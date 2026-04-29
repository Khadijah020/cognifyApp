import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pedometer } from 'expo-sensors';
import { supabase } from '../src/lib/supabase';

const MOCK_HEALTH_DATA_KEY = '@cognify_mock_health_data';

export type DailyHealthData = {
  steps: number;
  activeMinutes: number;
  date: string;
  recordedAt?: string;
};

class HealthDataService {
  private pedometerAvailable = false;
  
  constructor() {
    this.initializeMockDataIfNeeded();
    this.checkPedometerAvailability();
  }

  private async checkPedometerAvailability(): Promise<void> {
    try {
      this.pedometerAvailable = await Pedometer.isAvailableAsync();
      console.log('Pedometer available:', this.pedometerAvailable);
    } catch (error) {
      console.log('Error checking pedometer availability:', error);
      this.pedometerAvailable = false;
    }
  }

  private async initializeMockDataIfNeeded(): Promise<void> {
    try {
      const existingData = await AsyncStorage.getItem(MOCK_HEALTH_DATA_KEY);
      if (!existingData) {
        const initialData = {
          steps: this.generateMockSteps(),
          activeMinutes: this.generateMockActiveMinutes(),
          lastUpdated: new Date().toISOString()
        };
        await AsyncStorage.setItem(MOCK_HEALTH_DATA_KEY, JSON.stringify(initialData));
      }
    } catch (error) {
      console.log('Error initializing mock data:', error);
    }
  }

  async getStepCount(): Promise<number> {
    try {
      await this.checkPedometerAvailability();
      
      if (this.pedometerAvailable) {
        return await this.getPedometerStepCount();
      } else {
        console.log('Pedometer not available, using cached data');
        return (await this.getCachedRealStepCount()) ?? 0;
      }
    } catch (error) {
      console.log('Error getting steps from device APIs:', error);
      return (await this.getCachedRealStepCount()) ?? 0;
    }
  }

  async getTodayHealthData(): Promise<DailyHealthData> {
    const steps = await this.getStepCount();

    return {
      steps,
      activeMinutes: this.estimateActiveMinutes(steps),
      date: this.getLocalDateKey(),
      recordedAt: new Date().toISOString(),
    };
  }

  private async getPedometerStepCount(): Promise<number> {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
      // Get step count from device storage (works even when app was closed)
      const result = await Pedometer.getStepCountAsync(startOfDay, today);
      console.log('Device step count for today:', result.steps);
      
      // Store the real step count for offline access
      await this.saveRealStepCount(result.steps);
      
      return result.steps || 0;
    } catch (error) {
      console.log('Error getting steps from Pedometer, trying cached data:', error);
      // Try to get last cached real step count
      const cachedSteps = await this.getCachedRealStepCount();
      return cachedSteps ?? 0;
    }
  }

  async getActiveMinutes(): Promise<number> {
    try {
      const steps = await this.getStepCount();
      const estimatedMinutes = this.estimateActiveMinutes(steps);
      console.log('Estimated active minutes from steps:', estimatedMinutes);
      return estimatedMinutes;
    } catch (error) {
      console.log('Error getting active minutes:', error);
      return 0;
    }
  }

  private async getMockStepCount(): Promise<number> {
    try {
      const mockData = await AsyncStorage.getItem(MOCK_HEALTH_DATA_KEY);
      if (mockData) {
        const parsedData = JSON.parse(mockData);
        return parsedData.steps || this.generateMockSteps();
      }
      return this.generateMockSteps();
    } catch (error) {
      console.log('Error getting mock steps:', error);
      return this.generateMockSteps();
    }
  }

  private async getMockActiveMinutes(): Promise<number> {
    try {
      const mockData = await AsyncStorage.getItem(MOCK_HEALTH_DATA_KEY);
      if (mockData) {
        const parsedData = JSON.parse(mockData);
        return parsedData.activeMinutes || this.generateMockActiveMinutes();
      }
      return this.generateMockActiveMinutes();
    } catch (error) {
      console.log('Error getting mock active minutes:', error);
      return this.generateMockActiveMinutes();
    }
  }

  private generateMockSteps(): number {
    return Math.floor(3000 + Math.random() * 7000);
  }

  private generateMockActiveMinutes(): number {
    return Math.floor(30 + Math.random() * 90);
  }

  private estimateActiveMinutes(steps: number): number {
    if (steps <= 0) return 0;
    return Math.max(1, Math.min(120, Math.round(steps / 100)));
  }

  private getLocalDateKey(date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async syncPatientDailyHealthData(patientId: string, healthData: DailyHealthData): Promise<void> {
    try {
      const { data: existing, error: selectError } = await supabase
        .from('activity_metrics')
        .select('id')
        .eq('patient_id', patientId)
        .eq('day', healthData.date)
        .order('inserted_at', { ascending: false })
        .limit(1);

      if (selectError) {
        console.warn('Unable to check existing patient activity metrics:', selectError.message);
        return;
      }

      const payload = {
        patient_id: patientId,
        day: healthData.date,
        steps: healthData.steps,
        active_minutes: healthData.activeMinutes,
        inserted_at: healthData.recordedAt || new Date().toISOString(),
      };

      if (existing?.[0]?.id) {
        const { error } = await supabase
          .from('activity_metrics')
          .update(payload)
          .eq('id', existing[0].id);

        if (error) {
          console.warn('Unable to update patient activity metrics:', error.message);
        }
        return;
      }

      const { error } = await supabase.from('activity_metrics').insert(payload);
      if (error) {
        console.warn('Unable to insert patient activity metrics:', error.message);
      }
    } catch (error) {
      console.warn('Unexpected error syncing patient health data:', error);
    }
  }

  async getPatientDailyHealthData(patientId: string): Promise<DailyHealthData | null> {
    try {
      const today = this.getLocalDateKey();
      const { data, error } = await supabase
        .from('activity_metrics')
        .select('steps, active_minutes, day, inserted_at')
        .eq('patient_id', patientId)
        .eq('day', today)
        .order('inserted_at', { ascending: false })
        .limit(1);

      if (error) {
        console.warn('Unable to load patient health data:', error.message);
        return null;
      }

      const row = data?.[0];
      if (!row) return null;

      return {
        steps: Number(row.steps) || 0,
        activeMinutes: Number(row.active_minutes) || 0,
        date: String(row.day),
        recordedAt: row.inserted_at || undefined,
      };
    } catch (error) {
      console.warn('Unexpected error loading patient health data:', error);
      return null;
    }
  }

  async isHealthDataAvailable(): Promise<{ steps: boolean; activeMinutes: boolean }> {
    await this.checkPedometerAvailability();
    
    return {
      steps: this.pedometerAvailable,
      activeMinutes: this.pedometerAvailable,
    };
  }

  async requestHealthPermissions(): Promise<boolean> {
    try {
      const isAvailable = await Pedometer.isAvailableAsync();
      this.pedometerAvailable = isAvailable;
      console.log('Pedometer permissions check:', isAvailable);
      return isAvailable;
    } catch (error) {
      console.log('Error checking pedometer permissions:', error);
      return false;
    }
  }

  async saveMockHealthData(steps: number, activeMinutes: number): Promise<void> {
    try {
      const data = {
        steps,
        activeMinutes,
        lastUpdated: new Date().toISOString()
      };
      await AsyncStorage.setItem(MOCK_HEALTH_DATA_KEY, JSON.stringify(data));
    } catch (error) {
      console.log('Error saving mock health data:', error);
    }
  }

  /**
   * Save real step count data for caching when device API is unavailable
   */
  private async saveRealStepCount(steps: number): Promise<void> {
    try {
      const today = new Date().toDateString();
      const cacheKey = `@cognify_real_steps_${today}`;
      const data = {
        steps,
        date: today,
        timestamp: new Date().toISOString()
      };
      await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
      console.log('Cached real step count:', steps);
    } catch (error) {
      console.log('Error caching real step data:', error);
    }
  }

  /**
   * Get cached real step count if device API fails
   */
  private async getCachedRealStepCount(): Promise<number | null> {
    try {
      const today = new Date().toDateString();
      const cacheKey = `@cognify_real_steps_${today}`;
      const cachedData = await AsyncStorage.getItem(cacheKey);
      
      if (cachedData) {
        const parsedData = JSON.parse(cachedData);
        console.log('Using cached real step count:', parsedData.steps);
        return parsedData.steps;
      }
      
      return null;
    } catch (error) {
      console.log('Error getting cached real step data:', error);
      return null;
    }
  }

  /**
   * Get weekly step history (useful for showing user their activity patterns)
   */
  async getWeeklyStepHistory(): Promise<Array<{ date: string; steps: number }>> {
    try {
      await this.checkPedometerAvailability();
      
      if (!this.pedometerAvailable) {
        return this.getMockWeeklyData();
      }

      const weeklyData = [];
      const today = new Date();
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const endOfDay = new Date(startOfDay);
        endOfDay.setHours(23, 59, 59, 999);
        
        try {
          const result = await Pedometer.getStepCountAsync(startOfDay, endOfDay);
          weeklyData.push({
            date: date.toDateString(),
            steps: result.steps || 0
          });
        } catch (error) {
          console.log(`Error getting steps for ${date.toDateString()}:`, error);
          weeklyData.push({
            date: date.toDateString(),
            steps: this.generateMockSteps()
          });
        }
      }
      
      return weeklyData;
    } catch (error) {
      console.log('Error getting weekly step history:', error);
      return this.getMockWeeklyData();
    }
  }

  private getMockWeeklyData(): Array<{ date: string; steps: number }> {
    const weeklyData = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      weeklyData.push({
        date: date.toDateString(),
        steps: this.generateMockSteps()
      });
    }
    
    return weeklyData;
  }
}

export default new HealthDataService();
