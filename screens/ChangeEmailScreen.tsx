// ChangeEmailScreen.tsx
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
  Alert,
  Animated,
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

import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from '@expo-google-fonts/poppins';

type Props = NativeStackScreenProps<RootStackParamList, 'ChangeEmail'>;

const C = {
  bgTop: '#e0e7ff',
  bgBottom: '#f0f4ff',
  card: '#ffffff',
  text: '#0f172a',
  slate700: '#334155',
  slate600: '#475569',
  slate500: '#64748b',
  slate400: '#94a3b8',
  inputBg: '#f8fafc',
  inputBorder: '#e2e8f0',
  disabledBg: '#e2e8f0',
  disabledText: '#64748b',
  gradFrom: '#8b5cf6',
  gradTo: '#6366f1',
  success: '#10b981',
  shadow: '#000',
};

export default function ChangeEmailScreen({ navigation }: Props) {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const [currentEmail, setCurrentEmail] = useState('emily.carter@example.com');
  const [newEmail, setNewEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [hidePw, setHidePw] = useState(true);

  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [loading, setLoading] = useState(false);
  const bannerOpacity = useState(new Animated.Value(0))[0];
  const bannerY = useState(new Animated.Value(-50))[0];

  const validateEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const toast = () => {
    setShowSuccessBanner(true);
    Animated.parallel([
      Animated.timing(bannerOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(bannerY, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() =>
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(bannerOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
          Animated.timing(bannerY, { toValue: -50, duration: 250, useNativeDriver: true }),
        ]).start(() => setShowSuccessBanner(false))
      }, 2500)
    );
  };

  const handleSave = async () => {
    if (!validateEmail(newEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    if (newEmail !== confirmEmail) {
      Alert.alert('Email Mismatch', 'New email and confirmation do not match.');
      return;
    }
    if (!password) {
      Alert.alert('Password Required', 'Enter your current password.');
      return;
    }
    if (newEmail === currentEmail) {
      Alert.alert('Same Email', 'Please use a different email.');
      return;
    }

    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 1200)); // simulate API
      await AsyncStorage.setItem('userEmail', newEmail);
      setCurrentEmail(newEmail);
      setNewEmail('');
      setConfirmEmail('');
      setPassword('');
      toast();
    } catch {
      Alert.alert('Error', 'Failed to update email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: C.bgBottom }} />;

  return (
    <View style={s.root}>
      {/* success banner */}
      {showSuccessBanner && (
        <Animated.View
          style={[
            s.banner,
            { opacity: bannerOpacity, transform: [{ translateY: bannerY }] },
          ]}
        >
          <MaterialIcons name="check-circle" size={20} color="#fff" />
          <Text style={s.bannerTxt}>Email updated successfully!</Text>
        </Animated.View>
      )}

      {/* header */}
      <View style={s.header}>
        <TouchableOpacity style={s.back} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={C.slate600} />
        </TouchableOpacity>
        <Text style={s.title}>Change Email ID</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
        >
          {/* card */}
          <View style={s.card}>
            {/* Current email */}
            <Text style={s.label}>Current Email Address</Text>
            <TextInput
              value={currentEmail}
              editable={false}
              style={[s.input, { backgroundColor: '#eef2f7', color: C.slate500 }]}
            />

            {/* New email */}
            <Text style={[s.label, { marginTop: 18 }]}>New Email Address</Text>
            <TextInput
              style={s.input}
              placeholder="Enter your new email"
              placeholderTextColor={C.slate400}
              value={newEmail}
              onChangeText={setNewEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* Confirm email */}
            <Text style={[s.label, { marginTop: 18 }]}>Confirm New Email</Text>
            <TextInput
              style={s.input}
              placeholder="Confirm your new email"
              placeholderTextColor={C.slate400}
              value={confirmEmail}
              onChangeText={setConfirmEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* Password */}
            <Text style={[s.label, { marginTop: 18 }]}>Current Password</Text>
            <View style={{ position: 'relative' }}>
              <TextInput
                style={[s.input, { paddingRight: 44 }]}
                placeholder="Enter your password"
                placeholderTextColor={C.slate400}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={hidePw}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={s.eye}
                onPress={() => setHidePw((v) => !v)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialIcons
                  name={hidePw ? 'visibility-off' : 'visibility'}
                  size={22}
                  color={C.slate400}
                />
              </TouchableOpacity>
            </View>
            <Text style={s.helper}>
              For security, please enter your password to make this change.
            </Text>
          </View>

          {/* gradient pill button */}
          <View style={{ paddingHorizontal: 24, marginTop: 28 }}>
            <TouchableOpacity activeOpacity={0.9} onPress={handleSave} disabled={loading}>
              <LinearGradient
                colors={[C.gradFrom, C.gradTo]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[s.cta, loading && { opacity: 0.7 }]}
              >
                <Text style={s.ctaTxt}>{loading ? 'Updating…' : 'Update Email'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bgBottom,
  },
  banner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    right: 20,
    backgroundColor: C.success,
    borderRadius: 12,
    padding: 14,
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: C.shadow,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  bannerTxt: {
    color: '#fff',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
  },

  header: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 58 : 36,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  title: {
    marginLeft: 20,
    fontSize: 22,
    color: C.text,
    fontFamily: 'Poppins_700Bold',
  },

  card: {
    marginTop: 18,
    marginHorizontal: 24,
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 24,
    shadowColor: C.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },

  label: {
    fontSize: 16, color: C.text, marginBottom: 8, fontFamily: 'Poppins_600SemiBold'
  },
  input: {
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.inputBorder,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: C.slate700,
  },
  eye: { position: 'absolute', right: 12, top: 12 },
  helper: {
    marginTop: 8,
    fontSize: 12,
    color: C.slate400,
    fontFamily: 'Poppins_400Regular',
  },

  cta: {
    height: 50,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7c83ff',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  ctaTxt: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
  },
}); 