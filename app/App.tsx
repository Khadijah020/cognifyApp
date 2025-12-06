import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinkingOptions, NavigationContainer, NavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as Linking from "expo-linking";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import AddPatientScreen from "@/screens/AddPatientScreen";
import ApiConfigurationScreen from "@/screens/ApiConfigurationScreen";
import ChangeEmailScreen from "@/screens/ChangeEmailScreen";
import ChangePasswordScreen from "@/screens/ChangePasswordScreen";
import EditCaregiverProfileScreen from "@/screens/EditCaregiverProfileScreen";
import ManageFacesScreen from "@/screens/ManageFacesScreen";
import PatientDashboardScreen from "@/screens/PatientDashboardScreen";
import ResetPasswordScreen from "@/screens/ResetPasswordScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import VoiceAssistantScreen from "@/screens/VoiceAssistantScreen";
import { PatientProvider } from "../contexts/PatientContext";
import { ThemeProvider } from "../contexts/ThemeContext";
import AddReminderScreen from "../screens/AddReminderScreen";
import CaregiverDashboardScreen from "../screens/CaregiverDashboardScreen";
import EditPatientDetailsScreen from "../screens/EditPatientDetailsScreen";
import LoginScreen from "../screens/LoginScreen";
import PatientDetailsScreen from "../screens/PatientDetailsScreen";
import PatientLocationScreen from "../screens/PatientLocationScreen";
import SignupScreen from "../screens/SignupScreen";
import { ApiService } from "../services/ApiService";
import { supabase } from "../src/lib/supabase";

export type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  CaregiverDashboard: undefined;
  PatientDetails: undefined;
  EditPatientDetails: undefined;
  PatientLocation: { patientName?: string } | undefined;
  Settings: undefined;
  ManageFaces: undefined;
  ChangeEmail: undefined;
  ChangePassword: undefined;
  EditCaregiverProfile: undefined;
  AddPatient: undefined;
  PatientDashboard: undefined; 
  VoiceAssistant: undefined;
  ApiConfiguration: undefined;
  ResetPassword: undefined;
  AddReminder: {
    patientId: string;
    reminderId?: string;
    prefill?: {
      title?: string;
      date?: Date;
      timeText?: string;
      hour?: number;
      minute?: number;
      period?: 'AM' | 'PM';
    };
  } | undefined; 
};

// Deep linking configuration
const prefix = Linking.createURL('/');

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [prefix, 'cognify://', 'https://xlusfzcawhoqzmdfgkwj.supabase.co'],
  config: {
    screens: {
      ResetPassword: 'reset-password',
      Login: 'login',
    },
  },
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

  // Listen for PASSWORD_RECOVERY auth event
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[App.tsx] Auth event:', event);
      
      if (event === 'PASSWORD_RECOVERY') {
        console.log('[App.tsx] Password recovery detected, navigating to ResetPassword');
        // Navigate to ResetPassword screen
        setTimeout(() => {
          if (navigationRef.current) {
            navigationRef.current.reset({
              index: 0,
              routes: [{ name: 'ResetPassword' }],
            });
          }
        }, 100);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Listen for deep link URL changes
  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      console.log('[App.tsx] Deep link received:', event.url);
      
      // Check if this is a password reset link with tokens
      if (event.url.includes('reset-password') || event.url.includes('type=recovery')) {
        console.log('[App.tsx] Password reset link detected');
        
        // Extract tokens from URL fragment (after #)
        const url = event.url;
        const hashIndex = url.indexOf('#');
        
        if (hashIndex !== -1) {
          const fragment = url.substring(hashIndex + 1);
          const params = new URLSearchParams(fragment);
          
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          const type = params.get('type');
          
          console.log('[App.tsx] Token type:', type);
          console.log('[App.tsx] Has access token:', !!accessToken);
          
          if (accessToken && refreshToken && type === 'recovery') {
            try {
              // Set the session with the tokens from the URL
              const { data, error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              
              if (error) {
                console.error('[App.tsx] Error setting session:', error);
              } else {
                console.log('[App.tsx] Session set successfully for:', data.user?.email);
                
                // Navigate to ResetPassword screen
                setTimeout(() => {
                  if (navigationRef.current) {
                    navigationRef.current.reset({
                      index: 0,
                      routes: [{ name: 'ResetPassword' }],
                    });
                  }
                }, 100);
              }
            } catch (err) {
              console.error('[App.tsx] Exception setting session:', err);
            }
          }
        } else {
          // No fragment, just navigate
          setTimeout(() => {
            if (navigationRef.current) {
              navigationRef.current.reset({
                index: 0,
                routes: [{ name: 'ResetPassword' }],
              });
            }
          }, 500);
        }
      }
    };

    // Check if app was opened with a URL
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('[App.tsx] Initial URL:', url);
        handleDeepLink({ url });
      }
    });

    // Listen for URL changes while app is running
    const subscription = Linking.addEventListener('url', handleDeepLink);

    return () => {
      subscription.remove();
    };
  }, []);

// In App.tsx
useEffect(() => {
  
  const checkLogin = async () => {
    try {
      // Initialize ApiService with saved ngrok URL
      await ApiService.initialize();
      
      const { data: { session }, error } = await supabase.auth.getSession();
            
      if (error) {
        console.log('[App.tsx] Session check error:', error.message);
        setInitialRoute("Login");
        return;
      }
      
      if (session && session.access_token) {
        const role = await AsyncStorage.getItem("role");
        
        
        if (role === "patient") {
          setInitialRoute("PatientDashboard");
        } else if (role === "caregiver") {
          setInitialRoute("CaregiverDashboard");
        } else {
          setInitialRoute("Login");
        }
      } else {
        setInitialRoute("Login");
      }
    } catch (error: any) {
      setInitialRoute("Login");
    }
  };

  checkLogin();
}, []);

  if (!initialRoute) {
    // While checking AsyncStorage, show splash
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <PatientProvider>
        <NavigationContainer ref={navigationRef} linking={linking}>
          <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
            <Stack.Screen name="CaregiverDashboard" component={CaregiverDashboardScreen} />
            <Stack.Screen name="PatientDashboard" component={PatientDashboardScreen} /> 
            <Stack.Screen name="PatientDetails" component={PatientDetailsScreen} />
            <Stack.Screen name="AddReminder" component={AddReminderScreen} />
            <Stack.Screen name="PatientLocation" component={PatientLocationScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="ManageFaces" component={ManageFacesScreen} />
            <Stack.Screen name="ChangeEmail" component={ChangeEmailScreen} />
            <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
            <Stack.Screen name="EditCaregiverProfile" component={EditCaregiverProfileScreen} />
            <Stack.Screen name="AddPatient" component={AddPatientScreen} />
            <Stack.Screen name="VoiceAssistant" component={VoiceAssistantScreen} />
            <Stack.Screen name="ApiConfiguration" component={ApiConfigurationScreen} />
            <Stack.Screen
              name="EditPatientDetails"
              component={EditPatientDetailsScreen}
              options={{ headerShown: false }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </PatientProvider>
    </ThemeProvider>
  );
}