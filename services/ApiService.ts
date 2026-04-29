const NGROK_BASE_URL = 'https://3be3dc176e4c.ngrok-free.app';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Backend notebook ngrok URL - can be overridden by user in settings.
// The backend notebook itself calls the vision notebook through VISION_SERVICE_URL.
const DEFAULT_NGROK_URL = 'https://33d8-34-50-168-11.ngrok-free.app';
const NGROK_URL_STORAGE_KEY = 'cognify_ngrok_url';
const STALE_NGROK_URLS = new Set([
  'https://a740dc4389a4.ngrok-free.app',
  'https://3ec9-34-125-182-35.ngrok-free.app',
  'https://e0ee-136-117-84-242.ngrok-free.app',
]);

// In-memory cache for the URL (to avoid async calls every time)
let cachedNgrokUrl: string | null = null;

const resolveNgrokUrl = (storedUrl: string | null): string => {
  if (!storedUrl || STALE_NGROK_URLS.has(storedUrl)) {
    return DEFAULT_NGROK_URL;
  }

  return storedUrl;
};


export class ApiService {
  /**
   * Initialize the cached URL from storage (call this on app start)
   */
  static async initialize(): Promise<void> {
    try {
      const storedUrl = await AsyncStorage.getItem(NGROK_URL_STORAGE_KEY);
      cachedNgrokUrl = resolveNgrokUrl(storedUrl);
      if (storedUrl && storedUrl !== cachedNgrokUrl) {
        await AsyncStorage.setItem(NGROK_URL_STORAGE_KEY, cachedNgrokUrl);
      }
      console.log('📡 ApiService initialized with URL:', cachedNgrokUrl);
    } catch (error) {
      console.error('Error initializing ApiService:', error);
      cachedNgrokUrl = DEFAULT_NGROK_URL;
    }
  }

  /**
   * Get the ngrok URL (sync - uses cached value)
   */
  static getNgrokUrl(): string {
    const url = cachedNgrokUrl || DEFAULT_NGROK_URL;
    console.log('📡 getNgrokUrl() returning:', url);
    return url;
  }

  /**
   * Get the full API endpoint URL
   */
  static getApiEndpoint(path: string): string {
    const baseUrl = this.getNgrokUrl();
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const fullUrl = `${baseUrl}${cleanPath}`;
    console.log('🔗 getApiEndpoint:', fullUrl);
    return fullUrl;
  }

  /**
   * Get the ngrok URL (async - ALWAYS reads fresh from storage)
   */
  static async getNgrokUrlAsync(): Promise<string> {
    try {
      const storedUrl = await AsyncStorage.getItem(NGROK_URL_STORAGE_KEY);
      cachedNgrokUrl = resolveNgrokUrl(storedUrl);
      if (storedUrl && storedUrl !== cachedNgrokUrl) {
        await AsyncStorage.setItem(NGROK_URL_STORAGE_KEY, cachedNgrokUrl);
      }
      return cachedNgrokUrl;
    } catch (error) {
      console.error('Error getting ngrok URL:', error);
      return cachedNgrokUrl || DEFAULT_NGROK_URL;
    }
  }

  /**
   * Force refresh the cached URL from storage
   */
  static async refreshCache(): Promise<void> {
    try {
      const storedUrl = await AsyncStorage.getItem(NGROK_URL_STORAGE_KEY);
      cachedNgrokUrl = resolveNgrokUrl(storedUrl);
      if (storedUrl && storedUrl !== cachedNgrokUrl) {
        await AsyncStorage.setItem(NGROK_URL_STORAGE_KEY, cachedNgrokUrl);
      }
      console.log('🔄 ApiService cache refreshed:', cachedNgrokUrl);
    } catch (error) {
      console.error('Error refreshing cache:', error);
    }
  }

  /**
   * Save the ngrok URL to storage and update cache
   */
  static async saveNgrokUrl(url: string): Promise<void> {
    try {
      // Remove trailing slash if present
      const cleanUrl = url.replace(/\/+$/, '');
      await AsyncStorage.setItem(NGROK_URL_STORAGE_KEY, cleanUrl);
      cachedNgrokUrl = cleanUrl;
      console.log('✅ Ngrok URL saved:', cleanUrl);
    } catch (error) {
      console.error('Error saving ngrok URL:', error);
      throw error;
    }
  }

  /**
   * Clear the saved ngrok URL (reverts to default)
   */
  static async clearNgrokUrl(): Promise<void> {
    try {
      await AsyncStorage.removeItem(NGROK_URL_STORAGE_KEY);
      cachedNgrokUrl = DEFAULT_NGROK_URL;
      console.log('🗑️ Ngrok URL cleared, using default');
    } catch (error) {
      console.error('Error clearing ngrok URL:', error);
      throw error;
    }
  }

  /**
   * Get default headers for API calls (includes ngrok bypass header)
   */
  static getHeaders(contentType: string = 'application/json'): Record<string, string> {
    return {
      'Content-Type': contentType,
      'ngrok-skip-browser-warning': 'true', // Skip ngrok interstitial page
    };
  }

  /**
   * Post audio file to the ngrok endpoint for STT processing
   */
  static async sendAudioForSTT(audioUri: string): Promise<{ transcript: string }> {
    try {
      const endpoint = this.getApiEndpoint('/upload_audio');
      
      console.log('🚀 Sending audio to:', endpoint);
      console.log('📁 Audio file URI:', audioUri);
      
      const formData = new FormData();
      formData.append('file', {
        uri: audioUri,
        type: 'audio/m4a',
        name: 'voice_recording.m4a',
      } as any);

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
          'ngrok-skip-browser-warning': 'true',
        },
      });

      console.log('📡 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Server error:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Received transcript:', result.transcript);
      return result;
    } catch (error) {
      console.error('❌ Error sending audio for STT:', error);
      throw error;
    }
  }

  /**
   * Send audio for task guidance (step-by-step instructions)
   */
  static async sendAudioForTaskGuidance(audioUri: string): Promise<any> {
    try {
      const endpoint = this.getApiEndpoint('/task_guidance');
      
      console.log('🎯 Sending audio for task guidance to:', endpoint);
      
      const formData = new FormData();
      formData.append('file', {
        uri: audioUri,
        type: 'audio/m4a',
        name: 'task_query.m4a',
      } as any);

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Task guidance error:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Task guidance response:', result);
      return result;
    } catch (error) {
      console.error('❌ Error in task guidance:', error);
      throw error;
    }
  }

  /**
   * Get active task guidance session
   */
  static async getActiveTaskSession(): Promise<any> {
    try {
      const endpoint = this.getApiEndpoint('/task_guidance/active_session');
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('❌ Error getting active session:', error);
      throw error;
    }
  }

  /**
   * Poll for step updates (next step delivery)
   */
  static async pollStepUpdates(): Promise<any> {
    try {
      const endpoint = this.getApiEndpoint('/task_guidance/step_updates');
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('❌ Error polling step updates:', error);
      throw error;
    }
  }

  /**
   * Poll backend-queued fall detections produced by video analysis.
   * Backend notebook endpoint: GET /get_fall_detections
   * Response shape: { status, count, fall_detections: [...] }
   */
  static async getBackendFallAlerts(caregiverId?: string, patientId?: string): Promise<{ alerts: any[] }> {
    try {
      const endpoint = this.getApiEndpoint('/get_fall_detections');
      const response = await fetch(endpoint, {
        headers: {
          'ngrok-skip-browser-warning': 'true',
        },
      });

      if (response.status === 404) {
        return { alerts: [] };
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      const fallDetections = result.fall_detections || result.alerts || result.fall_alerts || [];
      const matchingFalls = fallDetections
        .filter((item: any) => {
          if (item?.is_fall !== true) return false;
          if (
            caregiverId &&
            item.caregiver_id &&
            item.caregiver_id !== caregiverId &&
            item.caregiver_id !== 'caregiver123'
          ) {
            return false;
          }
          if (
            patientId &&
            item.patient_id &&
            item.patient_id !== patientId &&
            item.patient_id !== 'user123'
          ) {
            return false;
          }
          return true;
        })
        .map((item: any) => ({
          ...item,
          patient_id: item.patient_id === 'user123' ? patientId : item.patient_id,
          caregiver_id: item.caregiver_id === 'caregiver123' ? caregiverId : item.caregiver_id,
          status: item.status || 'active',
          source: item.source || 'video',
          created_at: item.created_at || item.timestamp || new Date().toISOString(),
        }));

      return {
        alerts: matchingFalls,
      };
    } catch (error) {
      console.error('Error polling backend fall alerts:', error);
      return { alerts: [] };
    }
  }

  /**
   * Send a sensor fall candidate to the backend fusion cache.
   * This does not write to Supabase; it is safe to ignore when backend support is absent.
   */
  static async submitSensorFallCandidate(candidate: {
    patient_id: string;
    caregiver_id: string;
    sensor_score: number;
    latitude?: number | null;
    longitude?: number | null;
  }): Promise<void> {
    try {
      const endpoint = this.getApiEndpoint('/fall_sensor_candidate');
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.getHeaders('application/json'),
        body: JSON.stringify(candidate),
      });

      if (response.status === 404) {
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.log('Sensor fall candidate was not sent to backend:', error);
    }
  }

  /**
   * Upload a video for step verification — simulates the camera stream sending a frame
   * to the backend so it can confirm step completion and trigger the next step.
   * Backend endpoint: POST /process_video
   */
  static async sendVideoForStepVerification(videoUri: string): Promise<any> {
    try {
      const endpoint = this.getApiEndpoint('/process_video');

      console.log('🎥 Sending video for step verification to:', endpoint);

      const formData = new FormData();
      formData.append('video', {
        uri: videoUri,
        type: 'video/mp4',
        name: 'step_verification.mp4',
      } as any);

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
          'ngrok-skip-browser-warning': 'true',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Video upload error:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Video verification response:', result);
      return result;
    } catch (error) {
      console.error('❌ Error sending video for step verification:', error);
      throw error;
    }
  }

  /**
   * Cancel active task session
   */
  static async cancelTaskSession(): Promise<any> {
    try {
      const endpoint = this.getApiEndpoint('/task_guidance/cancel_session');
      const response = await fetch(endpoint, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('❌ Error cancelling session:', error);
      throw error;
    }
  }
}
