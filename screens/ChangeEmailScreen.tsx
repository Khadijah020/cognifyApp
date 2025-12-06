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
import { useTheme } from '../contexts/ThemeContext';

import {
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    useFonts,
} from '@expo-google-fonts/poppins';

type Props = NativeStackScreenProps<RootStackParamList, 'ChangeEmail'>;

export default function ChangeEmailScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme();
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

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  const s = createStyles(colors, isDark);

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
          <Ionicons name="arrow-back" size={22} color={colors.text} />
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
              style={[s.input, s.disabledInput]}
            />

            {/* New email */}
            <Text style={[s.label, { marginTop: 18 }]}>New Email Address</Text>
            <TextInput
              style={s.input}
              placeholder="Enter your new email"
              placeholderTextColor={colors.placeholder}
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
              placeholderTextColor={colors.placeholder}
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
                placeholderTextColor={colors.placeholder}
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
                  color={colors.placeholder}
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
                colors={isDark ? ['#7c3aed', '#6366f1'] : ['#8b5cf6', '#6366f1']}
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

const createStyles = (c: any, isDark: boolean) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.background,
    },
    banner: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 60 : 40,
      left: 20,
      right: 20,
      backgroundColor: '#10b981',
      borderRadius: 12,
      padding: 14,
      zIndex: 50,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      shadowColor: isDark ? '#000' : c.shadow,
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
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: isDark ? '#000' : c.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    title: {
      marginLeft: 20,
      fontSize: 22,
      color: c.text,
      fontFamily: 'Poppins_700Bold',
    },

    card: {
      marginTop: 18,
      marginHorizontal: 24,
      backgroundColor: c.surface,
      borderRadius: 20,
      padding: 24,
      shadowColor: isDark ? '#000' : c.shadow,
      shadowOpacity: 0.06,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 3,
    },

    label: {
      fontSize: 16,
      color: c.text,
      marginBottom: 8,
      fontFamily: 'Poppins_600SemiBold',
    },
    input: {
      backgroundColor: isDark ? '#2d2a4a' : '#f8fafc',
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      padding: 14,
      fontSize: 14,
      color: c.text,
    },
    disabledInput: {
      backgroundColor: isDark ? '#1a1828' : '#eef2f7',
      color: c.textSecondary,
    },
    eye: { position: 'absolute', right: 12, top: 12 },
    helper: {
      marginTop: 8,
      fontSize: 12,
      color: c.textSecondary,
      fontFamily: 'Poppins_400Regular',
    },

    cta: {
      height: 50,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: isDark ? '#7c3aed' : '#7c83ff',
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