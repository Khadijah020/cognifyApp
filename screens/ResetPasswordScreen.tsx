// ResetPasswordScreen.tsx
import {
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    useFonts,
} from '@expo-google-fonts/poppins';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { RootStackParamList } from '../app/App';
import { supabase } from '../src/lib/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'ResetPassword'>;

const INDIGO = '#6366f1';
const SLATE_800 = '#1e293b';
const SLATE_600 = '#475569';
const SLATE_400 = '#94a3b8';
const SLATE_200 = '#e2e8f0';

export default function ResetPasswordScreen({ navigation, route }: Props) {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isValidSession, setIsValidSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // Check if user has a valid recovery session
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session error:', error);
          setIsValidSession(false);
          setCheckingSession(false);
          return;
        }

        if (session?.user) {
          setUserEmail(session.user.email || null);
          setIsValidSession(true);
        } else {
          setIsValidSession(false);
        }
      } catch (err) {
        console.error('Error checking session:', err);
        setIsValidSession(false);
      } finally {
        setCheckingSession(false);
      }
    };

    checkSession();

    // Listen for auth state changes (when user clicks the magic link)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth event:', event);
      
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        if (session?.user) {
          setUserEmail(session.user.email || null);
          setIsValidSession(true);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleResetPassword = async () => {
    if (!newPassword.trim()) {
      Alert.alert('Error', 'Please enter a new password.');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw error;
      }

      Alert.alert(
        'Success',
        'Your password has been reset successfully!',
        [
          {
            text: 'OK',
            onPress: () => {
              // Sign out and redirect to login
              supabase.auth.signOut();
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Password reset error:', error);
      Alert.alert('Error', error.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoToLogin = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  if (!fontsLoaded || checkingSession) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={INDIGO} />
        <Text style={styles.loadingText}>Verifying reset link...</Text>
      </View>
    );
  }

  // If no valid session, show error message
  if (!isValidSession) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={64} color={SLATE_400} />
          <Text style={styles.errorTitle}>Invalid or Expired Link</Text>
          <Text style={styles.errorMessage}>
            This password reset link is invalid or has expired. Please request a new one from the login screen.
          </Text>
          <TouchableOpacity 
            style={styles.errorButton} 
            onPress={() => {
              supabase.auth.signOut();
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            }}
          >
            <Text style={styles.buttonText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <MaterialIcons name="lock-reset" size={48} color={INDIGO} />
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>Create a new password for your account</Text>
        </View>

        {/* Email Display */}
        {userEmail && (
          <View style={styles.emailContainer}>
            <MaterialIcons name="email" size={20} color={SLATE_600} />
            <Text style={styles.emailText}>{userEmail}</Text>
          </View>
        )}

        {/* Password Fields */}
        <View style={styles.form}>
          {/* New Password */}
          <Text style={styles.label}>New Password</Text>
          <View style={styles.inputContainer}>
            <MaterialIcons name="lock" size={20} color={SLATE_400} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter new password"
              placeholderTextColor={SLATE_400}
              secureTextEntry={!showPassword}
              value={newPassword}
              onChangeText={setNewPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons
                name={showPassword ? 'eye-off' : 'eye'}
                size={20}
                color={SLATE_400}
              />
            </TouchableOpacity>
          </View>

          {/* Confirm Password */}
          <Text style={styles.label}>Confirm Password</Text>
          <View style={styles.inputContainer}>
            <MaterialIcons name="lock" size={20} color={SLATE_400} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Confirm new password"
              placeholderTextColor={SLATE_400}
              secureTextEntry={!showConfirmPassword}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
              <Ionicons
                name={showConfirmPassword ? 'eye-off' : 'eye'}
                size={20}
                color={SLATE_400}
              />
            </TouchableOpacity>
          </View>

          {/* Password Requirements */}
          <View style={styles.requirements}>
            <Text style={styles.requirementText}>
              • Password must be at least 6 characters
            </Text>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleResetPassword}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MaterialIcons name="check" size={20} color="#fff" />
                <Text style={styles.buttonText}>Reset Password</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Cancel Link */}
          <TouchableOpacity style={styles.cancelButton} onPress={handleGoToLogin}>
            <Text style={styles.cancelText}>Cancel and return to Login</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: SLATE_600,
    fontFamily: 'Poppins_500Medium',
  },
  keyboardView: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Poppins_700Bold',
    color: SLATE_800,
    marginTop: 16,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Poppins_400Regular',
    color: SLATE_600,
    marginTop: 8,
    textAlign: 'center',
  },
  emailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e0e7ff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 24,
  },
  emailText: {
    fontSize: 15,
    fontFamily: 'Poppins_600SemiBold',
    color: INDIGO,
    marginLeft: 8,
  },
  form: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    color: SLATE_800,
    marginBottom: 8,
    marginTop: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: SLATE_200,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Poppins_400Regular',
    color: SLATE_800,
  },
  requirements: {
    marginTop: 12,
    marginBottom: 24,
  },
  requirementText: {
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    color: SLATE_600,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: INDIGO,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    color: '#fff',
  },
  cancelButton: {
    alignItems: 'center',
    marginTop: 20,
  },
  cancelText: {
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
    color: SLATE_600,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 22,
    fontFamily: 'Poppins_700Bold',
    color: SLATE_800,
    marginTop: 20,
  },
  errorMessage: {
    fontSize: 15,
    fontFamily: 'Poppins_400Regular',
    color: SLATE_600,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 32,
    lineHeight: 22,
  },
  errorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: INDIGO,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
  },
});
