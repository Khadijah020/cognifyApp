// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Works in Expo Go & builds. Fall back to legacy manifest if needed.
const extra =
  (Constants.expoConfig && (Constants.expoConfig as any).extra) ||
  (Constants.manifest && (Constants.manifest as any).extra) ||
  {};

const supabaseUrl: string | undefined = extra.supabaseUrl;
const supabaseAnonKey: string | undefined = extra.supabaseAnonKey;

// Helpful runtime guard (will throw a clear error if misconfigured)
if (!supabaseUrl || !supabaseAnonKey) {
  // Optional: log the first few chars to debug without leaking keys
  console.error('[Supabase config] Missing URL or Anon key', {
    urlPresent: !!supabaseUrl,
    keyPresent: !!supabaseAnonKey,
  });
  throw new Error(
    'Supabase URL/Anon key not found. Check app.json -> expo.extra and restart with `expo start -c`.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});
