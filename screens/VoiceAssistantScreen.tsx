import { MaterialIcons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
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

type TaskStep = {
  step_number: number;
  step_text: string;
  confidence_score: number;
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
  const [currentStep, setCurrentStep] = useState<TaskStep | null>(null);
  const [completedSteps, setCompletedSteps] = useState<TaskStep[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

  useEffect(() => {
    (async () => {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Audio recording permission is required.');
      }
    })();

    return () => {
      if (recording) {
        recording.stopAndUnloadAsync().catch(console.error);
      }
      stopPollingForSteps();
    };
  }, []);

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
        sendAudioForTaskGuidance(uri);
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  const sendAudioForTaskGuidance = async (uri: string) => {
  try {
    setIsProcessing(true);
    console.log('🎯 Processing task guidance request...');
    
    const result = await ApiService.sendAudioForTaskGuidance(uri);
    console.log('📦 Backend response:', JSON.stringify(result, null, 2));
    
    // FIX: Check for first_step instead of steps
    if (result.success && result.first_step) {
      const firstStep = result.first_step;
      console.log('✅ Setting first step:', firstStep);
      setCurrentStep(firstStep);
      
      // Speak first step
      Speech.speak(firstStep.step_text, { 
        rate: 0.9, 
        pitch: 1.0,
        language: 'en-US',
      });
      
      console.log('✅ First step spoken:', firstStep.step_text);
      console.log('🔄 Starting polling...');
      
      // Start polling for next steps
      startPollingForSteps();
    } else {
      console.log('❌ No first_step in response');
      Speech.speak("I couldn't understand that task. Please try again.");
    }
    
    setIsProcessing(false);
  } catch (error) {
    setIsProcessing(false);
    console.error('❌ Error processing task:', error);
    Alert.alert(
      'Error',
      'Failed to process your task request. Please check your connection.',
      [{ text: 'OK' }]
    );
  }
};

  const startPollingForSteps = () => {
    console.log('🔄 Polling started');
    // Clear any existing polling
    stopPollingForSteps();
    
    // Poll every 3 seconds for new steps
    pollingIntervalRef.current = setInterval(async () => {
      try {
        console.log('📡 Polling for updates...');
        const response = await ApiService.pollStepUpdates();
        console.log('📦 Poll response:', JSON.stringify(response, null, 2));
        
        if (response.has_update && response.update) {
          const update = response.update;
          console.log('🆕 Update received:', update.type);
          
          if (update.type === 'next_step' && update.step) {
            console.log('➡️ Moving to next step:', update.step.step_number);
            
            // New step received - use functional updates to avoid stale state
            setCurrentStep(prevStep => {
              console.log('📝 Previous step:', prevStep?.step_number);
              if (prevStep) {
                setCompletedSteps(prev => {
                  const newCompleted = [...prev, prevStep];
                  console.log('✅ Completed steps count:', newCompleted.length);
                  return newCompleted;
                });
              }
              console.log('🆕 New current step:', update.step.step_number);
              return update.step;
            });
            
            // Speak the new step
            Speech.speak(update.step.step_text, {
              rate: 0.9,
              pitch: 1.0,
              language: 'en-US',
            });
            
            console.log('📢 New step spoken:', update.step.step_text);
          } else if (update.type === 'task_complete') {
            console.log('🎉 Task complete!');
            
            // Task finished - mark current step as completed
            setCurrentStep(prevStep => {
              if (prevStep) {
                setCompletedSteps(prev => [...prev, prevStep]);
              }
              return null;
            });
            
            Speech.speak("Great job! You've completed all the steps.");
            stopPollingForSteps();
            
            // Reset after a delay
            setTimeout(() => {
              console.log('🔄 Resetting state');
              setCompletedSteps([]);
            }, 3000);
          }
        } else {
          console.log('⏳ No updates yet');
        }
      } catch (error) {
        console.error('❌ Error polling steps:', error);
      }
    }, 3000);
  };

  const stopPollingForSteps = () => {
    if (pollingIntervalRef.current) {
      console.log('⏹️ Stopping polling');
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const handleCancel = async () => {
    if (recording) {
      await recording.stopAndUnloadAsync().catch(console.error);
    }
    
    // Cancel active task session
    try {
      await ApiService.cancelTaskSession();
    } catch (error) {
      console.error('Error cancelling session:', error);
    }
    
    stopPollingForSteps();
    navigation.goBack();
  };

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#000' }} />;
  }

  return (
    <View style={styles.fill}>
      <LinearGradient colors={[C.overlayFrom, C.overlayTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.overlay}>
        <View style={styles.centerTop}>
          <Text style={[styles.title, { fontFamily: 'Poppins_700Bold' }]}>
            {isRecording ? 'Recording...' : isProcessing ? 'Processing...' : 'Ask for Help'}
          </Text>
          <Text style={[styles.subtitle, { fontFamily: 'Poppins_400Regular' }]}>
            {isRecording ? 'Tap stop when finished' : isProcessing ? 'Getting your steps...' : 'Describe what you need help with'}
          </Text>
        </View>

        {/* Current Step Display */}
        {currentStep && (
          <View style={styles.stepCard}>
            <Text style={[styles.stepNumber, { fontFamily: 'Poppins_700Bold' }]}>
              Step {currentStep.step_number}
            </Text>
            <Text style={[styles.stepText, { fontFamily: 'Poppins_500Medium' }]}>
              {currentStep.step_text}
            </Text>
          </View>
        )}

        {/* Completed Steps */}
        {completedSteps.length > 0 && (
          <ScrollView style={styles.completedSteps} showsVerticalScrollIndicator={false}>
            {completedSteps.map((step, index) => (
              <View key={index} style={styles.completedStepCard}>
                <MaterialIcons name="check-circle" size={20} color="#22c55e" />
                <Text style={[styles.completedStepText, { fontFamily: 'Poppins_400Regular' }]}>
                  Step {step.step_number}: {step.step_text}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}

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

          <TouchableOpacity 
            activeOpacity={0.9} 
            onPress={isRecording ? stopRecording : startRecording} 
            style={styles.micBtnShadow}
            disabled={isProcessing}
          >
            <LinearGradient 
              colors={isRecording ? ['#ef4444', '#dc2626'] : ['#60a5fa', '#a78bfa']} 
              start={{ x: 0, y: 0 }} 
              end={{ x: 1, y: 1 }} 
              style={styles.micBtn}
            >
              <MaterialIcons name={isRecording ? "stop" : "mic"} size={64} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.bottom}>
          <TouchableOpacity 
            activeOpacity={0.9} 
            onPress={handleCancel} 
            style={styles.cancelBtn}
          >
            <Text style={[styles.cancelText, { fontFamily: 'Poppins_600SemiBold' }]}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  overlay: { flex: 1, paddingHorizontal: 24, paddingTop: 120, paddingBottom: 32 },
  centerTop: { alignItems: 'center', marginBottom: 20 },
  title: { color: C.white, fontSize: 28, textAlign: 'center' },
  subtitle: { marginTop: 8, color: 'rgba(255,255,255,0.9)', fontSize: 18, textAlign: 'center' },
  stepCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  stepNumber: {
    fontSize: 14,
    color: '#6366f1',
    marginBottom: 8,
  },
  stepText: {
    fontSize: 18,
    color: '#1e293b',
    lineHeight: 26,
  },
  completedSteps: {
    maxHeight: 150,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  completedStepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  completedStepText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginLeft: 10,
    flex: 1,
  },
  micWrap: { alignItems: 'center', justifyContent: 'center', marginTop: 40, marginBottom: 40 },
  ring: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: C.white20 },
  micBtnShadow: { shadowColor: '#a78bfa', shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 6, borderRadius: 96 },
  micBtn: { width: 160, height: 160, borderRadius: 80, alignItems: 'center', justifyContent: 'center' },
  bottom: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  cancelBtn: { backgroundColor: C.white20, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 28, marginBottom: 20 },
  cancelText: { color: C.white, fontSize: 18 },
});