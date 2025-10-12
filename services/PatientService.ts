// src/lib/supabase.ts or wherever your API functions are
import { Patient } from '../screens/AddPatientScreen'; // import type if needed
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
      id: p.id,
      fullName: p.display_name,
      dementiaStage: '',
      dob: '',
      address: '',
      emergencyContact: '',
      allergies: '',
      medications: '',
      conditions: '',
      careNotes: '',
      likes: '',
      avatarUri: null,
      createdAt: p.created_at || '',
    })) ?? [];

    return patients;
  } catch (err) {
    console.error('Error fetching patients:', err);
    return [];
  }
}

