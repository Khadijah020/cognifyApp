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
        { event: "INSERT", schema: "public", table: "fall_alerts" },
        async (payload) => {
          const alert = payload.new as FallAlert;
          if (alert.caregiver_id === caregiverId && alert.status === "active") {
            console.log("🚨 New fall alert:", alert);
            await this.sendNotification(alert);
            onAlert(alert);
          }
        }
      )
      .subscribe((status) => console.log("Listener status:", status));
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
      if (final !== "granted") return;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: "🚨 Fall Detected!",
          body: `Patient ${alert.patient_id} may have fallen.`,
          data: alert,
        },
        trigger: null,
      });
    } catch (e) {
      console.error("Notification error:", e);
    }
  }
}

export default new FallAlertListener();
