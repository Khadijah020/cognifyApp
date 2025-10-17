import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from "@expo-google-fonts/poppins";
import { Feather, MaterialIcons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import AppLoading from "expo-app-loading";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  Path,
  Rect,
  Stop,
  LinearGradient as SvgGradient,
  Line as SvgLine,
  Text as SvgText,
} from "react-native-svg";
import { RootStackParamList } from "../app/App";
import HealthDataService from "../services/HealthDataService";

type Props = NativeStackScreenProps<RootStackParamList, "CaregiverDashboard">;

const W = Dimensions.get("window").width;

/* ----------------------- Reminder Modal Types ----------------------- */
type ReminderData = {
  title: string;
  subtitle: string; // "Today, 9:00 AM"
  icon: "medication" | "event";
  chipColor: string;
  chipBg: string;
  details?: {
    medication?: string;
    instructions?: string;
    note?: string;
  };
  status?: {
    time?: string; // "Taken at 9:05 AM"
    label?: string; // "Confirmed" | "Scheduled"
  };
  // ➜ prefill for Edit Reminder
  prefill?: {
    title: string;
    date: Date;       // exact date/time
    timeText: string; // "09:00 AM"
  };
};

export default function CaregiverDashboardScreen({ navigation }: Props) {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  /* -------------------- Modal state -------------------- */
  const [showReminder, setShowReminder] = useState(false);
  const [activeReminder, setActiveReminder] = useState<ReminderData | null>(null);

  /* -------------------- Health data state -------------------- */
  const [steps, setSteps] = useState(4280);
  const [activeMinutes, setActiveMinutes] = useState(62);

  useEffect(() => {
    loadHealthData();
    // Refresh health data every 30 seconds
    const interval = setInterval(loadHealthData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadHealthData = async () => {
    try {
      const stepCount = await HealthDataService.getStepCount();
      const minutes = await HealthDataService.getActiveMinutes();
      setSteps(stepCount);
      setActiveMinutes(minutes);
    } catch (error) {
      console.log('Error loading health data:', error);
    }
  };

  // ---------- bottom sheet animation + drag-to-close
  const translateY = useRef(new Animated.Value(0)).current;
  const sheetHeight = useRef(0);
  const DRAG_CLOSE_THRESHOLD = 120;

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
    translateY.setValue(50); // small pop-in
    requestAnimationFrame(() => animateTo(0));
  };

  const closeReminder = () => {
    animateTo(sheetHeight.current || 300, () => {
      setShowReminder(false);
    });
  };

  // only the handle needs to respond, but it moves the whole sheet
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
      onPanResponderMove: (_, g) => {
        const y = Math.max(0, g.dy); // drag down only
        translateY.setValue(y);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DRAG_CLOSE_THRESHOLD || g.vy > 1.2) {
          closeReminder();
        } else {
          animateTo(0);
        }
      },
    })
  ).current;

  if (!fontsLoaded) return <AppLoading />;

  // helpers to build exact Date for “Edit Reminder”
  const todayAt = (h: number, m: number) => {
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  };
  const tomorrowAt = (h: number, m: number) => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(h, m, 0, 0);
    return d;
  };

  return (
    <LinearGradient colors={["#e0e7ff", "#f0f4ff"]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Header */}
          <View style={{ paddingHorizontal: 24, paddingTop: 35 }}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.subText}>Hello, Caregiver</Text>
                <Text style={styles.h1}>Dashboard</Text>
              </View>
              <View style={styles.row}>
                <Image
                  source={{
                    uri: "https://lh3.googleusercontent.com/a/ACg8ocLw_b_95Zk8i_32X-y1xX8X2-wE9L7KzQ3qE6pB4P-5e_3A=s96-c-rg-br100",
                  }}
                  style={styles.avatar}
                />
                <TouchableOpacity style={styles.iconBtn}
                onPress={() => navigation.navigate('Settings')}>
                  <MaterialIcons name="settings" size={28} color="#475569" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Patient Card */}
          <View style={{ paddingHorizontal: 24, marginTop: 16 }}>
            <LinearGradient
              colors={["#a5b4fc", "#8893F9"]}
              style={styles.patientCard}
            >
              <View style={styles.rowBetween}>
                <View>
                  <Text style={styles.h2White}>John Doe</Text>
                  <Text style={styles.smallWhite}>Patient Profile</Text>
                </View>
                <View style={styles.row}>
                  <View style={styles.rowIcon}>
                    <Feather name="wifi" size={16} color="#fff" />
                    <Text style={styles.smallWhite}>Online</Text>
                  </View>
                  <View style={[styles.rowIcon, { marginLeft: 12 }]}>
                    <MaterialIcons name="battery-std" size={16} color="#fff" />
                    <Text style={styles.smallWhite}>92%</Text>
                  </View>
                </View>
              </View>
              <View style={styles.rowBetweenBtns}>
                <GhostBtn icon="phone" text="   Call Patient" />
                <GhostBtn 
                icon="pin-drop" 
                text="  Check Location"
                onPress={() => navigation.navigate('PatientLocation')}  />  
              </View>
            </LinearGradient>
          </View>

          {/* Quick Actions */}
          <QuickActionTitle title="Quick Actions" />
          <View style={styles.grid}>
            <Card
              label="Add Reminder"
              icon="add-alert"
              onPress={() => navigation.navigate("AddReminder")}
            />
            <Card 
              label="Patient Details" 
              icon="badge"
              onPress={() => navigation.navigate('PatientDetails')} />
            <Card 
              label="Manage Faces" 
              icon="face" full
              onPress={() => navigation.navigate('ManageFaces')} />
          </View>

          {/* Health Metrics */}
          <SectionTitle title="Health Metrics" />
          <View style={{ paddingHorizontal: 24 }}>
            {/* Daily Activity */}
            <CardBox>
              <View style={styles.rowBetween}>
                <View>
                  <Text style={styles.cardTitle}>Daily Activity</Text>
                  <Text style={styles.smallMuted}>Steps & Active Time</Text>
                </View>
                <MaterialIcons name="directions-walk" size={30} color="#6366F1" />
              </View>
              <View style={{ flexDirection: "row", marginTop: 8 }}>
                <Text style={styles.steps}>{steps.toLocaleString()}</Text>
                <Text style={styles.stepLabel}>steps</Text>
              </View>
              <View style={{ flexDirection: "row", marginTop: -4 }}>
                <Text style={styles.minutes}>{activeMinutes}</Text>
                <Text style={styles.minLabel}>active mins</Text>
              </View>
            </CardBox>

            {/* Medication Adherence — EXACT replica */}
            <MedicationAdherenceCardExact />

            {/* Cognition Level */}
            <CardBox>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>Cognition Level</Text>
                <Text style={styles.badge}>Good</Text>
              </View>
              <ScaleBar />
              <View style={styles.scaleLabels}>
                {["Severe", "Moderate", "Mild", "Good", "Excellent"].map(
                  (label) => (
                    <Text key={label} style={styles.scaleText}>
                      {label}
                    </Text>
                  )
                )}
              </View>
            </CardBox>

            {/* Weekly Adherence */}
            <CardBox>
              <Text style={[styles.cardTitle, { textAlign: "center" }]}>
                Weekly Adherence
              </Text>
              <Ring percent={92} />
            </CardBox>
          </View>

          {/* Upcoming Reminders */}
          <SectionTitle title="Upcoming Reminders" />
          <View style={{ paddingHorizontal: 24 }}>
            <ListItem
              title="Morning Medication"
              subtitle="Today, 9:00 AM"
              icon="medication"
              color="#14b8a6"
              bg="#ccfbf1"
              onPress={() =>
                openReminder({
                  title: "Morning Medication",
                  subtitle: "Today, 9:00 AM",
                  icon: "medication",
                  chipColor: "#14b8a6",
                  chipBg: "#ccfbf1",
                  details: {
                    medication: "Donepezil 10mg",
                    instructions:
                      "Take one tablet with breakfast. Should be taken with food to avoid stomach upset.",
                    note:
                      "Make sure he drinks a full glass of water with the pill.",
                  },
                  status: { time: "Taken at 9:05 AM", label: "Confirmed" },
                  prefill: {
                    title: "Morning Medication",
                    date: todayAt(9, 0),
                    timeText: "09:00 AM",
                  },
                })
              }
            />
            <ListItem
              title="Doctor's Appointment"
              subtitle="Tomorrow, 2:30 PM"
              icon="event"
              color="#3b82f6"
              bg="#dbeafe"
              onPress={() =>
                openReminder({
                  title: "Doctor's Appointment",
                  subtitle: "Tomorrow, 2:30 PM",
                  icon: "event",
                  chipColor: "#3b82f6",
                  chipBg: "#dbeafe",
                  details: {
                    medication: "With Dr. Smith — Room 402",
                    instructions: "Arrive 10 minutes early. Bring insurance card.",
                    note: "Confirm transportation with caretaker.",
                  },
                  status: { time: "Not yet", label: "Scheduled" },
                  prefill: {
                    title: "Doctor's Appointment",
                    date: tomorrowAt(14, 30),
                    timeText: "02:30 PM",
                  },
                })
              }
            />
          </View>

          {/* Recent Activity */}
          <SectionTitle title="Recent Activity" />
          <View style={{ paddingHorizontal: 24 }}>
            <ListItem
              title="Played 'Memory Lane'"
              subtitle="15 mins ago"
              icon="videogame-asset"
              color="#a855f7"
              bg="#f3e8ff"
            />
            <ListItem
              title="Afternoon medication taken"
              subtitle="1 hour ago"
              icon="check-circle"
              color="#22c55e"
              bg="#dcfce7"
            />
          </View>
        </ScrollView>

        {/* ------------------------------ Reminder Modal ------------------------------ */}
        <Modal
          visible={showReminder}
          transparent
          animationType="none"
          onRequestClose={closeReminder}
        >
          {/* FULLSCREEN overlay with blur all the way to the top */}
          <View style={modalStyles.overlayRoot} pointerEvents="box-none">
            <BlurView
              intensity={30}
              tint="dark"
              style={StyleSheet.absoluteFillObject}
            />
            {/* dark tint over the blur */}
            <TouchableOpacity
              style={modalStyles.overlayTint}
              activeOpacity={1}
              onPress={closeReminder}
            />

            {/* Bottom sheet */}
            <Animated.View
              style={[modalStyles.sheet, { transform: [{ translateY }] }]}
              onLayout={(e) => {
                sheetHeight.current = e.nativeEvent.layout.height;
              }}
            >
              {/* Handle bar — this is draggable */}
              <View
                {...panResponder.panHandlers}
                style={modalStyles.handleWrap}
              >
                <View style={modalStyles.handle} />
              </View>

              {/* Header row with icon + title/subtitle */}
              <View style={modalStyles.headerRow}>
                <View
                  style={[
                    styles.iconBg,
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
                  <Text style={modalStyles.subtitle}>{activeReminder?.subtitle}</Text>
                </View>
              </View>

              {/* Details */}
              <View style={modalStyles.section}>
                <Text style={modalStyles.sectionTitle}>Details</Text>

                {activeReminder?.details?.medication ? (
                  <View style={modalStyles.detailRow}>
                    <MaterialIcons name="medication" size={20} color="#6366f1" />
                    <Text style={modalStyles.detailText}>
                      <Text style={modalStyles.detailLabel}>Medication: </Text>
                      {activeReminder.details.medication}
                    </Text>
                  </View>
                ) : null}

                {activeReminder?.details?.instructions ? (
                  <View style={modalStyles.detailRow}>
                    <MaterialIcons name="lunch-dining" size={20} color="#6366f1" />
                    <Text style={modalStyles.detailText}>
                      <Text style={modalStyles.detailLabel}>Instructions: </Text>
                      {activeReminder.details.instructions}
                    </Text>
                  </View>
                ) : null}

                {activeReminder?.details?.note ? (
                  <View style={modalStyles.detailRow}>
                    <MaterialIcons name="speaker-notes" size={20} color="#6366f1" />
                    <Text style={modalStyles.detailText}>
                      <Text style={modalStyles.detailLabel}>Caregiver Note: </Text>
                      {activeReminder.details.note}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Status */}
              <View style={modalStyles.section}>
                <Text style={modalStyles.sectionTitle}>Status</Text>
                <View style={modalStyles.statusCard}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <MaterialIcons
                      name={
                        activeReminder?.status?.label === "Confirmed"
                          ? "check-circle"
                          : "schedule"
                      }
                      size={22}
                      color={activeReminder?.status?.label === "Confirmed" ? "#16a34a" : "#64748b"}
                      style={{ marginRight: 10 }}
                    />
                    <Text
                      style={[
                        modalStyles.statusMain,
                        { color: activeReminder?.status?.label === "Confirmed" ? "#065f46" : "#334155" },
                      ]}
                    >
                      {activeReminder?.status?.time || "—"}
                    </Text>
                  </View>
                  <Text
                    style={[
                      modalStyles.statusRight,
                      { color: activeReminder?.status?.label === "Confirmed" ? "#15803d" : "#64748b" },
                    ]}
                  >
                    {activeReminder?.status?.label || ""}
                  </Text>
                </View>
              </View>

              {/* Footer buttons */}
              <View style={modalStyles.footerRow}>
                <TouchableOpacity style={modalStyles.closeBtn} onPress={closeReminder}>
                  <MaterialIcons name="close" size={20} color="#334155" />
                  <Text style={modalStyles.closeText}>Close</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => {
                    if (activeReminder?.prefill) {
                      navigation.navigate("AddReminder", { prefill: activeReminder.prefill });
                      setShowReminder(false);
                    }
                  }}
                  style={{ flex: 1 }}
                >
                  <LinearGradient
                    colors={["#a5b4fc", "#818cf8"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={modalStyles.editBtn}
                  >
                    <MaterialIcons name="edit" size={20} color="#fff" />
                    <Text style={modalStyles.editText}>Edit Reminder</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </Modal>
        {/* ---------------------------- /Reminder Modal ---------------------------- */}
      </SafeAreaView>
    </LinearGradient>
  );
}

/* --- Components --- */

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function QuickActionTitle({ title }: { title: string }) {
  return <Text style={styles.quickactionTitle}>{title}</Text>;
}

type GhostBtnProps = {
  icon: string;
  text: string;
  onPress?: () => void; // 👈 make onPress optional
};

function GhostBtn({ icon, text, onPress }: GhostBtnProps) {
  return (
    <TouchableOpacity style={styles.ghostBtn} onPress={onPress}>
      <MaterialIcons name={icon as any} size={18} color="#fff" />
      <Text style={styles.ghostBtnText}>{text}</Text>
    </TouchableOpacity>
  );
}


function Card({
  label,
  icon,
  full,
  onPress,
}: {
  label: string;
  icon: string;
  full?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.card, full && { flexBasis: "100%" }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <MaterialIcons name={icon as any} size={32} color="#6366f1" />
      <Text style={styles.cardLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function CardBox({ children }: { children: React.ReactNode }) {
  return <View style={styles.cardBox}>{children}</View>;
}

function ListItem({
  title,
  subtitle,
  icon,
  color,
  bg,
  extra,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  bg: string;
  extra?: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={styles.listCard} activeOpacity={0.75} onPress={onPress}>
      <View style={[styles.iconBg, { backgroundColor: bg }]}>
        <MaterialIcons name={icon as any} size={22} color={color} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.listTitle}>{title}</Text>
        <Text style={styles.smallMuted}>{subtitle}</Text>
      </View>
      {extra ? (
        <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#22c55e" }}>
          {extra}
        </Text>
      ) : (
        <MaterialIcons name="chevron-right" size={22} color="#94a3b8" />
      )}
    </TouchableOpacity>
  );
}

/* ---------------- Existing charts & helpers (unchanged) ---------------- */

function MedicationAdherenceCardExact() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const values = [85, 60, 86, 88, 40, 87, 60];

  const CARD_PAD = 20;
  const SVG_W = W - 26 * 2 - CARD_PAD * 2.7;
  const SVG_H = 160;

  const Y_MAX = 100;
  const LEFT = 35;
  const RIGHT = 8;
  const TOP = 10;
  const BOTTOM = 30;
  const PLOT_W = SVG_W - LEFT - RIGHT;
  const PLOT_H = SVG_H - TOP - BOTTOM;

  const BAR_W = 16;
  const totalBarW = BAR_W * values.length;
  const GAP = (PLOT_W - totalBarW) / (values.length - 1);

  const BAR_OFFSET = 6;
  const R = 8;

  const yPos = (v: number) => TOP + (PLOT_H - (v / Y_MAX) * PLOT_H);
  const GRID_END = LEFT + PLOT_W + BAR_OFFSET + 0;

  const barPath = (x: number, y: number, w: number, h: number, r: number) => {
    const x0 = x,
      y0 = y;
    const x1 = x + w,
      y1 = y + h;
    const rr = Math.min(r, w / 2, h);
    return [
      `M ${x0} ${y0 + rr}`,
      `Q ${x0} ${y0} ${x0 + rr} ${y0}`,
      `H ${x1 - rr}`,
      `Q ${x1} ${y0} ${x1} ${y0 + rr}`,
      `V ${y1}`,
      `H ${x0}`,
      `Z`,
    ].join(" ");
  };

  return (
    <View style={styles.cardBox}>
      <View style={styles.rowBetween}>
        <View>
          <Text style={med.title}>Medication Adherence</Text>
          <Text style={med.subtitle}>Last 7 days</Text>
        </View>
        <MaterialIcons name="medication" size={24} color="#6366f1" />
      </View>

      <Svg width={SVG_W} height={SVG_H} style={{ marginTop: 6 }}>
        <Defs>
          <SvgGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="rgba(129,140,248,0.35)" />
            <Stop offset="1" stopColor="rgba(129,140,248,0.35)" />
          </SvgGradient>
        </Defs>

        {[{ v: 100, label: "100%" }, { v: 50, label: "50%" }, { v: 0, label: "0%" }].map(
          (t, i) => (
            <SvgText
              key={i}
              x={0}
              y={yPos(t.v) + 3}
              fill="#64748b"
              fontSize={10}
              fontFamily="Poppins_500Medium"
            >
              {t.label}
            </SvgText>
          )
        )}

        <SvgLine x1={LEFT} y1={TOP} x2={LEFT} y2={TOP + PLOT_H} stroke="#E6EBFF" strokeWidth={1} />
        {[0, 50, 100].map((v, i) => (
          <SvgLine
            key={i}
            x1={LEFT}
            y1={yPos(v)}
            x2={GRID_END}
            y2={yPos(v)}
            stroke="#E6EBFF"
            strokeWidth={1}
          />
        ))}

        {values.map((val, i) => {
          const h = (val / Y_MAX) * PLOT_H;
          const x = LEFT + BAR_OFFSET + i * (BAR_W + GAP);
          const y = TOP + (PLOT_H - h);
          return (
            <Path
              key={i}
              d={barPath(x, y, BAR_W, h, R)}
              fill="rgba(179,186,251,0.5)"
              stroke="#7073F2"
              strokeWidth={1}
            />
          );
        })}

        {days.map((d, i) => {
          const x = LEFT + BAR_OFFSET + i * (BAR_W + GAP) + BAR_W / 2;
          return (
            <SvgText
              key={d}
              x={x}
              y={SVG_H - 7}
              textAnchor="middle"
              fill="#64748b"
              fontSize={12}
              fontFamily="Poppins_500Medium"
            >
              {d}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}

function Ring({ percent }: { percent: number }) {
  const size = 200;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(percent, 100));
  const dash = (c * clamped) / 100;

  return (
    <View style={{ alignSelf: "center", marginTop: 12 }}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#818cf8" />
            <Stop offset="100%" stopColor="#c084fc" />
          </SvgGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#EEF2FF" strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#ringGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${dash}, ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[styles.ringCenter, { top: "36%" }]}>
        <Text style={[styles.ringPercent, { fontSize: 32 }]}>{clamped}%</Text>
        <Text style={[styles.smallMuted, { marginTop: -15 }]}>Adherence</Text>
      </View>
    </View>
  );
}

function ScaleBar() {
  const BAR_W = W - 80;
  const BAR_H = 14;
  const R = BAR_H / 2;
  const SEG = 5;
  const GAP = 6;
  const segW = (BAR_W - GAP * (SEG - 1)) / SEG;
  const segX = (i: number) => i * (segW + GAP);
  const markerLeft = segX(3) - 12;

  const leftRoundedPath = (x: number, y: number, w: number, h: number, r: number) =>
    [
      `M ${x + r},${y}`,
      `H ${x + w}`,
      `V ${y + h}`,
      `H ${x + r}`,
      `Q ${x},${y + h} ${x},${y + h - r}`,
      `V ${y + r}`,
      `Q ${x},${y} ${x + r},${y}`,
      `Z`,
    ].join(" ");

  const rightRoundedPath = (x: number, y: number, w: number, h: number, r: number) => {
    const xr = x + w;
    return [
      `M ${x},${y}`,
      `H ${xr - r}`,
      `Q ${xr},${y} ${xr},${y + r}`,
      `V ${y + h - r}`,
      `Q ${xr},${y + h} ${xr - r},${y + h}`,
      `H ${x}`,
      `Z`,
    ].join(" ");
  };

  return (
    <View style={styles.cogBarWrap}>
      <Svg width={BAR_W} height={BAR_H}>
        <Defs>
          <SvgGradient id="grad1" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor="#f87171" />
            <Stop offset="100%" stopColor="#fb923c" />
          </SvgGradient>
          <SvgGradient id="grad2" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor="#fb923c" />
            <Stop offset="100%" stopColor="#facc15" />
          </SvgGradient>
          <SvgGradient id="grad3" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor="#facc15" />
            <Stop offset="100%" stopColor="#84cc16" />
          </SvgGradient>
          <SvgGradient id="grad4" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor="#84cc16" />
            <Stop offset="100%" stopColor="#22c55e" />
          </SvgGradient>
          <SvgGradient id="grad5" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor="#22c55e" />
            <Stop offset="100%" stopColor="#2dd4bf" />
          </SvgGradient>
        </Defs>

        <Path d={leftRoundedPath(segX(0), 0, segW, BAR_H, R)} fill="url(#grad1)" />
        <Rect x={segX(1)} y={0} width={segW} height={BAR_H} fill="url(#grad2)" />
        <Rect x={segX(2)} y={0} width={segW} height={BAR_H} fill="url(#grad3)" />
        <Rect x={segX(3)} y={0} width={segW} height={BAR_H} fill="url(#grad4)" />
        <Path d={rightRoundedPath(segX(4), 0, segW, BAR_H, R)} fill="url(#grad5)" />
      </Svg>

      <View style={[styles.cognitionMarker, { left: markerLeft, top: -BAR_H - -9 }]}>
        <View style={styles.cognitionMarkerInner} />
      </View>
    </View>
  );
}

/* --- Styles --- */

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowBetweenBtns: { flexDirection: "row", justifyContent: "space-between", marginTop: 20, gap: 13 },

  h1: { fontSize: 28, fontFamily: "Poppins_700Bold", color: "#1e293b", marginBottom: 4 },
  h2White: { fontSize: 22, fontFamily: "Poppins_600SemiBold", color: "#fff" },
  subText: { fontSize: 16, fontFamily: "Poppins_400Regular", color: "#64748b", marginBottom: -5 },
  smallWhite: { fontSize: 12, fontFamily: "Poppins_400Regular", color: "#fff" },
  smallMuted: { fontSize: 14, fontFamily: "Poppins_400Regular", color: "#64748b", marginTop: -4 },

  avatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: "#a5b4fc", marginRight: 12, marginBottom: 10 },
  iconBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", marginBottom: 10 },

  patientCard: { borderRadius: 24, padding: 25, shadowOpacity: 0.2, shadowRadius: 10 },
  rowIcon: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 22 },

  ghostBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 14, paddingHorizontal: 22 },
  ghostBtnText: { color: "#fff", fontFamily: "Poppins_500Medium", marginLeft: 13 },

  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", paddingHorizontal: 24 },
  card: { backgroundColor: "#fff", borderRadius: 20, padding: 20, alignItems: "center", marginBottom: 16, width: "48%", shadowOpacity: 0.05 },
  cardLabel: { marginTop: 8, fontSize: 14, fontFamily: "Poppins_500Medium", color: "#475569" },

  cardBox: { backgroundColor: "#fff", borderRadius: 20, padding: 20, marginBottom: 20, shadowOpacity: 0.05 },
  cardTitle: { fontSize: 16, fontFamily: "Poppins_600SemiBold", color: "#334155", marginBottom: 4 },

  steps: { fontSize: 34, fontFamily: "Poppins_700Bold", color: "#6366F1" },
  stepLabel: { fontSize: 14, fontFamily: "Poppins_500Medium", color: "#64748b", marginLeft: 6, marginTop: 20 },
  minutes: { fontSize: 22, fontFamily: "Poppins_600SemiBold", color: "#475569" },
  minLabel: { fontSize: 14, fontFamily: "Poppins_500Medium", color: "#64748b", marginLeft: 6, marginTop: 9 },

  badge: { fontSize: 12, fontFamily: "Poppins_700Bold", color: "#6366F1", backgroundColor: "#e0e7ff", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: -3 },

  ringCenter: { position: "absolute", top: "40%", left: 0, right: 0, alignItems: "center" },
  ringPercent: { fontSize: 28, fontFamily: "Poppins_700Bold", color: "#1e293b", marginTop: -2 },

  scaleLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  scaleText: { fontSize: 12, fontFamily: "Poppins_400Regular", color: "#64748b" },
  scaleMarker: { position: "absolute", top: -8, right: -8, width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff", borderWidth: 2, borderColor: "#6366F1" },

  listCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 20, padding: 16, marginBottom: 12, shadowOpacity: 0.05 },
  iconBg: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  listTitle: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: "#334155" },

  sectionTitle: { fontSize: 18, fontFamily: "Poppins_600SemiBold", color: "#374151", marginHorizontal: 30, marginTop: 16, marginBottom: 8 },
  quickactionTitle: { fontSize: 18, fontFamily: "Poppins_600SemiBold", color: "#374151", marginHorizontal: 30, marginTop: 28, marginBottom: 8 },

  cogBarWrap: { marginTop: 12, alignItems: "center" },

  cognitionMarker: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: "#6366F1",
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  cognitionMarkerInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#6366F1",
  },
});

const med = StyleSheet.create({
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: "#334155",
  },
  subtitle: {
    marginTop: -2,
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: "#94a3b8",
  },
});

/* -------------------- Modal-specific styles -------------------- */
const modalStyles = StyleSheet.create({
  // absolute-fill so blur + tint cover the entire screen (header included)
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
  handleWrap: { alignItems: "center", paddingVertical: 10 },
  handle: { width: 56, height: 6, borderRadius: 3, backgroundColor: "#cbd5e1" },

  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  title: { fontFamily: "Poppins_700Bold", fontSize: 22, color: "#1e293b" },
  subtitle: { fontFamily: "Poppins_400Regular", fontSize: 14, color: "#64748b" },

  section: { borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 16, marginTop: 16 },
  sectionTitle: { fontFamily: "Poppins_600SemiBold", color: "#475569", marginBottom: 10 },

  detailRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8, gap: 12 },
  detailText: { flex: 1, color: "#334155", fontFamily: "Poppins_400Regular", fontSize: 14 },
  detailLabel: { fontFamily: "Poppins_500Medium", color: "#334155" },

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
  statusMain: { fontFamily: "Poppins_600SemiBold", fontSize: 15 },
  statusRight: { fontFamily: "Poppins_500Medium", fontSize: 13 },

  footerRow: { flexDirection: "row", gap: 12, marginTop: 18 },
  closeBtn: {
    flex: 1,
    backgroundColor: "#e5e7eb",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  closeText: { fontFamily: "Poppins_600SemiBold", color: "#334155" },

  editBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#818cf8",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  editText: { fontFamily: "Poppins_600SemiBold", color: "#fff" },
});
