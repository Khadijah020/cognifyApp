// PatientLocationScreen.tsx
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Dimensions,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { RootStackParamList } from '../app/App';
import { useTheme } from '../contexts/ThemeContext';
import * as CaregiverService from '../services/CaregiverService';
import PatientDeviceStatusService from '../services/PatientDeviceStatusService';

import {
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    useFonts,
} from '@expo-google-fonts/poppins';

type Props = NativeStackScreenProps<RootStackParamList, 'PatientLocation'>;

interface PatientInfo {
  name: string;
  lastUpdated: string;
  address: string;
  coordinates: { latitude: number; longitude: number };
}

const C = {
  bg: '#f0f4ff',
  slate800: '#1e293b',
  slate700: '#334155',
  slate600: '#475569',
  slate500: '#64748b',
  slate400: '#94a3b8',
  white: '#ffffff',
  indigo100: '#e0e7ff',
  indigo300: '#a5b4fc',
  indigo500: '#6366f1',
  purple300: '#c084fc',
  btnFrom: '#818cf8',
  btnTo: '#6366f1',
};

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

export default function PatientLocationScreen({ navigation, route }: Props) {
  const { colors, isDark } = useTheme();
  const alertLatitude = route.params?.latitude;
  const alertLongitude = route.params?.longitude;
  const alertCoordinates = useMemo(
    () =>
      typeof alertLatitude === 'number' && typeof alertLongitude === 'number'
        ? { latitude: alertLatitude, longitude: alertLongitude }
        : null,
    [alertLatitude, alertLongitude]
  );
  const hasAlertLocation = !!alertCoordinates;
  const fromAlert = route.params?.fromAlert === true;
  const routePatientId = route.params?.patientId;
  const routePatientName = route.params?.patientName;
  const initialTimestamp = useRef(route.params?.timestamp ? new Date(route.params.timestamp) : new Date()).current;
  const [lastLocationUpdate, setLastLocationUpdate] = useState<Date>(initialTimestamp);
  
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const [patientInfo, setPatientInfo] = useState<PatientInfo>({
    name: routePatientName || 'Loading...',
    lastUpdated: route.params?.timestamp ? getTimeAgo(initialTimestamp) : 'just now',
    address: hasAlertLocation
      ? 'Resolving fall alert location...'
      : fromAlert
        ? 'This fall alert did not include GPS coordinates.'
        : 'Loading address...',
    coordinates: {
      latitude: alertCoordinates?.latitude ?? 0,
      longitude: alertCoordinates?.longitude ?? 0,
    },
  });
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const mapRef = useRef<MapView>(null);

  const screenH = Dimensions.get('window').height;
  const mapHeight = useMemo(() => Math.max(350, screenH - 380), [screenH]);

  // Update time ago every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setPatientInfo((prev) => ({
        ...prev,
        lastUpdated: getTimeAgo(lastLocationUpdate),
      }));
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [lastLocationUpdate]);

  // Fetch patient name from Supabase on mount when one was not passed in route params.
  useEffect(() => {
    if (routePatientName) return;

    const fetchPatientName = async () => {
      try {
        const id = await CaregiverService.getCurrentCaregiversId();
        if (id) {
          const patient = await CaregiverService.getPrimaryPatient(id);
          if (patient) {
            setPatientInfo((prev) => ({
              ...prev,
              name: patient.full_name || 'Patient',
            }));
          }
        }
      } catch (error) {
        console.error('Error fetching patient name:', error);
      }
    };
    fetchPatientName();
  }, [routePatientName]);

  useEffect(() => {
    let sub: Location.LocationSubscription | undefined;
    let interval: ReturnType<typeof setInterval> | undefined;

    const loadSyncedPatientLocation = async () => {
      if (!routePatientId) return;

      const status = await PatientDeviceStatusService.getPatientDeviceStatus(routePatientId);
      const hasSyncedLocation =
        typeof status?.latitude === 'number' && typeof status?.longitude === 'number';

      if (!hasSyncedLocation) {
        setPatientInfo((prev) => ({
          ...prev,
          name: routePatientName || prev.name,
          address: 'No synced patient location yet. Open the patient app and allow location access.',
        }));
        setMapRegion(null);
        return;
      }

      const coordinates = {
        latitude: status.latitude as number,
        longitude: status.longitude as number,
      };
      const locationDate = status.locationRecordedAt
        ? new Date(status.locationRecordedAt)
        : status.recordedAt
          ? new Date(status.recordedAt)
          : new Date();

      let formattedAddress = 'Patient synced location';
      try {
        const [addr] = await Location.reverseGeocodeAsync(coordinates);
        formattedAddress = addr
          ? `${addr.street || 'Near'} ${addr.name || ''}, ${addr.city || ''}, ${addr.region || ''}`.replace(/\s+/g, ' ').trim()
          : formattedAddress;
      } catch (e) {
        console.log('Reverse geocode error', e);
      }

      setLastLocationUpdate(locationDate);
      setPatientInfo((prev) => ({
        ...prev,
        name: routePatientName || prev.name,
        lastUpdated: getTimeAgo(locationDate),
        address: formattedAddress,
        coordinates,
      }));

      const region = {
        ...coordinates,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      };
      setMapRegion(region);
    };

    (async () => {
      if (alertCoordinates) {
        const coordinates = alertCoordinates;
        const region = {
          ...coordinates,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        };

        let formattedAddress = 'Fall alert location';
        try {
          const [addr] = await Location.reverseGeocodeAsync(coordinates);
          formattedAddress = addr
            ? `${addr.street || 'Near'} ${addr.name || ''}, ${addr.city || ''}, ${addr.region || ''}`.replace(/\s+/g, ' ').trim()
            : formattedAddress;
        } catch (e) {
          console.log('Reverse geocode error', e);
        }

        setPatientInfo((prev) => ({
          ...prev,
          name: routePatientName || prev.name,
          lastUpdated: route.params?.timestamp ? getTimeAgo(initialTimestamp) : 'just now',
          address: formattedAddress,
          coordinates,
        }));
        setMapRegion(region);
        return;
      }

      if (fromAlert) {
        setPatientInfo((prev) => ({
          ...prev,
          name: routePatientName || prev.name,
          lastUpdated: route.params?.timestamp ? getTimeAgo(initialTimestamp) : 'just now',
          address: 'This fall alert did not include GPS coordinates.',
        }));
        setMapRegion(null);
        return;
      }

      if (routePatientId) {
        await loadSyncedPatientLocation();
        interval = setInterval(loadSyncedPatientLocation, 60 * 1000);
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to display the patient location.');
        return;
      }

      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
        const [addr] = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });

        const formattedAddress = addr
          ? `${addr.street || 'Near'} ${addr.name || ''}, ${addr.city || ''}, ${addr.region || ''}`.replace(/\s+/g,' ').trim()
          : 'Unknown location';

        const now = new Date();
        setLastLocationUpdate(now);
        setPatientInfo((prev) => ({
          ...prev,
          lastUpdated: 'just now',
          address: formattedAddress,
          coordinates: { latitude: loc.coords.latitude, longitude: loc.coords.longitude },
        }));

        const region = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        };
        setMapRegion(region);
      } catch (e) {
        console.error('Location error', e);
        Alert.alert('Error', 'Failed to get current location.');
      }

      // continuous updates
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
        (loc) => {
          const now = new Date();
          setLastLocationUpdate(now);
          setPatientInfo((prev) => ({
            ...prev,
            lastUpdated: 'just now',
            coordinates: { latitude: loc.coords.latitude, longitude: loc.coords.longitude },
          }));
        }
      );
    })();

    return () => {
      sub?.remove();
      if (interval) clearInterval(interval);
    };
  }, [alertCoordinates, fromAlert, initialTimestamp, route.params?.timestamp, routePatientId, routePatientName]);

  const openExternalDirections = () => {
    const { latitude, longitude } = patientInfo.coordinates;
    if (!latitude && !longitude) {
      Alert.alert('Error', 'Cannot get directions without a valid location.');
      return;
    }
    const label = encodeURIComponent(patientInfo.name);
    const apple = `http://maps.apple.com/?daddr=${latitude},${longitude}&q=${label}`;
    const google = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=walking`;
    const url = Platform.select({ ios: apple, android: google, default: google })!;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Failed to open maps.'));
  };

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  const dynamicStyles = {
    root: { ...styles.root, backgroundColor: colors.background },
    headerTitle: { ...styles.headerTitle, color: colors.text },
    card: { ...styles.card, backgroundColor: colors.surface },
    name: { ...styles.name, color: colors.text },
    updated: { ...styles.updated, color: colors.textSecondary },
    label: { ...styles.label, color: colors.textSecondary },
    value: { ...styles.value, color: colors.text },
  };

  return (
    <View style={dynamicStyles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back-ios-new" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={dynamicStyles.headerTitle}>Patient Location</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Map container */}
        <View style={[styles.mapOuter, { height: mapHeight }]}>
            {mapRegion ? (
            <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                style={StyleSheet.absoluteFill}
                initialRegion={mapRegion}
                region={mapRegion}
                showsUserLocation={!hasAlertLocation}
                showsMyLocationButton={false}
            >
                {/* Gradient pin with avatar + white halo */}
                <Marker coordinate={patientInfo.coordinates} anchor={{ x: 0.5, y: 1 }}>
                <View style={styles.pinWrap}>
                    <View style={styles.pinHalo} />
                    <LinearGradient
                    colors={[C.purple300, C.indigo300]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.pin}
                    >
                    <View style={styles.pinAvatar}>
                        <Text style={styles.pinInitial}>
                          {patientInfo.name
                            .split(' ')
                            .filter(word => word.length > 0)
                            .map(word => word[0])
                            .join('')
                            .toUpperCase()
                            .slice(0, 2)}
                        </Text>
                    </View>
                    </LinearGradient>
                </View>
                </Marker>
            </MapView>
            ) : (
            <View style={[StyleSheet.absoluteFill, styles.loadingMap]}>
                <Text style={{ fontFamily: 'Poppins_500Medium', color: C.slate600 }}>
                  {fromAlert ? 'No alert coordinates available' : 'Loading map...'}
                </Text>
            </View>
            )}

            {/* Map control stack (locate / zoom in / out) */}
            <View style={styles.controlsWrap}>
            <ControlButton
                icon={<MaterialIcons name={hasAlertLocation ? "center-focus-strong" : "my-location"} size={18} color={C.slate700} />}
                onPress={async () => {
                if (alertCoordinates) {
                    const region = {
                    latitude: alertCoordinates.latitude,
                    longitude: alertCoordinates.longitude,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                    };
                    setMapRegion(region);
                    mapRef.current?.animateToRegion(region, 300);
                    return;
                }
                if (fromAlert) {
                    Alert.alert('Location unavailable', 'This fall alert did not include GPS coordinates.');
                    return;
                }
                if (!locationPermission) {
                    Alert.alert('Permission Denied', 'Location permission is required.');
                    return;
                }
                try {
                    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                    const region = {
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                    };
                    setMapRegion(region);
                    mapRef.current?.animateToRegion(region, 300);
                } catch {
                    Alert.alert('Error', 'Failed to get your current location.');
                }
                }}
            />
            <ControlButton
                icon={<MaterialIcons name="add" size={18} color={C.slate700} />}
                onPress={() => {
                if (!mapRegion) return;
                const r = {
                    ...mapRegion,
                    latitudeDelta: mapRegion.latitudeDelta / 2,
                    longitudeDelta: mapRegion.longitudeDelta / 2,
                };
                setMapRegion(r);
                mapRef.current?.animateToRegion(r, 200);
                }}
            />
            <ControlButton
                icon={<MaterialIcons name="remove" size={18} color={C.slate700} />}
                onPress={() => {
                if (!mapRegion) return;
                const r = {
                    ...mapRegion,
                    latitudeDelta: mapRegion.latitudeDelta * 2,
                    longitudeDelta: mapRegion.longitudeDelta * 2,
                };
                setMapRegion(r);
                mapRef.current?.animateToRegion(r, 200);
                }}
            />
            </View>
        </View>

        {/* Details card */}
        <View style={dynamicStyles.card}>
            <View style={styles.cardHeader}>
            <View style={styles.avatarRing}>
                <Text style={styles.avatarInitial}>
                  {patientInfo.name
                    .split(' ')
                    .filter(word => word.length > 0)
                    .map(word => word[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)}
                </Text>
            </View>
            <View style={{ marginLeft: 14 }}>
                <Text style={dynamicStyles.name}>{patientInfo.name}</Text>
                <Text style={dynamicStyles.updated}>Last updated: {patientInfo.lastUpdated}</Text>
            </View>
            </View>

            <View style={styles.divider} />

            <View style={{ gap: 14 }}>
            <View style={styles.row}>
                <View style={[styles.iconBg, { backgroundColor: C.indigo100 }]}>
                <MaterialIcons name="pin-drop" size={20} color={C.indigo500} />
                </View>
                <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={dynamicStyles.label}>Address</Text>
                <Text style={dynamicStyles.value}>{patientInfo.address}</Text>
                </View>
            </View>

            <View style={styles.row}>
                <View style={[styles.iconBg, { backgroundColor: isDark ? '#2d2d44' : '#f3e8ff' }]}>
                <MaterialIcons name="explore" size={20} color={colors.primary} />
                </View>
                <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={dynamicStyles.label}>Coordinates</Text>
                <Text style={dynamicStyles.value}>
                    {patientInfo.coordinates.latitude
                    ? `${Math.abs(patientInfo.coordinates.latitude).toFixed(4)}° ${
                        patientInfo.coordinates.latitude >= 0 ? 'N' : 'S'
                        }, ${Math.abs(patientInfo.coordinates.longitude).toFixed(4)}° ${
                        patientInfo.coordinates.longitude >= 0 ? 'E' : 'W'
                        }`
                    : 'Locating…'}
                </Text>
                </View>
            </View>
            </View>

        </View>

        {/* CTA */}
        <View style={{ paddingHorizontal: 24, paddingBottom: 18, marginTop: 8 }}>
            <TouchableOpacity activeOpacity={0.9} onPress={openExternalDirections}>
            <LinearGradient
                colors={[C.btnFrom, C.btnTo]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cta}
            >
                <Ionicons name="navigate" size={22} color="#fff" />
                <Text style={styles.ctaText}>Get Directions</Text>
            </LinearGradient>
            </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

/* ————— Reusable small control button ————— */
const ControlButton = ({ icon, onPress }: { icon: React.ReactNode; onPress: () => void }) => {
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.ctrlBtn}>
      {icon}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  header: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: { paddingRight: 12, paddingVertical: 4 },
  headerTitle: {
    marginLeft: 30,
    fontSize: 22,
    color: C.slate800,
    fontFamily: 'Poppins_700Bold',
  },

  mapOuter: {
    marginTop: 8,
    marginHorizontal: 24,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#dfe7ff',
    shadowColor: '#4f46e5',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  loadingMap: { alignItems: 'center', justifyContent: 'center' },

  controlsWrap: {
    position: 'absolute',
    right: 14,
    top: 14,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 999,
    padding: 8,
    gap: 8,
    alignItems: 'center',
  },
  ctrlBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  /* Marker */
  pinWrap: { alignItems: 'center' },
  pinHalo: {
    position: 'absolute',
    bottom: 10,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  pin: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinInitial: {
    fontSize: 14,
    color: C.slate700,
    fontFamily: 'Poppins_600SemiBold',
  },

  /* Card */
  card: {
    backgroundColor: C.white,
    borderRadius: 20,
    marginTop: 18,
    marginBottom: 10,
    marginHorizontal: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatarRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#c7d2fe',
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 16,
    color: C.slate700,
    fontFamily: 'Poppins_600SemiBold',
  },
  name: {
    fontSize: 20,
    color: C.slate800,
    fontFamily: 'Poppins_700Bold',
  },
  updated: {
    marginTop: 2,
    fontSize: 12,
    color: C.slate500,
    fontFamily: 'Poppins_400Regular',
  },
  divider: { height: 1, backgroundColor: '#eef2f7', marginVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  iconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    color: C.slate500,
    fontFamily: 'Poppins_400Regular',
  },
  value: {
    marginTop: 2,
    fontSize: 16,
    color: C.slate700,
    fontFamily: 'Poppins_600SemiBold',
  },

  /* CTA */
  cta: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#9aa2ff',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  ctaText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#fff',
    fontFamily: 'Poppins_700Bold',
  },
});
