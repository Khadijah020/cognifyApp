import { MaterialIcons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Audio } from 'expo-av';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { RootStackParamList } from '../app/App';
import { ApiService } from '../services/ApiService';

import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from '@expo-google-fonts/poppins';

type Props = NativeStackScreenProps<RootStackParamList, 'VoiceAssistant'>;

const C = {
  overlayFrom: 'rgba(96,165,250,0.9)',
  overlayTo: 'rgba(167,139,250,0.9)',
  white: '#fff',
  white20: 'rgba(255,255,255,0.2)',
  white30: 'rgba(255,255,255,0.3)',
};

export default function VoiceAssistantScreen({ navigation }: Props) {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioUri, setAudioUri] = useState<string>('');
  const [transcript, setTranscript] = useState<string>('');
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.stagger(700, [
        Animated.timing(ring1, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(ring2, { toValue: 1, duration: 1800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [ring1, ring2]);

  // Clean up ALL audio recordings from cache on app start
  const cleanupAllRecordings = async () => {
    try {
      console.log('🧹 Starting cleanup of all old recordings...');
      
      // Use the known cache path pattern from the logs
      // Path: Library/Caches/ExponentExperienceData/@anonymous/cognify-xxx/AV/
      const baseCache = FileSystemLegacy.documentDirectory?.replace('Documents/', 'Caches/');
      
      if (!baseCache) {
        console.log('⚠️ Could not determine cache directory');
        return;
      }
      
      // Build the full path to the AV directory
      const avPath = `${baseCache}ExponentExperienceData/@anonymous/cognify-2a62085b-c124-4e0b-b4ad-6a29d100395c/AV/`;
      
      console.log('🔍 Checking cache directory:', avPath);
      
      const dirInfo = await FileSystemLegacy.getInfoAsync(avPath);
      if (!dirInfo.exists) {
        console.log('⚠️ AV cache directory does not exist yet');
        return;
      }
      
      // Read all files in the directory
      const files = await FileSystemLegacy.readDirectoryAsync(avPath);
      console.log(`📁 Found ${files.length} file(s) in cache directory`);
      
      // Delete ALL .m4a files
      let deletedCount = 0;
      for (const file of files) {
        if (file.endsWith('.m4a')) {
          const filePath = `${avPath}${file}`;
          await FileSystemLegacy.deleteAsync(filePath, { idempotent: true });
          deletedCount++;
          console.log('🗑️ Deleted old recording:', file);
        }
      }
      
      if (deletedCount > 0) {
        console.log(`✅ Cleaned up ${deletedCount} old recording(s)`);
      } else {
        console.log('✨ No old recordings to clean up');
      }
    } catch (error) {
      console.log('⚠️ Could not clean up old recordings:', error);
    }
  };

  // Clean up old audio recordings from cache (called after recording)
  const cleanupOldRecordingsFromUri = async (sampleUri: string) => {
    try {
      // Extract directory path from a sample URI
      const lastSlash = sampleUri.lastIndexOf('/');
      if (lastSlash === -1) return;
      
      const cacheDir = sampleUri.substring(0, lastSlash);
      console.log('🔍 Checking cache directory:', cacheDir);
      
      const dirInfo = await FileSystemLegacy.getInfoAsync(cacheDir);
      if (!dirInfo.exists) {
        console.log('⚠️ Cache directory does not exist');
        return;
      }
      
      // Read all files in the directory
      const files = await FileSystemLegacy.readDirectoryAsync(cacheDir);
      console.log(`📁 Found ${files.length} file(s) in cache directory`);
      
      // Delete all .m4a files except the current one
      let deletedCount = 0;
      const currentFileName = sampleUri.substring(lastSlash + 1);
      
      for (const file of files) {
        if (file.endsWith('.m4a') && file !== currentFileName) {
          const filePath = `${cacheDir}/${file}`;
          await FileSystemLegacy.deleteAsync(filePath, { idempotent: true });
          deletedCount++;
          console.log('🗑️ Deleted old recording:', file);
        }
      }
      
      if (deletedCount > 0) {
        console.log(`✅ Cleaned up ${deletedCount} old recording(s)`);
      } else {
        console.log('✨ No old recordings to clean up');
      }
    } catch (error) {
      console.log('⚠️ Could not clean up old recordings:', error);
    }
  };

  useEffect(() => {
    (async () => {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Audio recording permission is required.');
      }
      
      // Clean up ALL old recordings when the screen loads
      await cleanupAllRecordings();
    })();

    return () => {
      // Cleanup on unmount
      if (recording) {
        recording.stopAndUnloadAsync().catch(console.error);
      }
      // Delete audio file if it exists when component unmounts
      if (audioUri) {
        FileSystemLegacy.deleteAsync(audioUri, { idempotent: true }).catch(console.error);
      }
    };
  }, [recording, audioUri]);

  const startRecording = async () => {
    try {
      setAudioUri('');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(newRecording);
      setIsRecording(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording.');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      
      setRecording(null);
      setAudioUri(uri || '');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (uri) {
        // Clean up old recordings first (now we have a URI to work with)
        await cleanupOldRecordingsFromUri(uri);
        
        // Automatically send to server without confirmation
        sendAudioToColab(uri);
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  const sendAudioToColab = async (uri: string) => {
    try {
      console.log('🎤 Processing audio...');
      
      console.log('🎤 Processing audio...');
      
      // Send audio for STT processing
      const result = await ApiService.sendAudioForSTT(uri);
      
      // Delete the audio file immediately after successful upload
      try {
        await FileSystemLegacy.deleteAsync(uri, { idempotent: true });
        console.log('🗑️ Audio file deleted from device:', uri);
      } catch (deleteError) {
        console.error('⚠️ Failed to delete audio file:', deleteError);
      }
      
      // Process the transcript
      if (result.transcript) {
        setTranscript(result.transcript);
        console.log('📝 Transcript received:', result.transcript);
        console.log('📝 Transcript received:', result.transcript);
        handleCommand(result.transcript.trim().toLowerCase());
      }
    } catch (error) {
      console.error('❌ Error processing audio:', error);
      
      // Delete the audio file even if upload failed
      try {
        await FileSystemLegacy.deleteAsync(uri, { idempotent: true });
        console.log('🗑️ Audio file deleted from device after error');
      } catch (deleteError) {
        console.error('⚠️ Failed to delete audio file:', deleteError);
      }
      
      Alert.alert(
        'Error',
        'Failed to process audio. Make sure your ngrok URL is correct in ApiService.ts',
        'Failed to process audio. Make sure your ngrok URL is correct in ApiService.ts',
        [{ text: 'OK' }]
      );
    }
  };

  const handleCommand = async (text: string) => {
    const say = (msg: string) => Speech.speak(msg, { rate: 1.0, pitch: 1.0 });
    if (!text) return;
    if (text.includes('call') && text.includes('caregiver')) {
      say('Calling your caregiver.');
      const tel = 'tel:+11234567890';
      if (await Linking.canOpenURL(tel)) Linking.openURL(tel);
      return;
    }
    if (text.includes('location')) {
      say('Opening your location.');
      navigation.navigate('PatientLocation');
      return;
    }
    say("Sorry, I didn't quite get that.");
  };

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#000' }} />;
  }

  return (
    <View style={styles.fill}>
      <LinearGradient colors={[C.overlayFrom, C.overlayTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.overlay}>
        <View style={styles.centerTop}>
          <Text style={[styles.title, { fontFamily: 'Poppins_700Bold' }]}>
            {isRecording ? ' Recording...' : 'How can I help you?'}
          </Text>
          <Text style={[styles.subtitle, { fontFamily: 'Poppins_400Regular' }]}>
            {isRecording ? 'Tap stop when finished' : 'Tap mic to record'}
          </Text>
          {audioUri ? <Text style={[styles.statusText, { fontFamily: 'Poppins_500Medium' }]}> Audio recorded</Text> : null}
        </View>

        <View style={styles.micWrap}>
          <Animated.View
            style={[styles.ring, {
              transform: [{ scale: ring1.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.5] }) }],
              opacity: ring1.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
            }]}
          />
          <Animated.View
            style={[styles.ring, {
              transform: [{ scale: ring2.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.7] }) }],
              opacity: ring2.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0] }),
            }]}
          />

          <TouchableOpacity activeOpacity={0.9} onPress={isRecording ? stopRecording : startRecording} style={styles.micBtnShadow}>
            <LinearGradient colors={isRecording ? ['#ef4444', '#dc2626'] : ['#60a5fa', '#a78bfa']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.micBtn}>
              <MaterialIcons name={isRecording ? "stop" : "mic"} size={64} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.bottom}>
          <TouchableOpacity 
            activeOpacity={0.9} 
            onPress={async () => { 
              if (recording) recording.stopAndUnloadAsync().catch(console.error);
              // Delete audio file when canceling
              if (audioUri) {
                FileSystemLegacy.deleteAsync(audioUri, { idempotent: true }).catch(console.error);
              }
              navigation.goBack(); 
            }} 
            style={styles.cancelBtn}
          >
            <Text style={[styles.cancelText, { fontFamily: 'Poppins_600SemiBold' }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  overlay: { flex: 1, paddingHorizontal: 24, paddingTop: 120, paddingBottom: 32 },
  centerTop: { alignItems: 'center', marginBottom: 40 },
  title: { color: C.white, fontSize: 28, textAlign: 'center' },
  subtitle: { marginTop: 8, color: 'rgba(255,255,255,0.9)', fontSize: 18, textAlign: 'center' },
  statusText: { marginTop: 12, color: '#4ade80', fontSize: 16, textAlign: 'center' },
  micWrap: { alignItems: 'center', justifyContent: 'center', marginTop: 60, marginBottom: 40 },
  ring: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: C.white20 },
  micBtnShadow: { shadowColor: '#a78bfa', shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 6, borderRadius: 96 },
  micBtn: { width: 160, height: 160, borderRadius: 80, alignItems: 'center', justifyContent: 'center' },
  bottom: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  cancelBtn: { backgroundColor: C.white20, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 28, marginBottom: 20 },
  cancelText: { color: C.white, fontSize: 18 },
});
