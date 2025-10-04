// PatientDashboardScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../app/App';
import AsyncStorage from '@react-native-async-storage/async-storage';
import HealthDataService from '../services/HealthDataService';


import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';

type Props = NativeStackScreenProps<RootStackParamList, 'PatientDashboard'>;

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
};

const AVATAR =
  'https://lh3.googleusercontent.com/a/ACg8ocLw_b_95Zk8i_32X-y1xX8X2-wE9L7KzQ3qE6pB4P-5e_3A=s96-c-rg-br100';

export default function PatientDashboardScreen({ navigation }: Props) {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const [steps, setSteps] = useState(0);
  const [activeMinutes, setActiveMinutes] = useState(0);

  useEffect(() => {
    loadHealthData();
    // Refresh health data every 30 seconds
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

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: C.bgTo }} />;

  const callCaregiver = async () => {
    const phone = '+11234567890'; // <- your caregiver number
    const url = `tel:${phone}`;
    const supported = await Linking.canOpenURL(url);
    if (!supported) Alert.alert('Call not available on this device');
    else Linking.openURL(url);
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
            <Text style={styles.greetName}>John</Text>
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
        <SectionTitle>Upcoming Reminders</SectionTitle>
        <View style={{ paddingHorizontal: 24 }}>
          <View style={[styles.cardRow, { alignItems: 'center' }]}>
            <View style={[styles.iconBox, { backgroundColor: '#ccfbf1' }]}>
              <MaterialIcons name="medication" size={22} color={C.teal500} />
            </View>
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={styles.rowTitle2}>Morning Medication</Text>
              <Text style={styles.rowSmall2}>In 30 minutes</Text>
            </View>
            <View style={styles.timePill}>
              <Text style={styles.timeText}>9:00</Text>
            </View>
          </View>
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

        {/* Recent Activity */}
        <SectionTitle>Recent Activity</SectionTitle>
        <View style={{ paddingHorizontal: 24 }}>
          <RecentRow
            iconBg={C.purple100}
            iconColor={C.purple500}
            title="Susan Recognized"
            time="5 mins ago"
          />
          <RecentRow
            iconBg={C.green100}
            iconColor={C.green500}
            title="Medication taken"
            time="1 hour ago"
            style={{ marginTop: 12 }}
          />
        </View>

        {/* Sign out (small) */}
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

      </ScrollView>
    </View>
  );
}

/* ---------- Small subcomponents ---------- */
const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={styles.sectionTitle}>{children}</Text>
);

const RecentRow: React.FC<{
  iconBg: string;
  iconColor: string;
  title: string;
  time: string;
  style?: any;
}> = ({ iconBg, iconColor, title, time, style }) => (
  <View style={[styles.cardRow, style]}>
    <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
      <MaterialIcons name="face" size={24} color={iconColor} />
    </View>
    <View style={{ marginLeft: 12, flex: 1 }}>
      <Text style={styles.rowTitleMed}>{title}</Text>
      <Text style={styles.rowSmall}>{time}</Text>
    </View>
    <MaterialIcons name="more-vert" size={22} color={C.slate400} />
  </View>
);

const handleSignOut = async (navigation: Props['navigation']) => {
  try {
    await AsyncStorage.multiRemove(['role', 'userEmail', 'token']); // whatever keys you use
  } catch {}
  navigation.replace('Login');
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
  borderColor: '#f8e2e2ff', // light red border
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

});
