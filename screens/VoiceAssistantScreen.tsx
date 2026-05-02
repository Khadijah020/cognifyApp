import { MaterialIcons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import * as Speech from "expo-speech";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { RootStackParamList } from "../app/App";
import { ApiService } from "../services/ApiService";

import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from "@expo-google-fonts/poppins";

type Props = NativeStackScreenProps<RootStackParamList, "VoiceAssistant">;

const C = {
  overlayFrom: "rgba(96,165,250,0.9)",
  overlayTo: "rgba(167,139,250,0.9)",
  white: "#fff",
  white20: "rgba(255,255,255,0.2)",
  white30: "rgba(255,255,255,0.3)",
};

type TaskStep = {
  step_number: number;
  step_text: string;
  confidence_score: number;
};

// Helper: Sanitize text before speech synthesis
const cleanForSpeech = (text: string): string => {
  return text
    .replace(/\x1b(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "") // ANSI escape sequences
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "") // Control characters
    .replace(/\*\*([^*]+)\*\*/g, "$1") // **bold** → plain
    .replace(/\*([^*]+)\*/g, "$1") // *italic* → plain
    .replace(/#{1,4}\s/g, "") // ## headers
    .trim();
};

export default function VoiceAssistantScreen({ navigation }: Props) {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioUri, setAudioUri] = useState<string>("");
  const [currentStep, setCurrentStep] = useState<TaskStep | null>(null);
  const [completedSteps, setCompletedSteps] = useState<TaskStep[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVerifyingVideo, setIsVerifyingVideo] = useState(false);
  const [isOpeningCamera, setIsOpeningCamera] = useState(false);
  const [showVideoSourceModal, setShowVideoSourceModal] = useState(false);
  const [showRecordGuideModal, setShowRecordGuideModal] = useState(false);

  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.stagger(700, [
        Animated.timing(ring1, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(ring2, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [ring1, ring2]);

  useEffect(() => {
    (async () => {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Audio recording permission is required.",
        );
      }
    })();

    return () => {
      if (recording) {
        recording.stopAndUnloadAsync().catch(console.error);
      }
      stopPollingForSteps();
    };
  }, []);

  const startRecording = async () => {
    try {
      setAudioUri("");
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );

      setRecording(newRecording);
      setIsRecording(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.error("Failed to start recording:", error);
      Alert.alert("Error", "Failed to start recording.");
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      setRecording(null);
      setAudioUri(uri || "");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (uri) {
        sendAudioForTaskGuidance(uri);
      }
    } catch (error) {
      console.error("Failed to stop recording:", error);
    }
  };

  const sendAudioForTaskGuidance = async (uri: string) => {
    try {
      setIsProcessing(true);
      console.log("🎯 Processing task guidance request...");

      const result = await ApiService.sendAudioForTaskGuidance(uri);
      console.log("📦 Backend response:", JSON.stringify(result, null, 2));

      if (result.success && (result.first_step || result.current_step)) {
        const step = result.first_step || result.current_step;
        console.log("✅ Setting first step:", step);
        setCurrentStep(step);

        Speech.speak(cleanForSpeech(step.step_text), {
          rate: 0.9,
          pitch: 1.0,
          language: "en-US",
        });

        console.log("✅ Step spoken:", step.step_text);

        // FIX 3: Only start polling for brand new sessions.
        // For resumes, polling is already running — restarting it
        // causes the stale queue item to be re-delivered and spoken again.
        if (!result.resumed) {
          console.log("🔄 New session — starting polling...");
          startPollingForSteps();
        } else {
          console.log(
            "🔄 Resumed session — polling already running, not restarting.",
          );
        }
      } else {
        console.log("❌ No step in response");
        Speech.speak(
          cleanForSpeech("I couldn't understand that task. Please try again."),
        );
      }

      setIsProcessing(false);
    } catch (error) {
      setIsProcessing(false);
      console.error("❌ Error processing task:", error);
      Alert.alert(
        "Error",
        "Failed to process your task request. Please check your connection.",
        [{ text: "OK" }],
      );
    }
  };
  const startPollingForSteps = () => {
    console.log("🔄 Polling started");
    // Clear any existing polling
    stopPollingForSteps();

    // Poll every 3 seconds for new steps
    pollingIntervalRef.current = setInterval(async () => {
      try {
        console.log("📡 Polling for updates...");
        const response = await ApiService.pollStepUpdates();
        console.log("📦 Poll response:", JSON.stringify(response, null, 2));

        if (response.has_update && response.update) {
          const update = response.update;
          console.log("🆕 Update received:", update.type);

          if (update.type === "next_step" && update.step) {
            console.log("➡️ Moving to next step:", update.step.step_number);

            // New step received - use functional updates to avoid stale state
            setCurrentStep((prevStep) => {
              console.log("📝 Previous step:", prevStep?.step_number);
              if (prevStep) {
                setCompletedSteps((prev) => {
                  const newCompleted = [...prev, prevStep];
                  console.log("✅ Completed steps count:", newCompleted.length);
                  return newCompleted;
                });
              }
              console.log("🆕 New current step:", update.step.step_number);
              return update.step;
            });

            // Speak the new step
            Speech.speak(cleanForSpeech(update.step.step_text), {
              rate: 0.9,
              pitch: 1.0,
              language: "en-US",
            });

            console.log("📢 New step spoken:", update.step.step_text);
          } else if (update.type === "task_complete") {
            console.log("🎉 Task complete!");

            // Task finished - mark current step as completed
            setCurrentStep((prevStep) => {
              if (prevStep) {
                setCompletedSteps((prev) => [...prev, prevStep]);
              }
              return null;
            });

            Speech.speak(
              cleanForSpeech("Great job! You've completed all the steps."),
            );
            stopPollingForSteps();

            // Reset after a delay
            setTimeout(() => {
              console.log("🔄 Resetting state");
              setCompletedSteps([]);
            }, 3000);
          }
        } else {
          console.log("⏳ No updates yet");
        }
      } catch (error) {
        console.error("❌ Error polling steps:", error);
      }
    }, 3000);
  };

  const stopPollingForSteps = () => {
    if (pollingIntervalRef.current) {
      console.log("⏹️ Stopping polling");
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const verifyStepVideo = async (videoUri: string) => {
    try {
      setIsVerifyingVideo(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await ApiService.sendVideoForStepVerification(videoUri);
      // Polling already running — next step will arrive automatically
    } catch (error) {
      Alert.alert(
        "Upload Failed",
        "Could not send the video. Please try again.",
      );
    } finally {
      setIsVerifyingVideo(false);
    }
  };

  const handleVideoUpload = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Media library access is needed to upload a video.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.[0]?.uri) return;

    const videoUri = result.assets[0].uri;
    await verifyStepVideo(videoUri);
  };

  const handleVideoRecord = async () => {
    setIsOpeningCamera(true);

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Camera access is needed to record a video.",
      );
      setIsOpeningCamera(false);
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["videos"],
        allowsEditing: false,
        quality: 1,
        videoMaxDuration: 60,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      const videoUri = result.assets[0].uri;
      await verifyStepVideo(videoUri);
    } finally {
      setIsOpeningCamera(false);
    }
  };

  const handleChooseVideoUpload = () => {
    setShowVideoSourceModal(false);
    void handleVideoUpload();
  };

  const handleChooseVideoRecord = () => {
    setShowVideoSourceModal(false);
    setShowRecordGuideModal(true);
  };

  const handleLaunchCameraFromGuide = () => {
    setShowRecordGuideModal(false);
    void handleVideoRecord();
  };

  const handleVideoOptionPress = () => {
    if (isVerifyingVideo || isOpeningCamera) return;
    setShowVideoSourceModal(true);
  };

  const handleCancel = async () => {
    if (recording) {
      await recording.stopAndUnloadAsync().catch(console.error);
    }

    // Cancel active task session
    try {
      await ApiService.cancelTaskSession();
    } catch (error) {
      console.error("Error cancelling session:", error);
    }

    stopPollingForSteps();
    navigation.goBack();
  };

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: "#000" }} />;
  }

  return (
    <View style={styles.fill}>
      <LinearGradient
        colors={[C.overlayFrom, C.overlayTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.overlay}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleCancel}
          style={styles.backBtn}
        >
          <MaterialIcons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>

        <View style={styles.centerTop}>
          <Text style={[styles.title, { fontFamily: "Poppins_700Bold" }]}>
            {isRecording
              ? "Recording..."
              : isProcessing
                ? "Processing..."
                : "Ask for Help"}
          </Text>
          <Text style={[styles.subtitle, { fontFamily: "Poppins_400Regular" }]}>
            {isRecording
              ? "Tap stop when finished"
              : isProcessing
                ? "Getting your steps..."
                : "Describe what you need help with"}
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleVideoOptionPress}
          disabled={isVerifyingVideo}
          style={styles.uploadBtn}
        >
          <MaterialIcons
            name={isVerifyingVideo ? "hourglass-empty" : "video-library"}
            size={20}
            color="#fff"
            style={{ marginRight: 8 }}
          />
          <Text
            style={[
              styles.uploadBtnText,
              { fontFamily: "Poppins_600SemiBold" },
            ]}
          >
            {isVerifyingVideo
              ? "Verifying..."
              : isOpeningCamera
                ? "Opening Camera..."
                : "Upload or Record Video"}
          </Text>
        </TouchableOpacity>

        <Modal
          visible={showVideoSourceModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowVideoSourceModal(false)}
        >
          <View style={styles.videoModalOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFillObject}
              activeOpacity={1}
              onPress={() => setShowVideoSourceModal(false)}
            />
            <View style={styles.videoModalCard}>
              <LinearGradient
                colors={["#dbeafe", "#f3e8ff"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.videoModalTop}
              >
                <Text
                  style={[
                    styles.videoModalTitle,
                    { fontFamily: "Poppins_700Bold" },
                  ]}
                >
                  Add Verification Video
                </Text>
                <Text
                  style={[
                    styles.videoModalSubtitle,
                    { fontFamily: "Poppins_400Regular" },
                  ]}
                >
                  Pick a source to continue your current step.
                </Text>
              </LinearGradient>

              <View style={styles.videoModalActions}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.videoActionBtn}
                  onPress={handleChooseVideoUpload}
                >
                  <View
                    style={[
                      styles.videoActionIconWrap,
                      { backgroundColor: "#e0e7ff" },
                    ]}
                  >
                    <MaterialIcons
                      name="video-library"
                      size={22}
                      color="#4f46e5"
                    />
                  </View>
                  <View style={styles.videoActionTextWrap}>
                    <Text
                      style={[
                        styles.videoActionTitle,
                        { fontFamily: "Poppins_600SemiBold" },
                      ]}
                    >
                      Upload Video
                    </Text>
                    <Text
                      style={[
                        styles.videoActionSubtitle,
                        { fontFamily: "Poppins_400Regular" },
                      ]}
                    >
                      Choose an existing clip
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.videoActionBtn}
                  onPress={handleChooseVideoRecord}
                >
                  <View
                    style={[
                      styles.videoActionIconWrap,
                      { backgroundColor: "#dcfce7" },
                    ]}
                  >
                    <MaterialIcons name="videocam" size={22} color="#15803d" />
                  </View>
                  <View style={styles.videoActionTextWrap}>
                    <Text
                      style={[
                        styles.videoActionTitle,
                        { fontFamily: "Poppins_600SemiBold" },
                      ]}
                    >
                      Record with Camera
                    </Text>
                    <Text
                      style={[
                        styles.videoActionSubtitle,
                        { fontFamily: "Poppins_400Regular" },
                      ]}
                    >
                      Capture a fresh video now
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setShowVideoSourceModal(false)}
                  style={styles.videoModalCancelBtn}
                >
                  <Text
                    style={[
                      styles.videoModalCancelText,
                      { fontFamily: "Poppins_600SemiBold" },
                    ]}
                  >
                    Not now
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={showRecordGuideModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowRecordGuideModal(false)}
        >
          <View style={styles.videoModalOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFillObject}
              activeOpacity={1}
              onPress={() => setShowRecordGuideModal(false)}
            />
            <View style={styles.recordGuideCard}>
              <Text
                style={[
                  styles.recordGuideTitle,
                  { fontFamily: "Poppins_700Bold" },
                ]}
              >
                Ready to Record
              </Text>
              <Text
                style={[
                  styles.recordGuideSubtitle,
                  { fontFamily: "Poppins_400Regular" },
                ]}
              >
                For best guidance, keep the camera stable and capture the full
                action clearly.
              </Text>

              <View style={styles.recordGuideTips}>
                <View style={styles.recordGuideTipRow}>
                  <MaterialIcons
                    name="check-circle"
                    size={18}
                    color="#22c55e"
                  />
                  <Text
                    style={[
                      styles.recordGuideTipText,
                      { fontFamily: "Poppins_500Medium" },
                    ]}
                  >
                    Record in good lighting
                  </Text>
                </View>
                <View style={styles.recordGuideTipRow}>
                  <MaterialIcons
                    name="check-circle"
                    size={18}
                    color="#22c55e"
                  />
                  <Text
                    style={[
                      styles.recordGuideTipText,
                      { fontFamily: "Poppins_500Medium" },
                    ]}
                  >
                    Keep clip between 5 and 20 seconds
                  </Text>
                </View>
                <View style={styles.recordGuideTipRow}>
                  <MaterialIcons
                    name="check-circle"
                    size={18}
                    color="#22c55e"
                  />
                  <Text
                    style={[
                      styles.recordGuideTipText,
                      { fontFamily: "Poppins_500Medium" },
                    ]}
                  >
                    Keep your hands and objects in frame
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.9}
                onPress={handleLaunchCameraFromGuide}
                style={styles.recordGuidePrimaryBtn}
              >
                <LinearGradient
                  colors={["#22c55e", "#16a34a"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.recordGuidePrimaryFill}
                >
                  <MaterialIcons name="videocam" size={20} color="#fff" />
                  <Text
                    style={[
                      styles.recordGuidePrimaryText,
                      { fontFamily: "Poppins_600SemiBold" },
                    ]}
                  >
                    Open Camera
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setShowRecordGuideModal(false)}
                style={styles.recordGuideSecondaryBtn}
              >
                <Text
                  style={[
                    styles.recordGuideSecondaryText,
                    { fontFamily: "Poppins_500Medium" },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Current Step Display */}
        {currentStep && (
          <>
            <View style={styles.stepCard}>
              <Text
                style={[styles.stepNumber, { fontFamily: "Poppins_700Bold" }]}
              >
                Step {currentStep.step_number}
              </Text>
              <Text
                style={[styles.stepText, { fontFamily: "Poppins_500Medium" }]}
              >
                {currentStep.step_text}
              </Text>
            </View>
          </>
        )}

        {/* Completed Steps */}
        {completedSteps.length > 0 && (
          <ScrollView
            style={styles.completedSteps}
            showsVerticalScrollIndicator={false}
          >
            {completedSteps.map((step, index) => (
              <View key={index} style={styles.completedStepCard}>
                <MaterialIcons name="check-circle" size={20} color="#22c55e" />
                <Text
                  style={[
                    styles.completedStepText,
                    { fontFamily: "Poppins_400Regular" },
                  ]}
                >
                  Step {step.step_number}: {step.step_text}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}

        <View style={styles.micWrap}>
          <Animated.View
            style={[
              styles.ring,
              {
                transform: [
                  {
                    scale: ring1.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1.5],
                    }),
                  },
                ],
                opacity: ring1.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.35, 0],
                }),
              },
            ]}
          />
          <Animated.View
            style={[
              styles.ring,
              {
                transform: [
                  {
                    scale: ring2.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1.7],
                    }),
                  },
                ],
                opacity: ring2.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.25, 0],
                }),
              },
            ]}
          />

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={isRecording ? stopRecording : startRecording}
            style={styles.micBtnShadow}
            disabled={isProcessing}
          >
            <LinearGradient
              colors={
                isRecording ? ["#ef4444", "#dc2626"] : ["#60a5fa", "#a78bfa"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.micBtn}
            >
              <MaterialIcons
                name={isRecording ? "stop" : "mic"}
                size={64}
                color="#fff"
              />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.bottom}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleCancel}
            style={styles.cancelBtn}
          >
            <Text
              style={[styles.cancelText, { fontFamily: "Poppins_600SemiBold" }]}
            >
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)" },
  overlay: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 120,
    paddingBottom: 110,
  },
  backBtn: {
    position: "absolute",
    top: 48,
    left: 24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  centerTop: { alignItems: "center", marginBottom: 20 },
  title: { color: C.white, fontSize: 28, textAlign: "center" },
  subtitle: {
    marginTop: 8,
    color: "rgba(255,255,255,0.9)",
    fontSize: 18,
    textAlign: "center",
  },
  stepCard: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  stepNumber: {
    fontSize: 14,
    color: "#6366f1",
    marginBottom: 8,
  },
  stepText: {
    fontSize: 18,
    color: "#1e293b",
    lineHeight: 26,
  },
  completedSteps: {
    maxHeight: 150,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  completedStepCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  completedStepText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    marginLeft: 10,
    flex: 1,
  },
  micWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 40,
    marginBottom: 56,
  },
  ring: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: C.white20,
  },
  micBtnShadow: {
    shadowColor: "#a78bfa",
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
    borderRadius: 96,
  },
  micBtn: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(99,102,241,0.85)",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  uploadBtnText: {
    color: "#fff",
    fontSize: 15,
  },
  videoModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(2,6,23,0.45)",
    justifyContent: "flex-end",
    padding: 18,
  },
  videoModalCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  videoModalTop: {
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  videoModalTitle: {
    fontSize: 18,
    color: "#1e293b",
  },
  videoModalSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: "#475569",
  },
  videoModalActions: {
    padding: 14,
    gap: 10,
  },
  videoActionBtn: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  videoActionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  videoActionTextWrap: {
    marginLeft: 10,
  },
  videoActionTitle: {
    fontSize: 15,
    color: "#0f172a",
  },
  videoActionSubtitle: {
    fontSize: 12,
    color: "#64748b",
  },
  videoModalCancelBtn: {
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  videoModalCancelText: {
    color: "#334155",
    fontSize: 14,
  },
  recordGuideCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  recordGuideTitle: {
    fontSize: 20,
    color: "#0f172a",
    textAlign: "center",
  },
  recordGuideSubtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: "#475569",
    textAlign: "center",
  },
  recordGuideTips: {
    marginTop: 14,
    marginBottom: 16,
    gap: 8,
  },
  recordGuideTipRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  recordGuideTipText: {
    marginLeft: 8,
    color: "#1e293b",
    fontSize: 13,
  },
  recordGuidePrimaryBtn: {
    borderRadius: 14,
    overflow: "hidden",
  },
  recordGuidePrimaryFill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
  },
  recordGuidePrimaryText: {
    color: "#fff",
    fontSize: 15,
  },
  recordGuideSecondaryBtn: {
    marginTop: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  recordGuideSecondaryText: {
    color: "#64748b",
    fontSize: 14,
  },
  bottom: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 26,
    alignItems: "center",
    zIndex: 3,
  },
  cancelBtn: {
    backgroundColor: C.white20,
    minWidth: 180,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 28,
    alignItems: "center",
  },
  cancelText: { color: C.white, fontSize: 18 },
});
