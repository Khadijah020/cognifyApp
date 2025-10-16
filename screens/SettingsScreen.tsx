import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { RootStackParamList } from '../app/App';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../src/lib/supabase';

import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from '@expo-google-fonts/poppins';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

const C = {
  bgFrom: '#e0e7ff',
  bgTo: '#f0f4ff',
  slate900: '#0f172a',
  slate800: '#1e293b',
  slate700: '#334155',
  slate600: '#475569',
  slate500: '#64748b',
  slate400: '#94a3b8',
  slate300: '#cbd5e1',
  white: '#fff',
  indigo100: '#eef2ff',
  indigo300: '#c7d2fe',
  indigo500: '#6366f1',
  purple100: '#f3e8ff',
  purple500: '#a855f7',
  blue100: '#dbeafe',
  blue500: '#3b82f6',
  cardShadow: 'rgba(0,0,0,0.05)',
};

const GRAD = ['#a5b4fc', '#818cf8'];

const Toggle = ({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) => {
  const x = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(x, { toValue: value ? 1 : 0, duration: 220, useNativeDriver: false }).start();
  }, [value]);

  const trackBg = x.interpolate({
    inputRange: [0, 1],
    outputRange: [C.indigo100, GRAD[1]],
  });

  const thumbTranslate = x.interpolate({
    inputRange: [0, 1],
    outputRange: [4, 24],
  });

  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={{ width: 48, height: 28, borderRadius: 34, overflow: 'hidden' }}
      hitSlop={8}
    >
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: trackBg,
          borderRadius: 34,
        }}
      />
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          borderRadius: 34,
          opacity: x,
          backgroundColor: 'transparent',
        }}
      >
        <View style={[StyleSheet.absoluteFill, { backgroundColor: GRAD[0], opacity: 0.45 }]} />
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: C.white,
          bottom: 4,
          transform: [{ translateX: thumbTranslate }],
          shadowColor: '#000',
          shadowOpacity: 0.12,
          shadowRadius: 2,
          shadowOffset: { width: 0, height: 1 },
          elevation: 2,
        }}
      />
    </Pressable>
  );
};

interface PatientInfo {
  full_name: string;
  dementia_stage: string;
}

const SettingsScreen: React.FC<Props> = ({ navigation }) => {
  const { isDark, toggleTheme } = useTheme();

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const [pushNotifications, setPushNotifications] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [patientLoading, setPatientLoading] = useState(true);
  const [hasPatient, setHasPatient] = useState(false);

  const bannerOpacity = useRef(new Animated.Value(0)).current;
  const bannerY = useRef(new Animated.Value(-50)).current;

  useEffect(() => {
    (async () => {
      try {
        const p = await AsyncStorage.getItem('pushNotifications');
        const s = await AsyncStorage.getItem('smsAlerts');
        if (p !== null) setPushNotifications(JSON.parse(p));
        if (s !== null) setSmsAlerts(JSON.parse(s));
      } catch {}
    })();
  }, []);

  useEffect(() => {
    fetchPatientInfo();
  }, []);

  const fetchPatientInfo = async () => {
    setPatientLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const caregiverId = session?.user?.id;

      if (!caregiverId) {
        console.warn('No caregiver session found');
        setPatientLoading(false);
        return;
      }

      // Fetch patient from patients table
      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .select('id, full_name')
        .eq('caregiver_id', caregiverId)
        .single();

      // If patient not found, set hasPatient to false
      if (patientError) {
        if (patientError.code === 'PGRST116') {
          // No rows returned - patient doesn't exist
          setHasPatient(false);
        } else {
          console.error('Error fetching patient:', patientError.message);
        }
        setPatientLoading(false);
        return;
      }

      // Patient exists, fetch patient details for dementia stage
      const { data: detailsData, error: detailsError } = await supabase
        .from('patient_details')
        .select('dementia_stage')
        .eq('patient_id', patientData.id)
        .single();

      if (detailsError) {
        console.error('Error fetching patient details:', detailsError.message);
      }

      setPatient({
        full_name: patientData.full_name,
        dementia_stage: detailsData?.dementia_stage || 'N/A',
      });
      setHasPatient(true);
    } catch (err) {
      console.error('Unexpected error fetching patient:', err);
    } finally {
      setPatientLoading(false);
    }
  };

  const persist = async (key: string, val: boolean) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(val));
    } catch {}
  };

  const togglePref = (key: 'pushNotifications' | 'smsAlerts', val: boolean, setter: (v: boolean) => void) => {
    const next = !val;
    setter(next);
    persist(key, next);
  };

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: C.bgTo }} />;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={C.slate600} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 36 : 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileCard} onTouchEnd={() => navigation.navigate('EditCaregiverProfile')}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>EC</Text>
          </View>
          <View style={{ marginLeft: 14, flex: 1 }}>
            <Text style={styles.profileName}>Emily Carter</Text>
            <Text style={styles.profileEmail}>emily.carter@example.com</Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={C.slate400} />
        </View>

        <Text style={styles.sectionTitle}>Patient Profile</Text>

        {patientLoading ? (
          <View style={[styles.rowCard, { justifyContent: 'center', alignItems: 'center', minHeight: 80 }]}>
            <ActivityIndicator size="large" color={C.indigo500} />
          </View>
        ) : hasPatient && patient ? (
          <View style={styles.rowCard} onTouchEnd={() => navigation.navigate('PatientDetails')}>
            <View style={[styles.iconBg, { backgroundColor: C.indigo100 }]}>
              <MaterialIcons name="face" size={22} color={C.indigo500} />
            </View>
            <View style={{ marginLeft: 14, flex: 1 }}>
              <Text style={styles.rowTitle}>{patient.full_name}</Text>
              <Text style={styles.rowSub}>Stage {patient.dementia_stage}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={C.slate400} />
          </View>
        ) : (
          <TouchableOpacity activeOpacity={0.9} style={styles.addPatient} onPress={() => navigation.navigate('AddPatient')}>
            <View style={[styles.iconBg, { backgroundColor: '#f1f5f9' }]}>
              <MaterialIcons name="add" size={22} color={C.slate500} />
            </View>
            <Text style={styles.addPatientText}>Add New Patient</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.sectionTitle}>Account Management</Text>

        <View style={styles.groupCard}>
          <TouchableOpacity activeOpacity={0.8} style={styles.groupRow} onPress={() => navigation.navigate('ChangeEmail')}>
            <View style={[styles.iconBg, { backgroundColor: C.purple100 }]}>
              <MaterialIcons name="mail" size={20} color={C.purple500} />
            </View>
            <Text style={styles.groupText}>Change Email ID</Text>
            <MaterialIcons name="chevron-right" size={22} color={C.slate400} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity activeOpacity={0.8} style={styles.groupRow} onPress={() => navigation.navigate('ChangePassword')}>
            <View style={[styles.iconBg, { backgroundColor: C.purple100 }]}>
              <MaterialIcons name="lock" size={20} color={C.purple500} />
            </View>
            <Text style={styles.groupText}>Change Password</Text>
            <MaterialIcons name="chevron-right" size={22} color={C.slate400} />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Preferences</Text>

        <View style={styles.groupCard}>
          <View style={styles.prefRow}>
            <View style={styles.prefLeft}>
              <View style={[styles.iconBg, { backgroundColor: C.blue100 }]}>
                <MaterialIcons name="notifications" size={20} color={C.blue500} />
              </View>
              <Text style={styles.groupText}>Push Notifications</Text>
            </View>
            <Toggle value={pushNotifications} onChange={(v) => togglePref('pushNotifications', !v, setPushNotifications)} />
          </View>

          <View style={styles.divider} />

          <View style={styles.prefRow}>
            <View style={styles.prefLeft}>
              <View style={[styles.iconBg, { backgroundColor: C.blue100 }]}>
                <MaterialIcons name="sms" size={20} color={C.blue500} />
              </View>
              <Text style={styles.groupText}>SMS Alerts</Text>
            </View>
            <Toggle value={smsAlerts} onChange={(v) => togglePref('smsAlerts', !v, setSmsAlerts)} />
          </View>

          <View style={styles.divider} />

          <View style={styles.prefRow}>
            <View style={styles.prefLeft}>
              <View style={[styles.iconBg, { backgroundColor: C.blue100 }]}>
                <MaterialIcons name="dark-mode" size={20} color={C.blue500} />
              </View>
              <Text style={styles.groupText}>Dark Mode</Text>
            </View>
            <Toggle value={isDark} onChange={() => toggleTheme()} />
          </View>
        </View>

        <Text style={styles.sectionTitle}>API Configuration</Text>

        <View style={styles.groupCard}>
          <TouchableOpacity 
            activeOpacity={0.8} 
            style={styles.groupRow} 
            onPress={() => navigation.navigate('ApiConfiguration')}
          >
            <View style={[styles.iconBg, { backgroundColor: '#dcfce7' }]}>
              <MaterialIcons name="cloud" size={20} color="#22c55e" />
            </View>
            <Text style={styles.groupText}>Ngrok URL Settings</Text>
            <MaterialIcons name="chevron-right" size={22} color={C.slate400} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.logoutBtn}
          activeOpacity={0.85}
          onPress={async () => {
            try {
              await AsyncStorage.clear();
              navigation.replace('Login');
            } catch (err) {
              console.error('Error logging out:', err);
            }
          }}
        >
          <MaterialIcons name="logout" size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bgTo,
  },

  header: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 56 : 32,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    marginRight: 14,
  },
  headerTitle: {
    marginTop: 6,
    marginLeft: 50,
    fontSize: 24,
    color: C.slate800,
    fontFamily: 'Poppins_700Bold',
  },

  profileCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: C.indigo300,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: C.slate700,
  },
  profileName: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: C.slate800,
  },
  profileEmail: {
    marginTop: 2,
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: C.slate500,
  },

  sectionTitle: {
    marginTop: 26,
    marginBottom: 12,
    paddingHorizontal: 2,
    fontSize: 18,
    color: C.slate700,
    fontFamily: 'Poppins_600SemiBold',
  },

  rowCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  iconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: C.slate700,
  },
  rowSub: {
    marginTop: 2,
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: C.slate500,
  },

  addPatient: {
    marginTop: 14,
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: C.slate300,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  addPatientText: {
    marginLeft: 14,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: C.slate700,
  },

  groupCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  groupRow: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupText: {
    marginLeft: 14,
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    color: C.slate700,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#eef2f7',
    marginHorizontal: 20,
  },

  prefRow: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  prefLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  logoutBtn: {
    marginTop: 30,
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  logoutText: {
    marginLeft: 10,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: '#ef4444',
  },
});

export default SettingsScreen;