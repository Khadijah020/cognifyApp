// EditCaregiverProfileScreen.tsx
import {
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    useFonts,
} from '@expo-google-fonts/poppins';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
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

type Props = NativeStackScreenProps<RootStackParamList, 'EditCaregiverProfile'>;

const DEFAULT_AVATAR_URI =
  'https://lh3.googleusercontent.com/a/ACg8ocLw_b_95Zk8i_32X-y1xX8X2-wE9L7KzQ3qE6pB4P-5e_3A=s96-c-rg-br100';

export default function EditCaregiverProfileScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme();
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [caregiverId, setCaregiverId] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(DEFAULT_AVATAR_URI);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          Alert.alert('Error', 'Unable to fetch user information.');
          setLoading(false);
          return;
        }

        setCaregiverId(user.id);

        const { data, error } = await supabase
          .from('caregivers')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Fetch error:', error);
          Alert.alert('Error', 'Failed to load profile.');
          setLoading(false);
          return;
        }

        setFullName(data.full_name || '');
        setEmail(data.email || '');
        setPhone(data.phone || '');
        setAvatarUri(data.avatar_uri || DEFAULT_AVATAR_URI);
        setLoading(false);
      } catch (err) {
        console.error('Unexpected error:', err);
        Alert.alert('Error', 'An unexpected error occurred.');
        setLoading(false);
      }
    })();
  }, []);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Please allow photo access to change your avatar.');
      return;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });

    if (!res.canceled) {
      const uri = res.assets[0].uri;
      await uploadAvatar(uri);
    }
  };

  const uploadAvatar = async (uri: string) => {
    if (!caregiverId) {
      Alert.alert('Error', 'Unable to determine user ID.');
      return;
    }

    const previousAvatarUri = avatarUri;
    setAvatarUri(uri);
    setSaving(true);

    try {
      const filePath = `${caregiverId}/avatar_${Date.now()}.jpg`;
      const formData = new FormData();
      formData.append('file', {
        uri,
        name: 'avatar.jpg',
        type: 'image/jpeg',
      } as any);

      const { error: uploadError } = await supabase.storage
        .from('caregiver_avatars')
        .upload(filePath, formData);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('caregiver_avatars')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('caregivers')
        .update({ avatar_uri: urlData.publicUrl })
        .eq('id', caregiverId);

      if (updateError) throw updateError;

      setAvatarUri(urlData.publicUrl);
      Alert.alert('Avatar Updated', 'Your profile picture has been saved.');
    } catch (err: any) {
      console.error('Caregiver avatar upload error:', err);
      setAvatarUri(previousAvatarUri);
      Alert.alert(
        'Upload failed',
        err?.message || 'Could not upload avatar. Check that the caregiver_avatars bucket and caregivers.avatar_uri column exist.'
      );
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    if (!fullName.trim()) {
      return Alert.alert('Full Name required', 'Please enter your full name.');
    }
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) {
      return Alert.alert('Invalid Email', 'Please enter a valid email address.');
    }
    if (!caregiverId) {
      return Alert.alert('Error', 'Unable to determine user ID.');
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('caregivers')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim(),
        })
        .eq('id', caregiverId);

      if (error) {
        Alert.alert('Error', 'Failed to save profile: ' + error.message);
        setSaving(false);
        return;
      }

      Alert.alert('Success', 'Profile updated successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      console.error('Save error:', err);
      Alert.alert('Error', 'Failed to save your profile. Please try again.');
      setSaving(false);
    }
  };

  const S = styles;
  if (!fontsLoaded || loading) {
    return (
      <View style={[S.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <View style={[S.container, { backgroundColor: isDark ? '#0f0f1a' : '#f0f4ff' }]}>
      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity style={[S.backBtn, { backgroundColor: isDark ? '#1e1e36' : '#ffffff' }]} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={isDark ? '#9ca3af' : '#0f172a'} />
        </TouchableOpacity>
        <Text style={[S.headerTitle, { color: isDark ? '#e5e7eb' : '#0f172a' }]}>Edit Profile</Text>
        <View style={[S.avatarCircle, { backgroundColor: isDark ? '#7c3aed' : '#6366f1' }]}>
          <Text style={S.avatarInitials}>{getInitials(fullName || 'CG')}</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar */}
          <View style={{ alignItems: 'center', marginTop: 24 }}>
            <View style={S.avatarOuter}>
              <View style={S.avatarInner}>
                <Image
                  source={{
                    uri:
                      avatarUri ??
                      DEFAULT_AVATAR_URI,
                  }}
                  style={S.avatar}
                />
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={S.editBadge}
                  onPress={pickImage}
                >
                  <MaterialIcons name="edit" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Form */}
          <View style={{ marginTop: 28, gap: 20 }}>
            <View>
              <Text style={S.label}>Full Name</Text>
              <TextInput
                style={S.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Full Name"
                placeholderTextColor="#94a3b8"
                editable={!saving}
              />
            </View>

            <View>
              <Text style={S.label}>Email Address (Read-only)</Text>
              <TextInput
                style={[S.input, { color: '#94a3b8' }]}
                value={email}
                placeholder="email@example.com"
                placeholderTextColor="#94a3b8"
                editable={false}
              />
            </View>

            <View>
              <Text style={S.label}>Phone Number</Text>
              <TextInput
                style={S.input}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                placeholder="+1 (000) 000-0000"
                placeholderTextColor="#94a3b8"
                editable={!saving}
              />
            </View>
          </View>

          {/* Save button */}
          <TouchableOpacity
            activeOpacity={0.9}
            style={{ marginTop: 40 }}
            onPress={save}
            disabled={saving}
          >
            <LinearGradient
              colors={['#a5b4fc', '#6366f1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[S.saveBtn, saving && { opacity: 0.6 }]}
            >
              <Text style={S.saveText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4ff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingBottom: 8,
    paddingHorizontal: 24,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    marginRight: 12,
  },
  headerTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 22,
    color: '#0f172a',
    flex: 1,
    textAlign: 'center',
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  avatarInitials: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 16,
    color: '#ffffff',
  },
  avatarWrap: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 4,
    borderColor: '#ffffff',
    overflow: 'hidden',
    backgroundColor: '#eef2ff',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  avatar: { width: '100%', height: '100%' },
  editBadge: {
    position: 'absolute',
    right: 6,
    bottom: -2,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  label: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: '#475569',
    marginLeft: 2,
    marginBottom: 6,
  },
  input: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    color: '#334155',
    backgroundColor: '#f8f9ff',
    borderWidth: 1,
    borderColor: '#e0e7ff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  saveBtn: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(129,140,248,0.5)',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  saveText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 18,
    color: '#fff',
  },
  avatarOuter: {
    width: 126,
    height: 126,
    borderRadius: 63,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  avatarInner: {
    width: 112,
    height: 112,
    borderRadius: 56,
    overflow: 'hidden',
  },
});
