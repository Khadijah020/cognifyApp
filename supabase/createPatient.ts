// createPatient.ts (client, RN)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function provisionPatient(email: string, password: string, displayName?: string) {
  const session = (await supabase.auth.getSession()).data.session;
  if (!session) throw new Error('Not signed in');

  const res = await fetch(`${SUPABASE_URL}/functions/v1/provision_patient`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password, display_name: displayName }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to provision patient');
  return data.patient_id as string;
}
