// screens/CaregiverDashboardScreen.tsx - COMPLETE WITH DYNAMIC RECENT ACTIVITY

import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Modal,
  Animated,
  Alert,
  PanResponder,
  ActivityIndicator,
} from "react-native";
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from "@expo-google-fonts/poppins";
import { Feather, MaterialIcons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import AppLoading from "expo-app-loading";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
import React, { useEffect, useRef, useState } from "react";
import Svg, {
  Circle,
  Defs,
  Path,
  Rect,
  Stop,
  LinearGradient as SvgGradient,
  Line as SvgLine,
  Text as SvgText,
} from "react-native-svg";
import { RootStackParamList } from "../app/App";
import HealthDataService from "../services/HealthDataService";
import FallAlertListener from "../services/FallAlertListener";
import { supabase } from "../src/lib/supabase";
import ReminderHelperService from "../services/ReminderHelperService";
import MedicationAdherenceService from "../services/MedicationAdherenceService";
import * as CaregiverService from "../services/CaregiverService";
import PatientActivityService, { PatientActivity } from "../services/PatientActivityService";
import CognitionLevelService, { CognitionScore } from "../services/CognitionLevelService";

type Props = NativeStackScreenProps<RootStackParamList, "CaregiverDashboard">;

const W = Dimensions.get("window").width;

type ReminderData = {
  title: string;
  subtitle: string;
  icon: "medication" | "event";
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
  prefill?: {
    title: string;
    date: Date;
    timeText: string;
  };
};

export default function CaregiverDashboardScreen({ navigation }: Props) {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });
  
  const [caregiverId, setCaregiverId] = useState<string | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patientName, setPatientName] = useState<string>("Loading...");
  const [alert, setAlert] = useState<any>(null);
  
  /* -------------------- Modal state -------------------- */
  const [showReminder, setShowReminder] = useState(false);
  const [activeReminder, setActiveReminder] = useState<ReminderData | null>(null);
  const [upcomingReminders, setUpcomingReminders] = useState<ReminderData[]>([]);
  const [loadingReminders, setLoadingReminders] = useState(true);

  /* -------------------- Health data state -------------------- */
  const [steps, setSteps] = useState(4280);
  const [activeMinutes, setActiveMinutes] = useState(62);
  
  /* ✅ Medication adherence data */
  const [medicationAdherence, setMedicationAdherence] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [loadingAdherence, setLoadingAdherence] = useState(true);

  const [weeklyAdherence, setWeeklyAdherence] = useState(0);
  const [loadingWeeklyAdherence, setLoadingWeeklyAdherence] = useState(true);

  /* ✅ Recent activities state */
  const [recentActivities, setRecentActivities] = useState<PatientActivity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);

  /* ✅ Cognition level state */
  const [cognitionScore, setCognitionScore] = useState<CognitionScore | null>(null);
  const [loadingCognition, setLoadingCognition] = useState(true);
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);

  // ✅ Fetch caregiver ID from auth session on mount
  useEffect(() => {
    const initializeCaregiver = async () => {
      try {
        console.log('🔐 Fetching authenticated caregiver...');
        const id = await CaregiverService.getCurrentCaregiversId();
        
        if (!id) {
          Alert.alert('Error', 'No authenticated session found. Please log in again.');
          navigation.navigate('Login'); 
          return; 
        }
        
        setCaregiverId(id);
        console.log('✅ Caregiver ID set:', id);
        
        const patient = await CaregiverService.getPrimaryPatient(id);
        if (patient) {
          setPatientId(patient.id);
          setPatientName(patient.full_name || 'Patient');
          console.log('✅ Primary patient loaded:', patient.full_name);
        } else {
          console.log('⚠️ No patient linked to this caregiver');
          setPatientName('No Patient Linked');
        }
      } catch (error) {
        console.error('❌ Error initializing caregiver:', error);
        Alert.alert('Error', 'Failed to load caregiver information');
      }
    };

    initializeCaregiver();
  }, []);

  // ✅ Start fall alert listener when caregiver ID is available
  useEffect(() => {
    if (!caregiverId) return;

    console.log('👂 Starting fall alert listener for caregiver:', caregiverId);
    FallAlertListener.startListening(caregiverId, (newAlert: any) => {
      console.log("📩 Fall alert received:", newAlert);
      setAlert(newAlert);
      // Refresh activities when fall is detected
      if (patientId) loadRecentActivities();
    });

    return () => FallAlertListener.stopListening();
  }, [caregiverId, patientId]);

  // ✅ Load medication adherence when patient ID is available
  useEffect(() => {
    if (!patientId) return;

    loadMedicationAdherence();
    
    // Refresh adherence every 5 minutes
    const interval = setInterval(loadMedicationAdherence, 5 * 60 * 1000);
    
    // Run daily maintenance check every hour
    const maintenanceInterval = setInterval(() => {
      MedicationAdherenceService.runDailyMaintenance(patientId);
    }, 60 * 60 * 1000);

    return () => {
      clearInterval(interval);
      clearInterval(maintenanceInterval);
    };
  }, [patientId]);

  useEffect(() => {
    if (!patientId) return;

    loadWeeklyAdherence();
    
    // Refresh weekly adherence every 10 minutes
    const interval = setInterval(loadWeeklyAdherence, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, [patientId]);

  // ✅ Load recent activities when patient ID is available
  useEffect(() => {
    if (!patientId) return;

    loadRecentActivities();
    
    // Refresh activities every 2 minutes
    const interval = setInterval(loadRecentActivities, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, [patientId]);

  // ✅ Load cognition level when patient ID is available
  useEffect(() => {
    if (!patientId) return;

    loadCognitionLevel();
    
    // Refresh cognition level every 10 minutes
    const interval = setInterval(loadCognitionLevel, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, [patientId]);

  const loadWeeklyAdherence = async () => {
    if (!patientId) return;

    try {
      setLoadingWeeklyAdherence(true);
      console.log('📊 Loading weekly adherence for patient:', patientId);
      
      const percentage = await MedicationAdherenceService.getWeeklyAdherencePercentage(patientId);
      
      setWeeklyAdherence(percentage);
      console.log('✅ Weekly adherence loaded:', percentage + '%');
    } catch (error) {
      console.error('❌ Error loading weekly adherence:', error);
    } finally {
      setLoadingWeeklyAdherence(false);
    }
  };

  const loadMedicationAdherence = async () => {
    if (!patientId) return;

    try {
      setLoadingAdherence(true);
      console.log('📊 Loading medication adherence for patient:', patientId);
      
      // First, mark any overdue reminders as missed
      await MedicationAdherenceService.markOverdueRemindersAsMissed(patientId);
      
      // Then get the weekly adherence data
      const weeklyData = await MedicationAdherenceService.getWeeklyAdherence(patientId);
      
      setMedicationAdherence(weeklyData);
      console.log('✅ Medication adherence loaded:', weeklyData);
      
      // ✅ Also refresh weekly percentage and activities
      loadWeeklyAdherence();
      loadRecentActivities();
      loadCognitionLevel(); // Refresh cognition when medication data changes
    } catch (error) {
      console.error('❌ Error loading medication adherence:', error);
    } finally {
      setLoadingAdherence(false);
    }
  };

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

  const loadCognitionLevel = async () => {
    if (!patientId) return;

    try {
      setLoadingCognition(true);
      console.log('🧠 Loading cognition level for patient:', patientId);
      
      const score = await CognitionLevelService.calculateCognitionLevel(patientId);
      
      setCognitionScore(score);
      console.log('✅ Cognition level loaded:', score.level, score.score);
    } catch (error) {
      console.error('❌ Error loading cognition level:', error);
    } finally {
      setLoadingCognition(false);
    }
  };

  // ✅ Reload reminders when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (caregiverId) {
        console.log('📍 Dashboard focused - refreshing reminders...');
        loadUpcomingReminders();
        if (patientId) {
          loadMedicationAdherence();
          loadRecentActivities();
          loadCognitionLevel();
        }
      }
    });

    return unsubscribe;
  }, [navigation, caregiverId, patientId]);

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

  // ✅ Load reminders + Real-time subscription
  useEffect(() => {
    if (!caregiverId) return;

    loadUpcomingReminders();
    
    const interval = setInterval(loadUpcomingReminders, 2 * 60 * 1000);
    
    console.log('👂 Setting up real-time subscription for reminders...');
    const subscription = supabase
      .channel('reminders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reminders',
          filter: `caregiver_id=eq.${caregiverId}`,
        },
        (payload) => {
          console.log('🔔 Reminder changed:', payload.eventType, payload.new || payload.old);
          loadUpcomingReminders();
          if (patientId) {
            loadMedicationAdherence();
            loadRecentActivities();
            loadCognitionLevel();
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Reminder subscription status:', status);
      });

    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
      console.log('🛑 Unsubscribed from reminders');
    };
  }, [caregiverId, patientId]);

  const loadUpcomingReminders = async () => {
    if (!caregiverId) {
      console.log('⏳ Waiting for caregiver ID...');
      return;
    }

    try {
      setLoadingReminders(true);
      console.log('🔍 Loading reminders for caregiver:', caregiverId);
      
      const { data: allReminders, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('caregiver_id', caregiverId)
        .eq('status', 'pending')
        .order('date', { ascending: true })
        .order('time', { ascending: true });
      
      if (error) {
        console.error('❌ Supabase error:', error);
        throw error;
      }
      
      console.log('📋 Fetched reminders:', allReminders?.length || 0);
      
      if (!allReminders || allReminders.length === 0) {
        setUpcomingReminders([]);
        return;
      }
      
      const upcoming = ReminderHelperService.filterUpcomingReminders(allReminders, 24);
      console.log('⏰ Upcoming reminders (24h):', upcoming.length);
      
      const displayReminders = upcoming.map(r => 
        ReminderHelperService.convertToReminderData(r)
      );
      
      setUpcomingReminders(displayReminders);
      console.log('✅ Loaded', displayReminders.length, 'upcoming reminders within 24 hours');
    } catch (error) {
      console.error('❌ Failed to load reminders:', error);
    } finally {
      setLoadingReminders(false);
    }
  };

  // ---------- bottom sheet animation + drag-to-close
  const translateY = useRef(new Animated.Value(0)).current;
  const sheetHeight = useRef(0);
  const DRAG_CLOSE_THRESHOLD = 120;

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

  if (!fontsLoaded) return <AppLoading />;

  if (!caregiverId) {
    return (
      <LinearGradient colors={["#e0e7ff", "#f0f4ff"]} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={{ marginTop: 16, fontFamily: 'Poppins_500Medium', color: '#475569' }}>
            Loading your dashboard...
          </Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={["#e0e7ff", "#f0f4ff"]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Header */}
          <View style={{ paddingHorizontal: 24, paddingTop: 35 }}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.subText}>Hello, Caregiver</Text>
                <Text style={styles.h1}>Dashboard</Text>
              </View>
              <View style={styles.row}>
                <Image
                  source={{
                    uri: "https://lh3.googleusercontent.com/a/ACg8ocLw_b_95Zk8i_32X-y1xX8X2-wE9L7KzQ3qE6pB4P-5e_3A=s96-c-rg-br100",
                  }}
                  style={styles.avatar}
                />
                <TouchableOpacity style={styles.iconBtn}
                onPress={() => navigation.navigate('Settings')}>
                  <MaterialIcons name="settings" size={28} color="#475569" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Patient Card */}
          <View style={{ paddingHorizontal: 24, marginTop: 16 }}>
            <LinearGradient
              colors={["#a5b4fc", "#8893F9"]}
              style={styles.patientCard}
            >
              <View style={styles.rowBetween}>
                <View>
                  <Text style={styles.h2White}>{patientName}</Text>
                  <Text style={styles.smallWhite}>Patient Profile</Text>
                </View>
                <View style={styles.row}>
                  <View style={styles.rowIcon}>
                    <Feather name="wifi" size={16} color="#fff" />
                    <Text style={styles.smallWhite}>Online</Text>
                  </View>
                  <View style={[styles.rowIcon, { marginLeft: 12 }]}>
                    <MaterialIcons name="battery-std" size={16} color="#fff" />
                    <Text style={styles.smallWhite}>92%</Text>
                  </View>
                </View>
              </View>
              <View style={styles.rowBetweenBtns}>
                <GhostBtn icon="phone" text="   Call Patient" />
                <GhostBtn 
                icon="pin-drop" 
                text="  Check Location"
                onPress={() => navigation.navigate('PatientLocation')}  />  
              </View>
            </LinearGradient>
          </View>

          {/* Quick Actions */}
          <QuickActionTitle title="Quick Actions" />
          <View style={styles.grid}>
            <Card
              label="Add Reminder"
              icon="add-alert"
              onPress={() => navigation.navigate("AddReminder")}
            />
            <Card 
              label="Patient Details" 
              icon="badge"
              onPress={() => navigation.navigate('PatientDetails')} />
            <Card 
              label="Manage Faces" 
              icon="face" full
              onPress={() => navigation.navigate('ManageFaces')} />
          </View>

          {/* Health Metrics */}
          <SectionTitle title="Health Metrics" />
          <View style={{ paddingHorizontal: 24 }}>
            <CardBox>
              <View style={styles.rowBetween}>
                <View>
                  <Text style={styles.cardTitle}>Daily Activity</Text>
                  <Text style={styles.smallMuted}>Steps & Active Time</Text>
                </View>
                <MaterialIcons name="directions-walk" size={30} color="#6366F1" />
              </View>
              <View style={{ flexDirection: "row", marginTop: 8 }}>
                <Text style={styles.steps}>{steps.toLocaleString()}</Text>
                <Text style={styles.stepLabel}>steps</Text>
              </View>
              <View style={{ flexDirection: "row", marginTop: -4 }}>
                <Text style={styles.minutes}>{activeMinutes}</Text>
                <Text style={styles.minLabel}>active mins</Text>
              </View>
            </CardBox>

            {/* ✅ Updated Medication Adherence Card */}
            <MedicationAdherenceCard 
              values={medicationAdherence}
              loading={loadingAdherence}
              onRefresh={loadMedicationAdherence}
            />

            <CardBox>
              <View style={styles.rowBetween}>
                <TouchableOpacity 
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  onPress={() => setShowDisclaimerModal(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cardTitle}>Cognition Level</Text>
                  <MaterialIcons 
                    name="info-outline" 
                    size={18} 
                    color="#6366f1" 
                    style={{ marginTop: -6 }}  // ← Add this to move icon up
                  />
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {cognitionScore && (
                    <Text 
                      style={[
                        styles.badge, 
                        { 
                          color: CognitionLevelService.getCognitionColor(cognitionScore.level).text,
                          backgroundColor: CognitionLevelService.getCognitionColor(cognitionScore.level).background,
                        }
                      ]}
                    >
                      {cognitionScore.level}
                    </Text>
                  )}
                  <TouchableOpacity onPress={loadCognitionLevel} disabled={loadingCognition}>
                    <MaterialIcons 
                      name={loadingCognition ? "hourglass-empty" : "refresh"} 
                      size={20} 
                      color="#6366f1" 
                      style={{ marginTop: -5 }}
                    />
                  </TouchableOpacity>
                </View>
              </View>
              {loadingCognition ? (
                <View style={{ height: 100, justifyContent: 'center', alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#6366f1" />
                </View>
              ) : cognitionScore ? (
                <>
                  <ScaleBar position={cognitionScore.position} />
                  <View style={styles.scaleLabels}>
                    {["Severe", "Moderate", "Mild", "Good", "Excellent"].map(
                      (label) => (
                        <Text key={label} style={styles.scaleText}>
                          {label}
                        </Text>
                      )
                    )}
                  </View>
                  
                  {/* Additional Info */}
                  <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0' }}>
                    <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 13, color: '#64748b', lineHeight: 20 }}>
                      {CognitionLevelService.getCognitionDescription(cognitionScore.level)}
                    </Text>
                    
                    <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      <View style={styles.statPill}>
                        <Text style={styles.statPillLabel}>Medication</Text>
                        <Text style={styles.statPillValue}>{cognitionScore.factors.medicationAdherence}%</Text>
                      </View>
                      <View style={styles.statPill}>
                        <Text style={styles.statPillLabel}>Falls</Text>
                        <Text style={styles.statPillValue}>{cognitionScore.details.fallCount}</Text>
                      </View>
                      <View style={styles.statPill}>
                        <Text style={styles.statPillLabel}>Score</Text>
                        <Text style={styles.statPillValue}>{cognitionScore.score}</Text>
                      </View>
                    </View>
                  </View>
                </>
              ) : (
                <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 14, color: '#94a3b8', marginTop: 12 }}>
                  No cognition data available
                </Text>
              )}
            </CardBox>

            <CardBox>
              <View style={styles.rowBetween}>
                <Text style={[styles.cardTitle, { textAlign: "center", flex: 1 }]}>
                  Weekly Adherence
                </Text>
                <TouchableOpacity onPress={loadWeeklyAdherence} disabled={loadingWeeklyAdherence}>
                  <MaterialIcons 
                    name={loadingWeeklyAdherence ? "hourglass-empty" : "refresh"} 
                    size={20} 
                    color="#6366f1" 
                    style={{ marginTop: -6 }}
                  />
                </TouchableOpacity>
              </View>
              {loadingWeeklyAdherence ? (
                <View style={{ height: 200, justifyContent: 'center', alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#6366f1" />
                </View>
              ) : (
                <Ring percent={weeklyAdherence} />
              )}
            </CardBox>
          </View>

          {/* Upcoming Reminders Section */}
          <View style={{ flexDirection: 'row', marginBottom: 2 }}>
            <Text style={styles.sectionTitle}>Upcoming Reminders (24h)</Text>
            <TouchableOpacity 
              onPress={loadUpcomingReminders}
              style={{ paddingRight: 20, paddingTop: 17 , marginLeft: -4 }}
            >
              <MaterialIcons name="refresh" size={24} color="#6366f1" />
            </TouchableOpacity>
          </View>
          <View style={{ paddingHorizontal: 24 }}>
            {loadingReminders ? (
              <View style={styles.emptyStateCard}>
                <ActivityIndicator size="large" color="#6366f1" />
                <Text style={styles.emptyStateTitle}>Loading reminders...</Text>
              </View>
            ) : upcomingReminders.length > 0 ? (
              upcomingReminders.map((reminder, index) => (
                <ListItem
                  key={index}
                  title={reminder.title}
                  subtitle={reminder.subtitle}
                  icon={reminder.icon}
                  color={reminder.chipColor}
                  bg={reminder.chipBg}
                  onPress={() => openReminder(reminder)}
                />
              ))
            ) : (
              <View style={styles.emptyStateCard}>
                <MaterialIcons name="event-available" size={48} color="#94a3b8" />
                <Text style={styles.emptyStateTitle}>No Upcoming Reminders</Text>
                <Text style={styles.emptyStateSubtitle}>
                  All clear for the next 24 hours!
                </Text>
              </View>
            )}
          </View>

          {/* ✅ Recent Activity - NOW WITH DYNAMIC DATA */}
          <View style={{ flexDirection: 'row', marginBottom: 2, alignItems: 'center' }}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity 
              onPress={loadRecentActivities}
              style={{ paddingRight: 20, paddingTop: 6, marginLeft: 114 }}
              disabled={loadingActivities}
            >
              <MaterialIcons 
                name={loadingActivities ? "hourglass-empty" : "refresh"} 
                size={24} 
                color="#6366f1" 
              />
            </TouchableOpacity>
          </View>
          <View style={{ paddingHorizontal: 24 }}>
            {loadingActivities ? (
              <View style={styles.emptyStateCard}>
                <ActivityIndicator size="large" color="#6366f1" />
                <Text style={styles.emptyStateTitle}>Loading activities...</Text>
              </View>
            ) : recentActivities.length > 0 ? (
              recentActivities.map((activity) => (
                <ListItem
                  key={activity.id}
                  title={activity.title}
                  subtitle={activity.subtitle}
                  icon={activity.icon}
                  color={activity.iconColor}
                  bg={activity.iconBg}
                />
              ))
            ) : (
              <View style={styles.emptyStateCard}>
                <MaterialIcons name="history" size={48} color="#94a3b8" />
                <Text style={styles.emptyStateTitle}>No Recent Activity</Text>
                <Text style={styles.emptyStateSubtitle}>
                  Patient activities will appear here
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Fall Alert Modal */}
        <Modal visible={!!alert} transparent animationType="fade">
          <BlurView intensity={40} tint="dark" style={styles.puoverlay}>
            <View style={styles.pucentered}>
              <View style={styles.pucardContainer}>
                <TouchableOpacity style={styles.pucloseButton} onPress={() => setAlert(null)}>
                  <MaterialIcons name="close" size={30} color="rgba(255,255,255,0.8)" />
                </TouchableOpacity>

                <LinearGradient
                  colors={["#f87171", "#f472b6"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.pucard}
                >
                  <View style={styles.puiconWrapper}>
                    <MaterialIcons name="personal-injury" size={50} color="#fff" />
                  </View>

                  <Text style={styles.pucardTitle}>FALL DETECTED</Text>
                  <Text style={styles.pualertText}>
                    {alert?.patient_name || 'Your patient'} may have fallen.
                  </Text> 
                  <Text style={styles.putimestamp}>
                    {alert?.created_at
                      ? `Timestamp: ${new Date(alert.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}, ${new Date(alert.created_at).toLocaleDateString()}`
                      : "Timestamp: Just now"}
                  </Text>

                  <View style={styles.pubuttonGroup}>
                    <TouchableOpacity
                      style={styles.puprimaryButton}
                      onPress={() => {
                        setAlert(null);
                        navigation.navigate("PatientLocation");
                      }}
                    >
                      <MaterialIcons name="location-on" size={22} color="#e11d48" />
                      <Text style={styles.puprimaryText}>Check Location</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.pusecondaryButton}
                      onPress={async () => {
                        try {
                          if (!alert?.patient_id) {
                            Alert.alert("Error", "Patient ID not found.");
                            return;
                          }

                          const { data, error } = await supabase
                            .from("patients")
                            .select("phone_number, full_name")
                            .eq("id", alert.patient_id)
                            .single();

                          if (error) {
                            console.error("Supabase error:", error);
                            Alert.alert("Error", "Failed to fetch patient info.");
                            return;
                          }

                          const phoneNumber = data?.phone_number;
                          if (!phoneNumber) {
                            Alert.alert("Missing Info", "Phone number not available for this patient.");
                            return;
                          }

                          Linking.openURL(`tel:${phoneNumber}`);
                        } catch (err) {
                          console.error("Error calling patient:", err);
                          Alert.alert("Error", "Something went wrong.");
                        }
                      }}
                    >
                      <MaterialIcons name="call" size={20} color="#fff" />
                      <Text style={styles.pusecondaryText}>
                        Call {alert?.patient_name || 'Patient'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              </View>
            </View>
          </BlurView>
        </Modal>

        {/* Reminder Modal */}
        <Modal
          visible={showReminder}
          transparent
          animationType="none"
          onRequestClose={closeReminder}
        >
          <View style={modalStyles.overlayRoot} pointerEvents="box-none">
            <BlurView
              intensity={30}
              tint="dark"
              style={StyleSheet.absoluteFillObject}
            />
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
              <View
                {...panResponder.panHandlers}
                style={modalStyles.handleWrap}
              >
                <View style={modalStyles.handle} />
              </View>

              <View style={modalStyles.headerRow}>
                <View
                  style={[
                    styles.iconBg,
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

              <View style={modalStyles.section}>
                <Text style={modalStyles.sectionTitle}>Details</Text>

                {activeReminder?.details?.medication ? (
                  <View style={modalStyles.detailRow}>
                    <MaterialIcons name="medication" size={20} color="#6366f1" />
                    <Text style={modalStyles.detailText}>
                      <Text style={modalStyles.detailLabel}>Medication: </Text>
                      {activeReminder.details.medication}
                    </Text>
                  </View>
                ) : null}

                {activeReminder?.details?.instructions ? (
                  <View style={modalStyles.detailRow}>
                    <MaterialIcons name="lunch-dining" size={20} color="#6366f1" />
                    <Text style={modalStyles.detailText}>
                      <Text style={modalStyles.detailLabel}>Instructions: </Text>
                      {activeReminder.details.instructions}
                    </Text>
                  </View>
                ) : null}

                {activeReminder?.details?.note ? (
                  <View style={modalStyles.detailRow}>
                    <MaterialIcons name="speaker-notes" size={20} color="#6366f1" />
                    <Text style={modalStyles.detailText}>
                      <Text style={modalStyles.detailLabel}>Caregiver Note: </Text>
                      {activeReminder.details.note}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={modalStyles.section}>
                <Text style={modalStyles.sectionTitle}>Status</Text>
                <View style={modalStyles.statusCard}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <MaterialIcons
                      name={
                        activeReminder?.status?.label === "Confirmed"
                          ? "check-circle"
                          : "schedule"
                      }
                      size={22}
                      color={activeReminder?.status?.label === "Confirmed" ? "#16a34a" : "#64748b"}
                      style={{ marginRight: 10 }}
                    />
                    <Text
                      style={[
                        modalStyles.statusMain,
                        { color: activeReminder?.status?.label === "Confirmed" ? "#065f46" : "#334155" },
                      ]}
                    >
                      {activeReminder?.status?.time || "—"}
                    </Text>
                  </View>
                  <Text
                    style={[
                      modalStyles.statusRight,
                      { color: activeReminder?.status?.label === "Confirmed" ? "#15803d" : "#64748b" },
                    ]}
                  >
                    {activeReminder?.status?.label || ""}
                  </Text>
                </View>
              </View>

              <View style={modalStyles.footerRow}>
                <TouchableOpacity style={modalStyles.closeBtn} onPress={closeReminder}>
                  <MaterialIcons name="close" size={20} color="#334155" />
                  <Text style={modalStyles.closeText}>Close</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => {
                    if (activeReminder?.prefill) {
                      if (!patientId) {
                        Alert.alert("Missing Patient", "Please select a patient before editing a reminder.");
                        return;
                      }
                      navigation.navigate("AddReminder", {
                        patientId: patientId,
                        prefill: activeReminder.prefill,
                      });
                      setShowReminder(false);
                    }
                  }}
                  style={{ flex: 1 }}
                >
                  <LinearGradient
                    colors={["#a5b4fc", "#818cf8"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={modalStyles.editBtn}
                  >
                    <MaterialIcons name="edit" size={20} color="#fff" />
                    <Text style={modalStyles.editText}>Edit Reminder</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </Modal>

        {/* ✅ Disclaimer Modal */}
        <Modal
          visible={showDisclaimerModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDisclaimerModal(false)}
        >
          <View style={disclaimerModalStyles.overlay}>
            <TouchableOpacity
              style={disclaimerModalStyles.backdrop}
              activeOpacity={1}
              onPress={() => setShowDisclaimerModal(false)}
            />
            
            <View style={disclaimerModalStyles.modalContainer}>
              <LinearGradient
                colors={["#fef3c7", "#fde68a"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={disclaimerModalStyles.modal}
              >
                {/* Handle Bar */}
                <View style={disclaimerModalStyles.handleBar} />
                
                {/* Scrollable Content */}
                <ScrollView 
                  showsVerticalScrollIndicator={true}
                  contentContainerStyle={disclaimerModalStyles.scrollContent}
                  bounces={false}
                >
                  {/* Icon */}
                  <View style={disclaimerModalStyles.iconCircle}>
                    <MaterialIcons name="info-outline" size={40} color="#d97706" />
                  </View>
                  
                  {/* Title */}
                  <Text style={disclaimerModalStyles.title}>Important Notice</Text>
                  
                  {/* Disclaimer Text */}
                  <Text style={disclaimerModalStyles.disclaimerText}>
                    The following cognition assessment is <Text style={{ fontFamily: 'Poppins_600SemiBold' }}>not a medical diagnosis</Text>. 
                    It is a general evaluation based on the patient's activity records, medication adherence, and safety incidents.
                  </Text>
                  
                  {/* Additional Info */}
                  <View style={disclaimerModalStyles.infoBox}>
                    <Text style={disclaimerModalStyles.infoText}>
                      This tool provides insights to help caregivers monitor patient wellbeing. 
                      Always consult healthcare professionals for medical advice, diagnosis, or treatment.
                    </Text>
                  </View>
                  
                  {/* Close Button */}
                  <TouchableOpacity
                    style={disclaimerModalStyles.closeButton}
                    onPress={() => setShowDisclaimerModal(false)}
                    activeOpacity={0.9}
                  >
                    <Text style={disclaimerModalStyles.closeButtonText}>I Understand</Text>
                  </TouchableOpacity>
                </ScrollView>
              </LinearGradient>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

/* --- Components --- */

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function QuickActionTitle({ title }: { title: string }) {
  return <Text style={styles.quickactionTitle}>{title}</Text>;
}

type GhostBtnProps = {
  icon: string;
  text: string;
  onPress?: () => void;
};

function GhostBtn({ icon, text, onPress }: GhostBtnProps) {
  return (
    <TouchableOpacity style={styles.ghostBtn} onPress={onPress}>
      <MaterialIcons name={icon as any} size={18} color="#fff" />
      <Text style={styles.ghostBtnText}>{text}</Text>
    </TouchableOpacity>
  );
}

function Card({
  label,
  icon,
  full,
  onPress,
}: {
  label: string;
  icon: string;
  full?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.card, full && { flexBasis: "100%" }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <MaterialIcons name={icon as any} size={32} color="#6366f1" />
      <Text style={styles.cardLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function CardBox({ children }: { children: React.ReactNode }) {
  return <View style={styles.cardBox}>{children}</View>;
}

function ListItem({
  title,
  subtitle,
  icon,
  color,
  bg,
  extra,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  bg: string;
  extra?: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={styles.listCard} activeOpacity={0.75} onPress={onPress}>
      <View style={[styles.iconBg, { backgroundColor: bg }]}>
        <MaterialIcons name={icon as any} size={22} color={color} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.listTitle}>{title}</Text>
        <Text style={styles.smallMuted}>{subtitle}</Text>
      </View>
      {extra ? (
        <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#22c55e" }}>
          {extra}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

// ✅ Updated Medication Adherence Card Component
function MedicationAdherenceCard({ 
  values, 
  loading,
  onRefresh 
}: { 
  values: number[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const CARD_PAD = 20;
  const SVG_W = W - 26 * 2 - CARD_PAD * 2.7;
  const SVG_H = 160;

  const Y_MAX = 100;
  const LEFT = 35;
  const RIGHT = 8;
  const TOP = 10;
  const BOTTOM = 30;
  const PLOT_W = SVG_W - LEFT - RIGHT;
  const PLOT_H = SVG_H - TOP - BOTTOM;

  const BAR_W = 16;
  const totalBarW = BAR_W * values.length;
  const GAP = (PLOT_W - totalBarW) / (values.length - 1);

  const BAR_OFFSET = 6;
  const R = 8;

  const yPos = (v: number) => TOP + (PLOT_H - (v / Y_MAX) * PLOT_H);
  const GRID_END = LEFT + PLOT_W + BAR_OFFSET + 0;

  const barPath = (x: number, y: number, w: number, h: number, r: number) => {
    const x0 = x,
      y0 = y;
    const x1 = x + w,
      y1 = y + h;
    const rr = Math.min(r, w / 2, h);
    return [
      `M ${x0} ${y0 + rr}`,
      `Q ${x0} ${y0} ${x0 + rr} ${y0}`,
      `H ${x1 - rr}`,
      `Q ${x1} ${y0} ${x1} ${y0 + rr}`,
      `V ${y1}`,
      `H ${x0}`,
      `Z`,
    ].join(" ");
  };

  return (
    <View style={styles.cardBox}>
      <View style={styles.rowBetween}>
        <View>
          <Text style={med.title}>Medication Adherence</Text>
          <Text style={med.subtitle}>Last 7 days</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} disabled={loading}>
          <MaterialIcons 
            name={loading ? "hourglass-empty" : "medication"} 
            size={24} 
            color="#6366f1" 
          />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ height: SVG_H, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="small" color="#6366f1" />
        </View>
      ) : (
        <Svg width={SVG_W} height={SVG_H} style={{ marginTop: 6 }}>
          <Defs>
            <SvgGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="rgba(129,140,248,0.35)" />
              <Stop offset="1" stopColor="rgba(129,140,248,0.35)" />
            </SvgGradient>
          </Defs>

          {[{ v: 100, label: "100%" }, { v: 50, label: "50%" }, { v: 0, label: "0%" }].map(
            (t, i) => (
              <SvgText
                key={i}
                x={0}
                y={yPos(t.v) + 3}
                fill="#64748b"
                fontSize={10}
                fontFamily="Poppins_500Medium"
              >
                {t.label}
              </SvgText>
            )
          )}

          <SvgLine x1={LEFT} y1={TOP} x2={LEFT} y2={TOP + PLOT_H} stroke="#E6EBFF" strokeWidth={1} />
          {[0, 50, 100].map((v, i) => (
            <SvgLine
              key={i}
              x1={LEFT}
              y1={yPos(v)}
              x2={GRID_END}
              y2={yPos(v)}
              stroke="#E6EBFF"
              strokeWidth={1}
            />
          ))}

          {values.map((val, i) => {
            const h = (val / Y_MAX) * PLOT_H;
            const x = LEFT + BAR_OFFSET + i * (BAR_W + GAP);
            const y = TOP + (PLOT_H - h);
            return (
              <Path
                key={i}
                d={barPath(x, y, BAR_W, h, R)}
                fill="rgba(179,186,251,0.5)"
                stroke="#7073F2"
                strokeWidth={1}
              />
            );
          })}

          {days.map((d, i) => {
            const x = LEFT + BAR_OFFSET + i * (BAR_W + GAP) + BAR_W / 2;
            
            const today = new Date();
            const currentDayOfWeek = today.getDay();
            const todayIndex = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
            const isToday = i === todayIndex;
            
            return (
              <SvgText
                key={d}
                x={x}
                y={SVG_H - 7}
                textAnchor="middle"
                fill={isToday ? "#6366f1" : "#64748b"}
                fontSize={12}
                fontFamily="Poppins_500Medium"
                fontWeight={isToday ? "700" : "500"}
              >
                {d}
              </SvgText>
            );
          })}
        </Svg>
      )}
    </View>
  );
}

function Ring({ percent }: { percent: number }) {
  const size = 200;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(percent, 100));
  const dash = (c * clamped) / 100;

  return (
    <View style={{ alignSelf: "center", marginTop: 12 }}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#818cf8" />
            <Stop offset="100%" stopColor="#c084fc" />
          </SvgGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#EEF2FF" strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#ringGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${dash}, ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[styles.ringCenter, { top: "36%" }]}>
        <Text style={[styles.ringPercent, { fontSize: 32 }]}>{clamped}%</Text>
        <Text style={[styles.smallMuted, { marginTop: -15 }]}>Adherence</Text>
      </View>
    </View>
  );
}

function ScaleBar({ position = 3 }: { position?: number }) {
  const BAR_W = W - 80;
  const BAR_H = 14;
  const R = BAR_H / 2;
  const SEG = 5;
  const GAP = 6;
  const segW = (BAR_W - GAP * (SEG - 1)) / SEG;
  const segX = (i: number) => i * (segW + GAP);
  
  // Calculate marker position based on cognition level (0-4)
  const markerLeft = segX(position) + segW / 2 - 12;

  const leftRoundedPath = (x: number, y: number, w: number, h: number, r: number) =>
    [
      `M ${x + r},${y}`,
      `H ${x + w}`,
      `V ${y + h}`,
      `H ${x + r}`,
      `Q ${x},${y + h} ${x},${y + h - r}`,
      `V ${y + r}`,
      `Q ${x},${y} ${x + r},${y}`,
      `Z`,
    ].join(" ");

  const rightRoundedPath = (x: number, y: number, w: number, h: number, r: number) => {
    const xr = x + w;
    return [
      `M ${x},${y}`,
      `H ${xr - r}`,
      `Q ${xr},${y} ${xr},${y + r}`,
      `V ${y + h - r}`,
      `Q ${xr},${y + h} ${xr - r},${y + h}`,
      `H ${x}`,
      `Z`,
    ].join(" ");
  };

  return (
    <View style={styles.cogBarWrap}>
      <Svg width={BAR_W} height={BAR_H}>
        <Defs>
          <SvgGradient id="grad1" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor="#f87171" />
            <Stop offset="100%" stopColor="#fb923c" />
          </SvgGradient>
          <SvgGradient id="grad2" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor="#fb923c" />
            <Stop offset="100%" stopColor="#facc15" />
          </SvgGradient>
          <SvgGradient id="grad3" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor="#facc15" />
            <Stop offset="100%" stopColor="#84cc16" />
          </SvgGradient>
          <SvgGradient id="grad4" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor="#84cc16" />
            <Stop offset="100%" stopColor="#22c55e" />
          </SvgGradient>
          <SvgGradient id="grad5" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor="#22c55e" />
            <Stop offset="100%" stopColor="#2dd4bf" />
          </SvgGradient>
        </Defs>

        <Path d={leftRoundedPath(segX(0), 0, segW, BAR_H, R)} fill="url(#grad1)" />
        <Rect x={segX(1)} y={0} width={segW} height={BAR_H} fill="url(#grad2)" />
        <Rect x={segX(2)} y={0} width={segW} height={BAR_H} fill="url(#grad3)" />
        <Rect x={segX(3)} y={0} width={segW} height={BAR_H} fill="url(#grad4)" />
        <Path d={rightRoundedPath(segX(4), 0, segW, BAR_H, R)} fill="url(#grad5)" />
      </Svg>

      <View style={[styles.cognitionMarker, { left: markerLeft, top: -BAR_H - -9 }]}>
        <View style={styles.cognitionMarkerInner} />
      </View>
    </View>
  );
}

/* --- Styles --- */

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowBetweenBtns: { flexDirection: "row", justifyContent: "space-between", marginTop: 20, gap: 13 },

  h1: { fontSize: 28, fontFamily: "Poppins_700Bold", color: "#1e293b", marginBottom: 4 },
  h2White: { fontSize: 22, fontFamily: "Poppins_600SemiBold", color: "#fff" },
  subText: { fontSize: 16, fontFamily: "Poppins_400Regular", color: "#64748b", marginBottom: -5 },
  smallWhite: { fontSize: 12, fontFamily: "Poppins_400Regular", color: "#fff" },
  smallMuted: { fontSize: 14, fontFamily: "Poppins_400Regular", color: "#64748b", marginTop: -4 },

  avatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: "#a5b4fc", marginRight: 12, marginBottom: 10 },
  iconBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", marginBottom: 10 },

  patientCard: { borderRadius: 24, padding: 25, shadowOpacity: 0.2, shadowRadius: 10 },
  rowIcon: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 22 },

  ghostBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 14, paddingHorizontal: 22 },
  ghostBtnText: { color: "#fff", fontFamily: "Poppins_500Medium", marginLeft: 13 },

  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", paddingHorizontal: 24 },
  card: { backgroundColor: "#fff", borderRadius: 20, padding: 20, alignItems: "center", marginBottom: 16, width: "48%", shadowOpacity: 0.05 },
  cardLabel: { marginTop: 8, fontSize: 14, fontFamily: "Poppins_500Medium", color: "#475569" },

  cardBox: { backgroundColor: "#fff", borderRadius: 20, padding: 20, marginBottom: 20, shadowOpacity: 0.05 },
  cardTitle: { fontSize: 16, fontFamily: "Poppins_600SemiBold", color: "#334155", marginBottom: 4 },

  steps: { fontSize: 34, fontFamily: "Poppins_700Bold", color: "#6366F1" },
  stepLabel: { fontSize: 14, fontFamily: "Poppins_500Medium", color: "#64748b", marginLeft: 6, marginTop: 20 },
  minutes: { fontSize: 22, fontFamily: "Poppins_600SemiBold", color: "#475569" },
  minLabel: { fontSize: 14, fontFamily: "Poppins_500Medium", color: "#64748b", marginLeft: 6, marginTop: 9 },

  badge: { fontSize: 12, fontFamily: "Poppins_700Bold", color: "#6366F1", backgroundColor: "#e0e7ff", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: -3 },

  ringCenter: { position: "absolute", top: "40%", left: 0, right: 0, alignItems: "center" },
  ringPercent: { fontSize: 28, fontFamily: "Poppins_700Bold", color: "#1e293b", marginTop: -2 },

  scaleLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  scaleText: { fontSize: 12, fontFamily: "Poppins_400Regular", color: "#64748b" },
  scaleMarker: { position: "absolute", top: -8, right: -8, width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff", borderWidth: 2, borderColor: "#6366F1" },

  listCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 20, padding: 16, marginBottom: 12, shadowOpacity: 0.05 },
  iconBg: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  listTitle: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: "#334155" },

  sectionTitle: { fontSize: 18, fontFamily: "Poppins_600SemiBold", color: "#374151", marginHorizontal: 30, marginTop: 16, marginBottom: 8 },
  quickactionTitle: { fontSize: 18, fontFamily: "Poppins_600SemiBold", color: "#374151", marginHorizontal: 30, marginTop: 28, marginBottom: 8 },

  cogBarWrap: { marginTop: 12, alignItems: "center" },

  cognitionMarker: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: "#6366F1",
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  cognitionMarkerInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#6366F1",
  },
  puoverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  pucentered: {
    width: "100%",
    maxWidth: 400,
  },
  pucardContainer: {
    position: "relative",
  },
  pucloseButton: {
    position: "absolute",
    top: 12,
    left: 12,
    zIndex: 10,
  },
  pucard: {
    borderRadius: 28,
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: "center",
    shadowColor: "#f472b6",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 25,
    elevation: 10,
  },
  puiconWrapper: {
    backgroundColor: "rgba(255,255,255,0.3)",
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  pucardTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 8,
  },
  pualertText: {
    fontSize: 18,
    color: "#fff",
    textAlign: "center",
    marginBottom: 4,
    fontWeight: "500",
  },
  putimestamp: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    marginBottom: 28,
  },
  pubuttonGroup: {
    width: "100%",
    gap: 10,
  },
  puprimaryButton: {
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  puprimaryText: {
    color: "#e11d48",
    fontSize: 17,
    fontWeight: "700",
  },
  pusecondaryButton: {
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.8)",
    borderRadius: 20,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  pusecondaryText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  emptyStateCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyStateTitle: {
    marginTop: 12,
    fontFamily: 'Poppins_600SemiBold',
    color: '#475569',
    fontSize: 16,
  },
  emptyStateSubtitle: {
    marginTop: 4,
    fontFamily: 'Poppins_400Regular',
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
  },
  statPill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statPillLabel: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
    color: '#64748b',
  },
  statPillValue: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 12,
    color: '#334155',
  },
});

const disclaimerModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContainer: {
    maxHeight: '80%',
  },
  modal: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  scrollContent: {
    paddingHorizontal: 28,
    paddingBottom: 28,
    flexGrow: 1,
  },
  handleBar: {
    width: 48,
    height: 5,
    backgroundColor: 'rgba(217, 119, 6, 0.3)',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(217, 119, 6, 0.3)',
  },
  title: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 24,
    color: '#78350f',
    textAlign: 'center',
    marginBottom: 16,
  },
  disclaimerText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    color: '#78350f',
    lineHeight: 26,
    textAlign: 'center',
    marginBottom: 20,
  },
  infoBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.2)',
  },
  infoText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: '#92400e',
    lineHeight: 20,
    textAlign: 'center',
  },
  closeButton: {
    backgroundColor: '#f59e0b',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 8,
  },
  closeButtonText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 17,
    color: '#fff',
  },
});

const med = StyleSheet.create({
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: "#334155",
  },
  subtitle: {
    marginTop: -2,
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: "#94a3b8",
  },
});

const modalStyles = StyleSheet.create({
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
  },
  overlayTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.40)",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 6,
  },
  handleWrap: { alignItems: "center", paddingVertical: 10 },
  handle: { width: 56, height: 6, borderRadius: 3, backgroundColor: "#cbd5e1" },

  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  title: { fontFamily: "Poppins_700Bold", fontSize: 22, color: "#1e293b" },
  subtitle: { fontFamily: "Poppins_400Regular", fontSize: 14, color: "#64748b" },

  section: { borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 16, marginTop: 16 },
  sectionTitle: { fontFamily: "Poppins_600SemiBold", color: "#475569", marginBottom: 10 },

  detailRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8, gap: 12 },
  detailText: { flex: 1, color: "#334155", fontFamily: "Poppins_400Regular", fontSize: 14 },
  detailLabel: { fontFamily: "Poppins_500Medium", color: "#334155" },

  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  statusMain: { fontFamily: "Poppins_600SemiBold", fontSize: 15 },
  statusRight: { fontFamily: "Poppins_500Medium", fontSize: 13 },

  footerRow: { flexDirection: "row", gap: 12, marginTop: 18 },
  closeBtn: {
    flex: 1,
    backgroundColor: "#e5e7eb",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  closeText: { fontFamily: "Poppins_600SemiBold", color: "#334155" },

  editBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#818cf8",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  editText: { fontFamily: "Poppins_600SemiBold", color: "#fff" },
});