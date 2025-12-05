// ⚠️ HARDCODED NGROK URL - Replace with your actual ngrok URL
const NGROK_BASE_URL = 'https://bfabda320daf.ngrok-free.app';

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