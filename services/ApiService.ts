// ⚠️ HARDCODED NGROK URL - Replace with your actual ngrok URL
const NGROK_BASE_URL = 'https://1bf760273912.ngrok-free.app';

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
}
