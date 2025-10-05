// PatientDetailsScreen.tsx
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { RootStackParamList } from '../app/App';
import { usePatient } from '../contexts/PatientContext';

import {
  Poppins_300Light,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from '@expo-google-fonts/poppins';

type Props = NativeStackScreenProps<RootStackParamList, 'PatientDetails'>;

/* ───────── Design Tokens ───────── */
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

const R = {
  cardRadius: 20,
  chipRadius: 12,
  avatarSize: 128,
};

const PatientDetailsScreen: React.FC<Props> = ({ navigation }) => {
  const [fontsLoaded] = useFonts({
    Poppins_300Light,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  // Use patient data from context
  const { patient } = usePatient();

  // Local toggle for showing/hiding patient sign-in password
  const [showPassword, setShowPassword] = useState(false);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: COLORS.bgTo }} />;
  }

  // Safe formatting helpers
  const safe = (v?: string) => (v && String(v).trim().length ? String(v) : '—');
  const masked = (v?: string) =>
    v && v.length ? '•'.repeat(Math.min(v.length, 12)) : '—';

  const patientEmail = safe(patient?.email);
  // NOTE: only show stored password if you actually keep a temp password in state.
  // Prefer reset links in production; this is per your request.
  const patientPasswordRaw = patient?.password as string | undefined;
  const patientPasswordShown = showPassword
    ? safe(patientPasswordRaw)
    : masked(patientPasswordRaw);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[COLORS.bgFrom, COLORS.bgTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          activeOpacity={0.8}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons
            name="arrow-back-ios-new"
            size={20}
            color={COLORS.slate600}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Patient Details</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={[styles.card, { marginTop: 8 }]}>
          <View style={{ alignItems: 'center' }}>
            <View style={{ position: 'relative' }}>
              <View style={styles.avatar}>
                {patient?.avatar ? (
                  <Image
                    source={{ uri: patient.avatar }}
                    style={styles.avatarImg}
                  />
                ) : (
                  <MaterialIcons
                    name="person"
                    size={64}
                    color={COLORS.slate400}
                  />
                )}
              </View>
              <View style={styles.statusDotWrap}>
                <View style={styles.statusDot} />
              </View>
            </View>

            <Text style={styles.name}>{safe(patient?.name)}</Text>
            <Text style={styles.stage}>{safe(patient?.stage)}</Text>
          </View>
        </View>

        {/* Personal Information */}
        <Text style={styles.sectionTitle}>Personal Information</Text>
        <View style={[styles.card, { gap: 24 }]}>
          {/* NEW: Patient sign-in email */}
          <Row
            bg={COLORS.blue100}
            icon={<MaterialIcons name="email" size={22} color={COLORS.blue500} />}
            label="Patient Email"
            value={patientEmail}
          />

          {/* NEW: Patient sign-in password (masked with eye toggle) */}
          <RowPassword
            bg={COLORS.teal100}
            icon={<MaterialIcons name="lock" size={22} color={COLORS.teal500} />}
            label="Patient Password"
            value={patientPasswordShown}
            onToggle={() => setShowPassword((s) => !s)}
            toggled={showPassword}
          />

          {/* Existing fields */}
          <Row
            bg={COLORS.indigo100}
            icon={<MaterialIcons name="cake" size={22} color={COLORS.indigo500} />}
            label="Date of Birth"
            value={safe(patient?.dob)}
          />
          <Row
            bg={COLORS.purple100}
            icon={<MaterialIcons name="home" size={22} color={COLORS.purple500} />}
            label="Address"
            value={safe(patient?.address)}
          />
          <Row
            bg={COLORS.teal100}
            icon={<MaterialIcons name="call" size={22} color={COLORS.teal500} />}
            label="Emergency Contact"
            value={safe(patient?.emergency)}
          />
        </View>

        {/* Medical Details */}
        <Text style={styles.sectionTitle}>Medical Details</Text>
        <View style={[styles.card, { gap: 24 }]}>
          <Row
            bg={COLORS.red100}
            icon={<MaterialIcons name="warning-amber" size={22} color={COLORS.red500} />}
            label="Allergies"
            value={safe(patient?.allergies)}
          />
          <Row
            bg={COLORS.blue100}
            icon={<MaterialCommunityIcons name="medical-bag" size={22} color={COLORS.blue500} />}
            label="Current Medications"
            value={safe(patient?.meds)}
          />
          <Row
            bg={COLORS.green100}
            icon={<MaterialCommunityIcons name="heart-pulse" size={22} color={COLORS.green500} />}
            label="Medical Conditions"
            value={safe(patient?.conditions)}
          />
        </View>

        {/* Preferences & Notes */}
        <Text style={styles.sectionTitle}>Preferences & Notes</Text>
        <View style={[styles.card]}>
          <View style={{ flexDirection: 'row' }}>
            <IconChip bg={COLORS.yellow100}>
              <MaterialIcons name="lightbulb" size={22} color={COLORS.yellow500} />
            </IconChip>
            <View style={{ marginLeft: 16, flex: 1 }}>
              <Text style={styles.itemTitle}>Notes for Care</Text>
              <Text style={styles.bodyText}>{safe(patient?.notes)}</Text>
            </View>
          </View>

          <View
            style={{ height: 1, backgroundColor: '#eaeef5', marginVertical: 20 }}
          />

          <View style={{ flexDirection: 'row' }}>
            <IconChip bg={COLORS.pink100}>
              <MaterialIcons name="thumb-up" size={22} color={COLORS.pink500} />
            </IconChip>
            <View style={{ marginLeft: 16, flex: 1 }}>
              <Text style={styles.itemTitle}>Likes & Dislikes</Text>
              <Text style={styles.bodyText}>{safe(patient?.likes)}</Text>
            </View>
          </View>
        </View>

        {/* CTA */}
        <View style={{ marginTop: 36, marginBottom: 24 }}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              navigation.navigate('EditPatientDetails', { patient: {} as any });
            }}
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

/* ───────── Small sub-components ───────── */
const IconChip: React.FC<{ bg: string; children: React.ReactNode }> = ({ bg, children }) => (
  <View style={[styles.iconBg, { backgroundColor: bg }]}>{children}</View>
);

const Row: React.FC<{
  bg: string;
  icon: React.ReactNode;
  label: string;
  value: string;
}> = ({ bg, icon, label, value }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    <IconChip bg={bg}>{icon}</IconChip>
    <View style={{ marginLeft: 16, flex: 1 }}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  </View>
);

// Row with eye toggle on the right (for password)
const RowPassword: React.FC<{
  bg: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  toggled: boolean;
  onToggle: () => void;
}> = ({ bg, icon, label, value, toggled, onToggle }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    <IconChip bg={bg}>{icon}</IconChip>
    <View style={{ marginLeft: 16, flex: 1 }}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
    <TouchableOpacity
      onPress={onToggle}
      style={styles.eyeBtn}
      accessibilityRole="button"
      accessibilityLabel={toggled ? 'Hide password' : 'Show password'}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <MaterialIcons
        name={toggled ? 'visibility-off' : 'visibility'}
        size={20}
        color={COLORS.slate500}
      />
    </TouchableOpacity>
  </View>
);

/* ───────── Styles ───────── */
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

  /* Profile */
  avatar: {
    width: R.avatarSize,
    height: R.avatarSize,
    borderRadius: R.avatarSize / 2,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: COLORS.white,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
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

  itemTitle: {
    fontSize: 15,
    color: COLORS.slate700,
    fontFamily: 'Poppins_600SemiBold',
  },
  bodyText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.slate600,
    fontFamily: 'Poppins_400Regular',
  },

  cta: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.btnTo,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  ctaText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#fff',
    fontFamily: 'Poppins_600SemiBold',
  },

  eyeBtn: {
    padding: 6,
    marginLeft: 8,
  },
});

export default PatientDetailsScreen;
