import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
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
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../src/lib/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'EditPatientDetails'>;

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
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
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

interface EditableField {
  key: keyof PatientData;
  label: string;
  bg: string;
  icon: React.ReactNode;
  multiline?: boolean;
}

const EditPatientDetailsScreen: React.FC<Props> = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const [patient, setPatient] = useState<PatientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [avatar, setAvatar] = useState<string>('');

  useEffect(() => {
    fetchPatientDetails();
  }, []);

  const fetchPatientDetails = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const caregiverId = session?.user?.id;

      if (!caregiverId) {
        console.warn('No caregiver session found');
        setLoading(false);
        return;
      }

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

      const { data: detailsData, error: detailsError } = await supabase
        .from('patient_details')
        .select('*')
        .eq('patient_id', patientData.id)
        .single();

      if (detailsError) {
        console.error('Error fetching patient details:', detailsError.message);
      }

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
      setAvatar(flattenedData.avatar_uri);
    } catch (err) {
      console.error('Unexpected error fetching patient details:', err);
    } finally {
      setLoading(false);
    }
  };

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
      await uploadAvatar(uri);
    }
  };

  const uploadAvatar = async (uri: string) => {
    if (!patient) return;

    try {
      setSaving(true);
      const fileName = `${patient.patient_id}_avatar_${Date.now()}.jpg`;
      const formData = new FormData();
      formData.append('file', {
        uri,
        name: fileName,
        type: 'image/jpeg',
      } as any);

      const { data, error } = await supabase.storage
        .from('patient_avatars')
        .upload(fileName, formData);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('patient_avatars')
        .getPublicUrl(fileName);

      // Update patient_details with new avatar
      const { error: updateError } = await supabase
        .from('patient_details')
        .update({ avatar_uri: urlData.publicUrl })
        .eq('patient_id', patient.patient_id);

      if (updateError) throw updateError;

      setPatient((p) => (p ? { ...p, avatar_uri: urlData.publicUrl } : p));
    } catch (err) {
      console.error('Avatar upload error:', err);
      Alert.alert('Upload failed', 'Could not upload avatar.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (fieldKey: string, currentValue: string) => {
    setEditingField(fieldKey);
    setEditValue(currentValue);
  };

  const saveFieldChange = async (fieldKey: keyof PatientData) => {
    if (!patient) return;

    try {
      setSaving(true);

      // Determine which table and field to update
      const fieldsInPatients = ['email', 'full_name'];
      let updateData: any = {};

      if (fieldsInPatients.includes(fieldKey)) {
        // Update patients table
        updateData[fieldKey === 'full_name' ? 'full_name' : 'email'] = editValue;
        const { error } = await supabase
          .from('patients')
          .update(updateData)
          .eq('id', patient.patient_id);

        if (error) throw error;
      } else {
        // Update patient_details table
        updateData[fieldKey] = editValue;
        const { error } = await supabase
          .from('patient_details')
          .update(updateData)
          .eq('patient_id', patient.patient_id);

        if (error) throw error;
      }

      // Update local state
      setPatient((p) => (p ? { ...p, [fieldKey]: editValue } : p));
      setEditingField(null);
      setEditValue('');
      Alert.alert('Success', 'Field updated successfully!');
    } catch (err) {
      console.error('Update error:', err);
      Alert.alert('Error', 'Failed to update field.');
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const safe = (v?: string) => (v && String(v).trim().length ? String(v) : '—');

  const gradientColors = isDark ? ['#0f0f1a', '#1a1a2e'] : [COLORS.bgFrom, COLORS.bgTo];

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
        <Text style={{ color: isDark ? '#9ca3af' : COLORS.slate500 }}>No patient details found.</Text>
      </View>
    );
  }

  const editableFields: EditableField[] = [
    {
      key: 'email',
      label: 'Patient Email',
      bg: COLORS.blue100,
      icon: <MaterialIcons name="email" size={22} color={COLORS.blue500} />,
    },
    {
      key: 'dob',
      label: 'Date of Birth',
      bg: COLORS.indigo100,
      icon: <MaterialIcons name="cake" size={22} color={COLORS.indigo500} />,
    },
    {
      key: 'address',
      label: 'Address',
      bg: COLORS.purple100,
      icon: <MaterialIcons name="home" size={22} color={COLORS.purple500} />,
    },
    {
      key: 'emergency_contact',
      label: 'Emergency Contact',
      bg: COLORS.teal100,
      icon: <MaterialIcons name="call" size={22} color={COLORS.teal500} />,
    },
    {
      key: 'allergies',
      label: 'Allergies',
      bg: COLORS.red100,
      icon: <MaterialIcons name="warning-amber" size={22} color={COLORS.red500} />,
    },
    {
      key: 'medications',
      label: 'Current Medications',
      bg: COLORS.blue100,
      icon: <MaterialCommunityIcons name="medical-bag" size={22} color={COLORS.blue500} />,
    },
    {
      key: 'conditions',
      label: 'Medical Conditions',
      bg: COLORS.green100,
      icon: <MaterialCommunityIcons name="heart-pulse" size={22} color={COLORS.green500} />,
    },
    {
      key: 'notes',
      label: 'Notes for Care',
      bg: COLORS.yellow100,
      icon: <MaterialIcons name="lightbulb" size={22} color={COLORS.yellow500} />,
      multiline: true,
    },
    {
      key: 'likes',
      label: 'Likes & Dislikes',
      bg: COLORS.pink100,
      icon: <MaterialIcons name="thumb-up" size={22} color={COLORS.pink500} />,
      multiline: true,
    },
  ];

  return (
    <View style={styles.root}>
      <LinearGradient colors={gradientColors} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: isDark ? '#1e1e36' : COLORS.white }]} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back-ios-new" size={20} color={isDark ? '#9ca3af' : COLORS.slate600} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDark ? '#e5e7eb' : COLORS.slate800 }]}>Edit Patient Details</Text>
        <View style={[styles.headerAvatar, { backgroundColor: isDark ? '#7c3aed' : '#6366f1' }]}>
          <Text style={styles.headerAvatarText}>
            {patient?.full_name
              ? patient.full_name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)
              : 'PT'}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Card */}
          <View style={[styles.card, { marginTop: 8, backgroundColor: isDark ? '#1e1e36' : COLORS.white }]}>
            <View style={{ alignItems: 'center' }}>
              <View style={{ position: 'relative' }}>
                <View style={[styles.avatar, { backgroundColor: isDark ? '#2d2a4a' : '#e2e8f0', borderColor: isDark ? '#1e1e36' : COLORS.white }]}>
                  {avatar ? (
                    <Image source={{ uri: avatar }} style={styles.avatarImg} />
                  ) : (
                    <MaterialIcons name="person" size={64} color={isDark ? '#6b7280' : COLORS.slate400} />
                  )}
                </View>
                <TouchableOpacity
                  style={styles.cameraFab}
                  onPress={pickImage}
                  disabled={saving}
                >
                  <MaterialIcons name="photo-camera" size={22} color="#fff" />
                </TouchableOpacity>
              </View>

              <Text style={[styles.name, { color: isDark ? '#e5e7eb' : COLORS.slate800 }]}>{safe(patient?.full_name)}</Text>
              <Text style={[styles.stage, { color: isDark ? '#9ca3af' : COLORS.slate500 }]}>Stage: {safe(patient?.dementia_stage)}</Text>
            </View>
          </View>

          {/* Personal Information */}
          <Text style={[styles.sectionTitle, { color: isDark ? '#e5e7eb' : COLORS.slate700 }]}>Personal Information</Text>
          <View style={[styles.card, { gap: 20, backgroundColor: isDark ? '#1e1e36' : COLORS.white }]}>
            {editableFields.slice(0, 4).map((field) => (
              <EditableRow
                key={field.key}
                field={field}
                value={safe(patient[field.key])}
                isEditing={editingField === field.key}
                editValue={editValue}
                onEdit={() => startEdit(field.key, patient[field.key])}
                onSave={() => saveFieldChange(field.key)}
                onCancel={cancelEdit}
                onChangeText={setEditValue}
                isSaving={saving}
                isDark={isDark}
              />
            ))}
          </View>

          {/* Medical Details */}
          <Text style={[styles.sectionTitle, { color: isDark ? '#e5e7eb' : COLORS.slate700 }]}>Medical Details</Text>
          <View style={[styles.card, { gap: 20, backgroundColor: isDark ? '#1e1e36' : COLORS.white }]}>
            {editableFields.slice(4, 7).map((field) => (
              <EditableRow
                key={field.key}
                field={field}
                value={safe(patient[field.key])}
                isEditing={editingField === field.key}
                editValue={editValue}
                onEdit={() => startEdit(field.key, patient[field.key])}
                onSave={() => saveFieldChange(field.key)}
                onCancel={cancelEdit}
                onChangeText={setEditValue}
                isSaving={saving}
                isDark={isDark}
              />
            ))}
          </View>

          {/* Preferences & Notes */}
          <Text style={[styles.sectionTitle, { color: isDark ? '#e5e7eb' : COLORS.slate700 }]}>Preferences & Notes</Text>
          <View style={[styles.card, { gap: 20, backgroundColor: isDark ? '#1e1e36' : COLORS.white }]}>
            {editableFields.slice(7).map((field) => (
              <EditableRow
                key={field.key}
                field={field}
                value={safe(patient[field.key])}
                isEditing={editingField === field.key}
                editValue={editValue}
                onEdit={() => startEdit(field.key, patient[field.key])}
                onSave={() => saveFieldChange(field.key)}
                onCancel={cancelEdit}
                onChangeText={setEditValue}
                isSaving={saving}
                isDark={isDark}
              />
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

interface EditableRowProps {
  field: EditableField;
  value: string;
  isEditing: boolean;
  editValue: string;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onChangeText: (text: string) => void;
  isSaving: boolean;
  isDark?: boolean;
}

const EditableRow: React.FC<EditableRowProps> = ({
  field,
  value,
  isEditing,
  editValue,
  onEdit,
  onSave,
  onCancel,
  onChangeText,
  isSaving,
  isDark,
}) => {
  if (isEditing) {
    return (
      <View>
        <Text style={[styles.label, { color: isDark ? '#9ca3af' : COLORS.slate500 }]}>{field.label}</Text>
        <View style={[styles.inputWrap, { backgroundColor: isDark ? '#2d2a4a' : '#f8fafc', borderColor: isDark ? '#6366f1' : COLORS.indigo500 }]}>
          <TextInput
            value={editValue}
            onChangeText={onChangeText}
            style={[styles.editInput, field.multiline && { height: 100, textAlignVertical: 'top' }, { color: isDark ? '#e5e7eb' : COLORS.slate700 }]}
            multiline={field.multiline}
            autoFocus
            editable={!isSaving}
            placeholderTextColor={isDark ? '#6b7280' : COLORS.slate500}
          />
        </View>
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: isDark ? '#374151' : COLORS.gray200 }]}
            onPress={onCancel}
            disabled={isSaving}
          >
            <Text style={[styles.actionBtnText, { color: isDark ? '#e5e7eb' : COLORS.slate600 }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: isDark ? '#7c3aed' : COLORS.btnTo }]}
            onPress={onSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={[styles.actionBtnText, { color: '#fff' }]}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      <View style={[styles.iconBg, { backgroundColor: field.bg }]}>{field.icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.label, { color: isDark ? '#9ca3af' : COLORS.slate500 }]}>{field.label}</Text>
        <Text style={[styles.value, { color: isDark ? '#e5e7eb' : COLORS.slate700 }]}>{value}</Text>
      </View>
      <TouchableOpacity onPress={onEdit} style={styles.editBtn} disabled={isSaving}>
        <MaterialIcons name="edit" size={20} color={isDark ? '#9ca3af' : COLORS.slate500} />
      </TouchableOpacity>
    </View>
  );
};

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
    flex: 1,
    textAlign: 'center',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  headerAvatarText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 14,
    color: '#ffffff',
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
    marginBottom: 24,
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
  cameraFab: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.indigo500,
    alignItems: 'center',
    justifyContent: 'center',
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
  editBtn: {
    padding: 8,
  },
  inputWrap: {
    backgroundColor: '#f8fafc',
    borderWidth: 2,
    borderColor: COLORS.indigo500,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 12,
    overflow: 'hidden',
  },
  editInput: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: COLORS.slate700,
    fontSize: 15,
    fontFamily: 'Poppins_500Medium',
    minHeight: 50,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
  },
});

export default EditPatientDetailsScreen;