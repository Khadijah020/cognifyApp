import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Linking,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import Voice, {
  SpeechRecognizedEvent,
  SpeechEndEvent,
  SpeechErrorEvent,
  SpeechResultsEvent,
} from '@react-native-voice/voice';
import { MaterialIcons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../app/App';

// 🩷 Import Poppins font family
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';

type Props = NativeStackScreenProps<RootStackParamList, 'VoiceAssistant'>;

const C = {
  overlayFrom: 'rgba(96,165,250,0.9)', // #60a5fa
  overlayTo: 'rgba(167,139,250,0.9)', // #a78bfa
  white: '#fff',
  white20: 'rgba(255,255,255,0.2)',
  white30: 'rgba(255,255,255,0.3)',
};

export default function VoiceAssistantScreen({ navigation }: Props) {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState<string>('');
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.stagger(700, [
        Animated.timing(ring1, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(ring2, { toValue: 1, duration: 1800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [ring1, ring2]);

  useEffect(() => {
    Voice.onSpeechStart = () => {};
    Voice.onSpeechRecognized = (_: SpeechRecognizedEvent) => {};
    Voice.onSpeechEnd = (_: SpeechEndEvent) => setListening(false);
    Voice.onSpeechError = (e: SpeechErrorEvent) => {
      setListening(false);
      console.warn(e.error);
    };
    Voice.onSpeechResults = (e: SpeechResultsEvent) => {
      const value = e.value?.[0] ?? '';
      setTranscript(value);
      handleCommand(value.trim().toLowerCase());
    };

    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, []);

  const startListening = async () => {
    try {
      setTranscript('');
      setListening(true);
      await Voice.start('en-US');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    } catch {
      setListening(false);
    }
  };

  const stopListening = async () => {
    try {
      await Voice.stop();
    } catch {}
    setListening(false);
  };

  const handleCommand = async (text: string) => {
    const say = (msg: string) => Speech.speak(msg, { rate: 1.0, pitch: 1.0 });

    if (!text) return;

    if (text.includes('call') && text.includes('caregiver')) {
      say('Calling your caregiver.');
      const tel = 'tel:+11234567890';
      if (await Linking.canOpenURL(tel)) Linking.openURL(tel);
      return;
    }

    if (text.includes('location') || text.includes('where am i')) {
      say('Opening your location.');
      navigation.navigate('PatientLocation');
      return;
    }

    if (text.includes('reminder') || text.includes('medication')) {
      say('Opening your reminders.');
      navigation.navigate('AddReminder');
      return;
    }

    if (text.includes('help') || text.includes('assist')) {
      say('I am here. What do you need help with?');
      return;
    }

    if (text.includes('where are my keys')) {
      say('Last seen on the kitchen table 20 minutes ago.');
      return;
    }

    say("Sorry, I didn't quite get that. Please try again.");
  };

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#000' }} />;
  }

  return (
    <View style={styles.fill}>
      <LinearGradient
        colors={[C.overlayFrom, C.overlayTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.overlay}
      >
        <View style={styles.centerTop}>
          <Text style={[styles.title, { fontFamily: 'Poppins_700Bold' }]}>
            How can I help you?
          </Text>
          <Text style={[styles.subtitle, { fontFamily: 'Poppins_400Regular' }]}>
            Ask me anything, like “Where are my keys?”
          </Text>
        </View>

        <View style={styles.micWrap}>
          <Animated.View
            style={[
              styles.ring,
              {
                transform: [{ scale: ring1.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.5] }) }],
                opacity: ring1.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
              },
            ]}
          />
          <Animated.View
            style={[
              styles.ring,
              {
                transform: [{ scale: ring2.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.7] }) }],
                opacity: ring2.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0] }),
              },
            ]}
          />

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={listening ? stopListening : startListening}
            style={styles.micBtnShadow}
          >
            <LinearGradient
              colors={['#60a5fa', '#a78bfa']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.micBtn}
            >
              <MaterialIcons name="mic" size={64} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.bottom}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              stopListening();
              navigation.goBack();
            }}
            style={styles.cancelBtn}
          >
            <Text style={[styles.cancelText, { fontFamily: 'Poppins_600SemiBold' }]}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  overlay: { flex: 1, paddingHorizontal: 24, paddingTop: 120, paddingBottom: 32 },
  centerTop: { alignItems: 'center', marginBottom: 40 },
  title: {
    color: C.white,
    fontSize: 28,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.9)',
    fontSize: 18,
    textAlign: 'center',
  },
  micWrap: { alignItems: 'center', justifyContent: 'center', marginTop: 60, marginBottom: 40 },
  ring: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: C.white20,
  },
  micBtnShadow: {
    shadowColor: '#a78bfa',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottom: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  cancelBtn: {
    backgroundColor: C.white20,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 28,
    marginBottom: 20,
  },
  cancelText: { color: C.white, fontSize: 18 },
});
