// services/FaceRecognitionService.ts

import axios from 'axios';
import * as Speech from 'expo-speech';

const BACKEND_URL = 'https://1bf760273912.ngrok-free.app';
let pollInterval: ReturnType<typeof setInterval> | null = null;


class FaceRecognitionService {
  static start(voiceEnabled: boolean = true) {
    if (pollInterval) return; // Already running
    
    console.log('🎭 Face recognition service started');
    
    pollInterval = setInterval(async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/get_face_recognitions`);
        const faces = res.data.faces || [];

        if (faces.length > 0) {
          for (const face of faces) {
            const message = `${face.name}, your ${face.relationship}, is here.`;
            
            console.log(`👤 ${message}`);
            
            if (voiceEnabled) {
              Speech.speak(message, {
                language: 'en-US',
                pitch: 1.0,
                rate: 0.9,
              });
            }
          }
        }
      } catch (err) {
        console.log('Error in face recognition service:', err);
      }
    }, 3000);
  }

  static stop() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
      console.log('🎭 Face recognition service stopped');
    }
  }
}

export default FaceRecognitionService;