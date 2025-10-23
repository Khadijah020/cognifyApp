import { supabase } from "../src/lib/supabase";
import * as Notifications from "expo-notifications";

export type FallAlert = {
  id: string;
  patient_id: string;
  caregiver_id: string;
  latitude?: number | null;
  longitude?: number | null;
  status?: "active" | "acknowledged" | "resolved";
  created_at?: string;
  patient_name?: string;
};

class FallAlertListener {
  private subscription: any = null;

  startListening(caregiverId: string, onAlert: (alert: FallAlert) => void): void {
    if (this.subscription) return;

    console.log(`👂 Listening for fall alerts for caregiver: ${caregiverId}`);

    this.subscription = supabase
      .channel("realtime:fall_alerts")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "fall_alerts",
        },
        async (payload) => {
          const alert = payload.new as FallAlert;

          // Check if this alert is for this caregiver
          if (alert.caregiver_id === caregiverId && alert.status === "active") {
            console.log("🚨 New fall alert received:", alert);

            // Fetch patient name from patients table
            try {
              const { data: patient, error } = await supabase
                .from("patients")
                .select("full_name")
                .eq("id", alert.patient_id)
                .single();

              if (!error && patient) {
                alert.patient_name = patient.full_name;
              }
            } catch (err) {
              console.error("❌ Error fetching patient name:", err);
            }

            await this.sendNotification(alert);
            onAlert(alert);
          }
        }
      )
      .subscribe((status) => console.log("📡 Fall alert listener status:", status));
  }

  stopListening() {
    if (this.subscription) {
      supabase.removeChannel(this.subscription);
      this.subscription = null;
      console.log("🛑 Stopped listening for fall alerts");
    }
  }

  private async sendNotification(alert: FallAlert) {
    try {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let final = existing;

      if (existing !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        final = status;
      }

      if (final !== "granted") {
        console.log("⚠️ Notification permissions not granted");
        return;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: "🚨 Fall Detected!",
          body: alert.patient_name 
            ? `${alert.patient_name} may have fallen.` 
            : "A patient may have fallen.",
          data: alert,
        },
        trigger: null,
      });

      console.log("✅ Notification sent successfully");
    } catch (e) {
      console.error("❌ Notification error:", e);
    }
  }
}

export default new FallAlertListener();