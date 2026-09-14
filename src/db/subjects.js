import { supabase } from '../supabaseClient.js';

// user_id is never sent from the client — the column defaults to auth.uid()
// server-side, and RLS double-checks it on every write. This means a
// compromised or buggy client can't write data under someone else's id.

export async function fetchSubjects() {
  const { data, error } = await supabase
    .from('subjects')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function insertSubject({ name, code = null, fullName = null, color = null }) {
  const { data, error } = await supabase
    .from('subjects')
    .insert({ name, code, full_name: fullName, color })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSubject(id, { name, code = null, color = null }) {
  const { data, error } = await supabase
    .from('subjects')
    .update({ name, code, color })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSubject(id) {
  const { error } = await supabase.from('subjects').delete().eq('id', id);
  if (error) throw error;
}
