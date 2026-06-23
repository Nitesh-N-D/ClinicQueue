import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Gracefully degrade if Supabase auth isn't configured — PIN login still works.
export const isGoogleAuthConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isGoogleAuthConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
