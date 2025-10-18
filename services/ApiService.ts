import * as FileSystemLegacy from 'expo-file-system/legacy';

// ⚠️ HARDCODED NGROK URL - Replace with your actual ngrok URL
const NGROK_BASE_URL = 'https://823cca0d889f.ngrok-free.app';

export class ApiService {
  /**
   * Get the ngrok URL (hardcoded for now, will use DB later)
   */
  static getNgrokUrl(): string {
    return NGROK_BASE_URL;
  }

  /**
   * Get the full API endpoint URL
   */
  static getApiEndpoint(path: string): string {
    const baseUrl = this.getNgrokUrl();
    // Ensure path starts with /
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${cleanPath}`;
  }

  /**
   * Post audio file to the ngrok endpoint for STT processing
   */
  static async sendAudioForSTT(audioUri: string): Promise<{ transcript: string }> {
    try {
      const endpoint = this.getApiEndpoint('/upload_audio');
      
      console.log('🚀 Sending audio to:', endpoint);
      console.log('📁 Audio file URI:', audioUri);
      
      // Use FileSystem.uploadAsync for better compatibility with iOS
      // This method handles file reading and multipart form data automatically
      const uploadResult = await FileSystemLegacy.uploadAsync(endpoint, audioUri, {
        httpMethod: 'POST',
        uploadType: FileSystemLegacy.FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        headers: {
          'Accept': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      });

      console.log('📡 Response status:', uploadResult.status);
      console.log('📡 Response body:', uploadResult.body);

      if (uploadResult.status !== 200) {
        console.error('❌ Server error:', uploadResult.body);
        throw new Error(`HTTP error! status: ${uploadResult.status}`);
      }

      const result = JSON.parse(uploadResult.body);
      console.log('✅ Received transcript:', result.transcript);
      return result;
    } catch (error) {
      console.error('❌ Error sending audio for STT:', error);
      throw error;
    }
  }

  /**
   * Get local model output from the backend queue
   */
  static async getLocalModelOutput(): Promise<{ 
    status: string; 
    has_output: boolean; 
    data?: string; 
    message?: string 
  }> {
    try {
      const endpoint = this.getApiEndpoint('/get_local_Model_output');
      
      console.log('🔍 Polling local model output:', endpoint);
      
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      });

      if (!response.ok) {
        console.error('❌ HTTP error:', response.status);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Local model output response:', result);
      return result;
    } catch (error) {
      console.error('❌ Error getting local model output:', error);
      throw error;
    }
  }
}
