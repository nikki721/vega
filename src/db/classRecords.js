import { supabase } from '../supabaseClient.js';

export async function fetchClassRecords() {
  const { data, error } = await supabase
    .from('class_records')
    .select('*')
    .order('date', { ascending: true })
    .order('start_time', { ascending: true, nullsFirst: true });
  if (error) throw error;
  return data;
}

// scheduleEntryId is optional — present when this record was created by
// tapping a scheduled item, null when manually added. Never set automatically
// from the timetable side; only ever passed in explicitly by the caller.
export async function insertClassRecord({ subjectId, date, start, end, topic, attendance, scheduleEntryId = null }) {
  const { data, error } = await supabase
    .from('class_records')
    .insert({
      subject_id: subjectId,
      date,
      start_time: start || null,
      end_time: end || null,
      topic: topic || null,
      attendance: attendance || null,
      schedule_entry_id: scheduleEntryId,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateClassRecord(id, { subjectId, start, end, topic, attendance }) {
  const { data, error } = await supabase
    .from('class_records')
    .update({
      subject_id: subjectId,
      start_time: start || null,
      end_time: end || null,
      topic: topic || null,
      attendance: attendance || null,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteClassRecord(id) {
  const { error } = await supabase.from('class_records').delete().eq('id', id);
  if (error) throw error;
}
