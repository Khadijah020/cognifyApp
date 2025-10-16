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
  // 1️⃣ Get current caregiver UID
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error('Auth error:', authError.message);
    return;
  }
  const caregiverId = authData?.user?.id;
  if (!caregiverId) {
    console.error("No user logged in");
    return;
  }
  console.log('Caregiver UID:', caregiverId);

  // 2️⃣ Fetch patient_details
  const { data: pd, error: pdErr } = await supabase
    .from('patient_details')
    .select('*')
    .eq('caregiver_id', caregiverId)
    .maybeSingle();

  if (pdErr) {
    console.error('Error fetching patient details:', pdErr.message);
    return;
  }
  if (!pd) {
    console.log('No patient found for this caregiver');
    return;
  }
  console.log('Patient Details from DB:', pd);

  // 3️⃣ Fetch profile info
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('email, display_name')
    .eq('id', pd.patient_id)
    .maybeSingle();

  if (profileErr) {
    console.error('Error fetching patient profile:', profileErr.message);
    return;
  }
  if (!profile) {
    console.log('No profile found for patient');
    return;
  }
  console.log('Profile Data:', profile);

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
    fetchPatientByCaregiver();
  }, []);

  return (
    <PatientContext.Provider value={{ patient, setPatient, fetchPatientByCaregiver }}>
      {children}
    </PatientContext.Provider>
  );
};

export const usePatient = () => useContext(PatientContext);
