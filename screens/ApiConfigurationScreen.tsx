import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../app/App';
import { ApiService } from '../services/ApiService';

import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';

type Props = NativeStackScreenProps<RootStackParamList, 'ApiConfiguration'>;

const C = {
  bgFrom: '#e0e7ff',
  bgTo: '#f0f4ff',
  slate900: '#0f172a',
  slate800: '#1e293b',
  slate700: '#334155',
  slate600: '#475569',
  slate500: '#64748b',
  slate400: '#94a3b8',
  white: '#fff',
  indigo500: '#6366f1',
  indigo600: '#4f46e5',
  green500: '#22c55e',
  red500: '#ef4444',
};

export default function ApiConfigurationScreen({ navigation }: Props) {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const [ngrokUrl, setNgrokUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSavedUrl();
  }, []);

  const loadSavedUrl = async () => {
    try {
      const url = await ApiService.getNgrokUrl();
      if (url) {
        setNgrokUrl(url);
      }
    } catch (error) {
      console.error('Error loading ngrok URL:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!ngrokUrl.trim()) {
      Alert.alert('Error', 'Please enter a valid ngrok URL');
      return;
    }

    // Basic URL validation
    if (!ngrokUrl.startsWith('http://') && !ngrokUrl.startsWith('https://')) {
      Alert.alert('Error', 'URL must start with http:// or https://');
      return;
    }

    setSaving(true);
    try {
      await ApiService.saveNgrokUrl(ngrokUrl);
      Alert.alert('Success', 'Ngrok URL saved successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to save ngrok URL. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    Alert.alert(
      'Clear URL',
      'Are you sure you want to clear the saved ngrok URL?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await ApiService.clearNgrokUrl();
              setNgrokUrl('');
              Alert.alert('Success', 'Ngrok URL cleared successfully!');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear ngrok URL.');
            }
          }
        }
      ]
    );
  };

  if (!fontsLoaded || loading) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={C.indigo500} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={C.slate600} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>API Configuration</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Info Card */}
        <View style={styles.infoCard}>
          <MaterialIcons name="info-outline" size={24} color={C.indigo500} />
          <Text style={styles.infoText}>
            Enter your ngrok URL to enable voice assistant and API features. This URL will be used for
            speech-to-text processing and data synchronization.
          </Text>
        </View>

        {/* Form */}
        <Text style={styles.label}>Ngrok URL</Text>
        <TextInput
          style={styles.input}
          value={ngrokUrl}
          onChangeText={setNgrokUrl}
          placeholder="https://your-ngrok-url.ngrok.io"
          placeholderTextColor={C.slate400}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />

        <Text style={styles.hint}>
          Example: https://abc123.ngrok.io (without trailing slash)
        </Text>

        {/* Action Buttons */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color={C.white} />
          ) : (
            <>
              <MaterialIcons name="save" size={20} color={C.white} />
              <Text style={styles.saveBtnText}>Save Configuration</Text>
            </>
          )}
        </TouchableOpacity>

        {ngrokUrl ? (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={handleClear}
            activeOpacity={0.8}
          >
            <MaterialIcons name="delete-outline" size={20} color={C.red500} />
            <Text style={styles.clearBtnText}>Clear Saved URL</Text>
          </TouchableOpacity>
        ) : null}

        {/* Instructions */}
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>How to get your Ngrok URL:</Text>
          <Text style={styles.instructionStep}>1. Run your backend server (Flask/Colab)</Text>
          <Text style={styles.instructionStep}>2. Start ngrok: <Text style={styles.code}>ngrok http 5000</Text></Text>
          <Text style={styles.instructionStep}>3. Copy the HTTPS forwarding URL</Text>
          <Text style={styles.instructionStep}>4. Paste it here and save</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bgTo,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 20,
    color: C.slate900,
  },
  content: {
    padding: 24,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#eef2ff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    alignItems: 'flex-start',
  },
  infoText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: C.slate700,
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  label: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: C.slate900,
    marginBottom: 8,
  },
  input: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    fontFamily: 'Poppins_400Regular',
    fontSize: 15,
    color: C.slate900,
  },
  hint: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: C.slate500,
    marginTop: 8,
    marginBottom: 24,
  },
  saveBtn: {
    flexDirection: 'row',
    backgroundColor: C.indigo500,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.indigo500,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: C.white,
    marginLeft: 8,
  },
  clearBtn: {
    flexDirection: 'row',
    backgroundColor: '#fee2e2',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  clearBtnText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: C.red500,
    marginLeft: 8,
  },
  instructionsCard: {
    backgroundColor: C.white,
    padding: 20,
    borderRadius: 12,
    marginTop: 32,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  instructionsTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: C.slate900,
    marginBottom: 12,
  },
  instructionStep: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: C.slate700,
    marginBottom: 8,
    lineHeight: 20,
  },
  code: {
    fontFamily: 'Courier New',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 13,
    color: C.indigo600,
  },
});
