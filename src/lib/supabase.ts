import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Log configuration status (safe for production as it doesn't log the actual keys)
if (import.meta.env.DEV || !supabaseUrl || !supabaseAnonKey) {
  console.log('[Supabase Config Check]', {
    urlPresent: !!supabaseUrl,
    keyPresent: !!supabaseAnonKey,
    apiUrl: import.meta.env.VITE_API_URL || 'Not set'
  });
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('CRITICAL: Supabase credentials missing. The app will not function correctly.');
}

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

// Default to placeholder to avoid crash on module initialization if env vars are missing
export const supabase = createClient(
  supabaseUrl || 'https://placeholder-project.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);
