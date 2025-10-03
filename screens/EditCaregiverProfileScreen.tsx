// EditCaregiverProfileScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
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

type Props = NativeStackScreenProps<RootStackParamList, 'EditCaregiverProfile'>;

const STORAGE_KEY = 'caregiver_profile';

export default function EditCaregiverProfileScreen({ navigation }: Props) {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const [fullName, setFullName] = useState('Emily Carter');
  const [email, setEmail] = useState('emily.carter@example.com');
  const [phone, setPhone] = useState('+1 (123) 456-7890');
  const [address, setAddress] = useState('123 Maple Street, Anytown');
  const [avatarUri, setAvatarUri] = useState<string | null>(
    'https://lh3.googleusercontent.com/a/ACg8ocLw_b_95Zk8i_32X-y1xX8X2-wE9L7KzQ3qE6pB4P-5e_3A=s96-c-rg-br100'
  );

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const p = JSON.parse(stored);
          setFullName(p.fullName ?? fullName);
          setEmail(p.email ?? email);
          setPhone(p.phone ?? phone);
          setAddress(p.address ?? address);
          setAvatarUri(p.avatarUri ?? avatarUri);
        }
      } catch {}
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
    if (!res.canceled && res.assets?.[0]?.uri) setAvatarUri(res.assets[0].uri);
  };

  const save = async () => {
    if (!fullName.trim()) return Alert.alert('Full Name required', 'Please enter your full name.');
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) return Alert.alert('Invalid Email', 'Please enter a valid email address.');

    const payload = { fullName: fullName.trim(), email: email.trim(), phone: phone.trim(), address: address.trim(), avatarUri };
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      Alert.alert('Saved', 'Profile updated successfully.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch {
      Alert.alert('Error', 'Failed to save your profile. Please try again.');
    }
  };

  const S = styles;

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: '#e9efff' }} />;

  return (
    <View style={S.container}>
      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity style={S.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={S.headerTitle}>Edit Profile</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          {/* Avatar */}
          <View style={{ alignItems: 'center', marginTop: 8 }}>
            <View style={S.avatarWrap}>
              <Image
                source={{
                  uri:
                    avatarUri ??
                    'https://lh3.googleusercontent.com/a/ACg8ocLw_b_95Zk8i_32X-y1xX8X2-wE9L7KzQ3qE6pB4P-5e_3A=s96-c-rg-br100',
                }}
                style={S.avatar}
              />
              <TouchableOpacity activeOpacity={0.9} style={S.editBadge} onPress={pickImage}>
                <MaterialIcons name="edit" size={16} color="#fff" />
              </TouchableOpacity>
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
              />
            </View>

            <View>
              <Text style={S.label}>Email Address</Text>
              <TextInput
                style={S.input}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                placeholder="email@example.com"
                placeholderTextColor="#94a3b8"
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
              />
            </View>

            <View>
              <Text style={S.label}>Address</Text>
              <TextInput
                style={S.input}
                value={address}
                onChangeText={setAddress}
                placeholder="Street, City"
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>

          {/* Save button */}
          <TouchableOpacity activeOpacity={0.9} style={{ marginTop: 36 }} onPress={save}>
            <LinearGradient colors={['#a5b4fc', '#6366f1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={S.saveBtn}>
              <Text style={S.saveText}>Save Changes</Text>
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
    // EXACT soft indigo gradient look (static)
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
    marginLeft: 37,
  },

  avatarWrap: {
    width: 112, // w-28
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
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  // Gradient for edit badge
  editBadgeBg: {},
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
});
