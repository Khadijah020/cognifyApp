// src/screens/LoginScreen.tsx
import {
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
    useFonts,
} from "@expo-google-fonts/space-grotesk";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import AppLoading from "expo-app-loading";
import * as Linking from "expo-linking";
import React, { useState } from "react";
import {
    Alert,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { RootStackParamList } from "../app/App";
import { supabase } from "../src/lib/supabase";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

const COLORS = {
  bg: "#f9f8fc",
  text: "#110d1c",
  subText: "#5e499c",
  inputBg: "#eae7f4",
  primary: "#855ff7",
};

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  let [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
  });

  if (!fontsLoaded) return <AppLoading />;

  const getRoleAndNavigate = async () => {
    // Get user once and reuse the id
    const { data: authUser } = await supabase.auth.getUser();
    const uid = authUser.user?.id;
    if (!uid) {
      Alert.alert("Error", "No authenticated user.");
      return;
    }

    let role: "caregiver" | "patient" | undefined;

    // 1) Check caregivers table
    const { data: cg } = await supabase
      .from("caregivers")
      .select("id")
      .eq("id", uid)
      .maybeSingle();
    if (cg) role = "caregiver";

    // 2) Check patients table
    if (!role) {
      const { data: pt } = await supabase
        .from("patients")
        .select("id")
        .eq("id", uid)
        .maybeSingle();
      if (pt) role = "patient";
    }

    // 3) Fallback: check user metadata
    if (!role) {
      const metaRole = authUser.user?.user_metadata?.role;
      if (metaRole === "patient") role = "patient";
      else if (metaRole === "caregiver") role = "caregiver";
    }

if (role === "patient") {
  await AsyncStorage.setItem("role", "patient");
  navigation.replace("PatientDashboard");
  return
} else {
  await AsyncStorage.setItem("role", "caregiver");
  navigation.replace("CaregiverDashboard");
  return
}


  };

  const handleLogin = async () => {
  const mail = email.trim().toLowerCase();

  if (!mail || !password) {
    Alert.alert("Error", "Please enter email and password");
    return;
  }

  try {
    setSubmitting(true);

    // Sign in with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email: mail,
      password,
    });

    if (error) {
      // Helpful message for unconfirmed email
      const msg =
        /confirm/i.test(error.message)
          ? "Please confirm your email before signing in."
          : error.message;
      Alert.alert("Login Failed", msg);
      return;
    }

    const user = data.user;
    if (!user) {
      Alert.alert("Login Failed", "No user returned.");
      return;
    }

    // Store user info locally
    await AsyncStorage.multiSet([
      ["userEmail", mail],
      ["userId", user.id],
    ]);

    // Fetch role and navigate
    await getRoleAndNavigate();

  } catch (e: any) {
    Alert.alert("Login Error", e?.message ?? "Something went wrong.");
  } finally {
    setSubmitting(false);
  }
};

  const handleForgotPassword = async () => {
    const mail = email.trim().toLowerCase();
    if (!mail) {
      Alert.alert("Enter Email", "Please enter your email first.");
      return;
    }

    try {
      // Check if this email belongs to a patient or caregiver
      const { data: patientData } = await supabase
        .from("patients")
        .select("id, full_name")
        .eq("email", mail)
        .maybeSingle();

      // If it's a patient, tell them to contact their caregiver
      if (patientData) {
        Alert.alert(
          "Contact Your Caregiver",
          "As a patient, please contact your caregiver to reset your password.",
          [{ text: "OK" }]
        );
        return;
      }

      // For caregivers (or unknown emails), use Supabase reset
      // Create the redirect URL for the app
      const redirectUrl = Linking.createURL('reset-password');
      console.log('Password reset redirect URL:', redirectUrl);
      
      const { error } = await supabase.auth.resetPasswordForEmail(mail, {
        redirectTo: redirectUrl,
      });
      if (error) throw error;

      Alert.alert(
        "Check Your Email",
        "We've sent a password reset link to your email address. Please check your inbox and spam folder."
      );
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to send reset email.");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Text style={styles.brand}>Cognify</Text>
      </View>

      {/* Headings */}
      <Text style={styles.h1}>Welcome back</Text>
      <Text style={styles.sub}>Sign in to continue</Text>

      {/* Inputs */}
      <View style={styles.fieldWrap}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={COLORS.subText}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
          editable={!submitting}
        />
      </View>

      <View style={styles.fieldWrap}>
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={COLORS.subText}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          editable={!submitting}
        />
      </View>

      {/* Forgot password */}
      <TouchableOpacity onPress={handleForgotPassword} disabled={submitting}>
        <Text style={styles.link}>Forgot password?</Text>
      </TouchableOpacity>

      {/* Sign In button */}
      <TouchableOpacity
        style={[styles.primaryBtn, submitting && { opacity: 0.6 }]}
        onPress={handleLogin}
        disabled={submitting}
      >
        <Text style={styles.primaryBtnText}>
          {submitting ? "Signing In…" : "Sign In"}
        </Text>
      </TouchableOpacity>

      {/* Bottom link */}
      <TouchableOpacity
        style={styles.bottomLinkWrap}
        onPress={() => navigation.navigate("Signup")}
        disabled={submitting}
      >
        <Text style={styles.bottomLink}>Don’t have an account? Sign up</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingHorizontal: Platform.OS === "ios" ? 40 : 24,
    paddingTop: Platform.OS === "ios" ? 80 : 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 0,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Platform.OS === "ios" ? 60 : 20,
    marginTop: Platform.OS === "ios" ? 40 : 30,
  },
  brand: {
    fontFamily: "SpaceGrotesk_700Bold",
    fontSize: 18,
    textAlign: "center",
    flex: 1,
    color: COLORS.text,
  },
  h1: {
    fontFamily: "SpaceGrotesk_700Bold",
    fontSize: 28,
    textAlign: "center",
    marginBottom: Platform.OS === "ios" ? 16 : 6,
    color: COLORS.text,
  },
  sub: {
    fontFamily: "SpaceGrotesk_400Regular",
    fontSize: 16,
    textAlign: "center",
    marginBottom: Platform.OS === "ios" ? 50 : 20,
    color: COLORS.text,
  },
  fieldWrap: {
    marginBottom: Platform.OS === "ios" ? 20 : 12,
  },
  input: {
    backgroundColor: COLORS.inputBg,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 56,
    fontFamily: "SpaceGrotesk_400Regular",
    fontSize: 16,
    color: COLORS.text,
  },
  link: {
    fontFamily: "SpaceGrotesk_400Regular",
    color: COLORS.subText,
    textDecorationLine: "underline",
    marginBottom: Platform.OS === "ios" ? 40 : 20,
    marginTop: Platform.OS === "ios" ? 8 : 0,
    fontSize: 14,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Platform.OS === "ios" ? 40 : 20,
    marginHorizontal: Platform.OS === "ios" ? 20 : 0,
  },
  primaryBtnText: {
    fontFamily: "SpaceGrotesk_700Bold",
    color: COLORS.bg,
    fontSize: 16,
  },
  bottomLinkWrap: {
    marginTop: "auto",
    marginBottom: Platform.OS === "ios" ? 20 : 30,
  },
  bottomLink: {
    fontFamily: "SpaceGrotesk_400Regular",
    textAlign: "center",
    color: COLORS.subText,
    textDecorationLine: "underline",
    fontSize: 14,
    marginBottom: Platform.OS === "ios" ? 20 : 30,
  },
});
