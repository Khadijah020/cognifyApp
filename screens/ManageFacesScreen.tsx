// ManageFacesScreen.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../app/App';

import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';

type Props = NativeStackScreenProps<RootStackParamList, 'ManageFaces'>;

type RecognizedFace = {
  id: string;
  name: string;
  relationship: string;
  imageUri: string;
  dateAdded: string;
};

type NewPersonData = {
  name: string;
  relationship: string;
  imageUri: string | null;
};

const STORAGE_KEY = 'cognify_recognized_faces';

const defaultFaces: RecognizedFace[] = [
  {
    id: '1',
    name: 'Jane Doe',
    relationship: 'Daughter',
    imageUri:
      'https://images.unsplash.com/photo-1494790108755-2616b612b739?w=150&h=150&fit=crop&crop=face',
    dateAdded: '2024-01-15',
  },
  {
    id: '2',
    name: 'Michael Smith',
    relationship: 'Grandson',
    imageUri:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
    dateAdded: '2024-02-20',
  },
  {
    id: '3',
    name: 'Dr. Emily White',
    relationship: 'Doctor',
    imageUri:
      'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&h=150&fit=crop&crop=face',
    dateAdded: '2024-03-10',
  },
  {
    id: '4',
    name: 'David Chen',
    relationship: 'Neighbor',
    imageUri:
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
    dateAdded: '2024-03-25',
  },
];

const INDIGO = '#6366f1';
const BG_FROM = '#f0f4ff';
const BG_TO = '#e0e7ff';

export default function ManageFacesScreen({ navigation }: Props) {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const [recognizedFaces, setRecognizedFaces] = useState<RecognizedFace[]>([]);
  const [addPersonVisible, setAddPersonVisible] = useState(false);
  const [editPersonVisible, setEditPersonVisible] = useState(false);
  const [selectedFace, setSelectedFace] = useState<RecognizedFace | null>(null);
  const [newPersonData, setNewPersonData] = useState<NewPersonData>({
    name: '',
    relationship: '',
    imageUri: null,
  });

  const relationships = [
    'Family Member',
    'Daughter',
    'Son',
    'Grandson',
    'Granddaughter',
    'Doctor',
    'Nurse',
    'Caregiver',
    'Friend',
    'Neighbor',
    'Other',
  ];

  useEffect(() => {
    requestPermissions();
    loadFaces();
  }, []);

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'We need photo library access to select a picture.');
    }
  };

  const loadFaces = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setRecognizedFaces(JSON.parse(stored));
      } else {
        setRecognizedFaces(defaultFaces);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(defaultFaces));
      }
    } catch {
      setRecognizedFaces(defaultFaces);
    }
  };

  const saveFaces = async (faces: RecognizedFace[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(faces));
    } catch {}
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (!result.canceled && result.assets[0]) {
        setNewPersonData((p) => ({ ...p, imageUri: result.assets[0].uri }));
      }
    } catch {
      Alert.alert('Error', 'Failed to pick image.');
    }
  };

  const handleAddPerson = async () => {
    if (!newPersonData.name.trim()) return Alert.alert('Error', 'Please enter a name.');
    if (!newPersonData.relationship.trim())
      return Alert.alert('Error', 'Please select a relationship.');
    if (!newPersonData.imageUri) return Alert.alert('Error', 'Please select a photo.');

    const newFace: RecognizedFace = {
      id: Date.now().toString(),
      name: newPersonData.name.trim(),
      relationship: newPersonData.relationship,
      imageUri: newPersonData.imageUri,
      dateAdded: new Date().toISOString().split('T')[0],
    };

    const updated = [newFace, ...recognizedFaces];
    setRecognizedFaces(updated);
    await saveFaces(updated);

    setNewPersonData({ name: '', relationship: '', imageUri: null });
    setAddPersonVisible(false);
  };

  const handleEditPerson = async () => {
    if (!selectedFace) return;
    if (!newPersonData.name.trim() || !newPersonData.relationship.trim()) {
      return Alert.alert('Error', 'Please fill in all fields.');
    }
    const updated = recognizedFaces.map((f) =>
      f.id === selectedFace.id
        ? {
            ...f,
            name: newPersonData.name.trim(),
            relationship: newPersonData.relationship,
            imageUri: newPersonData.imageUri || f.imageUri,
          }
        : f
    );
    setRecognizedFaces(updated);
    await saveFaces(updated);
    setEditPersonVisible(false);
    setSelectedFace(null);
    setNewPersonData({ name: '', relationship: '', imageUri: null });
  };

  const handleDeletePerson = (face: RecognizedFace) => {
    Alert.alert('Delete Person', `Remove ${face.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const updated = recognizedFaces.filter((f) => f.id !== face.id);
          setRecognizedFaces(updated);
          await saveFaces(updated);
        },
      },
    ]);
  };

  const openEdit = (face: RecognizedFace) => {
    setSelectedFace(face);
    setNewPersonData({ name: face.name, relationship: face.relationship, imageUri: face.imageUri });
    setEditPersonVisible(true);
  };

  const renderItem = ({ item }: { item: RecognizedFace }) => (
    <View style={s.faceCard}>
      <Image source={{ uri: item.imageUri }} style={s.faceImg} />
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={s.faceName}>{item.name}</Text>
        <Text style={s.faceRel}>{item.relationship}</Text>
      </View>
      <View style={s.actions}>
        <TouchableOpacity style={s.iconBtnSoft} onPress={() => openEdit(item)}>
          <MaterialIcons name="edit" size={18} color="#475569" />
        </TouchableOpacity>
        <TouchableOpacity style={s.iconBtnSoft} onPress={() => handleDeletePerson(item)}>
          <MaterialIcons name="delete" size={18} color="#475569" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const PersonModal = ({
    visible,
    onClose,
    onSave,
    title,
  }: {
    visible: boolean;
    onClose: () => void;
    onSave: () => void;
    title: string;
  }) => (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={s.modalCard}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={22} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
            <TouchableOpacity style={s.photoTap} onPress={pickImage} activeOpacity={0.8}>
              {newPersonData.imageUri ? (
                <Image source={{ uri: newPersonData.imageUri }} style={s.photo} />
              ) : (
                <View style={s.photoPlaceholder}>
                  <MaterialIcons name="add-a-photo" size={34} color={INDIGO} />
                  <Text style={s.photoText}>Tap to add photo</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={s.field}>
              <Text style={s.label}>Name *</Text>
              <TextInput
                style={s.input}
                value={newPersonData.name}
                onChangeText={(t) => setNewPersonData((p) => ({ ...p, name: t }))}
                placeholder="Enter full name"
                placeholderTextColor="#94a3b8"
              />
            </View>

            <View style={s.field}>
              <Text style={s.label}>Relationship *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                {relationships.map((r) => {
                  const active = newPersonData.relationship === r;
                  return (
                    <TouchableOpacity
                      key={r}
                      style={[s.chip, active && s.chipActive]}
                      onPress={() => setNewPersonData((p) => ({ ...p, relationship: r }))}
                    >
                      <Text style={[s.chipText, active && s.chipTextActive]}>{r}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </ScrollView>

          <View style={s.modalActions}>
            <TouchableOpacity style={s.cancel} onPress={onClose}>
              <Text style={s.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.save} onPress={onSave}>
              <Text style={s.saveTxt}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: BG_FROM }} />;

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.back} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#475569" />
        </TouchableOpacity>
        <Text style={s.title}>Manage Faces</Text>
        <View style={{ width: 48 }} />
      </View>

      {/* Add new person */}
      <TouchableOpacity style={s.addCard} onPress={() => setAddPersonVisible(true)} activeOpacity={0.9}>
        <View style={s.addInner}>
          <View style={s.addIcon}>
            <MaterialIcons name="add-photo-alternate" size={24} color={INDIGO} />
          </View>
          <Text style={s.addTitle}>Add New Person</Text>
          <Text style={s.addSub}>Upload a photo and add details</Text>
        </View>
      </TouchableOpacity>

      {/* Recognized Faces */}
      <View style={{ paddingHorizontal: 24, marginTop: 22, flex: 1 }}>
        <Text style={s.section}>Recognized Faces</Text>

        <FlatList
          data={recognizedFaces}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        />
      </View>

      {/* Done CTA (fixed) */}
      <View style={s.ctaWrap}>
        <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.goBack()}>
          <LinearGradient
            colors={['#818cf8', '#6366f1']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.cta}
          >
            <Text style={s.ctaTxt}>Done</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Modals */}
      <PersonModal
        visible={addPersonVisible}
        onClose={() => {
          setAddPersonVisible(false);
          setNewPersonData({ name: '', relationship: '', imageUri: null });
        }}
        onSave={handleAddPerson}
        title="Add New Person"
      />
      <PersonModal
        visible={editPersonVisible}
        onClose={() => {
          setEditPersonVisible(false);
          setSelectedFace(null);
          setNewPersonData({ name: '', relationship: '', imageUri: null });
        }}
        onSave={handleEditPerson}
        title="Edit Person"
      />
    </SafeAreaView>
  );
}

/* —————————— Styles to MATCH mock —————————— */
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG_FROM,
  },

  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  title: {
    marginLeft: 22,
    fontSize: 22,
    color: '#0f172a',
    fontFamily: 'Poppins_700Bold',
  },

  addCard: {
    marginTop: 18,
    marginHorizontal: 24,
    borderRadius: 22,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#c7d2fe',
    paddingVertical: 26,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  addInner: { alignItems: 'center' },
  addIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTitle: {
    marginTop: 10,
    fontSize: 18,
    color: '#4f46e5',
    fontFamily: 'Poppins_600SemiBold',
  },
  addSub: {
    marginTop: 4,
    fontSize: 14,
    color: '#64748b',
    fontFamily: 'Poppins_400Regular',
  },

  section: {
    fontSize: 22,
    color: '#334155',
    fontFamily: 'Poppins_700Bold',
    marginBottom: 12,
  },

  faceCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  faceImg: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
  },
  faceName: {
    marginTop: 4,
    fontSize: 16,
    color: '#0f172a',
    fontFamily: 'Poppins_700Bold',
  },
  faceRel: {
    marginTop: -4,
    fontSize: 13,
    color: '#64748b',
    fontFamily: 'Poppins_500Medium',
  },
  actions: { flexDirection: 'row', gap: 10 },
  iconBtnSoft: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  ctaWrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: Platform.OS === 'ios' ? 26 : 20,
  },
  cta: {
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#818cf8',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
    marginBottom: 16,
  },
  ctaTxt: { color: '#fff', fontSize: 16, fontFamily: 'Poppins_700Bold' },

  /* — Modals — */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 18,
    color: '#111827',
    fontFamily: 'Poppins_600SemiBold',
  },
  photoTap: { alignItems: 'center', paddingVertical: 18 },
  photo: { width: 120, height: 120, borderRadius: 16 },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#c7d2fe',
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoText: {
    marginTop: 8,
    fontSize: 12,
    color: INDIGO,
    fontFamily: 'Poppins_500Medium',
  },
  field: { marginBottom: 18 },
  label: { fontSize: 14, color: '#374151', fontFamily: 'Poppins_600SemiBold' },
  input: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#111827',
    fontFamily: 'Poppins_500Medium',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f3f4f6',
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: INDIGO,
    borderColor: INDIGO,
  },
  chipText: {
    fontSize: 14,
    color: '#6b7280',
    fontFamily: 'Poppins_500Medium',
  },
  chipTextActive: {
    color: '#fff',
  },
  modalActions: {
    padding: 16,
    flexDirection: 'row',
    gap: 12,
  },
  cancel: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  cancelTxt: { color: '#374151', fontSize: 16, fontFamily: 'Poppins_600SemiBold' },
  save: {
    flex: 1,
    backgroundColor: INDIGO,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  saveTxt: { color: '#fff', fontSize: 14, fontFamily: 'Poppins_700Bold' },
});
