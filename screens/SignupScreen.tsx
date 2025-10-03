// src/screens/SignupScreen.tsx
import React, { useState } from "react";
import {
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
  });
  if (!fontsLoaded) return <AppLoading />;

  const handleSignup = () => {
    // TODO: hook up auth
    navigation.replace("CaregiverDashboard");
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Top bar with back arrow and centered title */}
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

        {/* Right spacer to keep the title visually centered */}
        <View style={styles.iconBox} />
      </View>

      {/* Fields */}
      <View style={styles.fieldWrap}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={COLORS.subText}
          keyboardType="email-address"
          autoCapitalize="none"
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

      <View style={styles.fieldWrap}>
        <TextInput
          style={styles.input}
          placeholder="Confirm Password"
          placeholderTextColor={COLORS.subText}
          secureTextEntry
          value={confirm}
          onChangeText={setConfirm}
        />
      </View>

      {/* CTA */}
      <TouchableOpacity style={styles.primaryBtn} onPress={handleSignup}>
        <Text style={styles.primaryBtnText}>Sign Up</Text>
      </TouchableOpacity>

      {/* Bottom spacer (to match screenshot’s airy bottom area) */}
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
    fontSize: 22, // visually matches screenshot weight/size
  },

  fieldWrap: {
    marginBottom: 16,
  },
  input: {
    height: 56, // h-14
    borderRadius: 16,
    backgroundColor: COLORS.inputBg,
    paddingHorizontal: 16,
    fontSize: 18,
    color: COLORS.text,
    fontFamily: "SpaceGrotesk_400Regular",
  },

  primaryBtn: {
    marginTop: 12,
    height: 56, // pill height
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
