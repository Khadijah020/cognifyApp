import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pedometer } from 'expo-sensors';
import { supabase } from '../src/lib/supabase';

const MOCK_HEALTH_DATA_KEY = '@cognify_mock_health_data';
const REAL_STEPS_CACHE_KEY = '@cognify_real_steps_cache';

// Platform-specific health data source types
type HealthDataSource = 'apple_healthkit' | 'google_fit' | 'pedometer' | 'mock';

export type DailyHealthData = {
  steps: number;
  activeMinutes: number;
  date: string;
  recordedAt?: string;
};

class HealthDataService {
  private pedometerAvailable = false;
  private healthKitAvailable = false;
  private googleFitAvailable = false;
  private currentSource: HealthDataSource = 'mock';
  private isInitialized = false;
  
  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    await this.initializeMockDataIfNeeded();
    await this.checkAvailableSources();
    this.isInitialized = true;
  }

  /**
   * Check which health data sources are available on this device
   */
  private async checkAvailableSources(): Promise<void> {
    try {
      // Check platform-specific health APIs
      if (Platform.OS === 'ios') {
        // For iOS, we'll try HealthKit first, then fall back to Pedometer
        // Note: HealthKit requires react-native-health package and proper entitlements
        // For now, we use Pedometer which reads from HealthKit when available
        this.healthKitAvailable = await this.checkHealthKitAvailability();
        console.log('📱 iOS - HealthKit available:', this.healthKitAvailable);
      } else if (Platform.OS === 'android') {
        // For Android, we'll try Google Fit first, then fall back to Pedometer
        // Note: Google Fit requires react-native-google-fit package
        this.googleFitAvailable = await this.checkGoogleFitAvailability();
        console.log('📱 Android - Google Fit available:', this.googleFitAvailable);
      }

      // Check Pedometer availability (works on both platforms via CoreMotion/Android sensors)
      this.pedometerAvailable = await Pedometer.isAvailableAsync();
      console.log('📱 Pedometer available:', this.pedometerAvailable);

      // Determine the best available source
      this.currentSource = this.determineBestSource();
      console.log('📱 Using health data source:', this.currentSource);
    } catch (error) {
      console.log('Error checking health data sources:', error);
      this.currentSource = 'mock';
    }
  }

  /**
   * Check if Apple HealthKit is available (iOS only)
   * Note: This requires react-native-health package for full functionality
   * The Pedometer API on iOS uses CoreMotion which can read from HealthKit
   */
  private async checkHealthKitAvailability(): Promise<boolean> {
    if (Platform.OS !== 'ios') return false;
    
    try {
      // expo-sensors Pedometer on iOS uses CoreMotion which integrates with HealthKit
      // For full HealthKit access, you would need react-native-health
      // For now, we rely on Pedometer which gives us step data from the device
      const isAvailable = await Pedometer.isAvailableAsync();
      return isAvailable;
    } catch (error) {
      console.log('HealthKit check error:', error);
      return false;
    }
  }

  /**
   * Check if Google Fit is available (Android only)
   * Note: This requires react-native-google-fit package for full functionality
   * The Pedometer API on Android uses the device's step counter sensor
   */
  private async checkGoogleFitAvailability(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    
    try {
      // expo-sensors Pedometer on Android uses the step counter sensor
      // For full Google Fit access, you would need react-native-google-fit
      // For now, we rely on Pedometer which gives us step data from the device sensor
      const isAvailable = await Pedometer.isAvailableAsync();
      return isAvailable;
    } catch (error) {
      console.log('Google Fit check error:', error);
      return false;
    }
  }

  /**
   * Determine the best health data source based on platform and availability
   */
  private determineBestSource(): HealthDataSource {
    if (Platform.OS === 'ios') {
      if (this.healthKitAvailable || this.pedometerAvailable) {
        // On iOS, Pedometer uses CoreMotion which integrates with HealthKit
        return 'apple_healthkit';
      }
    } else if (Platform.OS === 'android') {
      if (this.googleFitAvailable || this.pedometerAvailable) {
        // On Android, Pedometer uses the step counter sensor
        return 'google_fit';
      }
    }
    
    if (this.pedometerAvailable) {
      return 'pedometer';
    }
    
    return 'mock';
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

  /**
   * Get the current health data source being used
   */
  getDataSource(): { source: HealthDataSource; platform: string } {
    return {
      source: this.currentSource,
      platform: Platform.OS
    };
  }

  async getStepCount(): Promise<number> {
    try {
      await this.initialize();
      
      // Try platform-specific source first
      if (Platform.OS === 'ios' && (this.healthKitAvailable || this.pedometerAvailable)) {
        console.log('📱 iOS: Getting steps from HealthKit/CoreMotion...');
        return await this.getIOSStepCount();
      } else if (Platform.OS === 'android' && (this.googleFitAvailable || this.pedometerAvailable)) {
        console.log('📱 Android: Getting steps from Google Fit/Sensor...');
        return await this.getAndroidStepCount();
      } else if (this.pedometerAvailable) {
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
      steps: hasHealthData,
      activeMinutes: hasHealthData,
      source: this.currentSource,
      platform: Platform.OS
    };
  }

  async requestHealthPermissions(): Promise<boolean> {
    try {
      await this.initialize();
      
      if (Platform.OS === 'ios') {
        // On iOS, the Pedometer API will prompt for HealthKit permissions when accessed
        console.log('📱 iOS: Requesting HealthKit/Motion permissions...');
        const isAvailable = await Pedometer.isAvailableAsync();
        this.pedometerAvailable = isAvailable;
        this.healthKitAvailable = isAvailable;
        return isAvailable;
      } else if (Platform.OS === 'android') {
        // On Android, the Pedometer API uses the step counter sensor
        // For Google Fit, additional OAuth flow would be needed
        console.log('📱 Android: Requesting step sensor permissions...');
        const isAvailable = await Pedometer.isAvailableAsync();
        this.pedometerAvailable = isAvailable;
        return isAvailable;
      }
      
      return false;
    } catch (error) {
      console.log('Error requesting health permissions:', error);
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
   * Uses platform-specific APIs (HealthKit on iOS, step sensor on Android)
   */
  async getWeeklyStepHistory(): Promise<Array<{ date: string; steps: number; source: string }>> {
    try {
      await this.initialize();
      
      const hasHealthAccess = this.pedometerAvailable || this.healthKitAvailable || this.googleFitAvailable;
      
      if (!hasHealthAccess) {
        console.log('📱 No health APIs available for weekly history, using mock data');
        return this.getMockWeeklyData();
      }

      const weeklyData: Array<{ date: string; steps: number; source: string }> = [];
      const today = new Date();
      const sourceInfo = this.getDataSource();
      
      console.log(`📱 ${sourceInfo.platform}: Getting weekly step history from ${sourceInfo.source}...`);
      
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
            steps: result.steps || 0,
            source: sourceInfo.source
          });
        } catch (error) {
          console.log(`Error getting steps for ${date.toDateString()}:`, error);
          weeklyData.push({
            date: date.toDateString(),
            steps: 0, // Use 0 instead of mock for failed days
            source: 'unavailable'
          });
        }
      }
      
      return weeklyData;
    } catch (error) {
      console.log('Error getting weekly step history:', error);
      return this.getMockWeeklyData();
    }
  }

  private getMockWeeklyData(): Array<{ date: string; steps: number; source: string }> {
    const weeklyData: Array<{ date: string; steps: number; source: string }> = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      weeklyData.push({
        date: date.toDateString(),
        steps: this.generateMockSteps(),
        source: 'mock'
      });
    }
    
    return weeklyData;
  }
}

export default new HealthDataService();
