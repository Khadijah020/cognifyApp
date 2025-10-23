// services/caregiverService.ts
import { supabase } from '../src/lib/supabase'; // your supabase client

export async function getCurrentCaregiverProfile(caregiverId: string) {
  const { data, error } = await supabase
    .from('caregivers')
    .select('*')
    .eq('id', caregiverId)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

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