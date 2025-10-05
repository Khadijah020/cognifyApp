// src/screens/SignupScreen.tsx
import React, { useState } from "react";
import {
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import AppLoading from "expo-app-loading";
import {
  useFonts,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../src/lib/supabase";
import { RootStackParamList } from "../app/App";

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

    // 1) Create auth user (session should be returned immediately)
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
    if (!user || !session) {
      throw new Error("No session after signup. Make sure email confirmation is disabled.");
    }

    // 2) Create profile row (RLS allows insert when id = auth.uid())
    const { error: pErr } = await supabase.from("profiles").insert({
      id: user.id,                 // must equal auth.users.id
      email: mail,
      role: "caregiver",
      display_name: `${first} ${last}`,
    });
    if (pErr && pErr.code !== "23505") throw pErr;

    // 3) Create caregivers row (self)
    const { error: cErr } = await supabase.from("caregivers").insert({
      id: user.id,
    });
    if (cErr && cErr.code !== "23505") throw cErr;

    // 4) Cache and navigate
    await AsyncStorage.multiSet([
      ["userEmail", mail],
      ["userId", user.id],
      ["role", "caregiver"],
    ]);
    navigation.replace("CaregiverDashboard");
  } catch (e: any) {
    Alert.alert("Signup failed", e?.message ?? "Something went wrong.");
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
  },
  primaryBtnText: {
    color: COLORS.bg,
    fontSize: 18,
    fontFamily: "SpaceGrotesk_700Bold",
  },
});
