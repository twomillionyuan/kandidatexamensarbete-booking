import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);
export const supabaseConfigError = hasSupabaseConfig
  ? ''
  : 'Missing Supabase config. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to GitHub repo secrets.';

if (!hasSupabaseConfig) {
  console.warn(supabaseConfigError);
}

export const supabase = hasSupabaseConfig ? createClient(supabaseUrl, supabaseAnonKey) : null;
