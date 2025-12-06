import AsyncStorage from '@react-native-async-storage/async-storage';

// Default ngrok URL - can be overridden by user in settings
const DEFAULT_NGROK_URL = 'https://70d1d402dfeb.ngrok-free.app';
const NGROK_URL_STORAGE_KEY = 'cognify_ngrok_url';

// In-memory cache for the URL (to avoid async calls every time)
let cachedNgrokUrl: string | null = null;

export class ApiService {
  /**
   * Initialize the cached URL from storage (call this on app start)
   */
  static async initialize(): Promise<void> {
    try {
      const storedUrl = await AsyncStorage.getItem(NGROK_URL_STORAGE_KEY);
      cachedNgrokUrl = storedUrl || DEFAULT_NGROK_URL;
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
      cachedNgrokUrl = storedUrl || DEFAULT_NGROK_URL;
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
      cachedNgrokUrl = storedUrl || DEFAULT_NGROK_URL;
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