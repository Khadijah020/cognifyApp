// services/CaregiverService.ts
import { supabase } from '../src/lib/supabase';

/**
 * Get the currently logged-in caregiver's ID from the auth session
 */
export async function getCurrentCaregiversId(): Promise<string | null> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('❌ Error getting session:', error);
      return null;
    }
    
    if (!session?.user) {
      console.error('❌ No active session found');
      return null;
    }
    
    const caregiverId = session.user.id;
    console.log('✅ Current caregiver ID:', caregiverId);
    return caregiverId;
  } catch (error) {
    console.error('❌ Error in getCurrentCaregiversId:', error);
    return null;
  }
}

/**
 * Get the caregiver's profile data
 */
export async function getCurrentCaregiverProfile(caregiverId: string) {
  const { data, error } = await supabase
    .from('caregivers')
    .select('*')
    .eq('id', caregiverId)
    .single();
  
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Get the current logged-in caregiver's full profile
 */
export async function getMyProfile() {
  try {
    const caregiverId = await getCurrentCaregiversId();
    if (!caregiverId) {
      throw new Error('No authenticated caregiver found');
    }
    
    return await getCurrentCaregiverProfile(caregiverId);
  } catch (error) {
    console.error('❌ Error getting caregiver profile:', error);
    throw error;
  }
}

/**
 * Update caregiver profile
 */
export async function updateCaregiverProfile(caregiverId: string, updates: any) {
  const { data, error } = await supabase
    .from('caregivers')
    .update(updates)
    .eq('id', caregiverId)
    .select()
    .single();
  
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Get all patients linked to a specific caregiver
 * Since patients table has caregiver_id column
 */
export async function getCaregiverPatients(caregiverId: string) {
  try {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('caregiver_id', caregiverId);
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('❌ Error fetching caregiver patients:', error);
    throw error;
  }
}

/**
 * Get the first/primary patient for a caregiver
 */
export async function getPrimaryPatient(caregiverId: string) {
  try {
    const patients = await getCaregiverPatients(caregiverId);
    
    if (!patients || patients.length === 0) {
      console.log('⚠️ No patients found for caregiver:', caregiverId);
      return null;
    }
    
    // Return the first patient
    const primaryPatient = patients[0];
    console.log('✅ Primary patient:', primaryPatient.full_name);
    return primaryPatient;
  } catch (error) {
    console.error('❌ Error getting primary patient:', error);
    return null;
  }
}