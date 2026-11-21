import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = createClient(url ?? 'http://localhost:54321', anonKey ?? 'missing-anon-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export type Role = 'patient' | 'kine';

export interface Profile {
  id: string;
  role: Role;
  full_name: string | null;
  email: string | null;
  locale: 'nl' | 'en';
}

export interface Practice {
  id: string;
  kine_id: string;
  name: string;
  invite_code: string;
}
