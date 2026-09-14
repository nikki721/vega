import { supabase } from '../supabaseClient.js';

/* ---------- schedule_entries (the weekly timetable) ---------- */

export async function fetchScheduleEntries() {
  const { data, error } = await supabase
    .from('schedule_entries')
    .select('*')
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true, nullsFirst: true });
  if (error) throw error;
  return data;
}

// The ONLY place default data gets created. Calls a Postgres function that
// is safe to call on every single login: it's guarded by an advisory lock
// (so two tabs/a rapid refresh can't race each other) plus an existence
// check (a user who already has subjects is a no-op), and the database
// additionally enforces a unique (user_id, code) constraint on subjects as
// a second line of defense. See supabase/schema.sql for the full function.
export async function seedDefaultAcademicData() {
  const { error } = await supabase.rpc('seed_default_academic_data');
  if (error) throw error;
}

/* ---------- schedule_settings (one row per user) ---------- */

export async function fetchScheduleSettings() {
  const { data, error } = await supabase.from('schedule_settings').select('*').maybeSingle();
  if (error) throw error;
  return data; // null only if seeding hasn't run yet for some reason
}

// Defensive fallback only — seed_default_academic_data() already creates
// this row. Used by main.js purely to cover the edge case of an account
// that has subjects (so seeding no-ops) but somehow no settings row yet.
export async function insertScheduleSettings(settings) {
  const { data, error } = await supabase
    .from('schedule_settings')
    .insert({
      lab_group: settings.labGroup ?? null,
      aec_choice: settings.aecChoice ?? null,
      lateral_entry_student: !!settings.lateralEntryStudent,
      semester_start: settings.semesterStart ?? null,
      semester_end: settings.semesterEnd ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Partial update — pass only the camelCase fields that changed.
export async function updateScheduleSettings(id, patch) {
  const dbPatch = {};
  if ('labGroup' in patch) dbPatch.lab_group = patch.labGroup;
  if ('aecChoice' in patch) dbPatch.aec_choice = patch.aecChoice;
  if ('lateralEntryStudent' in patch) dbPatch.lateral_entry_student = patch.lateralEntryStudent;
  if ('semesterStart' in patch) dbPatch.semester_start = patch.semesterStart;
  if ('semesterEnd' in patch) dbPatch.semester_end = patch.semesterEnd;
  const { data, error } = await supabase
    .from('schedule_settings')
    .update(dbPatch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
