import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import LoginScreen from "../screens/LoginScreen";
import SignupScreen from "../screens/SignupScreen";
import CaregiverDashboardScreen from "../screens/CaregiverDashboardScreen";
import AddReminderScreen from "../screens/AddReminderScreen"; 
import PatientDetailsScreen from "../screens/PatientDetailsScreen";
import EditPatientDetailsScreen from "../screens/EditPatientDetailsScreen";
import PatientLocationScreen from "../screens/PatientLocationScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import ManageFacesScreen from "@/screens/ManageFacesScreen";
import ChangeEmailScreen from "@/screens/ChangeEmailScreen";
import ChangePasswordScreen from "@/screens/ChangePasswordScreen";
import EditCaregiverProfileScreen from "@/screens/EditCaregiverProfileScreen";
import AddPatientScreen from "@/screens/AddPatientScreen";
import PatientDashboardScreen from "@/screens/PatientDashboardScreen";

export type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  CaregiverDashboard: undefined;
  PatientDetails: undefined;
  EditPatientDetails: { patient: any };
  PatientLocation: undefined;
  Settings: undefined;
  ManageFaces: undefined;
  ChangeEmail: undefined;
  ChangePassword: undefined;
  EditCaregiverProfile: undefined;
  AddPatient: undefined;
  PatientDashboard: undefined; 
  AddReminder: {
    prefill?: {
      title?: string;
      date?: Date;            // or string if you prefer
      timeText?: string;      // e.g. "05:12 PM"
      hour?: number;          // optional if you want to preseed the wheel
      minute?: number;
      period?: 'AM' | 'PM';
    };
  } | undefined; 
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);

  useEffect(() => {
    const checkLogin = async () => {
      try {
        const role = await AsyncStorage.getItem("role");
        if (role === "patient") {
          setInitialRoute("PatientDashboard");
        } else if (role === "caregiver") {
          setInitialRoute("CaregiverDashboard");
        } else {
          setInitialRoute("Login");
        }
      } catch {
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
        <Stack.Screen
          name="EditPatientDetails"
          component={EditPatientDetailsScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}