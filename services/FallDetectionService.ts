import * as Location from "expo-location";
import { Accelerometer } from "expo-sensors";
import { Alert, Vibration } from "react-native";
import * as Location from "expo-location";
import { ApiService } from "./ApiService";
import { supabase } from "../src/lib/supabase";

class FallDetectionService {
  private subscription: any = null;
  private impactDetected = false;
  private fallStartTime: number | null = null;
  private stillnessStartTime: number | null = null;
  private fallAlertSent = false; // ✅ new flag

  // --- Start detection ---
  start(patientId: string, caregiverId: string) {
    if (this.subscription) return;

    Accelerometer.setUpdateInterval(100);

    this.subscription = Accelerometer.addListener((data) => {
      this.detectFall(data, patientId, caregiverId);
    });

    console.log("✅ Fall detection started");
  }

  // --- Stop detection ---
  stop() {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
      console.log("🛑 Fall detection stopped");
    }
  }

  // --- Core fall detection logic ---
  private async detectFall(
    { x, y, z }: { x: number; y: number; z: number },
    patientId: string,
    caregiverId: string
  ) {
    const acceleration = Math.sqrt(x * x + y * y + z * z);

    const impactThreshold = 2.0;
    const stillnessMin = 0.8;
    const stillnessMax = 1.2;
    const stillness = acceleration > stillnessMin && acceleration < stillnessMax;

    // Step 1: detect strong impact
    if (acceleration > impactThreshold && !this.impactDetected) {
      this.impactDetected = true;
      this.fallStartTime = Date.now();
      this.stillnessStartTime = null;
      console.log("💥 Impact detected");
    }

    // Step 2: track stillness progression
    if (this.impactDetected && this.fallStartTime && !this.fallAlertSent) {
      const elapsed = Date.now() - this.fallStartTime;

      // After 2 seconds grace period, start checking stillness
      if (elapsed > 2000) {
        if (stillness) {
          if (!this.stillnessStartTime) {
            this.stillnessStartTime = Date.now();
          } else {
            const stillElapsed = Date.now() - this.stillnessStartTime;

            if (stillElapsed >= 8000) {
              // ✅ Confirm fall (only once)
              this.fallAlertSent = true;
              console.log("🚨 Fall confirmed, sending alert...");

              Vibration.vibrate();
              Alert.alert("⚠️ Fall Detected", "A fall has been detected!");

              await this.sendAlert(patientId, caregiverId);

              // small delay before resetting to avoid duplicate triggers
              setTimeout(() => this.reset(), 5000);
            }
          }
        } else {
          // Movement after impact cancels fall detection
          this.reset();
        }
      }

      // Timeout after 20s if no confirmation
      if (elapsed > 20000) {
        this.reset();
      }
    }
  }

  // --- Reset internal state ---
  private reset() {
    this.impactDetected = false;
    this.fallStartTime = null;
    this.stillnessStartTime = null;
    this.fallAlertSent = false;
  }

  // --- Send alert to Supabase ---
  private async sendAlert(patientId: string, caregiverId: string) {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let coords = {
        latitude: null as number | null,
        longitude: null as number | null,
      };

      if (status === "granted") {
        const location = await Location.getCurrentPositionAsync({});
        coords = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
      }

      const alert = {
        patient_id: patientId,
        caregiver_id: caregiverId,
        latitude: coords.latitude,
        longitude: coords.longitude,
        status: "active",
        created_at: new Date().toISOString(),
      };

      await ApiService.submitSensorFallCandidate({
        patient_id: patientId,
        caregiver_id: caregiverId,
        sensor_score: 0.92,
        latitude: coords.latitude,
        longitude: coords.longitude,
      });

      const { error } = await supabase.from("fall_alerts").insert([alert]);
      if (error) console.error("❌ Error saving fall alert:", error);
      else console.log("✅ Fall alert sent to Supabase!");
    } catch (err) {
      console.error("❌ Error sending fall alert:", err);
    }
  }
}

export default new FallDetectionService();
