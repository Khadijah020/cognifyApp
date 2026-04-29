import * as Battery from 'expo-battery';
import * as Location from 'expo-location';
import { supabase } from '../src/lib/supabase';

export type PatientDeviceStatus = {
  batteryLevel: number | null;
  batteryState: string | null;
  lowPowerMode: boolean | null;
  latitude: number | null;
  longitude: number | null;
  locationAccuracy: number | null;
  recordedAt: string;
  locationRecordedAt?: string | null;
};

const batteryStateLabel = (state: Battery.BatteryState | null | undefined) => {
  switch (state) {
    case Battery.BatteryState.UNPLUGGED:
      return 'unplugged';
    case Battery.BatteryState.CHARGING:
      return 'charging';
    case Battery.BatteryState.FULL:
      return 'full';
    case Battery.BatteryState.UNKNOWN:
      return 'unknown';
    default:
      return null;
  }
};

class PatientDeviceStatusService {
  async collectDeviceStatus(): Promise<PatientDeviceStatus> {
    const recordedAt = new Date().toISOString();
    const status: PatientDeviceStatus = {
      batteryLevel: null,
      batteryState: null,
      lowPowerMode: null,
      latitude: null,
      longitude: null,
      locationAccuracy: null,
      recordedAt,
    };

    try {
      const batteryAvailable = await Battery.isAvailableAsync();
      if (batteryAvailable) {
        const powerState = await Battery.getPowerStateAsync();
        status.batteryLevel =
          typeof powerState.batteryLevel === 'number' && powerState.batteryLevel >= 0
            ? Math.round(powerState.batteryLevel * 100)
            : null;
        status.batteryState = batteryStateLabel(powerState.batteryState);
        status.lowPowerMode = powerState.lowPowerMode ?? null;
      }
    } catch (error) {
      console.warn('Unable to read patient battery status:', error);
    }

    try {
      const { status: permissionStatus } = await Location.requestForegroundPermissionsAsync();
      if (permissionStatus === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        status.latitude = location.coords.latitude;
        status.longitude = location.coords.longitude;
        status.locationAccuracy = location.coords.accuracy ?? null;
      }
    } catch (error) {
      console.warn('Unable to read patient location status:', error);
    }

    return status;
  }

  async syncPatientDeviceStatus(patientId: string, status: PatientDeviceStatus): Promise<void> {
    const payload: Record<string, unknown> = {
      patient_id: patientId,
      battery_level: status.batteryLevel,
      battery_state: status.batteryState,
      low_power_mode: status.lowPowerMode,
      recorded_at: status.recordedAt,
      updated_at: new Date().toISOString(),
    };

    if (typeof status.latitude === 'number' && typeof status.longitude === 'number') {
      payload.latitude = status.latitude;
      payload.longitude = status.longitude;
      payload.location_accuracy = status.locationAccuracy;
      payload.location_recorded_at = status.recordedAt;
    }

    try {
      const { error } = await supabase
        .from('patient_device_status')
        .upsert(payload, { onConflict: 'patient_id' });

      if (error) {
        console.warn('Unable to sync patient device status:', error.message);
      }
    } catch (error) {
      console.warn('Unexpected error syncing patient device status:', error);
    }
  }

  async getPatientDeviceStatus(patientId: string): Promise<PatientDeviceStatus | null> {
    try {
      const { data, error } = await supabase
        .from('patient_device_status')
        .select(
          'battery_level, battery_state, low_power_mode, latitude, longitude, location_accuracy, location_recorded_at, recorded_at'
        )
        .eq('patient_id', patientId)
        .maybeSingle();

      if (error) {
        console.warn('Unable to load patient device status:', error.message);
        return null;
      }

      if (!data) return null;

      return {
        batteryLevel: typeof data.battery_level === 'number' ? data.battery_level : null,
        batteryState: data.battery_state || null,
        lowPowerMode: typeof data.low_power_mode === 'boolean' ? data.low_power_mode : null,
        latitude: typeof data.latitude === 'number' ? data.latitude : null,
        longitude: typeof data.longitude === 'number' ? data.longitude : null,
        locationAccuracy:
          typeof data.location_accuracy === 'number' ? data.location_accuracy : null,
        recordedAt: data.recorded_at,
        locationRecordedAt: data.location_recorded_at || null,
      };
    } catch (error) {
      console.warn('Unexpected error loading patient device status:', error);
      return null;
    }
  }
}

export default new PatientDeviceStatusService();
