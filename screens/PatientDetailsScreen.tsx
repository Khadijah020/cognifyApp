import {
    Poppins_300Light,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    useFonts,
} from '@expo-google-fonts/poppins';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { RootStackParamList } from '../app/App';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../src/lib/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'PatientDetails'>;

const COLORS = {
  bgFrom: '#e0e7ff',
  bgTo: '#f0f4ff',
  slate800: '#1e293b',
  slate700: '#334155',
  slate600: '#475569',
  slate500: '#64748b',
  slate400: '#94a3b8',
  slate100: '#f1f5f9',
  white: '#ffffff',
  indigo100: '#e0e7ff',
  indigo500: '#6366f1',
  purple100: '#f3e8ff',
  purple500: '#a855f7',
  teal100: '#ccfbf1',
  teal500: '#14b8a6',
  red100: '#fee2e2',
  red500: '#ef4444',
  blue100: '#dbeafe',
  blue500: '#3b82f6',
  green100: '#dcfce7',
  green500: '#22c55e',
  yellow100: '#fef9c3',
  yellow500: '#eab308',
  pink100: '#ffe4e6',
  pink500: '#ec4899',
  btnFrom: '#818cf8',
  btnTo: '#6366f1',
};

const R = { cardRadius: 20, chipRadius: 12, avatarSize: 128 };

interface PatientData {
  patient_id: string;
  email: string;
  full_name: string;
  dob: string;
  address: string;
  emergency_contact: string;
  allergies: string;
  medications: string;
  conditions: string;
  dementia_stage: string;
  likes: string;
  notes: string;
  avatar_uri: string;
}

const PatientDetailsScreen: React.FC<Props> = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const [fontsLoaded] = useFonts({
    Poppins_300Light,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const [patient, setPatient] = useState<PatientData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPatient = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const caregiverId = session?.user?.id;

        if (!caregiverId) {
          console.warn('No caregiver session found');
          setLoading(false);
          return;
        }

        // First get the patient assigned to this caregiver
        const { data: patientData, error: patientError } = await supabase
          .from('patients')
          .select('id, email, full_name')
          .eq('caregiver_id', caregiverId)
          .single();

        if (patientError) {
          console.error('Error fetching patient:', patientError.message);
          setLoading(false);
          return;
        }

        // Then get the patient details using the patient_id
        const { data: detailsData, error: detailsError } = await supabase
          .from('patient_details')
          .select('*')
          .eq('patient_id', patientData.id)
          .single();

        if (detailsError) {
          console.error('Error fetching patient details:', detailsError.message);
        }

        // Combine the data
        const flattenedData: PatientData = {
          patient_id: patientData.id,
          email: patientData.email,
          full_name: patientData.full_name,
          dob: detailsData?.dob || '',
          address: detailsData?.address || '',
          emergency_contact: detailsData?.emergency_contact || '',
          allergies: detailsData?.allergies || '',
          medications: detailsData?.medications || '',
          conditions: detailsData?.conditions || '',
          dementia_stage: detailsData?.dementia_stage || '',
          likes: detailsData?.likes || '',
          notes: detailsData?.notes || '',
          avatar_uri: detailsData?.avatar_uri || '',
        };
        setPatient(flattenedData);
      } catch (err) {
        console.error('Unexpected error fetching patient details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPatient();
  }, []);

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: isDark ? '#0f0f1a' : COLORS.bgTo }} />;

  if (loading) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#0f0f1a' : COLORS.bgTo }]}>
        <ActivityIndicator size="large" color={isDark ? '#a78bfa' : COLORS.btnTo} />
        <Text style={{ marginTop: 12, color: isDark ? '#9ca3af' : COLORS.slate500 }}>Loading patient details...</Text>
      </View>
    );
  }

  if (!patient) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#0f0f1a' : COLORS.bgTo }]}>
        <Text style={{ color: isDark ? '#9ca3af' : COLORS.slate500 }}>No patient details found for this caregiver.</Text>
      </View>
    );
  }

  const safe = (v?: string) => (v && String(v).trim().length ? String(v) : '—');
  const gradientColors = isDark ? ['#0f0f1a', '#1a1a2e'] : [COLORS.bgFrom, COLORS.bgTo];

  return (
    <View style={styles.root}>
      <LinearGradient colors={gradientColors} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: isDark ? '#1e1e36' : COLORS.white }]} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back-ios-new" size={20} color={isDark ? '#9ca3af' : COLORS.slate600} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDark ? '#e5e7eb' : COLORS.slate800 }]}>Patient Details</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={[styles.card, { marginTop: 8, backgroundColor: isDark ? '#1e1e36' : COLORS.white }]}>
          <View style={{ alignItems: 'center' }}>
            <View style={{ position: 'relative' }}>
              <View style={styles.avatar}>
                {patient?.avatar_uri ? (
                  <Image source={{ uri: patient.avatar_uri }} style={styles.avatarImg} />
                ) : (
                  <MaterialIcons name="person" size={64} color={isDark ? '#6b7280' : COLORS.slate400} />
                )}
              </View>
              <View style={styles.statusDotWrap}>
                <View style={styles.statusDot} />
              </View>
            </View>

            <Text style={[styles.name, { color: isDark ? '#e5e7eb' : COLORS.slate800 }]}>{safe(patient?.full_name)}</Text>
            <Text style={[styles.stage, { color: isDark ? '#a78bfa' : COLORS.indigo500 }]}>
              {patient?.dementia_stage ? `Stage ${patient.dementia_stage}` : '—'}
              {patient?.conditions ? ` • ${patient.conditions}` : ''}
            </Text>
          </View>
        </View>

        {/* Personal Information */}
        <Text style={[styles.sectionTitle, { color: isDark ? '#e5e7eb' : COLORS.slate700 }]}>Personal Information</Text>
        <View style={[styles.card, { gap: 24, backgroundColor: isDark ? '#1e1e36' : COLORS.white }]}>
          <Row
            bg={COLORS.blue100}
            icon={<MaterialIcons name="email" size={22} color={COLORS.blue500} />}
            label="Patient Email"
            value={safe(patient?.email)}
            isDark={isDark}
          />
          <Row
            bg={COLORS.indigo100}
            icon={<MaterialIcons name="cake" size={22} color={COLORS.indigo500} />}
            label="Date of Birth"
            value={safe(patient?.dob)}
            isDark={isDark}
          />
          <Row
            bg={COLORS.purple100}
            icon={<MaterialIcons name="home" size={22} color={COLORS.purple500} />}
            label="Address"
            value={safe(patient?.address)}
            isDark={isDark}
          />
          <Row
            bg={COLORS.teal100}
            icon={<MaterialIcons name="call" size={22} color={COLORS.teal500} />}
            label="Emergency Contact"
            value={safe(patient?.emergency_contact)}
            isDark={isDark}
          />
        </View>

        {/* Medical Details */}
        <Text style={[styles.sectionTitle, { color: isDark ? '#e5e7eb' : COLORS.slate700 }]}>Medical Details</Text>
        <View style={[styles.card, { gap: 24, backgroundColor: isDark ? '#1e1e36' : COLORS.white }]}>
          <Row
            bg={COLORS.red100}
            icon={<MaterialIcons name="warning-amber" size={22} color={COLORS.red500} />}
            label="Allergies"
            value={safe(patient?.allergies)}
            isDark={isDark}
          />
          <Row
            bg={COLORS.blue100}
            icon={<MaterialCommunityIcons name="medical-bag" size={22} color={COLORS.blue500} />}
            label="Current Medications"
            value={safe(patient?.medications)}
            isDark={isDark}
          />
          <Row
            bg={COLORS.green100}
            icon={<MaterialCommunityIcons name="heart-pulse" size={22} color={COLORS.green500} />}
            label="Medical Conditions"
            value={safe(patient?.conditions)}
            isDark={isDark}
          />
        </View>

        {/* Preferences & Notes */}
        <Text style={[styles.sectionTitle, { color: isDark ? '#e5e7eb' : COLORS.slate700 }]}>Preferences & Notes</Text>
        <View style={[styles.card, { backgroundColor: isDark ? '#1e1e36' : COLORS.white }]}>
          <Row
            bg={COLORS.yellow100}
            icon={<MaterialIcons name="lightbulb" size={22} color={COLORS.yellow500} />}
            label="Notes for Care"
            value={safe(patient?.notes)}
            isDark={isDark}
          />
          <Row
            bg={COLORS.pink100}
            icon={<MaterialIcons name="thumb-up" size={22} color={COLORS.pink500} />}
            label="Likes & Dislikes"
            value={safe(patient?.likes)}
            isDark={isDark}
          />
        </View>

        {/* Edit Button */}
        <View style={{ marginTop: 36, marginBottom: 24 }}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => navigation.navigate('EditPatientDetails')}
          >
            <LinearGradient
              colors={[COLORS.btnFrom, COLORS.btnTo]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cta}
            >
              <MaterialIcons name="edit" size={22} color="#fff" />
              <Text style={styles.ctaText}>Edit Patient Details</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const Row = ({
  bg,
  icon,
  label,
  value,
  isDark,
}: {
  bg: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  isDark?: boolean;
}) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
    <View style={[styles.iconBg, { backgroundColor: bg }]}>{icon}</View>
    <View style={{ flex: 1 }}>
      <Text style={[styles.label, { color: isDark ? '#9ca3af' : COLORS.slate500 }]}>{label}</Text>
      <Text style={[styles.value, { color: isDark ? '#e5e7eb' : COLORS.slate700 }]}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: { padding: 6 },
  headerTitle: {
    fontSize: 22,
    color: COLORS.slate800,
    fontFamily: 'Poppins_700Bold',
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: R.cardRadius,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  avatar: {
    width: R.avatarSize,
    height: R.avatarSize,
    borderRadius: R.avatarSize / 2,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: COLORS.white,
  },
  avatarImg: {
    width: R.avatarSize,
    height: R.avatarSize,
    borderRadius: R.avatarSize / 2,
  },
  statusDotWrap: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.green500,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  name: {
    marginTop: 18,
    fontSize: 28,
    color: COLORS.slate800,
    fontFamily: 'Poppins_700Bold',
    textAlign: 'center',
  },
  stage: {
    marginTop: 4,
    fontSize: 14,
    color: COLORS.slate500,
    fontFamily: 'Poppins_400Regular',
    textAlign: 'center',
  },
  sectionTitle: {
    marginTop: 22,
    marginBottom: 12,
    paddingHorizontal: 2,
    fontSize: 18,
    color: COLORS.slate700,
    fontFamily: 'Poppins_600SemiBold',
  },
  iconBg: {
    width: 48,
    height: 48,
    borderRadius: R.chipRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    color: COLORS.slate500,
    fontFamily: 'Poppins_400Regular',
  },
  value: {
    marginTop: 2,
    fontSize: 15,
    color: COLORS.slate700,
    fontFamily: 'Poppins_600SemiBold',
  },
  cta: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#fff',
    fontFamily: 'Poppins_600SemiBold',
  },
});

export default PatientDetailsScreen;