// src/lib/supabase.ts or wherever your API functions are
import { Patient } from '../contexts/PatientContext'; // import type if needed
import { supabase } from '../src/lib/supabase'; // adjust path

export async function getPatients(): Promise<Patient[]> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, email, role')
      //.eq('role', 'patient');

    if (error) throw error;
    console.log('Raw data from Supabase:', data);


    const patients: Patient[] = data?.map((p: any) => ({
  patient_id: p.id,
  fullName: p.display_name || '',
  stage: '',              // you can fill later
  dob: '',
  address: '',
  emergency: '',
  allergies: '',
  meds: '',
  conditions: '',
  notes: '',
  likes: '',
  avatar: null,
  email: p.email || '',
})) ?? [];


    return patients;
  } catch (err) {
    console.error('Error fetching patients:', err);
    return [];
  }
}

