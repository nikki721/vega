import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// main.js checks this and fails fast with an on-screen message instead of
// letting a broken (empty-string) client hang or fail confusingly deep
// inside a network call. A common cause: VITE_SUPABASE_URL/KEY were added
// to .env.local after `npm run dev` was already running — Vite only reads
// env files at server start, so the dev server needs a restart to pick up
// a newly-created or newly-edited .env.local.
export const isSupabaseConfigured = !!(supabaseUrl && supabaseKey);

if (!isSupabaseConfigured) {
  console.error(
    'Missing Supabase environment variables. Copy .env.example to .env.local, ' +
    'fill in VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, and restart ' +
    '`npm run dev` (Vite only reads .env files at server start).'
  );
}

// One client for the whole app — every module imports this same instance.
export const supabase = createClient(supabaseUrl || 'https://placeholder.invalid', supabaseKey || 'placeholder');
