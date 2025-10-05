import AsyncStorage from '@react-native-async-storage/async-storage';

const NGROK_URL_KEY = '@cognify_ngrok_url';

export class ApiService {
  /**
   * Save the ngrok URL to AsyncStorage
   */
  static async saveNgrokUrl(url: string): Promise<void> {
    try {
      // Remove trailing slash if present
      const cleanUrl = url.trim().replace(/\/$/, '');
      await AsyncStorage.setItem(NGROK_URL_KEY, cleanUrl);
    } catch (error) {
      console.error('Error saving ngrok URL:', error);
      throw error;
    }
  }

  /**
   * Get the ngrok URL from AsyncStorage
   */
  static async getNgrokUrl(): Promise<string | null> {
    try {
      const url = await AsyncStorage.getItem(NGROK_URL_KEY);
      return url;
    } catch (error) {
      console.error('Error getting ngrok URL:', error);
      return null;
    }
  }

  /**
   * Clear the saved ngrok URL
   */
  static async clearNgrokUrl(): Promise<void> {
    try {
      await AsyncStorage.removeItem(NGROK_URL_KEY);
    } catch (error) {
      console.error('Error clearing ngrok URL:', error);
      throw error;
    }
  }

  /**
   * Get the full API endpoint URL
   */
  static async getApiEndpoint(path: string): Promise<string> {
    const baseUrl = await this.getNgrokUrl();
    if (!baseUrl) {
      throw new Error('Ngrok URL not configured. Please set it in Settings > API Configuration.');
    }
    // Ensure path starts with /
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${cleanPath}`;
  }

  /**
   * Post audio file to the ngrok endpoint for STT processing
   */
  static async sendAudioForSTT(audioUri: string): Promise<{ transcript: string }> {
    try {
      const endpoint = await this.getApiEndpoint('/upload_audio');
      
      const formData = new FormData();
      formData.append('audio', {
        uri: audioUri,
        type: 'audio/m4a',
        name: 'voice_recording.m4a',
      } as any);

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error sending audio for STT:', error);
      throw error;
    }
  }
}
