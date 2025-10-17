// src/contexts/PatientContext.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../src/lib/supabase';

export type Patient = {
  patient_id: string;
  fullName: string;
  stage: string;
  dob: string;
  address: string;
  emergency: string;
  allergies: string;
  meds: string;
  conditions: string;
  notes: string;
  likes: string;
  avatar: string | null;
  email: string;
};

type PatientContextType = {
  patient: Patient | null;
  setPatient: (p: Patient) => void;
  fetchPatientByCaregiver: () => Promise<void>;
};

const PatientContext = createContext<PatientContextType>({
  patient: null,
  setPatient: () => {},
  fetchPatientByCaregiver: async () => {},
});

export const PatientProvider = ({ children }: { children: React.ReactNode }) => {
  const [patient, setPatient] = useState<Patient | null>(null);

  const fetchPatientByCaregiver = async () => {
    console.log('[PatientContext] fetchPatientByCaregiver called');
    
    // ✅ Check if user is actually logged in first
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.log('[PatientContext] No session, skipping patient fetch');
      return;
    }

    // ✅ Also check role to avoid running for patients
    const role = await AsyncStorage.getItem('role');
    if (role !== 'caregiver') {
      console.log('[PatientContext] Not a caregiver, skipping patient fetch');
      return;
    }

    console.log('[PatientContext] Session exists, fetching patient...');
    
    // 1️⃣ Get current caregiver UID
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      console.error('[PatientContext] Auth error:', authError.message);
      return;
    }
    const caregiverId = authData?.user?.id;
    if (!caregiverId) {
      console.error("[PatientContext] No user logged in");
      return;
    }
    console.log('[PatientContext] Caregiver UID:', caregiverId);

    // 2️⃣ Fetch patient_details
    const { data: pd, error: pdErr } = await supabase
      .from('patient_details')
      .select('*')
      .eq('caregiver_id', caregiverId)
      .maybeSingle();

    if (pdErr) {
      console.error('[PatientContext] Error fetching patient details:', pdErr.message);
      return;
    }
    if (!pd) {
      console.log('[PatientContext] No patient found for this caregiver');
      return;
    }
    console.log('[PatientContext] Patient Details from DB:', pd);

    // 3️⃣ Fetch profile info
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('email, display_name')
      .eq('id', pd.patient_id)
      .maybeSingle();

    if (profileErr) {
      console.error('[PatientContext] Error fetching patient profile:', profileErr.message);
      return;
    }
    if (!profile) {
      console.log('[PatientContext] No profile found for patient');
      return;
    }
    console.log('[PatientContext] Profile Data:', profile);

    // 4️⃣ Set patient
    setPatient({
      patient_id: pd.patient_id,
      fullName: profile?.display_name || pd.fullName || '',
      stage: pd.dementia_stage || '',
      dob: pd.dob || '',
      address: pd.address || '',
      emergency: pd.emergency_contact || '',
      allergies: pd.allergies || '',
      meds: pd.medications || '',
      conditions: pd.conditions || '',
      notes: pd.notes || '',
      likes: pd.likes || '',
      avatar: pd.avatar_uri || null,
      email: profile?.email || '',
    });
  };

  useEffect(() => {
    console.log('[PatientContext] Provider mounted');
    fetchPatientByCaregiver();
  }, []);

  return (
    <PatientContext.Provider value={{ patient, setPatient, fetchPatientByCaregiver }}>
      {children}
    </PatientContext.Provider>
  );
};

export const usePatient = () => useContext(PatientContext);