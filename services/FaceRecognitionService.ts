// services/FaceRecognitionService.ts

import axios from 'axios';
import * as Speech from 'expo-speech';

<<<<<<< HEAD
const BACKEND_URL = 'https://411c0df88fb6.ngrok-free.app';
=======
const BACKEND_URL = 'https://3be3dc176e4c.ngrok-free.app';
>>>>>>> b5c56e052d5998fb49ff0fa8db4bd28961b02f1b
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