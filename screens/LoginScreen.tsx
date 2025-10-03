import React, { useState } from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
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
import { RootStackParamList } from "../app/App";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

  let [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
  });

  if (!fontsLoaded) {
    return <AppLoading />;
  }

  const handleLogin = async () => {
  if (!email || !password) {
    Alert.alert("Error", "Please enter email and password");
    return;
  }

  // Example: hard-coded role check — replace with API/database later
  if (email === "patient@example.com" && password === "patient123") {
    await AsyncStorage.setItem("role", "patient");
    navigation.replace("PatientDashboard"); // 🔑 navigate to Patient Dashboard
  } else if (email === "caregiver@example.com" && password === "caregiver123") {
    await AsyncStorage.setItem("role", "caregiver");
    navigation.replace("CaregiverDashboard");
  } else {
    Alert.alert("Login Failed", "Invalid credentials");
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
          value={email}
          onChangeText={setEmail}
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
        />
      </View>

      {/* Forgot password */}
      <TouchableOpacity>
        <Text style={styles.link}>Forgot password?</Text>
      </TouchableOpacity>

      {/* Sign In button */}
      <TouchableOpacity style={styles.primaryBtn} onPress={handleLogin}>
        <Text style={styles.primaryBtnText}>Sign In</Text>
      </TouchableOpacity>

      {/* Bottom link */}
      <TouchableOpacity
        style={styles.bottomLinkWrap}
        onPress={() => navigation.navigate("Signup")}
      >
        <Text style={styles.bottomLink}>
          Don’t have an account? Sign up
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    marginTop: 30,
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
    marginBottom: 6,
    color: COLORS.text,
  },
  sub: {
    fontFamily: "SpaceGrotesk_400Regular",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
    color: COLORS.text,
  },
  fieldWrap: {
    marginBottom: 12,
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
    marginBottom: 20,
    fontSize: 14,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  primaryBtnText: {
    fontFamily: "SpaceGrotesk_700Bold",
    color: COLORS.bg,
    fontSize: 16,
  },
  bottomLinkWrap: {
    marginTop: "auto",
    marginBottom: 30,
  },
  bottomLink: {
    fontFamily: "SpaceGrotesk_400Regular",
    textAlign: "center",
    color: COLORS.subText,
    textDecorationLine: "underline",
    fontSize: 14,
    marginBottom: 30,
  },
});
