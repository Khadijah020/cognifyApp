// PatientDashboardScreen.tsx - COMPLETE WITH DYNAMIC RECENT ACTIVITY

import React, { useEffect, useRef, useState } from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';

import * as Speech from 'expo-speech';

import { MaterialIcons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Linking,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { RootStackParamList } from '../app/App';
import FallDetectionService from "../services/FallDetectionService";
import HealthDataService from '../services/HealthDataService';

import PatientActivityService, { PatientActivity } from '../services/PatientActivityService';
import { getAuthenticatedPatientProfile } from '../services/PatientService';
import ReminderHelperService from '../services/ReminderHelperService';
import { supabase } from '../src/lib/supabase';

import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from '@expo-google-fonts/poppins';
import axios from 'axios';

type Props = NativeStackScreenProps<RootStackParamList, 'PatientDashboard'>;

type ReminderData = {
  id?: string;
  title: string;
  subtitle: string;
  icon: 'medication' | 'event';
  chipColor: string;
  chipBg: string;
  details?: {
    medication?: string;
    instructions?: string;
    note?: string;
  };
  status?: {
    time?: string;
    label?: string;
  };
};

// ✅ Face recognition data type
type RecognizedFace = {
  id: string;
  name: string;
  relationship: string;
  imageUri: string;
  dateAdded: string;
};

type FaceRecognitionData = {
  name: string;
  relationship: string;
  confidence: number;
  timestamp: string;
};

const C = {
  bgFrom: '#e0e7ff',
  bgTo: '#f0f4ff',
  white: '#ffffff',
  slate900: '#0f172a',
  slate800: '#1e293b',
  slate700: '#334155',
  slate600: '#475569',
  slate500: '#64748b',
  slate400: '#94a3b8',
  slate300: '#cbd5e1',
  indigo300: '#c7d2fe',
  indigo500: '#6366F1',
  green500: '#22c55e',
  green100: '#dcfce7',
  teal500: '#14b8a6',
  teal50: '#f0fdfa',
  purple100: '#f3e8ff',
  purple500: '#a855f7',
  blue50: '#eff6ff',
  blue300: '#93c5fd',
  shadow: 'rgba(0,0,0,0.06)',
  emerald400: '#34d399',
  emerald500: '#10b981',
};

const AVATAR =
  'https://lh3.googleusercontent.com/a/ACg8ocLw_b_95Zk8i_32X-y1xX8X2-wE9L7KzQ3qE6pB4P-5e_3A=s96-c-rg-br100';

const STORAGE_KEY = 'cognify_recognized_faces';
const BACKEND_URL = 'https://bfabda320daf.ngrok-free.app'; // ⚠️ Update this to match your backend

export default function PatientDashboardScreen({ navigation }: Props) {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const [steps, setSteps] = useState(0);
  const [activeMinutes, setActiveMinutes] = useState(0);
  
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patientName, setPatientName] = useState<string>('Patient');
  const [caregiverId, setCaregiverId] = useState<string | null>(null);
  const [upcomingReminders, setUpcomingReminders] = useState<ReminderData[]>([]);
  const [loadingReminders, setLoadingReminders] = useState(true);
  const [loading, setLoading] = useState(true);
  
  const [currentReminder, setCurrentReminder] = useState<ReminderData | null>(null);
  const [showReminderNotification, setShowReminderNotification] = useState(false);

  // Modal state for reminder details
  const [showReminder, setShowReminder] = useState(false);
  const [activeReminder, setActiveReminder] = useState<ReminderData | null>(null);

  // ✅ Face recognition popup state
  const [recognizedFace, setRecognizedFace] = useState<(RecognizedFace & { confidence?: number }) | null>(null);
  const [showFacePopup, setShowFacePopup] = useState(false);
  const [localFaces, setLocalFaces] = useState<RecognizedFace[]>([]);

  // ✅ NEW: Recent activities state
  const [recentActivities, setRecentActivities] = useState<PatientActivity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);

  // Modal animation
  const translateY = useRef(new Animated.Value(0)).current;
  const sheetHeight = useRef(0);
  const DRAG_CLOSE_THRESHOLD = 120;

  // ✅ Face popup animation
  const facePopupScale = useRef(new Animated.Value(0)).current;
  const facePopupOpacity = useRef(new Animated.Value(0)).current;

  const animateTo = (to: number, cb?: () => void) => {
    Animated.spring(translateY, {
      toValue: to,
      useNativeDriver: true,
      bounciness: 0,
      speed: 20,
    }).start(() => cb?.());
  };

  const openReminder = (data: ReminderData) => {
    setActiveReminder(data);
    setShowReminder(true);
    translateY.setValue(50);
    requestAnimationFrame(() => animateTo(0));
  };

  const closeReminder = () => {
    animateTo(sheetHeight.current || 300, () => {
      setShowReminder(false);
    });
  };
  
  const [contextualRemindersEnabled, setContextualRemindersEnabled] = useState(true);
  const [voiceAlertsEnabled, setVoiceAlertsEnabled] = useState(true);
  const [currentContextualReminder, setCurrentContextualReminder] = useState<string | undefined>(undefined);
  const [showContextualReminder, setShowContextualReminder] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
      onPanResponderMove: (_, g) => {
        const y = Math.max(0, g.dy);
        translateY.setValue(y);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DRAG_CLOSE_THRESHOLD || g.vy > 1.2) {
          closeReminder();
        } else {
          animateTo(0);
        }
      },
    })
  ).current;

  // ✅ Load local faces from storage
  useEffect(() => {
    loadLocalFaces();
  }, []);

  const loadLocalFaces = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setLocalFaces(JSON.parse(stored));
        console.log('✅ Loaded local faces:', JSON.parse(stored).length);
      }
    } catch (error) {
      console.error('❌ Error loading local faces:', error);
    }
  };

  // ✅ Animate face popup in
  const showFaceRecognitionPopup = (face: RecognizedFace & { confidence?: number }) => {
    setRecognizedFace(face);
    setShowFacePopup(true);
    
    facePopupScale.setValue(0.8);
    facePopupOpacity.setValue(0);
    
    Animated.parallel([
      Animated.spring(facePopupScale, {
        toValue: 1,
        tension: 100,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.timing(facePopupOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // ✅ Animate face popup out
  const hideFaceRecognitionPopup = () => {
    Animated.parallel([
      Animated.timing(facePopupScale, {
        toValue: 0.8,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(facePopupOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowFacePopup(false);
      setRecognizedFace(null);
    });
  };

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      setLoading(true);

      const patientProfile = await getAuthenticatedPatientProfile();
      
      if (!patientProfile) {
        Alert.alert('Error', 'Patient profile not found. Please log in again.');
        navigation.replace('Login');
        return;
      }

      console.log('✅ Patient profile loaded:', patientProfile.id, patientProfile.full_name);
      setPatientId(patientProfile.id);
      setPatientName(patientProfile.full_name || 'Patient');

      const caregiverIdFromProfile = patientProfile.caregiver_id;
      
      if (caregiverIdFromProfile) {
        console.log('✅ Caregiver ID found:', caregiverIdFromProfile);
        setCaregiverId(caregiverIdFromProfile);
        
        console.log('🚀 Starting fall detection service...');
        FallDetectionService.start(patientProfile.id, caregiverIdFromProfile);
        console.log('✅ Fall detection service started successfully');
      } else {
        console.warn('⚠️ No caregiver assigned to this patient');
        Alert.alert(
          'No Caregiver Assigned',
          'Fall detection requires a caregiver to be assigned to your account.',
          [{ text: 'OK' }]
        );
      }

    } catch (error) {
      console.error('❌ Error loading user data:', error);
      Alert.alert('Error', 'Failed to load dashboard.');
      navigation.replace('Login');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!patientId) return;

    loadUpcomingReminders();
    const interval = setInterval(loadUpcomingReminders, 5 * 60 * 1000);

    const subscription = supabase
      .channel('patient-reminders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reminders',
          filter: `patient_id=eq.${patientId}`,
        },
        () => {
          console.log('📡 Reminder changed - reloading list');
          loadUpcomingReminders();
          loadRecentActivities(); // ✅ Refresh activities when reminders change
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
      FallDetectionService.stop();
    };
  }, [patientId]);

  // ✅ NEW: Load recent activities when patient ID is available
  useEffect(() => {
    if (!patientId) return;

    loadRecentActivities();
    
    // Refresh activities every 2 minutes
    const interval = setInterval(loadRecentActivities, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, [patientId]);

  // ✅ NEW: Load recent activities function
  const loadRecentActivities = async () => {
    if (!patientId) return;

    try {
      setLoadingActivities(true);
      console.log('📋 Loading recent activities for patient:', patientId);
      
      const activities = await PatientActivityService.getRecentActivities(patientId, 10);
      
      setRecentActivities(activities);
      console.log('✅ Loaded', activities.length, 'recent activities');
    } catch (error) {
      console.error('❌ Error loading recent activities:', error);
    } finally {
      setLoadingActivities(false);
    }
  };

  useEffect(() => {
    if (!patientId) return;

    const checkForDueReminders = async () => {
      try {
        const { data: allReminders, error } = await supabase
          .from('reminders')
          .select('*')
          .eq('patient_id', patientId)
          .eq('status', 'pending');

        if (error || !allReminders) return;

        const now = new Date();
        
        const dueReminders = allReminders.filter(r => {
          const reminderTime = ReminderHelperService.parseReminderDateTime(r.date, r.time);
          const timeDiff = reminderTime.getTime() - now.getTime();
          
          return timeDiff >= -30 * 1000 && timeDiff < 2 * 60 * 1000;
        });

        if (dueReminders.length > 0 && !showReminderNotification) {
          const reminder = dueReminders[0];
          
          const lastShownKey = `reminder_shown_${reminder.id}`;
          const lastShownTime = await AsyncStorage.getItem(lastShownKey);
          
          if (lastShownTime) {
            const timeSinceShown = now.getTime() - parseInt(lastShownTime, 10);
            if (timeSinceShown < 5 * 60 * 1000) {
              console.log('⏭️ Skipping reminder - already shown recently:', reminder.title);
              return;
            }
          }
          
          const displayData = ReminderHelperService.convertToReminderData(reminder);
          
          console.log('⏰ SIMPLE REMINDER DUE NOW:', reminder.title, 'at', reminder.time);
          
          await AsyncStorage.setItem(lastShownKey, now.getTime().toString());
          
          setCurrentReminder(displayData);
          setShowReminderNotification(true);
        }
      } catch (error) {
        console.error('❌ Error checking due reminders:', error);
      }
    };

    checkForDueReminders();
    const reminderCheckInterval = setInterval(checkForDueReminders, 20 * 1000);

    return () => clearInterval(reminderCheckInterval);
  }, [patientId, showReminderNotification]);

  const loadUpcomingReminders = async () => {
    if (!patientId) return;

    try {
      setLoadingReminders(true);

      const { data: allReminders, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('patient_id', patientId)
        .eq('status', 'pending')
        .order('date', { ascending: true })
        .order('time', { ascending: true });

      if (error) throw error;

      console.log('📋 Fetched patient reminders:', allReminders?.length || 0);

      if (!allReminders || allReminders.length === 0) {
        setUpcomingReminders([]);
        return;
      }

      const upcoming = ReminderHelperService.filterUpcomingReminders(allReminders, 24);
      const displayReminders = upcoming.map(r =>
        ReminderHelperService.convertToReminderData(r)
      );

      setUpcomingReminders(displayReminders);
      console.log('✅ Loaded', displayReminders.length, 'upcoming reminders');
    } catch (error) {
      console.error('❌ Failed to load reminders:', error);
    } finally {
      setLoadingReminders(false);
    }
  };

  useEffect(() => {
    (async () => {
      const remindersPref = await AsyncStorage.getItem('contextualReminders');
      const voicePref = await AsyncStorage.getItem('voiceAlerts');
      if (remindersPref !== null) setContextualRemindersEnabled(remindersPref === 'true');
      if (voicePref !== null) setVoiceAlertsEnabled(voicePref === 'true');
    })();
  }, []);

  useEffect(() => {
    loadHealthData();
    const interval = setInterval(loadHealthData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadHealthData = async () => {
    try {
      const stepCount = await HealthDataService.getStepCount();
      const minutes = await HealthDataService.getActiveMinutes();
      setSteps(stepCount);
      setActiveMinutes(minutes);
    } catch (error) {
      console.log('Error loading health data:', error);
    }
  };

  useEffect(() => {
    if (!contextualRemindersEnabled) return;

    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/get_reminders`);
        const reminders = res.data.reminders || [];

        if (reminders.length > 0) {
          const reminderText = reminders[0].reminder || "You have a new reminder";

          setCurrentContextualReminder(reminderText);
          setShowContextualReminder(true);

          if (voiceAlertsEnabled) {
            Speech.speak(reminderText);
          }
        }
      } catch (err) {
        console.log('Error fetching contextual reminders:', err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [contextualRemindersEnabled, voiceAlertsEnabled]);

  // ✅ Poll for face recognitions with local face matching
  useEffect(() => {
  const interval = setInterval(async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/get_face_recognitions`);
      const faces: FaceRecognitionData[] = res.data.faces || [];

      if (faces.length > 0) {
        for (const faceData of faces) {
          // ✅ Check cooldown - don't show popup if shown within last hour
          const cooldownKey = `face_shown_${faceData.name.toLowerCase().trim()}`;
          const lastShownTime = await AsyncStorage.getItem(cooldownKey);
          
          if (lastShownTime) {
            const timeSinceShown = Date.now() - parseInt(lastShownTime, 10);
            const oneHourInMs = 60 * 60 * 1000; // 1 hour in milliseconds
            
            if (timeSinceShown < oneHourInMs) {
              console.log(`⏭️ Skipping ${faceData.name} - shown ${Math.round(timeSinceShown / 60000)} minutes ago`);
              continue; // Skip this person
            }
          }

          // Find matching local face
          const localFace = localFaces.find(
            f => f.name.toLowerCase().trim() === faceData.name.toLowerCase().trim()
          );

          // ✅ Set cooldown timestamp BEFORE showing popup
          await AsyncStorage.setItem(cooldownKey, Date.now().toString());

          // Show popup
          if (localFace) {
            showFaceRecognitionPopup({
              ...localFace,
              confidence: faceData.confidence,
            });

            if (voiceAlertsEnabled) {
              const message = `Hello! ${faceData.name}, your ${faceData.relationship}, is here.`;
              Speech.speak(message, {
                language: 'en-US',
                pitch: 1.0,
                rate: 0.9,
              });
            }
          } else {
            showFaceRecognitionPopup({
              id: Date.now().toString(),
              name: faceData.name,
              relationship: faceData.relationship,
              imageUri: '',
              dateAdded: new Date().toISOString(),
              confidence: faceData.confidence,
            });

            if (voiceAlertsEnabled) {
              const message = `Hello! ${faceData.name}, your ${faceData.relationship}, is here.`;
              Speech.speak(message, {
                language: 'en-US',
                pitch: 1.0,
                rate: 0.9,
              });
            }
          }

          // ✅ Refresh activities after face recognition
          loadRecentActivities();
        }
      }
    } catch (err) {
      console.log('Error fetching face recognitions:', err);
    }
  }, 3000);

  return () => clearInterval(interval);
}, [voiceAlertsEnabled, localFaces]);

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: C.bgTo }} />;

  const callCaregiver = async () => {
    const phone = '+11234567890';
    const url = `tel:${phone}`;
    const supported = await Linking.canOpenURL(url);
    if (!supported) Alert.alert('Call not available on this device');
    else Linking.openURL(url);
  };

  const MedicationReminderPopup: React.FC<{ visible: boolean; reminder: ReminderData | null; onClose: () => void }> = ({ visible, reminder, onClose }) => {
    const [timeRemaining, setTimeRemaining] = React.useState(300);
    const timerStartTimeRef = React.useRef<number | null>(null);
    const timerIntervalRef = React.useRef<number | null>(null);
    const autoCloseTimeoutRef = React.useRef<number | null>(null);

    React.useEffect(() => {
      if (visible && reminder) {
        console.log('⏱️ Starting 5-minute timer for reminder:', reminder.id);
        
        timerStartTimeRef.current = Date.now();
        setTimeRemaining(300);

        timerIntervalRef.current = window.setInterval(() => {
          if (timerStartTimeRef.current) {
            const elapsed = Math.floor((Date.now() - timerStartTimeRef.current) / 1000);
            const remaining = Math.max(0, 300 - elapsed);
            setTimeRemaining(remaining);
          }
        }, 1000);

        autoCloseTimeoutRef.current = window.setTimeout(() => {
          handleMissed();
        }, 300000);

        return () => {
          if (timerIntervalRef.current !== null) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
          }
          if (autoCloseTimeoutRef.current !== null) {
            clearTimeout(autoCloseTimeoutRef.current);
            autoCloseTimeoutRef.current = null;
          }
          timerStartTimeRef.current = null;
        };
      }
    }, [visible, reminder?.id]);

    const clearTimers = () => {
      if (timerIntervalRef.current !== null) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      if (autoCloseTimeoutRef.current !== null) {
        clearTimeout(autoCloseTimeoutRef.current);
        autoCloseTimeoutRef.current = null;
      }
      timerStartTimeRef.current = null;
    };

    const handleMissed = async () => {
      if (!reminder?.id) {
        clearTimers();
        onClose();
        return;
      }
      
      try {
        console.log('❌ Marking reminder as missed:', reminder.id);
        
        await supabase
          .from('reminders')
          .update({ status: 'missed' })
          .eq('id', reminder.id);
        
        console.log('✅ Reminder marked as missed');
        
        await AsyncStorage.removeItem(`reminder_shown_${reminder.id}`);
        await loadUpcomingReminders();
        await loadRecentActivities(); // ✅ Refresh activities
      } catch (error) {
        console.error('❌ Error marking reminder as missed:', error);
      }
      
      clearTimers();
      onClose();
    };

    const handleTaken = async () => {
      clearTimers();
      
      if (!reminder?.id) {
        onClose();
        return;
      }
      
      try {
        console.log('✅ Marking reminder as completed:', reminder.id);
        
        await supabase
          .from('reminders')
          .update({ status: 'completed' })
          .eq('id', reminder.id);
        
        console.log('✅ Reminder marked as completed');
        
        await AsyncStorage.removeItem(`reminder_shown_${reminder.id}`);
        await loadUpcomingReminders();
        await loadRecentActivities(); // ✅ Refresh activities
      } catch (error) {
        console.error('❌ Error updating reminder:', error);
      }
      
      onClose();
    };

    const handleLater = async () => {
      clearTimers();
      
      if (!reminder?.id) {
        onClose();
        return;
      }
      
      try {
        const now = new Date();
        const newTime = new Date(now.getTime() + 10 * 60 * 1000);
        
        const hours = newTime.getHours();
        const minutes = newTime.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        const displayMinutes = minutes.toString().padStart(2, '0');
        const newTimeString = `${displayHours}:${displayMinutes} ${ampm}`;
        
        const year = newTime.getFullYear();
        const month = String(newTime.getMonth() + 1).padStart(2, '0');
        const day = String(newTime.getDate()).padStart(2, '0');
        const newDate = `${year}-${month}-${day}`;
        
        console.log('⏰ Rescheduling reminder to:', newDate, newTimeString);
        
        await supabase
          .from('reminders')
          .update({ 
            date: newDate,
            time: newTimeString,
            status: 'pending'
          })
          .eq('id', reminder.id);
        
        console.log('✅ Reminder rescheduled for 10 minutes later');
        
        await AsyncStorage.removeItem(`reminder_shown_${reminder.id}`);
        
        Alert.alert(
          'Reminder Snoozed',
          `I'll remind you again at ${newTimeString}`,
          [{ text: 'OK' }]
        );
        
        await loadUpcomingReminders();
      } catch (error) {
        console.error('❌ Error rescheduling reminder:', error);
        Alert.alert('Error', 'Failed to reschedule reminder');
      }
      
      onClose();
    };

    const formatTimeRemaining = () => {
      const minutes = Math.floor(timeRemaining / 60);
      const seconds = timeRemaining % 60;
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    if (!visible || !reminder) return null;

    return (
      <View style={styles.reminderOverlay}>
        <View style={styles.reminderContainer}>
          <LinearGradient
            colors={['#818cf8', '#a78bfa']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.reminderCardModern}
          >
            <View style={styles.timerBadge}>
              <MaterialIcons name="timer" size={14} color="#fff" />
              <Text style={styles.timerText}>Auto-close in {formatTimeRemaining()}</Text>
            </View>

            <View style={styles.reminderIconOuter}>
              <View style={styles.reminderIconInner}>
                <MaterialIcons 
                  name={reminder.icon as any} 
                  size={50} 
                  color="#fff" 
                />
              </View>
            </View>

            <Text style={styles.reminderMainTitle}>{reminder.title}</Text>
            <Text style={styles.reminderMessage}>
              {reminder.subtitle}
              {reminder.details?.instructions && `\n${reminder.details.instructions}`}
            </Text>

            <TouchableOpacity
              style={styles.primaryBtn}
              activeOpacity={0.9}
              onPress={handleTaken}
            >
              <Text style={styles.primaryBtnText}>
                {reminder.icon === 'medication' ? "I've taken it" : 'Mark as Done'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              activeOpacity={0.9}
              onPress={handleLater}
            >
              <Text style={styles.secondaryBtnText}>Remind me later (10 min)</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.dismissBtn}
              activeOpacity={0.9}
              onPress={() => {
                clearTimers();
                onClose();
              }}
            >
              <Text style={styles.dismissBtnText}>Dismiss (no action)</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </View>
    );
  };

  // ✅ Face Recognition Popup Component
  const FaceRecognitionPopup: React.FC<{
    visible: boolean;
    face: (RecognizedFace & { confidence?: number }) | null;
    onClose: () => void;
  }> = ({ visible, face, onClose }) => {
    if (!visible || !face) return null;

    return (
      <Modal visible={visible} transparent animationType="none">
        <View style={faceStyles.overlay}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
          
          <Animated.View
            style={[
              faceStyles.popupContainer,
              {
                opacity: facePopupOpacity,
                transform: [{ scale: facePopupScale }],
              },
            ]}
          >
            <LinearGradient
              colors={['#6ee7b7', '#34d399']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={faceStyles.popup}
            >
              {/* Face Image */}
              {face.imageUri ? (
                <Image 
                  source={{ uri: face.imageUri }} 
                  style={faceStyles.faceImage}
                />
              ) : (
                <View style={faceStyles.faceImagePlaceholder}>
                  <MaterialIcons name="person" size={64} color="#fff" />
                </View>
              )}

              {/* Text Content */}
              <Text style={faceStyles.subtitle}>You know this person!</Text>
              <Text style={faceStyles.name}>{face.name}</Text>
              <Text style={faceStyles.relationship}>Your {face.relationship}</Text>

              {/* Optional: Show confidence */}
              {face.confidence && (
                <Text style={faceStyles.confidence}>
                  {Math.round(face.confidence)}% match
                </Text>
              )}

              {/* Dismiss Button */}
              <TouchableOpacity
                style={faceStyles.dismissButton}
                activeOpacity={0.9}
                onPress={onClose}
              >
                <MaterialIcons name="close" size={24} color={C.emerald500} />
                <Text style={faceStyles.dismissText}>Dismiss</Text>
              </TouchableOpacity>
            </LinearGradient>
          </Animated.View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting + avatar */}
        <View style={styles.headerWrap}>
          <View>
            <Text style={styles.greetSmall}>Good Morning</Text>
            <Text style={styles.greetName}>{patientName}</Text>
          </View>
          <Image source={{ uri: AVATAR }} style={styles.avatar} />
        </View>

        {/* Call My Caregiver */}
        <View style={{ paddingHorizontal: 24, marginTop: 8 }}>
          <TouchableOpacity activeOpacity={0.9} onPress={callCaregiver}>
            <LinearGradient
              colors={['#60a5fa', '#a78bfa']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.callBtn}
            >
              <MaterialIcons name="call" size={30} color="#fff" style={{ marginRight: 10 }} />
              <Text style={styles.callText}>Call My Caregiver</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Device Status */}
        <View style={{ paddingHorizontal: 24, marginTop: 22 }}>
          <View style={styles.cardRow}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#dcfce7' }]}>
                <MaterialIcons name="photo-camera" size={21} color="#22c55e" />
              </View>
              <Text style={styles.rowTitle}>Device</Text>
              <View style={styles.dotOnline} />
              <Text style={styles.rowSub}>Connected</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <SectionTitle>Quick Actions</SectionTitle>
        <View style={styles.quickGrid}>
          <TouchableOpacity activeOpacity={0.9} style={[styles.card, styles.quickItem]} onPress={() => navigation.navigate('VoiceAssistant')}>
            <MaterialIcons name="mic" size={30} color={C.indigo500} />
            <Text style={styles.quickText}>Ask for Help</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.card, styles.quickItem]}
            onPress={() => navigation.navigate('PatientLocation')}
          >
            <MaterialIcons name="location-on" size={30} color={C.indigo500} />
            <Text style={styles.quickText}>Location</Text>
          </TouchableOpacity>
        </View>

        {/* Upcoming Reminders */}
        <View style={{ flexDirection: 'row', marginTop: 26, marginBottom: 12, paddingLeft: 27 }}>
          <Text style={styles.sectionTitle2}>Upcoming Reminders (24h)</Text>
          <TouchableOpacity
            onPress={loadUpcomingReminders}
            style={{ paddingRight: 22, paddingTop: 2}}
          >
            <MaterialIcons name="refresh" size={24} color={C.indigo500} />
          </TouchableOpacity>
        </View>
        <View style={{ paddingHorizontal: 24 }}>
          {loadingReminders ? (
            <View style={styles.emptyCard}>
              <ActivityIndicator size="large" color={C.indigo500} />
              <Text style={styles.emptyTitle}>Loading reminders...</Text>
            </View>
          ) : upcomingReminders.length > 0 ? (
            upcomingReminders.map((reminder, index) => (
              <TouchableOpacity
                key={index}
                style={styles.reminderCard}
                activeOpacity={0.75}
                onPress={() => openReminder(reminder)}
              >
                <View style={[styles.iconBox, { backgroundColor: reminder.chipBg }]}>
                  <MaterialIcons name={reminder.icon as any} size={22} color={reminder.chipColor} />
                </View>
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={styles.rowTitle2}>{reminder.title}</Text>
                  <Text style={styles.rowSmall2}>{reminder.subtitle}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color={C.slate400} />
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <MaterialIcons name="event-available" size={48} color={C.slate400} />
              <Text style={styles.emptyTitle}>No Upcoming Reminders</Text>
              <Text style={styles.emptySubtitle}>All clear for the next 24 hours!</Text>
            </View>
          )}
        </View>

        {/* Daily Activity */}
        <SectionTitle>Daily Activity</SectionTitle>
        <View style={{ paddingHorizontal: 24 }}>
          <View style={[styles.card, styles.activityGrid]}>
            <View style={[styles.activityItem, { backgroundColor: '#eef2ff' }]}>
              <MaterialIcons name="directions-walk" size={36} color={C.indigo500} />
              <Text style={styles.activityBig}>{steps.toLocaleString()}</Text>
              <Text style={styles.activitySub}>Steps</Text>
            </View>

            <View style={[styles.activityItem, { backgroundColor: '#f0fdfa' }]}>
              <MaterialIcons name="local-fire-department" size={36} color={C.teal500} />
              <Text style={styles.activityBig}>{activeMinutes}</Text>
              <Text style={styles.activitySub}>Active Mins</Text>
            </View>
          </View>
        </View>

        {/* ✅ Recent Activity - NOW WITH DYNAMIC DATA */}
        <View style={{ flexDirection: 'row', marginTop: 26, marginBottom: 12, paddingLeft: 27 }}>
          <Text style={styles.sectionTitle2}>Recent Activity</Text>
          <TouchableOpacity
            onPress={loadRecentActivities}
            style={{ paddingRight: 22, paddingTop: 2 }}
            disabled={loadingActivities}
          >
            <MaterialIcons 
              name={loadingActivities ? "hourglass-empty" : "refresh"} 
              size={24} 
              color={C.indigo500} 
            />
          </TouchableOpacity>
        </View>
        <View style={{ paddingHorizontal: 24 }}>
          {loadingActivities ? (
            <View style={styles.emptyCard}>
              <ActivityIndicator size="large" color={C.indigo500} />
              <Text style={styles.emptyTitle}>Loading activities...</Text>
            </View>
          ) : recentActivities.length > 0 ? (
            recentActivities.map((activity) => (
              <View key={activity.id} style={styles.cardRow}>
                <View style={[styles.iconBox, { backgroundColor: activity.iconBg }]}>
                  <MaterialIcons name={activity.icon as any} size={24} color={activity.iconColor} />
                </View>
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={styles.rowTitleMed}>{activity.title}</Text>
                  <Text style={styles.rowSmall}>{activity.subtitle}</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <MaterialIcons name="history" size={48} color={C.slate400} />
              <Text style={styles.emptyTitle}>No Recent Activity</Text>
              <Text style={styles.emptySubtitle}>Your activities will appear here</Text>
            </View>
          )}
        </View>

        {/* Sign out */}
        <View style={{ paddingHorizontal: 24, marginTop: 18 }}>
          <TouchableOpacity
            style={styles.signOutBtn}
            activeOpacity={0.85}
            onPress={() => handleSignOut(navigation)}
          >
            <MaterialIcons name="logout" size={18} color="#df6666ff" />
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>

        {/* Medication Reminder Popup */}
        <MedicationReminderPopup 
          visible={showReminderNotification} 
          reminder={currentReminder}
          onClose={() => {
            setShowReminderNotification(false);
            setCurrentReminder(null);
          }} 
        />
        
        {/* Contextual Reminder Popup */}
        <ReminderPopup 
          visible={showContextualReminder} 
          onClose={() => setShowContextualReminder(false)} 
          message={currentContextualReminder} 
        />
      </ScrollView>

      {/* ✅ Face Recognition Popup */}
      <FaceRecognitionPopup
        visible={showFacePopup}
        face={recognizedFace}
        onClose={hideFaceRecognitionPopup}
      />

      {/* Reminder Details Modal */}
      <Modal
        visible={showReminder}
        transparent
        animationType="none"
        onRequestClose={closeReminder}
      >
        <View style={modalStyles.overlayRoot} pointerEvents="box-none">
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
          <TouchableOpacity
            style={modalStyles.overlayTint}
            activeOpacity={1}
            onPress={closeReminder}
          />

          <Animated.View
            style={[modalStyles.sheet, { transform: [{ translateY }] }]}
            onLayout={(e) => {
              sheetHeight.current = e.nativeEvent.layout.height;
            }}
          >
            <View {...panResponder.panHandlers} style={modalStyles.handleWrap}>
              <View style={modalStyles.handle} />
            </View>

            <View style={modalStyles.headerRow}>
              <View
                style={[
                  styles.iconBox,
                  { backgroundColor: activeReminder?.chipBg || "#e2e8f0" },
                ]}
              >
                <MaterialIcons
                  name={(activeReminder?.icon || "medication") as any}
                  size={28}
                  color={activeReminder?.chipColor || "#6366f1"}
                />
              </View>
              <View style={{ marginLeft: 12 }}>
                <Text style={modalStyles.title}>{activeReminder?.title}</Text>
                <Text style={modalStyles.subtitle}>{activeReminder?.subtitle}</Text>
              </View>
            </View>

            {activeReminder?.details && (
              <View style={modalStyles.section}>
                <Text style={modalStyles.sectionTitle}>Details</Text>

                {activeReminder.details.medication && (
                  <View style={modalStyles.detailRow}>
                    <MaterialIcons name="medication" size={20} color="#6366f1" />
                    <Text style={modalStyles.detailText}>
                      <Text style={modalStyles.detailLabel}>Medication: </Text>
                      {activeReminder.details.medication}
                    </Text>
                  </View>
                )}

                {activeReminder.details.instructions && (
                  <View style={modalStyles.detailRow}>
                    <MaterialIcons name="lunch-dining" size={20} color="#6366f1" />
                    <Text style={modalStyles.detailText}>
                      <Text style={modalStyles.detailLabel}>Instructions: </Text>
                      {activeReminder.details.instructions}
                    </Text>
                  </View>
                )}

                {activeReminder.details.note && (
                  <View style={modalStyles.detailRow}>
                    <MaterialIcons name="speaker-notes" size={20} color="#6366f1" />
                    <Text style={modalStyles.detailText}>
                      <Text style={modalStyles.detailLabel}>Caregiver Note: </Text>
                      {activeReminder.details.note}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {activeReminder?.status && (
              <View style={modalStyles.section}>
                <Text style={modalStyles.sectionTitle}>Status</Text>
                <View style={modalStyles.statusCard}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <MaterialIcons
                      name={
                        activeReminder.status.label === "Confirmed"
                          ? "check-circle"
                          : "schedule"
                      }
                      size={22}
                      color={activeReminder.status.label === "Confirmed" ? "#16a34a" : "#64748b"}
                      style={{ marginRight: 10 }}
                    />
                    <Text
                      style={[
                        modalStyles.statusMain,
                        { color: activeReminder.status.label === "Confirmed" ? "#065f46" : "#334155" },
                      ]}
                    >
                      {activeReminder.status.time || "—"}
                    </Text>
                  </View>
                  <Text
                    style={[
                      modalStyles.statusRight,
                      { color: activeReminder.status.label === "Confirmed" ? "#15803d" : "#64748b" },
                    ]}
                  >
                    {activeReminder.status.label || ""}
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={modalStyles.closeBtn}
              onPress={closeReminder}
            >
              <Text style={modalStyles.closeText}>Close</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={styles.sectionTitle}>{children}</Text>
);

const handleSignOut = async (navigation: Props['navigation']) => {
  try {
    await AsyncStorage.multiRemove(['role', 'userEmail', 'token']);
  } catch {}
  navigation.replace('Login');
};

const ReminderPopup: React.FC<{ visible: boolean; onClose: () => void; message?: string }> = ({ visible, onClose, message }) => {
  if (!visible) return null;

  const handleClose = () => {
    Speech.stop();
    onClose();
  };

  return (
    <View style={styles.reminderScrim}>
      <View style={styles.reminderWrap}>
        <LinearGradient
          colors={['#818cf8', '#a78bfa']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.reminderCCard}
        >
          <View style={styles.reminderIconCircle}>
            <MaterialIcons name="lightbulb" size={48} color="#fff" />
          </View>

          <Text style={styles.reminderTitle}>Gentle Reminder</Text>

          <Text style={styles.reminderBody}>
            {message || "You have a new reminder"}
          </Text>

          <TouchableOpacity style={styles.reminderCta} activeOpacity={0.9} onPress={handleClose}>
            <Text style={styles.reminderCtaText}>Okay, got it</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </View>
  );
};

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bgTo,
  },

  headerWrap: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 56 : 32,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greetSmall: {
    marginTop: 9,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: C.slate500,
  },
  greetName: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 32,
    color: C.slate800,
    marginTop: -6,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: C.indigo300,
  },

  callBtn: {
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#60a5fa',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  callText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: '#fff',
  },

  card: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardRow: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    marginBottom: 12,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center' },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    marginLeft: 12,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: C.slate700,
  },
  rowTitleMed: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    color: C.slate700,
  },
  rowSub: {
    marginLeft: 8,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: C.slate500,
  },
  rowSmall: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: C.slate500,
  },
  rowTitle2: {
    marginLeft: 0,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: C.slate700,
  },
  rowSmall2: {
    marginLeft: 0,
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: C.slate500,
  },
  dotOnline: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.green500,
    marginLeft: 8,
  },

  sectionTitle: {
    marginTop: 26,
    marginBottom: 12,
    paddingHorizontal: 24,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: C.slate700,
  },
  sectionTitle2: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: C.slate700,
    flex: 1,
  },

  quickGrid: {
    paddingHorizontal: 24,
    flexDirection: 'row',
    gap: 12,
  },
  quickItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  quickText: {
    marginTop: 8,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: C.slate700,
  },

  reminderCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },

  emptyCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  emptyTitle: {
    marginTop: 12,
    fontFamily: 'Poppins_600SemiBold',
    color: C.slate600,
    fontSize: 16,
  },
  emptySubtitle: {
    marginTop: 4,
    fontFamily: 'Poppins_400Regular',
    color: C.slate400,
    fontSize: 14,
    textAlign: 'center',
  },

  timePill: {
    width: 44,
    height: 44,
    borderRadius: 32,
    backgroundColor: C.teal50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 13,
    color: C.teal500,
  },

  activityGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  activityItem: {
    flex: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  activityBig: {
    marginTop: 6,
    fontFamily: 'Poppins_700Bold',
    fontSize: 24,
    color: C.slate700,
  },
  activitySub: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: C.slate500,
  },
  signOutBtn: {
    marginLeft: 96,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#f8e2e2ff',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    marginBottom: 20,
  },
  signOutText: {
    marginLeft: 8,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: '#df6666ff',
  },

  reminderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  reminderContainer: {
    width: '100%',
    maxWidth: 380,
  },
  reminderCardModern: {
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366F1',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  timerBadge: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
    marginBottom: 16,
  },
  timerText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: '#fff',
  },
  reminderIconOuter: {
    marginBottom: 16,
  },
  reminderIconInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderMainTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 22,
    color: '#fff',
    marginBottom: 6,
    textAlign: 'center',
  },
  reminderMessage: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    opacity: 0.95,
    marginBottom: 18,
    lineHeight: 24,
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  primaryBtnText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 17,
    color: '#4f46e5',
  },
  secondaryBtn: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    color: '#fff',
  },
  dismissBtn: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  dismissBtnText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  
  reminderScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  reminderWrap: { width: '100%', maxWidth: 380 },
  reminderCCard: {
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#818cf8',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  reminderIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  reminderTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 24,
    color: '#fff',
    marginTop: 4,
    marginBottom: 8,
    textAlign: 'center',
  },
  reminderBody: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 18,
    lineHeight: 28,
    color: '#ffffff',
    opacity: 0.95,
    textAlign: 'center',
    marginBottom: 18,
    paddingHorizontal: 6,
  },
  reminderCta: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderCtaText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 18,
    color: '#4f46e5',
  },
});

// ✅ Face Recognition Popup Styles
const faceStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  popupContainer: {
    width: '100%',
    maxWidth: 380,
  },
  popup: {
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#34d399',
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  faceImage: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.5)',
    marginBottom: 20,
  },
  faceImagePlaceholder: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.5)',
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    color: '#fff',
    opacity: 0.8,
    marginBottom: 4,
  },
  name: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 36,
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  relationship: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 20,
    color: '#fff',
    opacity: 0.9,
    marginBottom: 16,
  },
  confidence: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: '#fff',
    opacity: 0.7,
    marginBottom: 16,
  },
  dismissButton: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  dismissText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 18,
    color: C.emerald500,
  },
});

const modalStyles = StyleSheet.create({
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  overlayTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.40)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 6,
  },
  handleWrap: { 
    alignItems: 'center', 
    paddingVertical: 10 
  },
  handle: { 
    width: 56, 
    height: 6, 
    borderRadius: 3, 
    backgroundColor: '#cbd5e1' 
  },

  headerRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 8 
  },
  title: { 
    fontFamily: 'Poppins_700Bold', 
    fontSize: 22, 
    color: '#1e293b' 
  },
  subtitle: { 
    fontFamily: 'Poppins_400Regular', 
    fontSize: 14, 
    color: '#64748b' 
  },

  section: { 
    borderTopWidth: 1, 
    borderTopColor: '#e2e8f0', 
    paddingTop: 16, 
    marginTop: 16 
  },
  sectionTitle: { 
    fontFamily: 'Poppins_600SemiBold', 
    color: '#475569', 
    marginBottom: 10 
  },

  detailRow: { 
    flexDirection: 'row', 
    alignItems: 'flex-start', 
    marginBottom: 8, 
    gap: 12 
  },
  detailText: { 
    flex: 1, 
    color: '#334155', 
    fontFamily: 'Poppins_400Regular', 
    fontSize: 14 
  },
  detailLabel: { 
    fontFamily: 'Poppins_500Medium', 
    color: '#334155' 
  },

  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  statusMain: { 
    fontFamily: 'Poppins_600SemiBold', 
    fontSize: 15 
  },
  statusRight: { 
    fontFamily: 'Poppins_500Medium', 
    fontSize: 13 
  },

  closeBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 18,
  },
  closeText: { 
    fontFamily: 'Poppins_600SemiBold', 
    color: '#fff',
    fontSize: 16,
  },
});