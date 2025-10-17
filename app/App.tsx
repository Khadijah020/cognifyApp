import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import AddPatientScreen from "@/screens/AddPatientScreen";
import ApiConfigurationScreen from "@/screens/ApiConfigurationScreen";
import ChangeEmailScreen from "@/screens/ChangeEmailScreen";
import ChangePasswordScreen from "@/screens/ChangePasswordScreen";
import EditCaregiverProfileScreen from "@/screens/EditCaregiverProfileScreen";
import ManageFacesScreen from "@/screens/ManageFacesScreen";
import PatientDashboardScreen from "@/screens/PatientDashboardScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import VoiceAssistantScreen from "@/screens/VoiceAssistantScreen";
import { PatientProvider } from "../contexts/PatientContext";
import AddReminderScreen from "../screens/AddReminderScreen";
import CaregiverDashboardScreen from "../screens/CaregiverDashboardScreen";
import EditPatientDetailsScreen from "../screens/EditPatientDetailsScreen";
import LoginScreen from "../screens/LoginScreen";
import PatientDetailsScreen from "../screens/PatientDetailsScreen";
import PatientLocationScreen from "../screens/PatientLocationScreen";
import SignupScreen from "../screens/SignupScreen";
import { supabase } from "../src/lib/supabase";

export type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  CaregiverDashboard: undefined;
  PatientDetails: undefined;
  EditPatientDetails: undefined;
  PatientLocation: undefined;
  Settings: undefined;
  ManageFaces: undefined;
  ChangeEmail: undefined;
  ChangePassword: undefined;
  EditCaregiverProfile: undefined;
  AddPatient: undefined;
  PatientDashboard: undefined; 
  VoiceAssistant: undefined;
  ApiConfiguration: undefined;
  AddReminder: {
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

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);
// In App.tsx
useEffect(() => {
  
  const checkLogin = async () => {
    try {
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
    <PatientProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
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
  );
}