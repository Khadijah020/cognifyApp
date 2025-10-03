// AddPatientScreen.tsx
import React, { useEffect, useState } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../app/App';

import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';

type Props = NativeStackScreenProps<RootStackParamList, 'AddPatient'>;

type Patient = {
  id: string;
  fullName: string;
  dementiaStage: string;
  dob: string;
  address: string;
  emergencyContact: string;
  allergies: string;
  medications: string;
  conditions: string;
  careNotes: string;
  likes: string;
  avatarUri: string | null;
  createdAt: string;
};

const STORAGE_KEY = 'patients_list';

export default function AddPatientScreen({ navigation }: Props) {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  // form state
  const [fullName, setFullName] = useState('');
  const [dementiaStage, setDementiaStage] = useState('');
  const [dob, setDob] = useState('');
  const [address, setAddress] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [allergies, setAllergies] = useState('');
  const [medications, setMedications] = useState('');
  const [conditions, setConditions] = useState('');
  const [careNotes, setCareNotes] = useState('');
  const [likes, setLikes] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  useEffect(() => {
    // ask media permission once
    ImagePicker.requestMediaLibraryPermissionsAsync();
  }, []);

  const pickAvatar = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });
      if (!res.canceled && res.assets?.[0]?.uri) setAvatarUri(res.assets[0].uri);
    } catch {
      Alert.alert('Error', 'Unable to pick photo right now.');
    }
  };

  const savePatient = async () => {
    if (!fullName.trim()) {
      Alert.alert('Missing Info', 'Please enter the patient’s full name.');
      return;
    }

    const newPatient: Patient = {
      id: Date.now().toString(),
      fullName: fullName.trim(),
      dementiaStage: dementiaStage.trim(),
      dob: dob.trim(),
      address: address.trim(),
      emergencyContact: emergencyContact.trim(),
      allergies: allergies.trim(),
      medications: medications.trim(),
      conditions: conditions.trim(),
      careNotes: careNotes.trim(),
      likes: likes.trim(),
      avatarUri,
      createdAt: new Date().toISOString(),
    };

    try {
      const existing = await AsyncStorage.getItem(STORAGE_KEY);
      const arr: Patient[] = existing ? JSON.parse(existing) : [];
      arr.unshift(newPatient);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
      Alert.alert('Success', 'Patient added successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert('Error', 'Failed to save patient. Please try again.');
    }
  };

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: '#f0f4ff' }} />;

  const S = styles;

  return (
    <View style={S.root}>
      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity style={S.back} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back-ios-new" size={20} color="#475569" />
        </TouchableOpacity>
        <Text style={S.headerTitle}>Add New Patient</Text>
        <View style={{ width: 20 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28 }}
        >
          {/* Top Card: avatar + basic fields */}
          <View style={S.card}>
            <View style={{ alignItems: 'center' }}>
              <View style={{ position: 'relative' }}>
                <View style={S.avatarCircle}>
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={{ width: '100%', height: '100%', borderRadius: 64 }} />
                  ) : (
                    <MaterialIcons name="person-add" size={56} color="#cbd5e1" />
                  )}
                </View>
                <TouchableOpacity style={S.camBtn} onPress={pickAvatar}>
                  <MaterialIcons name="add-a-photo" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ marginTop: 24 }}>
              <Input label="Full Name" placeholder="Enter full name" value={fullName} onChangeText={setFullName} />
              <View style={{ height: 12 }} />
              <Input
                label="Dementia Stage"
                placeholder="e.g., Stage 4 Dementia"
                value={dementiaStage}
                onChangeText={setDementiaStage}
              />
            </View>
          </View>

          {/* Personal Information */}
          <SectionTitle>Personal Information</SectionTitle>
          <View style={S.card}>
            <Input label="Date of Birth" placeholder="e.g., January 1, 1950" value={dob} onChangeText={setDob} />
            <Spacer />
            <Input label="Address" placeholder="Enter address" value={address} onChangeText={setAddress} />
            <Spacer />
            <Input
              label="Emergency Contact"
              placeholder="e.g., Name (Relation) - Phone"
              value={emergencyContact}
              onChangeText={setEmergencyContact}
            />
          </View>

          {/* Medical Details */}
          <SectionTitle>Medical Details</SectionTitle>
          <View style={S.card}>
            <Input
              label="Allergies"
              placeholder="List any known allergies"
              value={allergies}
              onChangeText={setAllergies}
            />
            <Spacer />
            <Input
              label="Current Medications"
              placeholder="List current medications"
              value={medications}
              onChangeText={setMedications}
            />
            <Spacer />
            <Input
              label="Medical Conditions"
              placeholder="List other medical conditions"
              value={conditions}
              onChangeText={setConditions}
            />
          </View>

          {/* Preferences & Notes */}
          <SectionTitle>Preferences & Notes</SectionTitle>
          <View style={S.card}>
            <Input
              label="Notes for Care"
              placeholder="Add important care notes..."
              multiline
              value={careNotes}
              onChangeText={setCareNotes}
            />
            <Spacer />
            <Input
              label="Likes & Dislikes"
              placeholder="e.g., Likes: Music, Puzzles. Dislikes: ..."
              multiline
              value={likes}
              onChangeText={setLikes}
            />
          </View>

          {/* Footer buttons */}
          <View style={S.footerRow}>
            <TouchableOpacity style={S.cancelBtn} onPress={() => navigation.goBack()}>
              <Text style={S.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.9} onPress={savePatient} style={{ flex: 1 }}>
              <LinearGradient colors={['#818cf8', '#6366f1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={S.addBtn}>
                <MaterialIcons name="person-add" size={22} color="#fff" />
                <Text style={S.addText}>Add{'\n'}Patient</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/* Reusable small pieces */
const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <Text style={styles.sectionTitle}>{children}</Text>
);

const Spacer = () => <View style={{ height: 14 }} />;

function Input({
  label,
  placeholder,
  value,
  onChangeText,
  multiline,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  multiline?: boolean;
}) {
  return (
    <View>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.textarea]}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0f4ff' },

  header: {
    paddingTop: Platform.OS === 'ios' ? 56 : 32,
    paddingBottom: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: {
    padding: 8,
  },
  headerTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 22,
    color: '#1f2937',
  },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
    marginTop: 12,
  },

  avatarCircle: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: '#e2e8f0',
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  camBtn: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },

  inputLabel: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: '#475569',
    marginBottom: 8,
    marginLeft: 2,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    color: '#334155',
    fontFamily: 'Poppins_500Medium',
    fontSize: 15,
    height: 48,
  },
  textarea: {
    minHeight: 120,
    paddingTop: 12,
    height: undefined,
  },

  sectionTitle: {
    marginTop: 22,
    marginLeft: 8,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: '#334155',
  },

  footerRow: {
    marginTop: 26,
    marginBottom: 12,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'stretch',
  },
  cancelBtn: {
    backgroundColor: '#e2e8f0',
    borderRadius: 16,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
    height: 60,
    minWidth: 120,
  },
  cancelText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: '#475569',
  },
  addBtn: {
    height: 60,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
    shadowColor: 'rgba(129,140,248,0.4)',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  addText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 18,
  },
});
