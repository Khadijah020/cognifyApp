// services/PatientService.ts
import { supabase } from '../src/lib/supabase';

export type Patient = {
  patient_id: string;
  fullName: string;
  email: string;
  stage?: string;
  dob?: string;
  address?: string;
  emergency?: string;
  allergies?: string;
  meds?: string;
  conditions?: string;
  notes?: string;
  likes?: string;
  avatar?: string | null;
};

// ✅ Get authenticated patient's ID
export async function getCurrentPatientId(): Promise<string | null> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('❌ No authenticated user:', userError);
      return null;
    }

    console.log('✅ User email:', user.email);

    // Fetch patient record by email
    const { data: patient, error } = await supabase
      .from('patients')
      .select('id')
      .eq('email', user.email)
      .single();

    if (error) {
      console.error('❌ Failed to fetch patient by email:', error);
      return null;
    }

    console.log('✅ Patient ID found:', patient?.id);
    return patient?.id || null;
  } catch (error) {
    console.error('❌ Error getting patient ID:', error);
    return null;
  }
}

// ✅ Get authenticated patient's full profile
export async function getAuthenticatedPatientProfile() {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('❌ No authenticated user');
      return null;
    }

    const { data: patient, error } = await supabase
      .from('patients')
      .select('*')
      .eq('email', user.email)
      .single();

    if (error) {
      console.error('❌ Failed to fetch patient profile:', error);
      return null;
    }

    console.log('✅ Patient profile loaded:', patient.id);
    return patient;
  } catch (error) {
    console.error('❌ Error getting authenticated patient:', error);
    return null;
  }
}

// ✅ Get all patients (for admin/caregiver views)
export async function getPatients(): Promise<Patient[]> {
  try {
    const { data, error } = await supabase
      .from('patients')
      .select('*');

    if (error) throw error;
    
    console.log('Raw patients data from Supabase:', data);

    const patients: Patient[] = data?.map((p: any) => ({
      patient_id: p.id,
      fullName: p.full_name || '',
      email: p.email || '',
      stage: p.stage || '',
      dob: p.date_of_birth || '',
      address: p.address || '',
      emergency: p.emergency_contact || '',
      allergies: p.allergies || '',
      meds: p.medications || '',
      conditions: p.conditions || '',
      notes: p.notes || '',
      likes: p.likes || '',
      avatar: p.avatar_url || null,
    })) ?? [];

    return patients;
  } catch (err) {
    console.error('Error fetching patients:', err);
    return [];
  }
}

// ✅ Update patient profile
export async function updatePatientProfile(patientId: string, updates: any) {
  try {
    const { data, error } = await supabase
      .from('patients')
      .update(updates)
      .eq('id', patientId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    
    console.log('✅ Patient profile updated:', data);
    return data;
  } catch (error) {
    console.error('❌ Failed to update patient profile:', error);
    throw error;
  }
}