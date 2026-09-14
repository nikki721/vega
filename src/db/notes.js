import { supabase } from '../supabaseClient.js';

export async function fetchNotes() {
  const { data, error } = await supabase.from('daily_notes').select('*');
  if (error) throw error;
  return data;
}

// One row per (user, date) — upsert on that unique pair so saving a note
// twice for the same day updates it instead of creating a duplicate.
export async function upsertNote(date, content) {
  const { data, error } = await supabase
    .from('daily_notes')
    .upsert({ date, content }, { onConflict: 'user_id,date' })
    .select()
    .single();
  if (error) throw error;
  return data;
}
