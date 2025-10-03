// ChangePasswordScreen.tsx
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
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

// ✅ Poppins
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';

type Props = NativeStackScreenProps<RootStackParamList, 'ChangePassword'>;

export default function ChangePasswordScreen({ navigation }: Props) {
  const { colors } = useTheme();

  // ✅ load fonts
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const bannerOpacity = useState(new Animated.Value(0))[0];
  const bannerTranslateY = useState(new Animated.Value(-50))[0];

  const validatePassword = (p: string) => p.length >= 8;

  const showSuccess = () => {
    setShowSuccessBanner(true);
    Animated.parallel([
      Animated.timing(bannerOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(bannerTranslateY, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => {
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(bannerOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.timing(bannerTranslateY, { toValue: -50, duration: 300, useNativeDriver: true }),
        ]).start(() => setShowSuccessBanner(false));
      }, 3000);
    });
  };

  const handleChangePassword = async () => {
    if (!currentPassword) return Alert.alert('Current Password Required', 'Please enter your current password');
    if (!validatePassword(newPassword)) return Alert.alert('Invalid Password', 'New password must be at least 8 characters');
    if (newPassword !== confirmPassword) return Alert.alert('Password Mismatch', 'New and confirm passwords do not match');
    if (currentPassword === newPassword) return Alert.alert('Same Password', 'Use a different new password');

    setLoading(true);
    try {
      await new Promise(r => setTimeout(r, 1200));
      await AsyncStorage.setItem('lastPasswordUpdate', new Date().toISOString());
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      showSuccess();
    } catch {
      Alert.alert('Error', 'Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const styles = createStyles(colors);

  // Render a plain background while fonts load to avoid a flash of unstyled text
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  return (
    <View style={styles.container}>
      {showSuccessBanner && (
        <Animated.View style={[styles.successBanner, { opacity: bannerOpacity, transform: [{ translateY: bannerTranslateY }] }]}>
          <MaterialIcons name="check-circle" size={20} color="white" />
          <Text style={styles.successBannerText}>Password updated successfully!</Text>
        </Animated.View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Change Password</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Card */}
          <View style={styles.card}>
            {/* Current Password */}
            <Text style={styles.label}>Current Password</Text>
            <View style={styles.inputRow}>
              <MaterialIcons name="lock-open" size={20} color={colors.placeholder} style={styles.leftIcon} />
              <TextInput
                style={styles.inputField}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter current password"
                placeholderTextColor={colors.placeholder}
                secureTextEntry={!showCurrent}
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.rightIconBtn} onPress={() => setShowCurrent(v => !v)}>
                <Ionicons name={showCurrent ? 'eye-off' : 'eye'} size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* New Password */}
            <Text style={[styles.label, { marginTop: 18 }]}>New Password</Text>
            <View style={styles.inputRow}>
              <MaterialIcons name="lock" size={20} color={colors.placeholder} style={styles.leftIcon} />
              <TextInput
                style={styles.inputField}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password"
                placeholderTextColor={colors.placeholder}
                secureTextEntry={!showNew}
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.rightIconBtn} onPress={() => setShowNew(v => !v)}>
                <Ionicons name={showNew ? 'eye-off' : 'eye'} size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Confirm Password */}
            <Text style={[styles.label, { marginTop: 18 }]}>Confirm New Password</Text>
            <View style={styles.inputRow}>
              <MaterialIcons name="check-circle" size={20} color={colors.placeholder} style={styles.leftIcon} />
              <TextInput
                style={styles.inputField}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
                placeholderTextColor={colors.placeholder}
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.rightIconBtn} onPress={() => setShowConfirm(v => !v)}>
                <Ionicons name={showConfirm ? 'eye-off' : 'eye'} size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={[styles.saveButton, loading && { opacity: 0.6 }]}
            onPress={handleChangePassword}
            disabled={loading}
          >
            <MaterialIcons name="update" size={20} color="#fff" />
            <Text style={styles.saveText}>{loading ? 'Updating…' : 'Update Password'}</Text>
          </TouchableOpacity>

          <View style={{ height: Platform.OS === 'ios' ? 80 : 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (c: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },

    successBanner: {
      position: 'absolute',
          top: Platform.OS === 'ios' ? 60 : 40,
          left: 20,
          right: 20,
          backgroundColor: c.success,
          borderRadius: 12,
          padding: 14,
          zIndex: 50,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          shadowColor: c.shadow,
          shadowOpacity: 0.15,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
          elevation: 6,
    },
    successBannerText: { color: '#fff',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14, },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: Platform.OS === 'ios' ? 60 : 40,
      paddingBottom: 20,
      backgroundColor: c.background,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
      elevation: 2,
    },
    headerTitle: { fontSize: 22, color: c.text, fontFamily: 'Poppins_700Bold', marginLeft: 8 },

    scroll: { flex: 1, paddingHorizontal: 20 },

    card: {
      backgroundColor: '#fff',
      borderRadius: 20,
      padding: 20,
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },

    label: { fontSize: 16, color: c.text, marginBottom: 8, fontFamily: 'Poppins_600SemiBold' },

    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      borderRadius: 12,
      height: 56,
    },
    leftIcon: { marginLeft: 14, marginRight: 8 },
    inputField: {
      flex: 1,
      fontSize: 16,
      color: c.text,
      paddingVertical: 12,
      fontFamily: 'Poppins_500Medium',
    },
    rightIconBtn: { paddingHorizontal: 14, height: '100%', justifyContent: 'center' },

    saveButton: {
      marginTop: 24,
      backgroundColor: c.primary,
      borderRadius: 16,
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#9aa2ff',
      shadowOpacity: 0.35,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 10 },
      elevation: 3,
    },
    saveText: { color: '#fff', fontSize: 16, fontFamily: 'Poppins_700Bold', marginLeft: 8 },
  });
