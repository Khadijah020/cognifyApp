import * as Location from "expo-location";
import { Accelerometer } from "expo-sensors";
import { Alert, Vibration } from "react-native";
import { ApiService } from "./ApiService";
import { supabase } from "../src/lib/supabase";

class FallDetectionService {
  private subscription: any = null;
  private impactDetected = false;
  private fallStartTime: number | null = null;
  private stillnessStartTime: number | null = null;
  private fallAlertSent = false;

  // --- Video fall polling state ---
  private videoPollingInterval: ReturnType<typeof setInterval> | null = null;
  private seenVideoFallIds = new Set<string>();

  // --- Start sensor-based detection ---
  start(patientId: string, caregiverId: string) {
    if (this.subscription) return;

    Accelerometer.setUpdateInterval(100);

    this.subscription = Accelerometer.addListener((data) => {
      this.detectFall(data, patientId, caregiverId);
    });

    console.log("✅ Sensor fall detection started");
  }

  // --- Stop sensor-based detection ---
  stop() {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
      console.log("🛑 Sensor fall detection stopped");
    }
  }

  // --- Start polling backend for video-detected falls (patient device alert only) ---
  startVideoPolling(patientId: string, caregiverId: string) {
    if (this.videoPollingInterval) return;

    console.log("📹 Video fall polling started (patient side)");

    const poll = async () => {
      try {
        const response = await ApiService.getBackendFallAlerts(caregiverId, patientId);

        for (const backendAlert of response.alerts) {
          const fallId =
            backendAlert.id ||
            `${backendAlert.patient_id}:${backendAlert.timestamp || backendAlert.created_at}`;

          if (this.seenVideoFallIds.has(fallId)) continue;
          this.seenVideoFallIds.add(fallId);

          console.log("🚨 Video fall detected on patient device:", backendAlert);

          Vibration.vibrate([0, 500, 200, 500]);
          Alert.alert(
            "Fall Detected by Camera",
            `A fall was detected by the camera. Please call for help if needed.`,
            [{ text: "OK" }]
          );
        }
      } catch (err) {
        console.log("Video fall polling error:", err);
      }
    };

    poll();
    this.videoPollingInterval = setInterval(poll, 5000);
  }

  // --- Stop video fall polling ---
  stopVideoPolling() {
    if (this.videoPollingInterval) {
      clearInterval(this.videoPollingInterval);
      this.videoPollingInterval = null;
      console.log("🛑 Video fall polling stopped");
    }
  }

  // --- Core sensor fall detection logic ---
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

    if (acceleration > impactThreshold && !this.impactDetected) {
      this.impactDetected = true;
      this.fallStartTime = Date.now();
      this.stillnessStartTime = null;
      console.log("💥 Impact detected");
    }

    if (this.impactDetected && this.fallStartTime && !this.fallAlertSent) {
      const elapsed = Date.now() - this.fallStartTime;

      if (elapsed > 2000) {
        if (stillness) {
          if (!this.stillnessStartTime) {
            this.stillnessStartTime = Date.now();
          } else {
            const stillElapsed = Date.now() - this.stillnessStartTime;

            if (stillElapsed >= 8000) {
              this.fallAlertSent = true;
              console.log("🚨 Sensor fall confirmed, sending alert...");

              Vibration.vibrate();
              Alert.alert("⚠️ Fall Detected", "A fall has been detected!");

              await this.sendAlert(patientId, caregiverId);

              setTimeout(() => this.reset(), 5000);
            }
          }
        } else {
          this.reset();
        }
      }

      if (elapsed > 20000) {
        this.reset();
      }
    }
  }

  private reset() {
    this.impactDetected = false;
    this.fallStartTime = null;
    this.stillnessStartTime = null;
    this.fallAlertSent = false;
  }

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
