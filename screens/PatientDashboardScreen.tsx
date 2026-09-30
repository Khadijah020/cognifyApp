// PatientDashboardScreen.tsx - COMPLETE WITH DYNAMIC RECENT ACTIVITY

import React, { useEffect, useRef, useState } from "react";

import AsyncStorage from "@react-native-async-storage/async-storage";

import * as ImagePicker from "expo-image-picker";
import * as Speech from "expo-speech";

import { MaterialIcons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Audio } from "expo-av";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  PanResponder,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { RootStackParamList } from "../app/App";
import { ApiService } from "../services/ApiService";
import FallDetectionService from "../services/FallDetectionService";
import HealthDataService from "../services/HealthDataService";

import PatientActivityService, {
  PatientActivity,
} from "../services/PatientActivityService";
import PatientDeviceStatusService from "../services/PatientDeviceStatusService";
import { getAuthenticatedPatientProfile } from "../services/PatientService";
import ReminderHelperService from "../services/ReminderHelperService";
import { supabase } from "../src/lib/supabase";

import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from "@expo-google-fonts/poppins";
import axios from "axios";

type Props = NativeStackScreenProps<RootStackParamList, "PatientDashboard">;

type ReminderData = {
  id?: string;
  title: string;
  subtitle: string;
  icon: "medication" | "event";
  chipColor: string;
  chipBg: string;
  details?: {
    medication?: string;
    instructions?: string;
    note?: string;
  };
  status?: {
    time?: string;
    label?: string;
  };
};

// ✅ Face recognition data type
type RecognizedFace = {
  id: string;
  name: string;
  relationship: string;
  imageUri: string;
  dateAdded: string;
};

type FaceRecognitionData = {
  id?: string;
  name?: string;
  relationship?: string;
  confidence?: number;
  timestamp?: string;
  match?: {
    id?: string | null;
    name?: string;
    relationship?: string | null;
    confidence?: number;
  } | null;
};

type FacePopupItem = RecognizedFace & {
  confidence?: number;
  timestamp?: string;
};

type Note = {
  id: string;
  text: string;
  createdAt: string;
};

type FallAlertData = {
  id?: string;
  patient_id?: string;
  caregiver_id?: string;
  latitude?: number | null;
  longitude?: number | null;
  status?: string;
  created_at?: string;
  patient_name?: string;
  source?: string;
  confidence?: number;
  fall_probability?: number;
};

const C = {
  bgFrom: "#e0e7ff",
  bgTo: "#f0f4ff",
  white: "#ffffff",
  slate900: "#0f172a",
  slate800: "#1e293b",
  slate700: "#334155",
  slate600: "#475569",
  slate500: "#64748b",
  slate400: "#94a3b8",
  slate300: "#cbd5e1",
  indigo300: "#c7d2fe",
  indigo500: "#6366F1",
  green500: "#22c55e",
  green100: "#dcfce7",
  teal500: "#14b8a6",
  teal50: "#f0fdfa",
  purple100: "#f3e8ff",
  purple500: "#a855f7",
  blue50: "#eff6ff",
  blue300: "#93c5fd",
  shadow: "rgba(0,0,0,0.06)",
  emerald400: "#34d399",
  emerald500: "#10b981",
};

const AVATAR =
  "https://lh3.googleusercontent.com/a/ACg8ocLw_b_95Zk8i_32X-y1xX8X2-wE9L7KzQ3qE6pB4P-5e_3A=s96-c-rg-br100";

const STORAGE_KEY = "cognify_recognized_faces";
const FALL_ALERT_COOLDOWN_MS = 2 * 60 * 1000;
const FACE_RECOGNITION_COOLDOWN_MS = 60 * 60 * 1000;

const normalizeFaceText = (value?: string | null) =>
  (value || "").trim().toLowerCase();

const getFaceIdentityKey = (face: {
  id?: string | null;
  name?: string | null;
}) => normalizeFaceText(face.id) || normalizeFaceText(face.name);

const mergeFacePopupItems = (
  currentFaces: FacePopupItem[],
  incomingFaces: FacePopupItem[],
) => {
  const byIdentity = new Map<string, FacePopupItem>();

  for (const face of currentFaces) {
    const key = getFaceIdentityKey(face);
    if (key) byIdentity.set(key, face);
  }

  for (const face of incomingFaces) {
    const key = getFaceIdentityKey(face);
    if (!key) continue;
    byIdentity.set(key, { ...byIdentity.get(key), ...face });
  }

  return Array.from(byIdentity.values());
};

export default function PatientDashboardScreen({ navigation }: Props) {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const [steps, setSteps] = useState(0);
  const [activeMinutes, setActiveMinutes] = useState(0);

  const [patientId, setPatientId] = useState<string | null>(null);
  const [patientName, setPatientName] = useState<string>("Patient");
  const [caregiverId, setCaregiverId] = useState<string | null>(null);
  const [caregiverPhone, setCaregiverPhone] = useState<string | null>(null);
  const [upcomingReminders, setUpcomingReminders] = useState<ReminderData[]>(
    [],
  );
  const [loadingReminders, setLoadingReminders] = useState(true);
  const [loading, setLoading] = useState(true);

  const [currentReminder, setCurrentReminder] = useState<ReminderData | null>(
    null,
  );
  const [showReminderNotification, setShowReminderNotification] =
    useState(false);

  // Modal state for reminder details
  const [showReminder, setShowReminder] = useState(false);
  const [activeReminder, setActiveReminder] = useState<ReminderData | null>(
    null,
  );

  // ✅ Face recognition popup state
  const [recognizedFaceBatch, setRecognizedFaceBatch] = useState<
    FacePopupItem[]
  >([]);
  const [showFacePopup, setShowFacePopup] = useState(false);
  const [localFaces, setLocalFaces] = useState<RecognizedFace[]>([]);

  // ✅ NEW: Recent activities state
  const [recentActivities, setRecentActivities] = useState<PatientActivity[]>(
    [],
  );
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [fallAlert, setFallAlert] = useState<FallAlertData | null>(null);

  // Notes state
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNoteText, setNewNoteText] = useState("");
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [videoUploadResult, setVideoUploadResult] = useState<string | null>(
    null,
  );
  const [isOpeningCamera, setIsOpeningCamera] = useState(false);
  const [showVideoSourceModal, setShowVideoSourceModal] = useState(false);
  const [showRecordGuideModal, setShowRecordGuideModal] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribingNote, setIsTranscribingNote] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const isStoppingRef = useRef(false);

  // Modal animation
  const translateY = useRef(new Animated.Value(0)).current;
  const sheetHeight = useRef(0);
  const DRAG_CLOSE_THRESHOLD = 120;
  const shownFallAlertsRef = useRef<Map<string, number>>(new Map());
  const isPollingFaceRecognitionRef = useRef(false);

  // ✅ Face popup animation
  const facePopupScale = useRef(new Animated.Value(0)).current;
  const facePopupOpacity = useRef(new Animated.Value(0)).current;

  const animateTo = (to: number, cb?: () => void) => {
    Animated.spring(translateY, {
      toValue: to,
      useNativeDriver: true,
      bounciness: 0,
      speed: 20,
    }).start(() => cb?.());
  };

  const openReminder = (data: ReminderData) => {
    setActiveReminder(data);
    setShowReminder(true);
    translateY.setValue(50);
    requestAnimationFrame(() => animateTo(0));
  };

  const closeReminder = () => {
    animateTo(sheetHeight.current || 300, () => {
      setShowReminder(false);
    });
  };

  const [contextualRemindersEnabled, setContextualRemindersEnabled] =
    useState(true);
  const [voiceAlertsEnabled, setVoiceAlertsEnabled] = useState(true);
  const [currentContextualReminder, setCurrentContextualReminder] = useState<
    string | undefined
  >(undefined);
  const [showContextualReminder, setShowContextualReminder] = useState(false);

  const shouldShowFallAlert = (incomingAlert: FallAlertData) => {
    const now = Date.now();
    const shown = shownFallAlertsRef.current;

    for (const [key, timestamp] of shown.entries()) {
      if (!key.startsWith("id:") && now - timestamp > FALL_ALERT_COOLDOWN_MS) {
        shown.delete(key);
      }
    }

    const alertKey = incomingAlert.id
      ? `id:${incomingAlert.id}`
      : `fallback:${incomingAlert.patient_id || patientId || "unknown"}:${incomingAlert.created_at || ""}:${incomingAlert.source || "unknown"}`;

    if (shown.has(alertKey)) {
      return false;
    }

    shown.set(alertKey, now);
    return true;
  };

  const handleIncomingFallAlert = (
    incomingAlert: FallAlertData & { timestamp?: string },
  ) => {
    const normalizedAlert: FallAlertData = {
      ...incomingAlert,
      patient_id: incomingAlert.patient_id || patientId || undefined,
      caregiver_id: incomingAlert.caregiver_id || caregiverId || undefined,
      patient_name: incomingAlert.patient_name || patientName,
      status: incomingAlert.status || "active",
      source: incomingAlert.source || "video",
      created_at:
        incomingAlert.created_at ||
        incomingAlert.timestamp ||
        new Date().toISOString(),
    };

    if (!shouldShowFallAlert(normalizedAlert)) {
      console.log("Skipping duplicate patient fall alert:", normalizedAlert);
      return;
    }

    setFallAlert(normalizedAlert);
    loadRecentActivities();

    if (voiceAlertsEnabled) {
      Speech.speak(
        "A fall has been detected. Your caregiver has been notified.",
        {
          language: "en-US",
          pitch: 1.0,
          rate: 0.9,
        },
      );
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
      onPanResponderMove: (_, g) => {
        const y = Math.max(0, g.dy);
        translateY.setValue(y);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DRAG_CLOSE_THRESHOLD || g.vy > 1.2) {
          closeReminder();
        } else {
          animateTo(0);
        }
      },
    }),
  ).current;

  // ✅ Load local faces from storage
  useEffect(() => {
    loadLocalFaces();
    // Refresh API service cache to get latest ngrok URL
    ApiService.refreshCache();
  }, []);

  const loadLocalFaces = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setLocalFaces(JSON.parse(stored));
        console.log("✅ Loaded local faces:", JSON.parse(stored).length);
      }
    } catch (error) {
      console.error("❌ Error loading local faces:", error);
    }
  };

  const loadNotes = async (pid: string) => {
    try {
      const stored = await AsyncStorage.getItem(`patient_notes_${pid}`);
      if (stored) setNotes(JSON.parse(stored));
    } catch (error) {
      console.error("❌ Error loading notes:", error);
    }
  };

  const saveNote = async () => {
    const text = newNoteText.trim();
    if (!text || !patientId) return;

    const note: Note = {
      id: Date.now().toString(),
      text,
      createdAt: new Date().toISOString(),
    };

    const updated = [note, ...notes];
    setNotes(updated);
    setNewNoteText("");
    Keyboard.dismiss();

    try {
      await AsyncStorage.setItem(
        `patient_notes_${patientId}`,
        JSON.stringify(updated),
      );
    } catch (error) {
      console.error("❌ Error saving note:", error);
    }
  };

  const deleteNote = async (id: string) => {
    Alert.alert("Delete Note", "Are you sure you want to delete this note?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const updated = notes.filter((n) => n.id !== id);
          setNotes(updated);
          try {
            await AsyncStorage.setItem(
              `patient_notes_${patientId}`,
              JSON.stringify(updated),
            );
          } catch (error) {
            console.error("❌ Error deleting note:", error);
          }
        },
      },
    ]);
  };
  const formatNoteDate = (iso: string) => {
    const d = new Date(iso);
    return (
      d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }) +
      " · " +
      d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    );
  };

  const ANDROID_M4A_OPTIONS: Audio.RecordingOptions = {
    isMeteringEnabled: false,
    android: {
      extension: ".m4a",
      outputFormat: Audio.AndroidOutputFormat.MPEG_4,
      audioEncoder: Audio.AndroidAudioEncoder.AAC,
      sampleRate: 16000,
      numberOfChannels: 1,
      bitRate: 64000,
    },
    ios: Audio.RecordingOptionsPresets.HIGH_QUALITY.ios,
    web: Audio.RecordingOptionsPresets.HIGH_QUALITY.web,
  };

  const IOS_M4A_OPTIONS: Audio.RecordingOptions =
    Audio.RecordingOptionsPresets.HIGH_QUALITY;

  const logIOSVoiceNote = (message: string, details?: unknown) => {
    if (Platform.OS !== "ios") return;

    if (details === undefined) {
      console.log(`[VoiceNote:iOS] ${message}`);
      return;
    }

    console.log(`[VoiceNote:iOS] ${message}`, details);
  };

  const formatRecordingError = (error: unknown) => {
    if (error instanceof Error) {
      return { name: error.name, message: error.message };
    }

    return error;
  };

  const createVoiceNoteRecording = async () => {
    if (Platform.OS !== "ios") {
      return Audio.Recording.createAsync(ANDROID_M4A_OPTIONS);
    }

    logIOSVoiceNote("Creating recorder with HIGH_QUALITY preset", {
      extension: IOS_M4A_OPTIONS.ios.extension,
      sampleRate: IOS_M4A_OPTIONS.ios.sampleRate,
      channels: IOS_M4A_OPTIONS.ios.numberOfChannels,
      bitRate: IOS_M4A_OPTIONS.ios.bitRate,
    });

    try {
      return await Audio.Recording.createAsync(IOS_M4A_OPTIONS);
    } catch (error) {
      logIOSVoiceNote(
        "HIGH_QUALITY prepare failed, trying LOW_QUALITY preset",
        formatRecordingError(error),
      );

      return Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.LOW_QUALITY,
      );
    }
  };

  const processVoiceNote = async (uri: string) => {
    logIOSVoiceNote("Sending completed recording for STT", { uri });
    setIsTranscribingNote(true);
    try {
      const result = await ApiService.sendAudioForSTT(uri);
      logIOSVoiceNote("STT response received", {
        hasTranscript: Boolean(result.transcript?.trim()),
        transcriptLength: result.transcript?.length ?? 0,
      });
      if (result.transcript?.trim()) {
        setNewNoteText((prev) => {
          const t = prev.trim();
          return t
            ? `${t} ${result.transcript.trim()}`
            : result.transcript.trim();
        });
      }
    } catch (err) {
      logIOSVoiceNote("STT request failed", formatRecordingError(err));
      console.log("STT note error:", err);
    } finally {
      setIsTranscribingNote(false);
    }
  };

  const startVoiceRecording = async () => {
    logIOSVoiceNote("Start pressed", {
      hasActiveRecording: Boolean(recordingRef.current),
      isStopping: isStoppingRef.current,
      isTranscribingNote,
    });

    if (recordingRef.current || isStoppingRef.current || isTranscribingNote) {
      logIOSVoiceNote("Start ignored because recorder is busy");
      return;
    }

    logIOSVoiceNote("Requesting microphone permission");
    const permission = await Audio.requestPermissionsAsync();
    logIOSVoiceNote("Microphone permission result", {
      granted: permission.granted,
      status: permission.status,
      canAskAgain: permission.canAskAgain,
    });

    if (!permission.granted) {
      Alert.alert(
        "Permission needed",
        "Microphone access is required to use voice notes.",
      );
      return;
    }

    try {
      logIOSVoiceNote("Setting audio mode for recording");
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      logIOSVoiceNote("Audio mode set");
      isStoppingRef.current = false;
      const { recording, status } = await createVoiceNoteRecording();
      recordingRef.current = recording;
      setIsRecording(true);
      logIOSVoiceNote("Recording started", {
        canRecord: status.canRecord,
        isRecording: status.isRecording,
        durationMillis: status.durationMillis,
        uri: recording.getURI(),
      });
    } catch (err) {
      recordingRef.current = null;
      setIsRecording(false);
      logIOSVoiceNote("Recording start failed", formatRecordingError(err));
      console.log("Recording start error:", err);
    }
  };

  const stopVoiceRecording = async () => {
    logIOSVoiceNote("Stop pressed", {
      hasActiveRecording: Boolean(recordingRef.current),
      isStopping: isStoppingRef.current,
    });

    if (isStoppingRef.current) return;

    isStoppingRef.current = true;
    setIsRecording(false);
    const recording = recordingRef.current;
    recordingRef.current = null;

    if (!recording) {
      logIOSVoiceNote("Stop ignored because no active recorder exists");
      isStoppingRef.current = false;
      return;
    }

    try {
      if (Platform.OS === "ios") {
        const statusBeforeStop = await recording.getStatusAsync();
        logIOSVoiceNote("Stopping recorder", {
          canRecord: statusBeforeStop.canRecord,
          isRecording: statusBeforeStop.isRecording,
          durationMillis: statusBeforeStop.durationMillis,
        });
      }

      const stopStatus = await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      logIOSVoiceNote("Recorder stopped", {
        durationMillis: stopStatus.durationMillis,
        uri,
      });
      if (uri) await processVoiceNote(uri);
      if (!uri) logIOSVoiceNote("Recorder stopped without a file URI");
    } catch (err) {
      logIOSVoiceNote("Recording stop failed", formatRecordingError(err));
      console.log("Recording stop error:", err);
    } finally {
      isStoppingRef.current = false;
      Audio.setAudioModeAsync({ allowsRecordingIOS: false })
        .then(() => logIOSVoiceNote("Audio mode reset after recording"))
        .catch((err) =>
          logIOSVoiceNote("Audio mode reset failed", formatRecordingError(err)),
        );
    }
  };

  // ✅ Animate face popup in
  const showFaceRecognitionPopup = (faces: FacePopupItem[]) => {
    if (faces.length === 0) return;

    setRecognizedFaceBatch((currentFaces) =>
      mergeFacePopupItems(currentFaces, faces),
    );
    setShowFacePopup(true);

    facePopupScale.setValue(0.8);
    facePopupOpacity.setValue(0);

    Animated.parallel([
      Animated.spring(facePopupScale, {
        toValue: 1,
        tension: 100,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.timing(facePopupOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // ✅ Animate face popup out
  const hideFaceRecognitionPopup = () => {
    Animated.parallel([
      Animated.timing(facePopupScale, {
        toValue: 0.8,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(facePopupOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowFacePopup(false);
      setRecognizedFaceBatch([]);
    });
  };

  const extractFaceBatchFromResponse = (
    response: any,
  ): FaceRecognitionData[] => {
    const candidateLists = [
      response?.faces,
      response?.recognized_faces,
      response?.face_recognitions,
      response?.face_result,
      response?.face_recognition?.faces,
      response?.recognition?.faces,
    ];

    const faces = candidateLists.find(Array.isArray);
    return faces || [];
  };

  const findLocalFace = (faceData: FaceRecognitionData) => {
    const match = faceData.match;
    const incomingId = normalizeFaceText(faceData.id || match?.id);
    const incomingName = normalizeFaceText(faceData.name || match?.name);

    return localFaces.find((face) => {
      const sameId = incomingId && normalizeFaceText(face.id) === incomingId;
      const sameName =
        incomingName && normalizeFaceText(face.name) === incomingName;
      return sameId || sameName;
    });
  };

  const handleRecognizedFaceBatch = async (
    incomingFaces: FaceRecognitionData[],
  ) => {
    if (!Array.isArray(incomingFaces) || incomingFaces.length === 0) return;

    const pendingFaces: FacePopupItem[] = [];
    const seenInBatch = new Set<string>();
    const now = Date.now();
    const nowIso = new Date(now).toISOString();

    for (const faceData of incomingFaces) {
      const match = faceData.match;
      const name = (faceData.name || match?.name || "").trim();
      if (!name) continue;

      const backendId = faceData.id || match?.id || undefined;
      const relationship = (
        faceData.relationship ||
        match?.relationship ||
        "known person"
      ).trim();
      const identityKey = getFaceIdentityKey({ id: backendId, name });

      if (!identityKey || seenInBatch.has(identityKey)) continue;
      seenInBatch.add(identityKey);

      const cooldownKey = `face_shown_${identityKey}`;
      const lastShownTime = await AsyncStorage.getItem(cooldownKey);

      if (lastShownTime) {
        const timeSinceShown = now - parseInt(lastShownTime, 10);

        if (timeSinceShown < FACE_RECOGNITION_COOLDOWN_MS) {
          console.log(
            `Skipping ${name} - shown ${Math.round(timeSinceShown / 60000)} minutes ago`,
          );
          continue;
        }
      }

      const localFace = findLocalFace(faceData);
      const popupFace: FacePopupItem = {
        id: localFace?.id || backendId || `${identityKey}_${now}`,
        name: localFace?.name || name,
        relationship: localFace?.relationship || relationship,
        imageUri: localFace?.imageUri || "",
        dateAdded: localFace?.dateAdded || nowIso,
        confidence: faceData.confidence ?? match?.confidence,
        timestamp: faceData.timestamp || nowIso,
      };

      pendingFaces.push(popupFace);
      await AsyncStorage.setItem(cooldownKey, now.toString());
    }

    if (pendingFaces.length === 0) return;

    showFaceRecognitionPopup(pendingFaces);

    if (voiceAlertsEnabled) {
      const message =
        pendingFaces.length === 1
          ? `Hello! ${pendingFaces[0].name}, your ${pendingFaces[0].relationship}, is here.`
          : `Hello! ${pendingFaces.map((face) => face.name).join(", ")} are here.`;

      Speech.speak(message, {
        language: "en-US",
        pitch: 1.0,
        rate: 0.9,
      });
    }

    loadRecentActivities();
  };

  const handleRecognizedFaceBatchRef = useRef(handleRecognizedFaceBatch);

  useEffect(() => {
    handleRecognizedFaceBatchRef.current = handleRecognizedFaceBatch;
  });

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    const loadCaregiverPhone = async () => {
      if (!caregiverId) {
        setCaregiverPhone(null);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("caregivers")
          .select("phone")
          .eq("id", caregiverId)
          .single();

        if (error) {
          console.error("Error fetching caregiver phone:", error);
          return;
        }

        setCaregiverPhone(data?.phone || null);
      } catch (err) {
        console.error("Unexpected error loading caregiver phone:", err);
      }
    };

    loadCaregiverPhone();
  }, [caregiverId]);

  const loadUserData = async () => {
    try {
      setLoading(true);
      const patientProfile = await getAuthenticatedPatientProfile();

      if (!patientProfile) {
        Alert.alert("Error", "Patient profile not found. Please log in again.");
        navigation.replace("Login");
        return;
      }

      console.log(
        "✅ Patient profile loaded:",
        patientProfile.id,
        patientProfile.full_name,
      );
      setPatientId(patientProfile.id);
      setPatientName(patientProfile.full_name || "Patient");
      loadNotes(patientProfile.id);

      // ✅ ADD THESE
      console.log("🔐 Requesting health permissions...");
      try {
        const granted = await HealthDataService.requestHealthPermissions();
        console.log("🔐 Health permissions result:", granted);
      } catch (permError) {
        console.log("🔐 Health permissions ERROR:", permError);
      }

      console.log("🚗 Setting up caregiver...");
      const caregiverIdFromProfile = patientProfile.caregiver_id;

      if (caregiverIdFromProfile) {
        console.log("✅ Caregiver ID found:", caregiverIdFromProfile);
        setCaregiverId(caregiverIdFromProfile);

        console.log("🚀 Starting fall detection service...");
        FallDetectionService.start(patientProfile.id, caregiverIdFromProfile);
        FallDetectionService.startVideoPolling(
          patientProfile.id,
          caregiverIdFromProfile,
        );
        console.log("✅ Fall detection service started successfully");
      } else {
        console.warn("⚠️ No caregiver assigned to this patient");
        Alert.alert(
          "No Caregiver Assigned",
          "Fall detection requires a caregiver to be assigned to your account.",
          [{ text: "OK" }],
        );
      }
    } catch (error) {
      console.error("❌ Error loading user data:", error);
      Alert.alert("Error", "Failed to load dashboard.");
      navigation.replace("Login");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!patientId) return;

    loadUpcomingReminders();
    const interval = setInterval(loadUpcomingReminders, 5 * 60 * 1000);

    const subscription = supabase
      .channel("patient-reminders")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reminders",
          filter: `patient_id=eq.${patientId}`,
        },
        () => {
          console.log("📡 Reminder changed - reloading list");
          loadUpcomingReminders();
          loadRecentActivities(); // ✅ Refresh activities when reminders change
        },
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
      FallDetectionService.stop();
      FallDetectionService.stopVideoPolling();
    };
  }, [patientId]);

  // ✅ NEW: Load recent activities when patient ID is available
  useEffect(() => {
    if (!patientId) return;

    loadRecentActivities();

    // Refresh activities every 2 minutes
    const interval = setInterval(loadRecentActivities, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, [patientId]);

  useEffect(() => {
    if (!patientId || !caregiverId) return;

    let cancelled = false;

    const pollBackendFallAlerts = async () => {
      const response = await ApiService.getBackendFallAlerts(
        caregiverId,
        patientId,
      );
      if (cancelled) return;

      for (const backendAlert of response.alerts) {
        handleIncomingFallAlert({
          ...backendAlert,
          source: backendAlert.source || "video",
        });
      }
    };

    pollBackendFallAlerts();
    const interval = setInterval(pollBackendFallAlerts, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [patientId, caregiverId, patientName, voiceAlertsEnabled]);

  // ✅ NEW: Load recent activities function
  const loadRecentActivities = async () => {
    if (!patientId) return;

    try {
      setLoadingActivities(true);
      console.log("📋 Loading recent activities for patient:", patientId);

      const activities = await PatientActivityService.getRecentActivities(
        patientId,
        10,
      );

      setRecentActivities(activities);
      console.log("✅ Loaded", activities.length, "recent activities");
    } catch (error) {
      console.error("❌ Error loading recent activities:", error);
    } finally {
      setLoadingActivities(false);
    }
  };

  useEffect(() => {
    if (!patientId) return;

    const checkForDueReminders = async () => {
      try {
        const { data: allReminders, error } = await supabase
          .from("reminders")
          .select("*")
          .eq("patient_id", patientId)
          .eq("status", "pending");

        if (error || !allReminders) return;

        const now = new Date();

        const dueReminders = allReminders.filter((r) => {
          const reminderTime = ReminderHelperService.parseReminderDateTime(
            r.date,
            r.time,
          );
          const timeDiff = reminderTime.getTime() - now.getTime();
          // Show only in a tight window: 30s after due to 10s before due
          return timeDiff >= -30 * 1000 && timeDiff <= 10 * 1000;
        });

        if (dueReminders.length > 0 && !showReminderNotification) {
          const reminder = dueReminders[0];

          const lastShownKey = `reminder_shown_${reminder.id}`;
          const lastShownTime = await AsyncStorage.getItem(lastShownKey);

          if (lastShownTime) {
            const timeSinceShown = now.getTime() - parseInt(lastShownTime, 10);
            if (timeSinceShown < 5 * 60 * 1000) {
              console.log(
                "⏭️ Skipping reminder - already shown recently:",
                reminder.title,
              );
              return;
            }
          }

          const displayData =
            ReminderHelperService.convertToReminderData(reminder);

          console.log(
            "⏰ SIMPLE REMINDER DUE NOW:",
            reminder.title,
            "at",
            reminder.time,
          );

          await AsyncStorage.setItem(lastShownKey, now.getTime().toString());

          setCurrentReminder(displayData);
          setShowReminderNotification(true);
        }
      } catch (error) {
        console.error("❌ Error checking due reminders:", error);
      }
    };

    checkForDueReminders();
    // Poll more frequently so the 10s window is not missed
    const reminderCheckInterval = setInterval(checkForDueReminders, 5 * 1000);

    return () => clearInterval(reminderCheckInterval);
  }, [patientId, showReminderNotification]);

  const loadUpcomingReminders = async () => {
    if (!patientId) return;

    try {
      setLoadingReminders(true);

      const { data: allReminders, error } = await supabase
        .from("reminders")
        .select("*")
        .eq("patient_id", patientId)
        .eq("status", "pending")
        .order("date", { ascending: true })
        .order("time", { ascending: true });

      if (error) throw error;

      console.log("📋 Fetched patient reminders:", allReminders?.length || 0);

      if (!allReminders || allReminders.length === 0) {
        setUpcomingReminders([]);
        return;
      }

      const upcoming = ReminderHelperService.filterUpcomingReminders(
        allReminders,
        24,
      );
      const displayReminders = upcoming.map((r) =>
        ReminderHelperService.convertToReminderData(r),
      );

      setUpcomingReminders(displayReminders);
      console.log("✅ Loaded", displayReminders.length, "upcoming reminders");
    } catch (error) {
      console.error("❌ Failed to load reminders:", error);
    } finally {
      setLoadingReminders(false);
    }
  };

  const processContextualReminderVideo = async (videoUri: string) => {
    setIsUploadingVideo(true);
    setVideoUploadResult(null);

    try {
      const response = await ApiService.sendVideoForStepVerification(videoUri);
      const recognizedFaces = extractFaceBatchFromResponse(response);

      if (recognizedFaces.length > 0) {
        await handleRecognizedFaceBatch(recognizedFaces);
      }

      const message =
        response?.reminder ||
        response?.message ||
        "Video processed successfully.";
      setVideoUploadResult(message);
    } catch (error) {
      setVideoUploadResult(
        "Failed to process video. Please check the backend URL and try again.",
      );
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const handleVideoUpload = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission required",
        "Please allow access to your media library to upload a video.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      allowsEditing: false,
      quality: 1,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) return;

    const videoUri = result.assets[0].uri;
    await processContextualReminderVideo(videoUri);
  };

  const handleVideoRecord = async () => {
    setIsOpeningCamera(true);

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission required",
        "Please allow camera access to record a video.",
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

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const videoUri = result.assets[0].uri;
      await processContextualReminderVideo(videoUri);
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
    if (isUploadingVideo || isOpeningCamera) return;
    setShowVideoSourceModal(true);
  };

  useEffect(() => {
    (async () => {
      const remindersPref = await AsyncStorage.getItem("contextualReminders");
      const voicePref = await AsyncStorage.getItem("voiceAlerts");
      if (remindersPref !== null)
        setContextualRemindersEnabled(remindersPref === "true");
      if (voicePref !== null) setVoiceAlertsEnabled(voicePref === "true");
    })();
  }, []);

  useEffect(() => {
    loadHealthData();
    const interval = setInterval(loadHealthData, 30000);
    return () => clearInterval(interval);
  }, [patientId]);

  useEffect(() => {
    if (!patientId) return;

    loadDeviceStatus();
    const interval = setInterval(loadDeviceStatus, 60 * 1000);

    return () => clearInterval(interval);
  }, [patientId]);

  const loadDeviceStatus = async () => {
    if (!patientId) return;

    try {
      const status = await PatientDeviceStatusService.collectDeviceStatus();
      await PatientDeviceStatusService.syncPatientDeviceStatus(
        patientId,
        status,
      );
    } catch (error) {
      console.log("Error syncing patient device status:", error);
    }
  };

  const loadHealthData = async () => {
    try {
      const healthData = await HealthDataService.getTodayHealthData();
      setSteps(healthData.steps);
      setActiveMinutes(healthData.activeMinutes);

      if (patientId) {
        await HealthDataService.syncPatientDailyHealthData(
          patientId,
          healthData,
        );
      }
    } catch (error) {
      console.log("Error loading health data:", error);
    }
  };

  useEffect(() => {
    if (!contextualRemindersEnabled) return;

    const interval = setInterval(async () => {
      try {
        const res = await axios.get(
          ApiService.getApiEndpoint("/get_reminders"),
          {
            headers: { "ngrok-skip-browser-warning": "true" },
          },
        );
        const reminders = res.data.reminders || [];

        if (reminders.length > 0) {
          const reminderText =
            reminders[0].reminder || "You have a new reminder";

          setCurrentContextualReminder(reminderText);
          setShowContextualReminder(true);

          if (voiceAlertsEnabled) {
            Speech.speak(reminderText);
          }
        }
      } catch (err) {
        console.log("Error fetching contextual reminders:", err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [contextualRemindersEnabled, voiceAlertsEnabled]);

  // ✅ Poll for face recognitions with local face matching
  useEffect(() => {
    const interval = setInterval(async () => {
      if (isPollingFaceRecognitionRef.current) return;

      isPollingFaceRecognitionRef.current = true;

      try {
        const res = await axios.get(
          ApiService.getApiEndpoint("/get_face_recognitions"),
          {
            headers: { "ngrok-skip-browser-warning": "true" },
          },
        );
        const faces: FaceRecognitionData[] = res.data.faces || [];

        if (faces.length > 0) {
          await handleRecognizedFaceBatchRef.current(faces);
        }
      } catch (err) {
        console.log("Error fetching face recognitions:", err);
      } finally {
        isPollingFaceRecognitionRef.current = false;
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  if (!fontsLoaded)
    return <View style={{ flex: 1, backgroundColor: C.bgTo }} />;

  const callCaregiver = async () => {
    if (!caregiverPhone) {
      Alert.alert(
        "Phone number unavailable",
        "Unable to find your caregiver's phone number. Please try again later.",
      );
      return;
    }

    const url = `tel:${caregiverPhone}`;
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert("Call not available on this device");
    } else {
      Linking.openURL(url);
    }
  };

  const MedicationReminderPopup: React.FC<{
    visible: boolean;
    reminder: ReminderData | null;
    onClose: () => void;
  }> = ({ visible, reminder, onClose }) => {
    const [timeRemaining, setTimeRemaining] = React.useState(300);
    const timerStartTimeRef = React.useRef<number | null>(null);
    const timerIntervalRef = React.useRef<number | null>(null);
    const autoCloseTimeoutRef = React.useRef<number | null>(null);

    React.useEffect(() => {
      if (visible && reminder) {
        console.log("⏱️ Starting 5-minute timer for reminder:", reminder.id);

        timerStartTimeRef.current = Date.now();
        setTimeRemaining(300);

        timerIntervalRef.current = window.setInterval(() => {
          if (timerStartTimeRef.current) {
            const elapsed = Math.floor(
              (Date.now() - timerStartTimeRef.current) / 1000,
            );
            const remaining = Math.max(0, 300 - elapsed);
            setTimeRemaining(remaining);
          }
        }, 1000);

        autoCloseTimeoutRef.current = window.setTimeout(() => {
          handleMissed();
        }, 300000);

        return () => {
          if (timerIntervalRef.current !== null) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
          }
          if (autoCloseTimeoutRef.current !== null) {
            clearTimeout(autoCloseTimeoutRef.current);
            autoCloseTimeoutRef.current = null;
          }
          timerStartTimeRef.current = null;
        };
      }
    }, [visible, reminder?.id]);

    const clearTimers = () => {
      if (timerIntervalRef.current !== null) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      if (autoCloseTimeoutRef.current !== null) {
        clearTimeout(autoCloseTimeoutRef.current);
        autoCloseTimeoutRef.current = null;
      }
      timerStartTimeRef.current = null;
    };

    const handleMissed = async () => {
      if (!reminder?.id) {
        clearTimers();
        onClose();
        return;
      }

      try {
        console.log("❌ Marking reminder as missed:", reminder.id);

        await supabase
          .from("reminders")
          .update({ status: "missed" })
          .eq("id", reminder.id);

        console.log("✅ Reminder marked as missed");

        await AsyncStorage.removeItem(`reminder_shown_${reminder.id}`);
        await loadUpcomingReminders();
        await loadRecentActivities(); // ✅ Refresh activities
      } catch (error) {
        console.error("❌ Error marking reminder as missed:", error);
      }

      clearTimers();
      onClose();
    };

    const handleTaken = async () => {
      clearTimers();

      if (!reminder?.id) {
        onClose();
        return;
      }

      try {
        console.log("✅ Marking reminder as completed:", reminder.id);

        await supabase
          .from("reminders")
          .update({ status: "completed" })
          .eq("id", reminder.id);

        console.log("✅ Reminder marked as completed");

        await AsyncStorage.removeItem(`reminder_shown_${reminder.id}`);
        await loadUpcomingReminders();
        await loadRecentActivities(); // ✅ Refresh activities
      } catch (error) {
        console.error("❌ Error updating reminder:", error);
      }

      onClose();
    };

    const handleLater = async () => {
      clearTimers();

      if (!reminder?.id) {
        onClose();
        return;
      }

      try {
        const now = new Date();
        const newTime = new Date(now.getTime() + 10 * 60 * 1000);

        const hours = newTime.getHours();
        const minutes = newTime.getMinutes();
        const ampm = hours >= 12 ? "PM" : "AM";
        const displayHours = hours % 12 || 12;
        const displayMinutes = minutes.toString().padStart(2, "0");
        const newTimeString = `${displayHours}:${displayMinutes} ${ampm}`;

        const year = newTime.getFullYear();
        const month = String(newTime.getMonth() + 1).padStart(2, "0");
        const day = String(newTime.getDate()).padStart(2, "0");
        const newDate = `${year}-${month}-${day}`;

        console.log("⏰ Rescheduling reminder to:", newDate, newTimeString);

        await supabase
          .from("reminders")
          .update({
            date: newDate,
            time: newTimeString,
            status: "pending",
          })
          .eq("id", reminder.id);

        console.log("✅ Reminder rescheduled for 10 minutes later");

        await AsyncStorage.removeItem(`reminder_shown_${reminder.id}`);

        Alert.alert(
          "Reminder Snoozed",
          `I'll remind you again at ${newTimeString}`,
          [{ text: "OK" }],
        );

        await loadUpcomingReminders();
      } catch (error) {
        console.error("❌ Error rescheduling reminder:", error);
        Alert.alert("Error", "Failed to reschedule reminder");
      }

      onClose();
    };

    const formatTimeRemaining = () => {
      const minutes = Math.floor(timeRemaining / 60);
      const seconds = timeRemaining % 60;
      return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    };

    if (!visible || !reminder) return null;

    return (
      <View style={styles.reminderOverlay}>
        <View style={styles.reminderContainer}>
          <LinearGradient
            colors={["#818cf8", "#a78bfa"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.reminderCardModern}
          >
            <View style={styles.timerBadge}>
              <MaterialIcons name="timer" size={14} color="#fff" />
              <Text style={styles.timerText}>
                Auto-close in {formatTimeRemaining()}
              </Text>
            </View>

            <View style={styles.reminderIconOuter}>
              <View style={styles.reminderIconInner}>
                <MaterialIcons
                  name={reminder.icon as any}
                  size={50}
                  color="#fff"
                />
              </View>
            </View>

            <Text style={styles.reminderMainTitle}>{reminder.title}</Text>
            <Text style={styles.reminderMessage}>
              {reminder.subtitle}
              {reminder.details?.instructions &&
                `\n${reminder.details.instructions}`}
            </Text>

            <TouchableOpacity
              style={styles.primaryBtn}
              activeOpacity={0.9}
              onPress={handleTaken}
            >
              <Text style={styles.primaryBtnText}>
                {reminder.icon === "medication"
                  ? "I've taken it"
                  : "Mark as Done"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              activeOpacity={0.9}
              onPress={handleLater}
            >
              <Text style={styles.secondaryBtnText}>
                Remind me later (10 min)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dismissBtn}
              activeOpacity={0.9}
              onPress={() => {
                clearTimers();
                onClose();
              }}
            >
              <Text style={styles.dismissBtnText}>Dismiss (no action)</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </View>
    );
  };

  // ✅ Face Recognition Popup Component
  const FaceRecognitionPopup: React.FC<{
    visible: boolean;
    faces: FacePopupItem[];
    onClose: () => void;
  }> = ({ visible, faces, onClose }) => {
    if (!visible || faces.length === 0) return null;

    const multipleFaces = faces.length > 1;
    const title = multipleFaces
      ? `${faces.length} familiar people are here`
      : "You know this person!";

    return (
      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={onClose}
      >
        <View style={faceStyles.overlay}>
          <BlurView
            intensity={40}
            tint="dark"
            style={StyleSheet.absoluteFillObject}
          />

          <Animated.View
            style={[
              faceStyles.popupContainer,
              {
                opacity: facePopupOpacity,
                transform: [{ scale: facePopupScale }],
              },
            ]}
          >
            <LinearGradient
              colors={["#6ee7b7", "#34d399"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={faceStyles.popup}
            >
              <View style={faceStyles.iconBadge}>
                <MaterialIcons
                  name={multipleFaces ? "groups" : "person"}
                  size={36}
                  color={C.emerald500}
                />
              </View>

              <Text style={faceStyles.subtitle}>{title}</Text>
              <Text style={faceStyles.summary}>
                {faces.map((face) => face.name).join(", ")}
              </Text>

              <ScrollView
                style={faceStyles.faceList}
                contentContainerStyle={faceStyles.faceListContent}
                showsVerticalScrollIndicator={faces.length > 3}
              >
                {faces.map((face) => (
                  <View
                    key={getFaceIdentityKey(face)}
                    style={faceStyles.faceRow}
                  >
                    {face.imageUri ? (
                      <Image
                        source={{ uri: face.imageUri }}
                        style={faceStyles.faceThumb}
                      />
                    ) : (
                      <View style={faceStyles.faceThumbPlaceholder}>
                        <MaterialIcons name="person" size={30} color="#fff" />
                      </View>
                    )}

                    <View style={faceStyles.faceInfo}>
                      <Text style={faceStyles.name} numberOfLines={1}>
                        {face.name}
                      </Text>
                      <Text style={faceStyles.relationship} numberOfLines={1}>
                        Your {face.relationship}
                      </Text>
                    </View>

                    {typeof face.confidence === "number" && (
                      <Text style={faceStyles.confidence}>
                        {Math.round(face.confidence)}%
                      </Text>
                    )}
                  </View>
                ))}
              </ScrollView>

              <TouchableOpacity
                style={faceStyles.dismissButton}
                activeOpacity={0.9}
                onPress={onClose}
              >
                <MaterialIcons name="close" size={24} color={C.emerald500} />
                <Text style={faceStyles.dismissText}>Dismiss</Text>
              </TouchableOpacity>
            </LinearGradient>
          </Animated.View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting + avatar */}
        <View style={styles.headerWrap}>
          <View>
            <Text style={styles.greetSmall}>Good Morning</Text>
            <Text style={styles.greetName}>{patientName}</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {patientName
                ? patientName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)
                : "P"}
            </Text>
          </View>
        </View>

        {/* Call My Caregiver */}
        <View style={{ paddingHorizontal: 24, marginTop: 8 }}>
          <TouchableOpacity activeOpacity={0.9} onPress={callCaregiver}>
            <LinearGradient
              colors={["#60a5fa", "#a78bfa"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.callBtn}
            >
              <MaterialIcons
                name="call"
                size={30}
                color="#fff"
                style={{ marginRight: 10 }}
              />
              <Text style={styles.callText}>Call My Caregiver</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Device Status */}
        <View style={{ paddingHorizontal: 24, marginTop: 22 }}>
          <View style={styles.cardRow}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: "#dcfce7" }]}>
                <MaterialIcons name="photo-camera" size={21} color="#22c55e" />
              </View>
              <Text style={styles.rowTitle}>Device</Text>
              <View style={styles.dotOnline} />
              <Text style={styles.rowSub}>Connected</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <SectionTitle>Quick Actions</SectionTitle>
        <View style={styles.quickGrid}>
          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.card, styles.quickItem]}
            onPress={() => navigation.navigate("VoiceAssistant")}
          >
            <MaterialIcons name="mic" size={30} color={C.indigo500} />
            <Text style={styles.quickText}>Ask for Help</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.card, styles.quickItem]}
            onPress={() =>
              navigation.navigate("PatientLocation", {
                patientName,
              })
            }
          >
            <MaterialIcons name="location-on" size={30} color={C.indigo500} />
            <Text style={styles.quickText}>Location</Text>
          </TouchableOpacity>
        </View>

        <View style={{ paddingHorizontal: 24, marginTop: 12 }}>
          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.card, styles.notesQuickItem]}
            onPress={() => setShowNotesModal(true)}
          >
            <MaterialIcons name="edit-note" size={28} color={C.indigo500} />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={styles.quickText}>Take Notes</Text>
              <Text style={styles.rowSmall}>
                {notes.length === 0
                  ? "No notes yet"
                  : `${notes.length} note${notes.length > 1 ? "s" : ""} saved`}
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={C.slate400} />
          </TouchableOpacity>
        </View>

        {/* Upcoming Reminders */}
        <View
          style={{
            flexDirection: "row",
            marginTop: 26,
            marginBottom: 12,
            paddingLeft: 27,
          }}
        >
          <Text style={styles.sectionTitle2}>Upcoming Reminders (24h)</Text>
          <TouchableOpacity
            onPress={loadUpcomingReminders}
            style={{ paddingRight: 22, paddingTop: 2 }}
          >
            <MaterialIcons name="refresh" size={24} color={C.indigo500} />
          </TouchableOpacity>
        </View>
        <View style={{ paddingHorizontal: 24 }}>
          {loadingReminders ? (
            <View style={styles.emptyCard}>
              <ActivityIndicator size="large" color={C.indigo500} />
              <Text style={styles.emptyTitle}>Loading reminders...</Text>
            </View>
          ) : upcomingReminders.length > 0 ? (
            upcomingReminders.map((reminder, index) => (
              <TouchableOpacity
                key={index}
                style={styles.reminderCard}
                activeOpacity={0.75}
                onPress={() => openReminder(reminder)}
              >
                <View
                  style={[styles.iconBox, { backgroundColor: reminder.chipBg }]}
                >
                  <MaterialIcons
                    name={reminder.icon as any}
                    size={22}
                    color={reminder.chipColor}
                  />
                </View>
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={styles.rowTitle2}>{reminder.title}</Text>
                  <Text style={styles.rowSmall2}>{reminder.subtitle}</Text>
                </View>
                <MaterialIcons
                  name="chevron-right"
                  size={22}
                  color={C.slate400}
                />
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <MaterialIcons
                name="event-available"
                size={48}
                color={C.slate400}
              />
              <Text style={styles.emptyTitle}>No Upcoming Reminders</Text>
              <Text style={styles.emptySubtitle}>
                All clear for the next 24 hours!
              </Text>
            </View>
          )}
        </View>

        {/* Test Contextual Reminders */}
        <View
          style={{
            flexDirection: "row",
            marginTop: 26,
            marginBottom: 12,
            paddingLeft: 27,
          }}
        >
          <Text style={styles.sectionTitle2}>Test Contextual Reminders</Text>
        </View>
        <View style={{ paddingHorizontal: 24 }}>
          <View style={styles.card}>
            <Text
              style={{
                fontFamily: "Poppins_400Regular",
                fontSize: 13,
                color: C.slate500,
                marginBottom: 14,
              }}
            >
              Upload a short video clip or record one with the camera to test
              the contextual reminder system. The video will be analysed by the
              backend and a relevant reminder will be returned.
            </Text>
            <TouchableOpacity
              onPress={handleVideoOptionPress}
              disabled={isUploadingVideo || isOpeningCamera}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor:
                  isUploadingVideo || isOpeningCamera
                    ? C.indigo300
                    : C.indigo500,
                borderRadius: 14,
                paddingVertical: 13,
                paddingHorizontal: 20,
                gap: 8,
              }}
            >
              {isUploadingVideo ? (
                <ActivityIndicator size="small" color={C.white} />
              ) : (
                <MaterialIcons name="video-library" size={20} color={C.white} />
              )}
              <Text
                style={{
                  fontFamily: "Poppins_600SemiBold",
                  fontSize: 15,
                  color: C.white,
                }}
              >
                {isUploadingVideo
                  ? "Processing..."
                  : isOpeningCamera
                    ? "Opening Camera..."
                    : "Upload or Record Video"}
              </Text>
            </TouchableOpacity>
            {videoUploadResult !== null && (
              <View
                style={{
                  marginTop: 14,
                  backgroundColor: "#eef2ff",
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Poppins_500Medium",
                    fontSize: 13,
                    color: C.indigo500,
                  }}
                >
                  {videoUploadResult}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Daily Activity */}
        <SectionTitle>Daily Activity</SectionTitle>
        <View style={{ paddingHorizontal: 24 }}>
          <View style={[styles.card, styles.activityGrid]}>
            <View style={[styles.activityItem, { backgroundColor: "#eef2ff" }]}>
              <MaterialIcons
                name="directions-walk"
                size={36}
                color={C.indigo500}
              />
              <Text style={styles.activityBig}>{steps.toLocaleString()}</Text>
              <Text style={styles.activitySub}>Steps</Text>
            </View>

            <View style={[styles.activityItem, { backgroundColor: "#f0fdfa" }]}>
              <MaterialIcons
                name="local-fire-department"
                size={36}
                color={C.teal500}
              />
              <Text style={styles.activityBig}>{activeMinutes}</Text>
              <Text style={styles.activitySub}>Active Mins</Text>
            </View>
          </View>
        </View>

        {/* ✅ Recent Activity - NOW WITH DYNAMIC DATA */}
        <View
          style={{
            flexDirection: "row",
            marginTop: 26,
            marginBottom: 12,
            paddingLeft: 27,
          }}
        >
          <Text style={styles.sectionTitle2}>Recent Activity</Text>
          <TouchableOpacity
            onPress={loadRecentActivities}
            style={{ paddingRight: 22, paddingTop: 2 }}
            disabled={loadingActivities}
          >
            <MaterialIcons
              name={loadingActivities ? "hourglass-empty" : "refresh"}
              size={24}
              color={C.indigo500}
            />
          </TouchableOpacity>
        </View>
        <View style={{ paddingHorizontal: 24 }}>
          {loadingActivities ? (
            <View style={styles.emptyCard}>
              <ActivityIndicator size="large" color={C.indigo500} />
              <Text style={styles.emptyTitle}>Loading activities...</Text>
            </View>
          ) : recentActivities.length > 0 ? (
            recentActivities.map((activity) => (
              <View key={activity.id} style={styles.cardRow}>
                <View
                  style={[styles.iconBox, { backgroundColor: activity.iconBg }]}
                >
                  <MaterialIcons
                    name={activity.icon as any}
                    size={24}
                    color={activity.iconColor}
                  />
                </View>
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={styles.rowTitleMed}>{activity.title}</Text>
                  <Text style={styles.rowSmall}>{activity.subtitle}</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <MaterialIcons name="history" size={48} color={C.slate400} />
              <Text style={styles.emptyTitle}>No Recent Activity</Text>
              <Text style={styles.emptySubtitle}>
                Your activities will appear here
              </Text>
            </View>
          )}
        </View>

        {/* Sign out */}
        <View style={{ paddingHorizontal: 24, marginTop: 18 }}>
          <TouchableOpacity
            style={styles.signOutBtn}
            activeOpacity={0.85}
            onPress={() => handleSignOut(navigation)}
          >
            <MaterialIcons name="logout" size={18} color="#df6666ff" />
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>

        {/* Medication Reminder Popup */}
        <MedicationReminderPopup
          visible={showReminderNotification}
          reminder={currentReminder}
          onClose={() => {
            setShowReminderNotification(false);
            setCurrentReminder(null);
          }}
        />

        {/* Contextual Reminder Popup */}
        <ReminderPopup
          visible={showContextualReminder}
          onClose={() => setShowContextualReminder(false)}
          message={currentContextualReminder}
        />
      </ScrollView>

      {/* ✅ Face Recognition Popup */}
      {/* Fall Alert Popup */}
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
              colors={["#dbeafe", "#ede9fe"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.videoModalTop}
            >
              <Text style={styles.videoModalTitle}>Choose Video Source</Text>
              <Text style={styles.videoModalSubtitle}>
                Add a clip from your gallery or record one now.
              </Text>
            </LinearGradient>

            <View style={styles.videoModalActions}>
              <TouchableOpacity
                activeOpacity={0.86}
                onPress={handleChooseVideoUpload}
                style={styles.videoActionBtn}
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
                  <Text style={styles.videoActionTitle}>Upload Video</Text>
                  <Text style={styles.videoActionSubtitle}>
                    Pick an existing clip
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.86}
                onPress={handleChooseVideoRecord}
                style={styles.videoActionBtn}
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
                  <Text style={styles.videoActionTitle}>
                    Record with Camera
                  </Text>
                  <Text style={styles.videoActionSubtitle}>
                    Capture a new clip
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.videoModalCancelBtn}
                onPress={() => setShowVideoSourceModal(false)}
              >
                <Text style={styles.videoModalCancelText}>Not now</Text>
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
            <Text style={styles.recordGuideTitle}>Record a Test Clip</Text>
            <Text style={styles.recordGuideSubtitle}>
              A short, steady recording helps generate a better reminder.
            </Text>

            <View style={styles.recordGuideTips}>
              <View style={styles.recordGuideTipRow}>
                <MaterialIcons name="check-circle" size={18} color="#22c55e" />
                <Text style={styles.recordGuideTipText}>Use good lighting</Text>
              </View>
              <View style={styles.recordGuideTipRow}>
                <MaterialIcons name="check-circle" size={18} color="#22c55e" />
                <Text style={styles.recordGuideTipText}>
                  Keep it between 5 and 20 seconds
                </Text>
              </View>
              <View style={styles.recordGuideTipRow}>
                <MaterialIcons name="check-circle" size={18} color="#22c55e" />
                <Text style={styles.recordGuideTipText}>
                  Keep the activity centered in frame
                </Text>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleLaunchCameraFromGuide}
              style={styles.recordGuidePrimaryBtn}
            >
              <LinearGradient
                colors={["#16a34a", "#22c55e"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.recordGuidePrimaryFill}
              >
                <MaterialIcons name="videocam" size={20} color="#fff" />
                <Text style={styles.recordGuidePrimaryText}>Open Camera</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setShowRecordGuideModal(false)}
              style={styles.recordGuideSecondaryBtn}
            >
              <Text style={styles.recordGuideSecondaryText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={!!fallAlert} transparent animationType="fade">
        <BlurView intensity={40} tint="dark" style={fallStyles.overlay}>
          <View style={fallStyles.centered}>
            <View style={fallStyles.cardContainer}>
              <TouchableOpacity
                style={fallStyles.closeButton}
                onPress={() => setFallAlert(null)}
              >
                <MaterialIcons
                  name="close"
                  size={30}
                  color="rgba(255,255,255,0.8)"
                />
              </TouchableOpacity>

              <LinearGradient
                colors={["#f87171", "#f472b6"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={fallStyles.card}
              >
                <View style={fallStyles.iconWrapper}>
                  <MaterialIcons
                    name="personal-injury"
                    size={50}
                    color="#fff"
                  />
                </View>

                <Text style={fallStyles.title}>FALL DETECTED</Text>
                <Text style={fallStyles.alertText}>
                  We detected a possible fall. Your caregiver has been notified.
                </Text>
                <Text style={fallStyles.timestamp}>
                  {fallAlert?.created_at
                    ? (() => {
                        const date = new Date(
                          fallAlert.created_at.endsWith("Z")
                            ? fallAlert.created_at
                            : `${fallAlert.created_at}Z`,
                        );
                        return `Timestamp: ${date.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}, ${date.toLocaleDateString()}`;
                      })()
                    : "Timestamp: Just now"}
                </Text>

                <View style={fallStyles.buttonGroup}>
                  <TouchableOpacity
                    style={fallStyles.primaryButton}
                    onPress={() => setFallAlert(null)}
                  >
                    <MaterialIcons
                      name="check-circle"
                      size={22}
                      color="#e11d48"
                    />
                    <Text style={fallStyles.primaryText}>I am OK</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={fallStyles.secondaryButton}
                    onPress={callCaregiver}
                  >
                    <MaterialIcons name="call" size={20} color="#fff" />
                    <Text style={fallStyles.secondaryText}>Call Caregiver</Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </View>
          </View>
        </BlurView>
      </Modal>

      {/* Face Recognition Popup */}
      <FaceRecognitionPopup
        visible={showFacePopup}
        faces={recognizedFaceBatch}
        onClose={hideFaceRecognitionPopup}
      />

      {/* Notes Modal — full-screen slide-up so FlatList gets a real flex:1 height */}
      <Modal
        visible={showNotesModal}
        animationType="slide"
        onRequestClose={() => {
          Keyboard.dismiss();
          setShowNotesModal(false);
        }}
      >
        <SafeAreaView style={notesStyles.screen}>
          {/* Header */}
          <View style={notesStyles.headerRow}>
            <TouchableOpacity
              onPress={() => {
                Keyboard.dismiss();
                setShowNotesModal(false);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons name="arrow-back" size={24} color={C.slate700} />
            </TouchableOpacity>
            <View style={notesStyles.headerCenter}>
              <MaterialIcons name="edit-note" size={22} color={C.indigo500} />
              <Text style={notesStyles.title}>My Notes</Text>
            </View>
            <View style={{ width: 24 }} />
          </View>

          {/* Notes list — flex:1 fills all space between header and input bar */}
          <FlatList
            data={notes}
            keyExtractor={(item) => item.id}
            contentContainerStyle={notesStyles.listContent}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={notesStyles.emptyState}>
                <MaterialIcons name="notes" size={56} color={C.slate300} />
                <Text style={notesStyles.emptyText}>No notes yet</Text>
                <Text style={notesStyles.emptySubText}>
                  Use the input below to add your first note
                </Text>
              </View>
            }
            renderItem={({ item: note }) => (
              <View style={notesStyles.noteCard}>
                <Text style={notesStyles.noteText}>{note.text}</Text>
                <View style={notesStyles.noteFooter}>
                  <Text style={notesStyles.noteDate}>
                    {formatNoteDate(note.createdAt)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => deleteNote(note.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <MaterialIcons
                      name="delete-outline"
                      size={18}
                      color={C.slate400}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />

          {/* Input bar pinned to the bottom */}
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <View style={notesStyles.inputBar}>
              {/* Mic button */}
              <TouchableOpacity
                style={[
                  notesStyles.micBtn,
                  isRecording && notesStyles.micBtnActive,
                ]}
                onPress={isRecording ? stopVoiceRecording : startVoiceRecording}
                disabled={isTranscribingNote}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name={isRecording ? "stop" : "mic"}
                  size={22}
                  color="#fff"
                />
              </TouchableOpacity>

              <TextInput
                style={notesStyles.input}
                placeholder="Write or speak a note…"
                placeholderTextColor={C.slate400}
                value={newNoteText}
                onChangeText={setNewNoteText}
                multiline
                maxLength={500}
              />

              {/* Send button */}
              <TouchableOpacity
                style={[
                  notesStyles.saveBtn,
                  !newNoteText.trim() && notesStyles.saveBtnDisabled,
                ]}
                onPress={saveNote}
                disabled={!newNoteText.trim()}
                activeOpacity={0.8}
              >
                <MaterialIcons name="send" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {(isRecording || isTranscribingNote) && (
              <View style={notesStyles.recordingBanner}>
                <View style={notesStyles.recordingDot} />
                <Text style={notesStyles.recordingText}>
                  {isRecording ? "Recording..." : "Transcribing..."}
                </Text>
              </View>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Reminder Details Modal */}
      <Modal
        visible={showReminder}
        transparent
        animationType="none"
        onRequestClose={closeReminder}
      >
        <View style={modalStyles.overlayRoot} pointerEvents="box-none">
          <BlurView
            intensity={30}
            tint="dark"
            style={StyleSheet.absoluteFillObject}
          />
          <TouchableOpacity
            style={modalStyles.overlayTint}
            activeOpacity={1}
            onPress={closeReminder}
          />

          <Animated.View
            style={[modalStyles.sheet, { transform: [{ translateY }] }]}
            onLayout={(e) => {
              sheetHeight.current = e.nativeEvent.layout.height;
            }}
          >
            <View {...panResponder.panHandlers} style={modalStyles.handleWrap}>
              <View style={modalStyles.handle} />
            </View>

            <View style={modalStyles.headerRow}>
              <View
                style={[
                  styles.iconBox,
                  { backgroundColor: activeReminder?.chipBg || "#e2e8f0" },
                ]}
              >
                <MaterialIcons
                  name={(activeReminder?.icon || "medication") as any}
                  size={28}
                  color={activeReminder?.chipColor || "#6366f1"}
                />
              </View>
              <View style={{ marginLeft: 12 }}>
                <Text style={modalStyles.title}>{activeReminder?.title}</Text>
                <Text style={modalStyles.subtitle}>
                  {activeReminder?.subtitle}
                </Text>
              </View>
            </View>

            {activeReminder?.details && (
              <View style={modalStyles.section}>
                <Text style={modalStyles.sectionTitle}>Details</Text>

                {activeReminder.details.medication && (
                  <View style={modalStyles.detailRow}>
                    <MaterialIcons
                      name="medication"
                      size={20}
                      color="#6366f1"
                    />
                    <Text style={modalStyles.detailText}>
                      <Text style={modalStyles.detailLabel}>Medication: </Text>
                      {activeReminder.details.medication}
                    </Text>
                  </View>
                )}

                {activeReminder.details.instructions && (
                  <View style={modalStyles.detailRow}>
                    <MaterialIcons
                      name="lunch-dining"
                      size={20}
                      color="#6366f1"
                    />
                    <Text style={modalStyles.detailText}>
                      <Text style={modalStyles.detailLabel}>
                        Instructions:{" "}
                      </Text>
                      {activeReminder.details.instructions}
                    </Text>
                  </View>
                )}

                {activeReminder.details.note && (
                  <View style={modalStyles.detailRow}>
                    <MaterialIcons
                      name="speaker-notes"
                      size={20}
                      color="#6366f1"
                    />
                    <Text style={modalStyles.detailText}>
                      <Text style={modalStyles.detailLabel}>
                        Caregiver Note:{" "}
                      </Text>
                      {activeReminder.details.note}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {activeReminder?.status && (
              <View style={modalStyles.section}>
                <Text style={modalStyles.sectionTitle}>Status</Text>
                <View style={modalStyles.statusCard}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <MaterialIcons
                      name={
                        activeReminder.status.label === "Confirmed"
                          ? "check-circle"
                          : "schedule"
                      }
                      size={22}
                      color={
                        activeReminder.status.label === "Confirmed"
                          ? "#16a34a"
                          : "#64748b"
                      }
                      style={{ marginRight: 10 }}
                    />
                    <Text
                      style={[
                        modalStyles.statusMain,
                        {
                          color:
                            activeReminder.status.label === "Confirmed"
                              ? "#065f46"
                              : "#334155",
                        },
                      ]}
                    >
                      {activeReminder.status.time || "—"}
                    </Text>
                  </View>
                  <Text
                    style={[
                      modalStyles.statusRight,
                      {
                        color:
                          activeReminder.status.label === "Confirmed"
                            ? "#15803d"
                            : "#64748b",
                      },
                    ]}
                  >
                    {activeReminder.status.label || ""}
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={modalStyles.closeBtn}
              onPress={closeReminder}
            >
              <Text style={modalStyles.closeText}>Close</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <Text style={styles.sectionTitle}>{children}</Text>;

const handleSignOut = async (navigation: Props["navigation"]) => {
  try {
    await AsyncStorage.multiRemove(["role", "userEmail", "token"]);
  } catch {}
  navigation.replace("Login");
};

const ReminderPopup: React.FC<{
  visible: boolean;
  onClose: () => void;
  message?: string;
}> = ({ visible, onClose, message }) => {
  if (!visible) return null;

  const handleClose = () => {
    Speech.stop();
    onClose();
  };

  return (
    <View style={styles.reminderScrim}>
      <View style={styles.reminderWrap}>
        <LinearGradient
          colors={["#818cf8", "#a78bfa"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.reminderCCard}
        >
          <View style={styles.reminderIconCircle}>
            <MaterialIcons name="lightbulb" size={48} color="#fff" />
          </View>

          <Text style={styles.reminderTitle}>Gentle Reminder</Text>

          <Text style={styles.reminderBody}>
            {message || "You have a new reminder"}
          </Text>

          <TouchableOpacity
            style={styles.reminderCta}
            activeOpacity={0.9}
            onPress={handleClose}
          >
            <Text style={styles.reminderCtaText}>Okay, got it</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </View>
  );
};

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bgTo,
  },

  headerWrap: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "ios" ? 56 : 32,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  greetSmall: {
    marginTop: 9,
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: C.slate500,
  },
  greetName: {
    fontFamily: "Poppins_700Bold",
    fontSize: 32,
    color: C.slate800,
    marginTop: -6,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: C.indigo300,
    backgroundColor: "#818cf8",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 20,
    color: "#fff",
  },

  callBtn: {
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#60a5fa",
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  callText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 18,
    color: "#fff",
  },

  card: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardRow: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    marginBottom: 12,
  },
  rowLeft: { flexDirection: "row", alignItems: "center" },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: {
    marginLeft: 12,
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: C.slate700,
  },
  rowTitleMed: {
    fontFamily: "Poppins_500Medium",
    fontSize: 16,
    color: C.slate700,
  },
  rowSub: {
    marginLeft: 8,
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: C.slate500,
  },
  rowSmall: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: C.slate500,
  },
  rowTitle2: {
    marginLeft: 0,
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: C.slate700,
  },
  rowSmall2: {
    marginLeft: 0,
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: C.slate500,
  },
  dotOnline: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.green500,
    marginLeft: 8,
  },

  sectionTitle: {
    marginTop: 26,
    marginBottom: 12,
    paddingHorizontal: 24,
    fontFamily: "Poppins_600SemiBold",
    fontSize: 18,
    color: C.slate700,
  },
  sectionTitle2: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 18,
    color: C.slate700,
    flex: 1,
  },

  quickGrid: {
    paddingHorizontal: 24,
    flexDirection: "row",
    gap: 12,
  },
  quickItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
  },
  quickText: {
    marginTop: 8,
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: C.slate700,
  },
  notesQuickItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    padding: 16,
  },

  reminderCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },

  emptyCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  emptyTitle: {
    marginTop: 12,
    fontFamily: "Poppins_600SemiBold",
    color: C.slate600,
    fontSize: 16,
  },
  emptySubtitle: {
    marginTop: 4,
    fontFamily: "Poppins_400Regular",
    color: C.slate400,
    fontSize: 14,
    textAlign: "center",
  },

  timePill: {
    width: 44,
    height: 44,
    borderRadius: 32,
    backgroundColor: C.teal50,
    alignItems: "center",
    justifyContent: "center",
  },
  timeText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 13,
    color: C.teal500,
  },

  activityGrid: {
    flexDirection: "row",
    gap: 12,
  },
  activityItem: {
    flex: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  activityBig: {
    marginTop: 6,
    fontFamily: "Poppins_700Bold",
    fontSize: 24,
    color: C.slate700,
  },
  activitySub: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: C.slate500,
  },
  signOutBtn: {
    marginLeft: 96,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#f8e2e2ff",
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    marginBottom: 20,
  },
  signOutText: {
    marginLeft: 8,
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: "#df6666ff",
  },

  videoModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2,6,23,0.45)",
    justifyContent: "flex-end",
    padding: 16,
  },
  videoModalCard: {
    backgroundColor: C.white,
    borderRadius: 22,
    overflow: "hidden",
    shadowColor: "#0f172a",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  videoModalTop: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
  },
  videoModalTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: C.slate800,
  },
  videoModalSubtitle: {
    marginTop: 4,
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: C.slate600,
  },
  videoModalActions: {
    padding: 14,
    gap: 10,
  },
  videoActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.slate300,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
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
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: C.slate800,
  },
  videoActionSubtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: C.slate500,
  },
  videoModalCancelBtn: {
    marginTop: 2,
    borderWidth: 1,
    borderColor: C.slate300,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  videoModalCancelText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: C.slate700,
  },
  recordGuideCard: {
    backgroundColor: C.white,
    borderRadius: 22,
    padding: 18,
    shadowColor: "#0f172a",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  recordGuideTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 19,
    color: C.slate800,
    textAlign: "center",
  },
  recordGuideSubtitle: {
    marginTop: 6,
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    color: C.slate600,
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
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  recordGuideTipText: {
    marginLeft: 8,
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: C.slate700,
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
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: C.white,
  },
  recordGuideSecondaryBtn: {
    marginTop: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
  },
  recordGuideSecondaryText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    color: C.slate500,
  },

  reminderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  reminderContainer: {
    width: "100%",
    maxWidth: 380,
  },
  reminderCardModern: {
    borderRadius: 28,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6366F1",
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  timerBadge: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
    marginBottom: 16,
  },
  timerText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: "#fff",
  },
  reminderIconOuter: {
    marginBottom: 16,
  },
  reminderIconInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  reminderMainTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 22,
    color: "#fff",
    marginBottom: 6,
    textAlign: "center",
  },
  reminderMessage: {
    fontFamily: "Poppins_400Regular",
    fontSize: 16,
    color: "#fff",
    textAlign: "center",
    opacity: 0.95,
    marginBottom: 18,
    lineHeight: 24,
  },
  primaryBtn: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  primaryBtnText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 17,
    color: "#4f46e5",
  },
  secondaryBtn: {
    width: "100%",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 16,
    color: "#fff",
  },
  dismissBtn: {
    width: "100%",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  dismissBtnText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
  },

  reminderScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  reminderWrap: { width: "100%", maxWidth: 380 },
  reminderCCard: {
    borderRadius: 28,
    padding: 24,
    alignItems: "center",
    shadowColor: "#818cf8",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  reminderIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.30)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  reminderTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 24,
    color: "#fff",
    marginTop: 4,
    marginBottom: 8,
    textAlign: "center",
  },
  reminderBody: {
    fontFamily: "Poppins_500Medium",
    fontSize: 18,
    lineHeight: 28,
    color: "#ffffff",
    opacity: 0.95,
    textAlign: "center",
    marginBottom: 18,
    paddingHorizontal: 6,
  },
  reminderCta: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  reminderCtaText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: "#4f46e5",
  },
});

// ✅ Face Recognition Popup Styles
const fallStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  centered: {
    width: "100%",
    maxWidth: 400,
  },
  cardContainer: {
    position: "relative",
  },
  closeButton: {
    position: "absolute",
    top: 12,
    left: 12,
    zIndex: 10,
  },
  card: {
    borderRadius: 28,
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: "center",
    shadowColor: "#f472b6",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 25,
    elevation: 10,
  },
  iconWrapper: {
    backgroundColor: "rgba(255,255,255,0.3)",
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontFamily: "Poppins_700Bold",
    color: "#fff",
    marginBottom: 8,
  },
  alertText: {
    fontSize: 18,
    color: "#fff",
    textAlign: "center",
    marginBottom: 4,
    fontFamily: "Poppins_500Medium",
  },
  timestamp: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    marginBottom: 28,
    fontFamily: "Poppins_400Regular",
  },
  buttonGroup: {
    width: "100%",
    gap: 10,
  },
  primaryButton: {
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  primaryText: {
    color: "#e11d48",
    fontSize: 17,
    fontFamily: "Poppins_700Bold",
  },
  secondaryButton: {
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.8)",
    borderRadius: 20,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  secondaryText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Poppins_600SemiBold",
  },
});

const faceStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  popupContainer: {
    width: "100%",
    maxWidth: 380,
  },
  popup: {
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    shadowColor: "#34d399",
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  iconBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  subtitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 22,
    color: "#fff",
    marginBottom: 8,
    textAlign: "center",
  },
  summary: {
    fontFamily: "Poppins_500Medium",
    fontSize: 15,
    color: "#fff",
    opacity: 0.85,
    marginBottom: 18,
    textAlign: "center",
  },
  faceList: {
    width: "100%",
    maxHeight: 300,
    marginBottom: 18,
  },
  faceListContent: {
    gap: 10,
  },
  faceRow: {
    width: "100%",
    minHeight: 76,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  faceThumb: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.55)",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  faceThumbPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.55)",
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  faceInfo: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
  },
  name: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: "#fff",
  },
  relationship: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: "#fff",
    opacity: 0.82,
    marginTop: 2,
  },
  confidence: {
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
    color: "#fff",
    marginLeft: 10,
  },
  dismissButton: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  dismissText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: C.emerald500,
  },
});

const modalStyles = StyleSheet.create({
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
  },
  overlayTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.40)",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 6,
  },
  handleWrap: {
    alignItems: "center",
    paddingVertical: 10,
  },
  handle: {
    width: 56,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#cbd5e1",
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 22,
    color: "#1e293b",
  },
  subtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: "#64748b",
  },

  section: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 16,
    marginTop: 16,
  },
  sectionTitle: {
    fontFamily: "Poppins_600SemiBold",
    color: "#475569",
    marginBottom: 10,
  },

  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
    gap: 12,
  },
  detailText: {
    flex: 1,
    color: "#334155",
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
  },
  detailLabel: {
    fontFamily: "Poppins_500Medium",
    color: "#334155",
  },

  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  statusMain: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
  },
  statusRight: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
  },

  closeBtn: {
    backgroundColor: "#6366f1",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 18,
  },
  closeText: {
    fontFamily: "Poppins_600SemiBold",
    color: "#fff",
    fontSize: 16,
  },
});

const notesStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 20,
    color: C.slate800,
  },
  listContent: {
    padding: 16,
    paddingBottom: 8,
    flexGrow: 1,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
  },
  emptyText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: C.slate500,
    marginTop: 16,
  },
  emptySubText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: C.slate400,
    marginTop: 6,
    textAlign: "center",
    paddingHorizontal: 32,
  },
  noteCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: C.indigo500,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  noteText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 15,
    color: C.slate700,
    lineHeight: 22,
  },
  noteFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  noteDate: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: C.slate400,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 24 : 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  micBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: C.indigo500,
    alignItems: "center",
    justifyContent: "center",
  },
  micBtnActive: {
    backgroundColor: "#ef4444",
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    backgroundColor: "#f1f5f9",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: "Poppins_400Regular",
    fontSize: 15,
    color: C.slate800,
    textAlignVertical: "top",
  },
  saveBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: C.indigo500,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnDisabled: {
    backgroundColor: C.slate300,
  },
  recordingBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 8,
    backgroundColor: "#fef2f2",
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444",
  },
  recordingText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: "#ef4444",
  },
});
