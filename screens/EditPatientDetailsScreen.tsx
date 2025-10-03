import { MaterialIcons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
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

type Props = NativeStackScreenProps<RootStackParamList, 'EditPatientDetails'>;

/* ───────── Design Tokens (match mock) ───────── */
const C = {
  bgFrom: '#e0e7ff',
  bgTo:   '#f0f4ff',
  slate800: '#1e293b',
  slate700: '#334155',
  slate600: '#475569',
  slate500: '#64748b',
  slate400: '#94a3b8',
  white: '#ffffff',
  inputBg: '#f8fafc',
  inputBorder: '#e2e8f0',
  indigo500: '#6366f1',
  btnFrom: '#818cf8',
  btnTo: '#6366f1',
};

const R = {
  cardRadius: 20,
  avatar: 128,
};

/* Reusable field (single + multiline) */
const Field: React.FC<{
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  multiline?: boolean;
}> = ({ label, value, onChangeText, multiline }) => {
  const [focus, setFocus] = useState(false);
  const b = focus ? C.indigo500 : C.inputBorder;

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={[styles.inputWrap, { borderColor: b }]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          style={[styles.input, multiline && { height: 120, textAlignVertical: 'top' }]}
          multiline={!!multiline}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          placeholderTextColor={C.slate500}
          placeholder={`Enter ${label.toLowerCase()}`}
          autoCorrect={false}
          autoCapitalize="words"
        />
      </View>
    </View>
  );
};

const EditPatientDetailsScreen: React.FC<Props> = ({ navigation }) => {
  const [fontsLoaded] = useFonts({
    Poppins_300Light,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });
  const { patient, updatePatient } = usePatient();

  const [form, setForm] = useState(() => ({
    name: patient?.name || '',
    stage: patient?.stage || '',
    dob: patient?.dob || '',
    address: patient?.address || '',
    emergency: patient?.emergency || '',
    allergies: patient?.allergies || '',
    meds: patient?.meds || '',
    conditions: patient?.conditions || '',
    notes: patient?.notes || '',
    likes: patient?.likes || '',
    avatar: patient?.avatar,
  }));
  const [avatar, setAvatar] = useState<string | undefined>(patient?.avatar);

  const set = (key: keyof typeof form) => (t: string) =>
    setForm((p) => ({ ...p, [key]: t }));

  const spacer = useMemo(() => <View style={{ width: 32 }} />, []);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to set an avatar.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!res.canceled) {
      const uri = res.assets[0].uri;
      setAvatar(uri);
      setForm((p) => ({ ...p, avatar: uri }));
    }
  };

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: C.bgTo }} />;

  return (
    <View style={{ flex: 1, backgroundColor: C.bgTo }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <MaterialIcons name="arrow-back-ios-new" size={20} color={C.slate600} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Patient Details</Text>
        {spacer}
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 28 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
          {/* Avatar + name card */}
          <View style={[styles.card, { marginTop: 8 }]}>
            <View style={{ alignItems: 'center' }}>
              <View style={{ position: 'relative' }}>
                <View style={styles.avatar}>
                  {avatar ? (
                    <Image source={{ uri: avatar }} style={styles.avatarImg} />
                  ) : (
                    <MaterialIcons name="person" size={64} color={C.slate400} />
                  )}
                </View>
                <TouchableOpacity style={styles.cameraFab} onPress={pickImage} activeOpacity={0.85}>
                  <MaterialIcons name="photo-camera" size={22} color="#fff" />
                </TouchableOpacity>
              </View>

              <View style={{ width: '100%', marginTop: 24 }}>
                <Field label="Full Name" value={form.name} onChangeText={set('name')} />
                <Field label="Dementia Stage" value={form.stage} onChangeText={set('stage')} />
              </View>
            </View>
          </View>

          {/* Personal Info */}
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <View style={styles.card}>
            <Field label="Date of Birth" value={form.dob} onChangeText={set('dob')} />
            <Field label="Address" value={form.address} onChangeText={set('address')} />
            <Field label="Emergency Contact" value={form.emergency} onChangeText={set('emergency')} />
          </View>

          {/* Medical Details */}
          <Text style={styles.sectionTitle}>Medical Details</Text>
          <View style={styles.card}>
            <Field label="Allergies" value={form.allergies} onChangeText={set('allergies')} />
            <Field label="Current Medications" value={form.meds} onChangeText={set('meds')} />
            <Field label="Medical Conditions" value={form.conditions} onChangeText={set('conditions')} />
          </View>

          {/* Preferences & Notes */}
          <Text style={styles.sectionTitle}>Preferences & Notes</Text>
          <View style={styles.card}>
            <Field label="Notes for Care" value={form.notes} onChangeText={set('notes')} multiline />
            <Field label="Likes & Dislikes" value={form.likes} onChangeText={set('likes')} multiline />
          </View>

          {/* Footer buttons */}
          <View style={styles.footerRow}>
            <TouchableOpacity style={styles.cancelBtn} activeOpacity={0.9} onPress={() => navigation.goBack()}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.95}
              onPress={() => { updatePatient(form); navigation.goBack(); }}>
              <LinearGradient colors={[C.btnFrom, C.btnTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.saveBtn}>
                <MaterialIcons name="save" size={20} color="#fff" />
                <Text style={styles.saveText}>Save Changes</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

/* ───────── Styles (crafted to match the mock exactly) ───────── */
const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 52 : 28,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: { padding: 6 },
  headerTitle: {
    fontSize: 20,
    color: C.slate800,
    fontFamily: 'Poppins_700Bold',
  },

  card: {
    backgroundColor: C.white,
    borderRadius: R.cardRadius,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    marginBottom: 24,
  },

  avatar: {
    width: R.avatar,
    height: R.avatar,
    borderRadius: R.avatar / 2,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: C.white,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: R.avatar / 2,
  },
  cameraFab: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.indigo500,
    shadowColor: C.indigo500,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },

  sectionTitle: {
    marginTop: 8,
    marginBottom: 12,
    paddingHorizontal: 2,
    fontSize: 18,
    color: C.slate700,
    fontFamily: 'Poppins_600SemiBold',
  },

  inputLabel: {
    fontSize: 14,
    color: C.slate600,
    fontFamily: 'Poppins_600SemiBold',
    marginBottom: 8,
  },
  inputWrap: {
    backgroundColor: C.inputBg,
    borderWidth: 2,
    borderColor: C.inputBorder,
    borderRadius: 12,
    overflow: 'hidden',
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 16 : 12,
    color: C.slate700,
    fontSize: 15,
    fontFamily: 'Poppins_500Medium',
    minHeight: 50,
  },

  footerRow: {
    marginTop: 28,
    marginBottom: 24,
    flexDirection: 'row',
    gap: 16,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#e2e8f0',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  cancelText: {
    color: C.slate600,
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
  },
  saveBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: C.btnTo,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  saveText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#fff',
    fontFamily: 'Poppins_600SemiBold',
  },
});

export default EditPatientDetailsScreen;
