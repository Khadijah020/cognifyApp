// AddReminderScreen.tsx
import {
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    useFonts,
} from '@expo-google-fonts/poppins';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { RootStackParamList } from '../app/App';
import { useTheme } from '../contexts/ThemeContext';
import ReminderService from '../services/ReminderService';

const INDIGO = '#6366f1';
const SLATE_800 = '#1e293b';
const SLATE_700 = '#334155';
const SLATE_600 = '#475569';
const SLATE_500 = '#64748b';
const SLATE_400 = '#94a3b8';
const SLATE_300 = '#cbd5e1';
const SLATE_200 = '#e5e7eb';
const BG_CARD = '#ffffff';
const BG_INPUT = '#f8fafc';
const ITEM_HEIGHT = 50;
const WHEEL_HEIGHT = 200;
const WHEEL_PADDING = (WHEEL_HEIGHT - ITEM_HEIGHT) / 2;

const originalWarn = console.warn;
const originalError = console.error;

console.warn = (...args) => {
  const m = args[0]?.toString?.() || '';
  if (
    m.includes('expo-notifications') ||
    m.includes('Android Push notifications') ||
    m.includes('remote notifications') ||
    m.includes('development build')
  )
    return;
  originalWarn(...args);
};

console.error = (...args) => {
  const m = args[0]?.toString?.() || '';
  if (m.includes('expo-notifications') || m.includes('Android Push notifications')) return;
  originalError(...args);
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type Props = NativeStackScreenProps<RootStackParamList, 'AddReminder'>;

const AddReminderScreen = ({ navigation, route }: Props) => {
  const { colors, isDark } = useTheme();
  const prefill = route.params?.prefill;
  const isEditing = !!prefill?.id; // Check if we're editing an existing reminder
  const reminderId = prefill?.id;
  
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const [reminderTitle, setReminderTitle] = useState('');
  const [selectedTime, setSelectedTime] = useState('09:00 AM');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);

  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedHour, setSelectedHour] = useState(9);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>('AM');
  const [sliderHour, setSliderHour] = useState(9);
  const [sliderMinute, setSliderMinute] = useState(0);

  const hourScrollRef = useRef<ScrollView>(null);
  const minuteScrollRef = useRef<ScrollView>(null);

  const [reminderType, setReminderType] = useState('');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [medication, setMedication] = useState('');
  const [instructions, setInstructions] = useState('');
  const [caregiverNote, setCaregiverNote] = useState('');
  
  const reminderTypes = ['Medication', "Doctor's Appointment", 'Meal', 'Event'];

  // Parse time string like "09:00 AM" or "21:00:00" into hour, minute, period
  const parseTimeString = (timeStr: string) => {
    const upperTime = timeStr.toUpperCase().trim();
    let hour = 9;
    let minute = 0;
    let period: 'AM' | 'PM' = 'AM';

    if (upperTime.includes('AM') || upperTime.includes('PM')) {
      // Format: "9:00 AM" or "09:00 PM"
      const [timePart, periodPart] = upperTime.split(/\s+/);
      const [h, m] = timePart.split(':');
      hour = parseInt(h, 10);
      minute = parseInt(m || '0', 10);
      period = periodPart as 'AM' | 'PM';
    } else {
      // 24-hour format: "21:00" or "21:00:00"
      const [h, m] = timeStr.split(':');
      hour = parseInt(h, 10);
      minute = parseInt(m || '0', 10);
      
      if (hour >= 12) {
        period = 'PM';
        if (hour > 12) hour -= 12;
      } else {
        period = 'AM';
        if (hour === 0) hour = 12;
      }
    }

    return { hour, minute, period };
  };

  // Prefill form when editing an existing reminder
  useEffect(() => {
    if (prefill) {
      console.log('📝 Prefilling reminder form:', prefill);
      
      if (prefill.title) {
        setReminderTitle(prefill.title);
      }
      
      if (prefill.type) {
        setReminderType(prefill.type);
      }
      
      if (prefill.medication) {
        setMedication(prefill.medication);
      }
      
      if (prefill.instructions) {
        setInstructions(prefill.instructions);
      }
      
      if (prefill.caregiver_note) {
        setCaregiverNote(prefill.caregiver_note);
      }
      
      if (prefill.date) {
        const date = new Date(prefill.date);
        setSelectedDate(date);
        setCurrentMonth(date.getMonth());
        setCurrentYear(date.getFullYear());
      }
      
      if (prefill.timeText) {
        const { hour, minute, period } = parseTimeString(prefill.timeText);
        setSelectedHour(hour);
        setSelectedMinute(minute);
        setSelectedPeriod(period);
        setSliderHour(hour);
        setSliderMinute(minute);
        setSelectedTime(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} ${period}`);
      }
    }
  }, [prefill]);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const getDaysInMonth = (m: number, y: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (m: number, y: number) => new Date(y, m, 1).getDay();

  const generateCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentMonth, currentYear);
    const firstDay = getFirstDayOfMonth(currentMonth, currentYear);
    const days: { day: number; isCurrentMonth: boolean; date: Date }[] = [];

    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const daysInPrev = getDaysInMonth(prevMonth, prevYear);

    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({
        day: daysInPrev - i,
        isCurrentMonth: false,
        date: new Date(prevYear, prevMonth, daysInPrev - i),
      });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      days.push({
        day: d,
        isCurrentMonth: true,
        date: new Date(currentYear, currentMonth, d),
      });
    }

    const totalCells = 42;
    const remaining = totalCells - days.length;
    const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;

    for (let d = 1; d <= remaining; d++) {
      days.push({
        day: d,
        isCurrentMonth: false,
        date: new Date(nextYear, nextMonth, d),
      });
    }

    return days;
  };

  const isDateSelected = (date: Date) =>
    date.getDate() === selectedDate.getDate() &&
    date.getMonth() === selectedDate.getMonth() &&
    date.getFullYear() === selectedDate.getFullYear();

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else setCurrentMonth((m) => m - 1);
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else setCurrentMonth((m) => m + 1);
  };

  const handleDateSelect = (d: Date) => setSelectedDate(d);
  const generateHours = () => Array.from({ length: 12 }, (_, i) => i + 1);
  const generateMinutes = () => Array.from({ length: 12 }, (_, i) => i * 5);

  const hourData = generateHours();
  const minuteData = generateMinutes();

  const formatTime = (h: number, m: number, p: 'AM' | 'PM') => 
    `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${p}`;

  const openTimePicker = () => {
    setSliderHour(selectedHour);
    setSliderMinute(selectedMinute);
    setShowTimePicker(true);
    setTimeout(() => {
      const hIdx = hourData.findIndex((h) => h === selectedHour);
      const mIdx = minuteData.findIndex((m) => m === selectedMinute);
      if (hourScrollRef.current && hIdx >= 0)
        hourScrollRef.current.scrollTo({ y: hIdx * ITEM_HEIGHT, animated: false });
      if (minuteScrollRef.current && mIdx >= 0)
        minuteScrollRef.current.scrollTo({ y: mIdx * ITEM_HEIGHT, animated: false });
    }, 180);
  };

  const handleScrollEnd = (event: any, type: 'hour' | 'minute') => {
    const yOffset = event.nativeEvent.contentOffset.y;
    const index = Math.round(yOffset / ITEM_HEIGHT);
    if (type === 'hour') {
      const newHour = hourData[Math.min(index, hourData.length - 1)];
      setSliderHour(newHour);
      setSelectedHour(newHour);
    } else {
      const newMinute = minuteData[Math.min(index, minuteData.length - 1)];
      setSliderMinute(newMinute);
      setSelectedMinute(newMinute);
    }
  };

  const handleSaveTime = () => {
    const t = formatTime(sliderHour, sliderMinute, selectedPeriod);
    setSelectedTime(t);
    setShowTimePicker(false);
  };

  const handleAddReminder = async () => {
    if (!reminderTitle.trim()) {
      Alert.alert('Missing Title', 'Please enter a reminder title.');
      return;
    }

    setLoading(true);

    try {
      // ✅ Format date as YYYY-MM-DD in local timezone (not UTC)
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}`;

      const reminderData = {
        title: reminderTitle,
        time: selectedTime,
        date: formattedDate, // Use local date, not ISO string
        type: reminderType || 'General',
        medication: medication || undefined,
        instructions: instructions || undefined,
        caregiver_note: caregiverNote || undefined,
        status: 'pending' as const,
      };

      if (isEditing && reminderId) {
        // Update existing reminder
        await ReminderService.updateReminder(reminderId, reminderData);
        Alert.alert('Success', 'Reminder updated successfully!', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
      } else {
        // Create new reminder
        await ReminderService.saveReminder(reminderData);
        Alert.alert('Success', 'Reminder added successfully!', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
      }
    } catch (error: any) {
      console.error('Failed to save reminder:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to save reminder. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (!fontsLoaded) return null;

  const days = generateCalendarDays();

  const dynamicStyles = {
    container: { ...styles.container, backgroundColor: isDark ? '#0f0f23' : '#e8e9f3' },
    header: { ...styles.header, backgroundColor: isDark ? '#0f0f23' : '#e8e9f3' },
    card: { ...styles.card, backgroundColor: isDark ? '#1a1a2e' : BG_CARD },
    text: { color: isDark ? '#e5e7eb' : SLATE_800 },
    textSecondary: { color: isDark ? '#9ca3af' : SLATE_600 },
    input: { ...styles.input, color: isDark ? '#e5e7eb' : SLATE_800 },
    inputContainer: {
      ...styles.inputContainer,
      backgroundColor: isDark ? '#2d2d44' : BG_INPUT,
      borderColor: isDark ? '#374151' : SLATE_200,
    },
  };

  return (
    <View style={dynamicStyles.container}>
      {/* HEADER */}
      <View style={dynamicStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={isDark ? '#9ca3af' : SLATE_800} />
          <Text style={[styles.backText, dynamicStyles.text]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, dynamicStyles.text]}>{isEditing ? 'Edit Reminder' : 'Add Reminder'}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* MAIN CARD */}
        <View style={dynamicStyles.card}>
          {/* TITLE */}
          <Text style={[styles.label, dynamicStyles.textSecondary]}>Reminder Title</Text>
          <View style={dynamicStyles.inputContainer}>
            <MaterialCommunityIcons name="text" size={20} color={isDark ? '#9ca3af' : SLATE_500} style={styles.inputIcon} />
            <TextInput
              style={dynamicStyles.input}
              placeholder="Take medication"
              placeholderTextColor={isDark ? '#6b7280' : SLATE_400}
              value={reminderTitle}
              onChangeText={setReminderTitle}
            />
          </View>

          {/* TYPE */}
          <Text style={[styles.label, dynamicStyles.textSecondary]}>Type</Text>
          <TouchableOpacity style={dynamicStyles.inputContainer} onPress={() => setShowTypeDropdown(!showTypeDropdown)}>
            <MaterialCommunityIcons name="bottle-tonic-plus" size={20} color={isDark ? '#9ca3af' : SLATE_500} style={styles.inputIcon} />
            <Text style={[styles.inputText, dynamicStyles.text, !reminderType && { color: isDark ? '#6b7280' : SLATE_400 }]}>
              {reminderType || 'Select type'}
            </Text>
            <Ionicons name={showTypeDropdown ? "chevron-up" : "chevron-down"} size={20} color={isDark ? '#9ca3af' : SLATE_500} />
          </TouchableOpacity>
          {showTypeDropdown && (
            <View style={[dynamicStyles.card, { marginTop: 8, padding: 0, overflow: 'hidden' }]}>
              {reminderTypes.map((type, index) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.dropdownItem,
                    { borderTopWidth: index > 0 ? 1 : 0, borderTopColor: isDark ? '#374151' : '#e5e7eb' }
                  ]}
                  onPress={() => {
                    setReminderType(type);
                    setShowTypeDropdown(false);
                  }}
                >
                  <Text style={[styles.dropdownItemText, dynamicStyles.text]}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* MEDICATION */}
          <Text style={[styles.label, dynamicStyles.textSecondary]}>Medication</Text>
          <View style={dynamicStyles.inputContainer}>
            <MaterialCommunityIcons name="pill" size={20} color={isDark ? '#9ca3af' : SLATE_500} style={styles.inputIcon} />
            <TextInput
              style={dynamicStyles.input}
              placeholder="Donepezil"
              placeholderTextColor={isDark ? '#6b7280' : SLATE_400}
              value={medication}
              onChangeText={setMedication}
            />
          </View>

          {/* INSTRUCTIONS */}
          <Text style={[styles.label, dynamicStyles.textSecondary]}>Instructions</Text>
          <View style={dynamicStyles.inputContainer}>
            <MaterialCommunityIcons name="text-box-outline" size={20} color={isDark ? '#9ca3af' : SLATE_500} style={styles.inputIconTop} />
            <TextInput
              style={[dynamicStyles.input, styles.textArea]}
              multiline
              placeholder="Take one tablet with a glass of water after breakfast."
              placeholderTextColor={isDark ? '#6b7280' : SLATE_400}
              value={instructions}
              onChangeText={setInstructions}
            />
          </View>

          {/* CAREGIVER NOTE */}
          <Text style={[styles.label, dynamicStyles.textSecondary]}>Caregiver Note (optional)</Text>
          <View style={dynamicStyles.inputContainer}>
            <MaterialCommunityIcons name="account-edit" size={20} color={isDark ? '#9ca3af' : SLATE_500} style={styles.inputIconTop} />
            <TextInput
              style={[dynamicStyles.input, styles.textArea]}
              multiline
              placeholder="Check if mom takes it. She sometimes forgets."
              placeholderTextColor={isDark ? '#6b7280' : SLATE_400}
              value={caregiverNote}
              onChangeText={setCaregiverNote}
            />
          </View>

          {/* TIME */}
          <Text style={[styles.label, dynamicStyles.textSecondary]}>Time</Text>
          <TouchableOpacity style={dynamicStyles.inputContainer} onPress={openTimePicker}>
            <Ionicons name="time-outline" size={20} color={isDark ? '#9ca3af' : SLATE_500} style={styles.inputIcon} />
            <Text style={[styles.inputText, dynamicStyles.text]}>{selectedTime}</Text>
          </TouchableOpacity>
        </View>

        {/* DATE PICKER CARD */}
        <View style={[styles.dateCard, dynamicStyles.card]}>
          <Text style={[styles.dateTitle, dynamicStyles.text]}>Set Date</Text>
          
          <View style={styles.calendarHeader}>
            <TouchableOpacity onPress={handlePrevMonth}>
              <Ionicons name="chevron-back" size={24} color={isDark ? '#9ca3af' : SLATE_700} />
            </TouchableOpacity>
            <Text style={[styles.calendarHeaderText, dynamicStyles.text]}>
              {months[currentMonth]} {currentYear}
            </Text>
            <TouchableOpacity onPress={handleNextMonth}>
              <Ionicons name="chevron-forward" size={24} color={isDark ? '#9ca3af' : SLATE_700} />
            </TouchableOpacity>
          </View>

          <View style={styles.weekdays}>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <Text key={d} style={styles.weekdayText}>
                {d}
              </Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {days.map((d, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.dayCell,
                  isDateSelected(d.date) && styles.selectedDay,
                  !d.isCurrentMonth && styles.dimmedDay,
                ]}
                onPress={() => handleDateSelect(d.date)}
              >
                <Text
                  style={[
                    styles.dayText,
                    isDateSelected(d.date) && styles.selectedDayText,
                    !d.isCurrentMonth && styles.dimmedDayText,
                  ]}
                >
                  {d.day}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* SAVE BUTTON */}
        <TouchableOpacity 
          style={[styles.saveButton, loading && styles.saveButtonDisabled]} 
          onPress={handleAddReminder}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialIcons name={isEditing ? "edit" : "alarm-add"} size={20} color="#fff" />
              <Text style={styles.saveButtonText}>{isEditing ? 'Update Reminder' : 'Set Reminder'}</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* TIME PICKER MODAL */}
      <Modal
        visible={showTimePicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTimePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Time</Text>
            <View style={styles.timePickerContainer}>
              {/* HOURS */}
              <View style={styles.wheelContainer}>
                <ScrollView
                  ref={hourScrollRef}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={ITEM_HEIGHT}
                  decelerationRate="fast"
                  onMomentumScrollEnd={(e) => handleScrollEnd(e, 'hour')}
                  contentContainerStyle={{ paddingVertical: WHEEL_PADDING }}
                >
                  {hourData.map((h) => (
                    <View key={h} style={styles.wheelItem}>
                      <Text
                        style={[
                          styles.wheelText,
                          h === sliderHour && styles.wheelSelectedText,
                        ]}
                      >
                        {h.toString().padStart(2, '0')}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
                <View style={styles.selectionIndicator} />
              </View>

              <Text style={styles.timeSeparator}>:</Text>

              {/* MINUTES */}
              <View style={styles.wheelContainer}>
                <ScrollView
                  ref={minuteScrollRef}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={ITEM_HEIGHT}
                  decelerationRate="fast"
                  onMomentumScrollEnd={(e) => handleScrollEnd(e, 'minute')}
                  contentContainerStyle={{ paddingVertical: WHEEL_PADDING }}
                >
                  {minuteData.map((m) => (
                    <View key={m} style={styles.wheelItem}>
                      <Text
                        style={[
                          styles.wheelText,
                          m === sliderMinute && styles.wheelSelectedText,
                        ]}
                      >
                        {m.toString().padStart(2, '0')}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
                <View style={styles.selectionIndicator} />
              </View>

              {/* AM/PM */}
              <View style={styles.periodSelector}>
                {(['AM', 'PM'] as const).map((p) => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setSelectedPeriod(p)}
                    style={[
                      styles.periodButton,
                      selectedPeriod === p && styles.periodButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.periodButtonText,
                        selectedPeriod === p && styles.periodButtonTextActive,
                      ]}
                    >
                      {p}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowTimePicker(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmButton} onPress={handleSaveTime}>
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e8e9f3',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 16,
    backgroundColor: '#e8e9f3',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    color: SLATE_800,
    marginLeft: 4,
  },
  headerTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 20,
    color: SLATE_800,
    marginLeft: 16,
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: BG_CARD,
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  label: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: SLATE_600,
    marginBottom: 8,
    marginTop: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BG_INPUT,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SLATE_200,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  inputIcon: {
    marginRight: 10,
  },
  inputIconTop: {
    marginRight: 10,
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: SLATE_800,
    fontFamily: 'Poppins_500Medium',
  },
  inputText: {
    flex: 1,
    fontSize: 15,
    color: SLATE_800,
    fontFamily: 'Poppins_500Medium',
  },
  textArea: {
    height: 70,
    textAlignVertical: 'top',
  },
  dateCard: {
    backgroundColor: BG_CARD,
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  dateTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: SLATE_800,
    marginBottom: 16,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  calendarHeaderText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: SLATE_800,
  },
  weekdays: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  weekdayText: {
    width: 40,
    textAlign: 'center',
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: SLATE_500,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  dayCell: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
    borderRadius: 12,
  },
  dayText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 15,
    color: SLATE_700,
  },
  dimmedDay: {
    opacity: 0.3,
  },
  dimmedDayText: {
    color: SLATE_400,
  },
  selectedDay: {
    backgroundColor: INDIGO,
  },
  selectedDayText: {
    color: '#fff',
    fontFamily: 'Poppins_600SemiBold',
  },
  saveButton: {
    backgroundColor: INDIGO,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    shadowColor: INDIGO,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    color: '#fff',
    fontSize: 16,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    width: '85%',
    padding: 24,
  },
  modalTitle: {
    textAlign: 'center',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: SLATE_800,
    marginBottom: 20,
  },
  timePickerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: WHEEL_HEIGHT,
  },
  wheelContainer: {
    width: 70,
    height: WHEEL_HEIGHT,
    position: 'relative',
  },
  wheelItem: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 18,
    color: SLATE_400,
  },
  wheelSelectedText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 24,
    color: INDIGO,
  },
  selectionIndicator: {
    position: 'absolute',
    top: WHEEL_PADDING,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: SLATE_200,
    pointerEvents: 'none',
  },
  timeSeparator: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 28,
    color: INDIGO,
    marginHorizontal: 8,
  },
  periodSelector: {
    marginLeft: 16,
    justifyContent: 'center',
  },
  periodButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: SLATE_200,
    backgroundColor: BG_INPUT,
  },
  periodButtonActive: {
    backgroundColor: INDIGO,
    borderColor: INDIGO,
  },
  periodButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: SLATE_600,
  },
  periodButtonTextActive: {
    color: '#fff',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: SLATE_200,
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 14,
  },
  dropdownItem: {
    padding: 14,
    backgroundColor: 'transparent',
  },
  dropdownItemText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 15,
  },
  inputText: {
    flex: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: 15,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: INDIGO,
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 14,
  },
  cancelButtonText: {
    color: SLATE_700,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
  },
  confirmButtonText: {
    color: '#fff',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
  },
});

export default AddReminderScreen;