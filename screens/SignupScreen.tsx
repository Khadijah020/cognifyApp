// src/screens/SignupScreen.tsx
import {
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
    useFonts,
} from "@expo-google-fonts/space-grotesk";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import AppLoading from "expo-app-loading";
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

type Props = NativeStackScreenProps<RootStackParamList, "Signup">;

const COLORS = {
  bg: "#f9f8fc",
  text: "#110d1c",
  subText: "#5e499c",
  inputBg: "#eae7f4",
  primary: "#855ff7",
};

export default function SignupScreen({ navigation }: Props) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
  });
  if (!fontsLoaded) return <AppLoading />;

  const handleSignup = async () => {
  const first = firstName.trim();
  const last = lastName.trim();
  const mail = email.trim().toLowerCase();

  if (!first || !last || !mail || !password || !confirm) {
    Alert.alert("Missing info", "Please fill all fields.");
    return;
  }
  if (password !== confirm) {
    Alert.alert("Password mismatch", "Passwords do not match.");
    return;
  }

  try {
    setSubmitting(true);

    // 1️⃣ Create caregiver in auth
    const { data, error } = await supabase.auth.signUp({
      email: mail,
      password,
      options: {
        data: { role: "caregiver", display_name: `${first} ${last}` },
      },
    });
    if (error) throw error;

    const user = data.user;
    const session = data.session;

    if (!user) {
      throw new Error("No user returned from Supabase signUp");
    }

    // 2️⃣ Add entry in caregivers table
    const { error: cErr } = await supabase.from("caregivers").insert([
      {
        id: user.id,
        email: mail,
        full_name: `${first} ${last}`,
      },
    ]);
    if (cErr) throw cErr;

    // 3️⃣ Cache local data
    await AsyncStorage.multiSet([
      ["userEmail", mail],
      ["userId", user.id],
      ["role", "caregiver"],
    ]);

    // 4️⃣ Navigate to dashboard
    navigation.replace("CaregiverDashboard");
  } catch (e: any) {
    console.error("Signup Error:", e);
    Alert.alert("Signup failed", e.message || "Something went wrong");
  } finally {
    setSubmitting(false);
  }
};

  return (
    <SafeAreaView style={styles.safe}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.iconBox}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather name="arrow-left" size={24} color={COLORS.text} />
        </TouchableOpacity>

        <Text style={styles.title}>Sign Up</Text>
        <View style={styles.iconBox} />
      </View>

      {/* Input fields */}
      <View style={styles.fieldWrap}>
        <TextInput
          style={styles.input}
          placeholder="First Name"
          placeholderTextColor={COLORS.subText}
          value={firstName}
          onChangeText={setFirstName}
          editable={!submitting}
        />
      </View>

      <View style={styles.fieldWrap}>
        <TextInput
          style={styles.input}
          placeholder="Last Name"
          placeholderTextColor={COLORS.subText}
          value={lastName}
          onChangeText={setLastName}
          editable={!submitting}
        />
      </View>

      <View style={styles.fieldWrap}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={COLORS.subText}
          keyboardType="email-address"
          autoCapitalize="none"
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

      <View style={styles.fieldWrap}>
        <TextInput
          style={styles.input}
          placeholder="Confirm Password"
          placeholderTextColor={COLORS.subText}
          secureTextEntry
          value={confirm}
          onChangeText={setConfirm}
          editable={!submitting}
        />
      </View>

      {/* CTA */}
      <TouchableOpacity
        style={[styles.primaryBtn, submitting && { opacity: 0.7 }]}
        onPress={handleSignup}
        disabled={submitting}
      >
        <Text style={styles.primaryBtnText}>
          {submitting ? "Creating account…" : "Sign Up"}
        </Text>
      </TouchableOpacity>

      <View style={{ height: 20 }} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    marginTop: 30,
  },
  iconBox: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    textAlign: "center",
    color: COLORS.text,
    fontFamily: "SpaceGrotesk_700Bold",
    fontSize: 22,
  },
  fieldWrap: {
    marginBottom: 16,
    paddingHorizontal: Platform.OS === "ios" ? 20 : 0,
  },
  input: {
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.inputBg,
    paddingHorizontal: 16,
    fontSize: 18,
    color: COLORS.text,
    fontFamily: "SpaceGrotesk_400Regular",
  },
  primaryBtn: {
    marginTop: 12,
    height: 56,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: Platform.OS === "ios" ? 20 : 0,
  },
  primaryBtnText: {
    color: COLORS.bg,
    fontSize: 18,
    fontFamily: "SpaceGrotesk_700Bold",
  },
});
