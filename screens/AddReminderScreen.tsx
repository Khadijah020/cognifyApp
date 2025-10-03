// AddReminderScreen.tsx
import React, { useRef, useState } from 'react';
import {
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
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import ReminderService from '../services/ReminderService';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../app/App';

// ⬇️ NEW: load Poppins safely without early-returning before other hooks
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';

/* ─────────────────────────────  EXACT DESIGN TOKENS ───────────────────────────── */
const INDIGO = '#6366f1';
const INDIGO_DARK = '#4f46e5';
const SLATE_800 = '#1e293b';
const SLATE_700 = '#334155';
const SLATE_600 = '#475569';
const SLATE_500 = '#64748b';
const SLATE_400 = '#94a3b8';
const SLATE_200 = '#e5e7eb';
const BG_CARD = '#ffffff';
const BG_INPUT = '#f8fafc';
const GRAD_TO = '#f0f4ff';

/* ─────────────────────────────  WHEEL CONSTANTS (NEW) ───────────────────────────── */
const ITEM_HEIGHT = 50;
const WHEEL_HEIGHT = 200;
const WHEEL_PADDING = (WHEEL_HEIGHT - ITEM_HEIGHT) / 2; // 75

/* ─────────────────────────────  DEV NOISE SILENCER ───────────────────────────── */
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

/* ─────────────────────────────  Notification handler ───────────────────────────── */
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

const AddReminderScreen = ({ navigation }: Props) => {
  // ⬇️ load fonts FIRST, but do not early-return later
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  /* ---------- INITIAL STATE ---------- */
  const [reminderTitle, setReminderTitle] = useState('Take medication');
  const [selectedTime, setSelectedTime] = useState('05:12 PM');
  const [selectedDate, setSelectedDate] = useState(new Date(2023, 9, 13)); // Oct 13, 2023
  const [currentMonth, setCurrentMonth] = useState(9);
  const [currentYear, setCurrentYear] = useState(2023);

  /* Time picker */
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedHour, setSelectedHour] = useState(5);
  const [selectedMinute, setSelectedMinute] = useState(12);
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>('PM');
  const [sliderHour, setSliderHour] = useState(5);
  const [sliderMinute, setSliderMinute] = useState(10);
  const hourScrollRef = useRef<ScrollView>(null);
  const minuteScrollRef = useRef<ScrollView>(null);

  const months = [
    'January','February','March','April','May','June','July','August','September','October','November','December',
  ];
  const daysOfWeek = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  /* ---------- Calendar helpers ---------- */
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
      days.push({ day: d, isCurrentMonth: true, date: new Date(currentYear, currentMonth, d) });
    }
    const totalCells = 42;
    const remaining = totalCells - days.length;
    const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    for (let d = 1; d <= remaining; d++) {
      days.push({ day: d, isCurrentMonth: false, date: new Date(nextYear, nextMonth, d) });
    }
    return days;
  };
  const isDateSelected = (date: Date) =>
    date.getDate() === selectedDate.getDate() &&
    date.getMonth() === selectedDate.getMonth() &&
    date.getFullYear() === selectedDate.getFullYear();

  /* ---------- Month navigation ---------- */
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

  /* ---------- Time helpers (UPDATED) ---------- */
  const generateHours = () => Array.from({ length: 12 }, (_, i) => i + 1);
  const generateMinutes = () => Array.from({ length: 12 }, (_, i) => i * 5);

  // Simple lists (no fake padding items)
  const hourData = generateHours();
  const minuteData = generateMinutes();

  const formatTime = (h: number, m: number, p: 'AM' | 'PM') =>
    `${h}:${m.toString().padStart(2, '0')} ${p}`;

  const openTimePicker = () => {
    setSliderHour(selectedHour);
    setSliderMinute(selectedMinute);
    setShowTimePicker(true);
    setTimeout(() => {
      const hIdx = hourData.findIndex((h) => h === selectedHour);
      const mIdx = minuteData.findIndex((m) => m === selectedMinute);
      if (hourScrollRef.current && hIdx >= 0) {
        hourScrollRef.current.scrollTo({ y: hIdx * ITEM_HEIGHT, animated: false });
      }
      if (minuteScrollRef.current && mIdx >= 0) {
        minuteScrollRef.current.scrollTo({ y: mIdx * ITEM_HEIGHT, animated: false });
      }
    }, 180);
  };

  const handleWheelScroll = (e: any, type: 'hour' | 'minute') => {
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.round(y / ITEM_HEIGHT); // snap to nearest
    if (type === 'hour') {
      if (idx >= 0 && idx < hourData.length) setSliderHour(hourData[idx]);
    } else {
      if (idx >= 0 && idx < minuteData.length) setSliderMinute(minuteData[idx]);
    }
  };

  const handleSliderTimeChange = () => {
    const t = formatTime(sliderHour, sliderMinute, selectedPeriod);
    setSelectedTime(t);
    setSelectedHour(sliderHour);
    setSelectedMinute(sliderMinute);
    setShowTimePicker(false);
  };

  /* ---------- Save reminder ---------- */
  const handleSetReminder = async () => {
    if (!reminderTitle.trim()) {
      Alert.alert('Error', 'Please enter a reminder title');
      return;
    }
    try {
      const reminder = {
        id: Date.now().toString(),
        title: reminderTitle.trim(),
        date: selectedDate.toISOString(),
        time: selectedTime,
        createdAt: new Date().toISOString(),
        status: 'pending' as const,
      };
      const notificationId = await ReminderService.scheduleNotification(reminder);
      if (notificationId) (reminder as any).notificationId = notificationId;

      const ok = await ReminderService.saveReminder(reminder);
      if (ok) {
        Alert.alert(
          'Reminder Set',
          `Reminder "${reminderTitle}" has been set for ${selectedDate.toDateString()} at ${selectedTime}`,
          [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
      } else {
        Alert.alert('Error', 'Failed to save reminder. Please try again.');
      }
    } catch (err) {
      console.error('Error saving reminder:', err);
      Alert.alert('Error', 'Failed to save reminder. Please try again.');
    }
  };

  const s = styles;

  // ⬇️ IMPORTANT: do NOT early-return.
  // Always call hooks. Switch what we render instead.
  return (
    <View style={s.root}>
      {!fontsLoaded ? (
        <View style={{ flex: 1, backgroundColor: GRAD_TO }} />
      ) : (
        <>
          {/* Header */}
          <View style={s.headerRow}>
            <TouchableOpacity style={s.backWrap} onPress={() => navigation.goBack()}>
              <MaterialIcons name="arrow-back-ios-new" size={18} color={SLATE_600} />
              <Text style={[s.backText, { fontFamily: 'Poppins_500Medium' }]}>Back</Text>
            </TouchableOpacity>
          </View>

          <View style={s.headerRow2}>
            <Text style={[s.headerTitle]}>Add Reminder</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
            {/* Card: Title & Time */}
            <View style={s.sectionPad}>
              <View style={s.card}>
                <Text style={[s.label, { fontFamily: 'Poppins_500Medium' }]}>Reminder Title</Text>
                <View style={s.inputWrap2}>
                  <MaterialIcons name="edit-note" size={22} color={SLATE_400} style={s.inputIcon} />
                  <TextInput
                    style={[s.input, { fontFamily: 'Poppins_600SemiBold' }]}
                    value={reminderTitle}
                    onChangeText={setReminderTitle}
                    placeholder="e.g., Doctor's appointment"
                    placeholderTextColor={SLATE_400}
                  />
                </View>

                <Text style={[s.label, { marginTop: 16, fontFamily: 'Poppins_500Medium' }]}>Time</Text>
                <TouchableOpacity style={s.inputWrap} onPress={openTimePicker} activeOpacity={0.8}>
                  <MaterialIcons name="schedule" size={22} color={SLATE_400} style={s.inputIcon} />
                  <Text style={[s.inputText, { fontFamily: 'Poppins_600SemiBold' }]}>{selectedTime}</Text>
                  <MaterialIcons
                    name="keyboard-arrow-down"
                    size={22}
                    color={SLATE_400}
                    style={s.inputRightIcon}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Set Date section title */}
            <Text style={[s.sectionTitle, { fontFamily: 'Poppins_600SemiBold' }]}>Set Date</Text>

            {/* Calendar card */}
            <View style={s.sectionPad}>
              <View style={s.card}>
                <View style={s.calendarHeader}>
                  <TouchableOpacity onPress={handlePrevMonth} style={s.chevBtn}>
                    <Ionicons name="chevron-back" size={22} color={SLATE_500} />
                  </TouchableOpacity>
                  <Text style={[s.monthYear, { fontFamily: 'Poppins_600SemiBold' }]}>
                    {months[currentMonth]} {currentYear}
                  </Text>
                  <TouchableOpacity onPress={handleNextMonth} style={s.chevBtn}>
                    <Ionicons name="chevron-forward" size={22} color={SLATE_500} />
                  </TouchableOpacity>
                </View>

                <View style={s.dowRow}>
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                    <Text key={d} style={[s.dowText, { fontFamily: 'Poppins_500Medium' }]}>
                      {d}
                    </Text>
                  ))}
                </View>

                <View style={s.grid}>
                  {generateCalendarDays().map((info, idx) => {
                    const selected = isDateSelected(info.date);
                    return (
                      <TouchableOpacity
                        key={`${info.date.toISOString()}-${idx}`}
                        style={s.cell}
                        onPress={() => handleDateSelect(info.date)}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            s.bubble,
                            selected && s.bubbleSelected,
                            !info.isCurrentMonth && s.dimCell,
                          ]}
                        >
                          <Text
                            style={[
                              s.dayText,
                              { fontFamily: selected ? 'Poppins_700Bold' : 'Poppins_500Medium' },
                              selected && s.dayTextSelected,
                              !info.isCurrentMonth && s.outMonthText,
                            ]}
                          >
                            {info.day}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* CTA */}
            <View style={s.ctaPad}>
              <TouchableOpacity style={s.cta} activeOpacity={0.9} onPress={handleSetReminder}>
                <MaterialIcons name="add-task" size={24} color="#fff" />
                <Text style={[s.ctaText, { fontFamily: 'Poppins_700Bold' }]}>Set Reminder</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Time Picker Modal */}
          <Modal
            visible={showTimePicker}
            transparent
            animationType="slide"
            onRequestClose={() => setShowTimePicker(false)}
          >
            <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowTimePicker(false)}>
              <TouchableOpacity style={s.timeCard} activeOpacity={1} onPress={() => {}}>
                <View style={s.timeHeader}>
                  <Text style={[s.timeHeaderTitle, { fontFamily: 'Poppins_600SemiBold' }]}>Select Time</Text>
                  <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                    <MaterialIcons name="close" size={22} color={SLATE_400} />
                  </TouchableOpacity>
                </View>

                <View style={s.timeBody}>
                  <View style={s.wheelsRow}>
                    {/* Hour */}
                    <View style={s.wheelCol}>
                      <Text style={[s.wheelLabel, { fontFamily: 'Poppins_600SemiBold' }]}>Hour</Text>
                      <Text style={[s.currentValue, { fontFamily: 'Poppins_700Bold' }]}>{sliderHour}</Text>
                      <View style={s.wheelWrap}>
                        <View style={s.selectionOverlay} />
                        <ScrollView
                          ref={hourScrollRef}
                          style={s.wheelScroll}
                          contentContainerStyle={{ paddingVertical: WHEEL_PADDING }}
                          showsVerticalScrollIndicator={false}
                          snapToInterval={ITEM_HEIGHT}
                          decelerationRate="fast"
                          onScroll={(e) => handleWheelScroll(e, 'hour')}
                          onMomentumScrollEnd={(e) => handleWheelScroll(e, 'hour')}
                          onScrollEndDrag={(e) => handleWheelScroll(e, 'hour')}
                          scrollEventThrottle={16}
                        >
                          {hourData.map((h, i) => (
                            <TouchableOpacity
                              key={`h-${h}`}
                              style={s.wheelItem}
                              onPress={() => {
                                setSliderHour(h);
                                hourScrollRef.current?.scrollTo({ y: i * ITEM_HEIGHT, animated: true });
                              }}
                            >
                              <Text
                                style={[
                                  s.wheelText,
                                  h === sliderHour && s.wheelTextSel,
                                  { fontFamily: h === sliderHour ? 'Poppins_700Bold' : 'Poppins_400Regular' },
                                ]}
                              >
                                {h}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    </View>

                    {/* Minute */}
                    <View style={s.wheelCol}>
                      <Text style={[s.wheelLabel, { fontFamily: 'Poppins_600SemiBold' }]}>Minute</Text>
                      <Text style={[s.currentValue, { fontFamily: 'Poppins_700Bold' }]}>
                        {sliderMinute.toString().padStart(2, '0')}
                      </Text>
                      <View style={s.wheelWrap}>
                        <View style={s.selectionOverlay} />
                        <ScrollView
                          ref={minuteScrollRef}
                          style={s.wheelScroll}
                          contentContainerStyle={{ paddingVertical: WHEEL_PADDING }}
                          showsVerticalScrollIndicator={false}
                          snapToInterval={ITEM_HEIGHT}
                          decelerationRate="fast"
                          onScroll={(e) => handleWheelScroll(e, 'minute')}
                          onMomentumScrollEnd={(e) => handleWheelScroll(e, 'minute')}
                          onScrollEndDrag={(e) => handleWheelScroll(e, 'minute')}
                          scrollEventThrottle={16}
                        >
                          {minuteData.map((m, i) => (
                            <TouchableOpacity
                              key={`m-${m}`}
                              style={s.wheelItem}
                              onPress={() => {
                                setSliderMinute(m);
                                minuteScrollRef.current?.scrollTo({ y: i * ITEM_HEIGHT, animated: true });
                              }}
                            >
                              <Text
                                style={[
                                  s.wheelText,
                                  m === sliderMinute && s.wheelTextSel,
                                  { fontFamily: m === sliderMinute ? 'Poppins_700Bold' : 'Poppins_400Regular' },
                                ]}
                              >
                                {m.toString().padStart(2, '0')}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    </View>

                    {/* Period */}
                    <View style={s.wheelCol}>
                      <Text style={[s.wheelLabel, { fontFamily: 'Poppins_600SemiBold' }]}>Period</Text>
                      <View style={s.periodCol}>
                        {(['AM', 'PM'] as const).map((p) => (
                          <TouchableOpacity
                            key={p}
                            onPress={() => setSelectedPeriod(p)}
                            style={[s.periodBtn, selectedPeriod === p && s.periodBtnActive]}
                          >
                            <Text
                              style={[
                                s.periodText,
                                selectedPeriod === p && s.periodTextActive,
                                { fontFamily: selectedPeriod === p ? 'Poppins_700Bold' : 'Poppins_600SemiBold' },
                              ]}
                            >
                              {p}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>

                  <View style={s.previewCard}>
                    <Text style={[s.previewLabel, { fontFamily: 'Poppins_600SemiBold' }]}>Selected Time</Text>
                    <Text style={[s.previewValue, { fontFamily: 'Poppins_800ExtraBold' as any }]}>
                      {formatTime(sliderHour, sliderMinute, selectedPeriod)}
                    </Text>
                  </View>
                </View>

                <View style={s.actionsRow}>
                  <TouchableOpacity style={s.cancelBtn} onPress={() => setShowTimePicker(false)}>
                    <Text style={[s.cancelText, { fontFamily: 'Poppins_600SemiBold' }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.confirmBtn} onPress={handleSliderTimeChange}>
                    <Text style={[s.confirmText, { fontFamily: 'Poppins_700Bold' }]}>Confirm</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        </>
      )}
    </View>
  );
};

/* ─────────────────────────────  STYLES ───────────────────────────── */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: GRAD_TO },

  headerRow: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 48 : 32,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerRow2: {
    paddingHorizontal: 24,
    paddingTop: -3,
    paddingBottom: -10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: 70,
  },
  backWrap: { flexDirection: 'row', alignItems: 'center' },
  backText: { marginLeft: 6, color: SLATE_600, fontSize: 16, fontWeight: '500' },
  headerTitle: { fontSize: 22, color: SLATE_800, fontFamily: 'Poppins_700Bold',  marginLeft: 6 },

  sectionPad: { paddingHorizontal: 24, marginTop: 12 },
  card: {
    backgroundColor: BG_CARD,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },

  label: { fontSize: 14, fontWeight: '500', color: SLATE_500 },
  inputWrap: {
    marginTop: 8,
    position: 'relative',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SLATE_200,
    backgroundColor: BG_INPUT,
    paddingVertical: 12,
    paddingLeft: 44,
    paddingRight: 40,
  },
  inputWrap2: {
    marginTop: 8,
    position: 'relative',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SLATE_200,
    backgroundColor: BG_INPUT,
    paddingVertical: 1,
    paddingLeft: 44,
    paddingRight: 40,
  },
  inputIcon: { position: 'absolute', left: 12, top: 12 },
  inputRightIcon: { position: 'absolute', right: 8, top: 12 },
  input: { fontSize: 16, fontWeight: '600', color: SLATE_800 },
  inputText: { fontSize: 16, fontWeight: '600', color: SLATE_800 },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: SLATE_700,
    marginTop: 22,
    marginBottom: 12,
    marginLeft: 28,
  },

  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  chevBtn: { padding: 8, borderRadius: 20 },
  monthYear: { fontSize: 18, fontWeight: '600', color: SLATE_700 },

  dowRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 6 },
  dowText: { width: 40, textAlign: 'center', fontSize: 14, color: SLATE_400, fontWeight: '500' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 2 },
  cell: { width: '14.28%', alignItems: 'center', marginVertical: 2 },
  bubble: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  bubbleSelected: { backgroundColor: INDIGO },
  dimCell: { opacity: 0.5 },
  dayText: { fontSize: 16, color: SLATE_800, fontWeight: '500' },
  dayTextSelected: { color: '#fff', fontWeight: '700' },
  outMonthText: { color: SLATE_400 },

  ctaPad: { paddingHorizontal: 24, paddingVertical: 24 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: INDIGO,
    shadowColor: INDIGO_DARK,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700', marginLeft: 8 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  timeCard: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', minHeight: 420 },
  timeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: SLATE_200 },
  timeHeaderTitle: { fontSize: 16, fontWeight: '600', color: SLATE_700 },
  timeBody: { paddingHorizontal: 20, paddingVertical: 20 },
  wheelsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  wheelCol: { flex: 1, alignItems: 'center', paddingHorizontal: 6 },
  wheelLabel: { fontSize: 14, fontWeight: '600', color: SLATE_700, marginBottom: 6 },
  currentValue: { fontSize: 18, fontWeight: '700', color: INDIGO, marginBottom: 8 },

  /* ⬇️ UPDATED WHEEL STYLES */
  wheelWrap: { position: 'relative', height: WHEEL_HEIGHT, width: '100%', justifyContent: 'center' },
  selectionOverlay: {
    position: 'absolute',
    top: WHEEL_PADDING,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    backgroundColor: '#c7d2fe',
    borderRadius: 8,
    opacity: 0.35,
    zIndex: 1,
  },
  wheelScroll: { height: WHEEL_HEIGHT, width: '100%' },
  wheelItem: { height: ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center' },
  wheelText: { fontSize: 20, color: SLATE_400, fontWeight: '400', textAlign: 'center' },
  wheelTextSel: { fontSize: 26, color: INDIGO, fontWeight: '700' },

  periodCol: { flexDirection: 'column', gap: 12, marginTop: 16 },
  periodBtn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 18, backgroundColor: BG_INPUT, borderWidth: 2, borderColor: SLATE_200, minWidth: 64, alignItems: 'center' },
  periodBtnActive: { backgroundColor: INDIGO, borderColor: INDIGO },
  periodText: { fontSize: 16, fontWeight: '600', color: SLATE_700 },
  periodTextActive: { color: '#fff' },

  previewCard: { marginTop: 8, padding: 18, backgroundColor: '#eef2ff', borderRadius: 16, alignItems: 'center' },
  previewLabel: { fontSize: 13, color: INDIGO, fontWeight: '600', marginBottom: 6 },
  previewValue: { fontSize: 30, fontWeight: '800', color: INDIGO },

  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, gap: 12, paddingBottom: Platform.OS === 'ios' ? 24 : 16 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: BG_INPUT, alignItems: 'center', borderWidth: 1, borderColor: SLATE_200 },
  cancelText: { fontSize: 16, fontWeight: '600', color: SLATE_500 },
  confirmBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: INDIGO, alignItems: 'center' },
  confirmText: { fontSize: 16, color: '#fff' },
});

export default AddReminderScreen;
