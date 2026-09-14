/* ============================================================
   MIGRATION — one-time move of the old localStorage diary into
   Supabase. Old data is NEVER deleted here, only read. The
   migration is only ever marked complete after every insert has
   succeeded, so a failure partway through can always be retried
   safely on next login without creating duplicates.

   NOT CURRENTLY CALLED: main.js does not invoke this in the present
   build — this is still development/sample data, so there's nothing
   to migrate. It's left in place, unused, for whenever real migration
   is needed again. Note its schedule shape (labConfig) predates the v2
   schema (lab_group) — it would need a small update to match before
   being wired back in.
   ============================================================ */

import { supabase } from './supabaseClient.js';

const LEGACY_STORAGE_KEY = 'academic-diary-v1';
const migratedFlagKey = (userId) => `academic-diary-migrated:${userId}`;

export function hasLegacyLocalData() {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return !!(parsed && (parsed.subjects || parsed.days));
  } catch {
    return false;
  }
}

export function isMigrationComplete(userId) {
  return localStorage.getItem(migratedFlagKey(userId)) === 'true';
}

function readLegacyData() {
  const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Legacy diary data was present but could not be parsed', e);
    return null;
  }
}

// Runs the migration if — and only if — there is legacy data AND it hasn't
// already been migrated for this user. Returns a small result object the
// caller can use to show a banner; never throws (errors are returned, not
// thrown, so the caller can decide how to surface them).
export async function runMigrationIfNeeded(user) {
  if (isMigrationComplete(user.id)) return { ran: false, reason: 'already-migrated' };

  const legacy = readLegacyData();
  if (!legacy) return { ran: false, reason: 'no-legacy-data' };

  try {
    const subjectIdMap = {}; // legacy local id -> new Supabase uuid

    // Fetch what may already exist from a previous partial attempt, so a
    // retry reuses/skips those rows instead of duplicating them. There is no
    // single all-or-nothing transaction across these inserts (the Supabase
    // JS client talks to PostgREST per-table), so this signature-based
    // dedupe is the safety net for retries after a failure partway through.
    const [{ data: existingSubjects }, { data: existingEntries }, { data: existingClasses }] = await Promise.all([
      supabase.from('subjects').select('*'),
      supabase.from('schedule_entries').select('id'),
      supabase.from('class_records').select('subject_id,date,start_time,end_time,topic,attendance'),
    ]);
    const existingSubjectKey = (s) => `${s.name}|${s.code || ''}`;
    const existingSubjectsByKey = new Map((existingSubjects || []).map((s) => [existingSubjectKey(s), s]));
    const existingClassSignature = (c) => `${c.subject_id || ''}|${c.date}|${c.start_time || ''}|${c.end_time || ''}|${c.topic || ''}|${c.attendance || ''}`;
    const existingClassSignatures = new Set((existingClasses || []).map(existingClassSignature));
    const scheduleEntriesAlreadyPresent = (existingEntries || []).length > 0;

    // 1. Subjects — reuse a matching one (by name + code) if it already exists
    const legacySubjects = Array.isArray(legacy.subjects) ? legacy.subjects : [];
    for (const s of legacySubjects) {
      const key = `${s.name}|${s.code || ''}`;
      const already = existingSubjectsByKey.get(key);
      if (already) {
        subjectIdMap[s.id] = already.id;
        continue;
      }
      const { data, error } = await supabase
        .from('subjects')
        .insert({ name: s.name, code: s.code || null, full_name: s.fullName || null, color: s.color || null })
        .select()
        .single();
      if (error) throw new Error(`Failed inserting subject "${s.name}": ${error.message}`);
      subjectIdMap[s.id] = data.id;
    }

    // 2. Schedule settings (single row) — only insert if one doesn't exist yet
    const sched = legacy.schedule || {};
    const { data: existingSettings } = await supabase.from('schedule_settings').select('id').maybeSingle();
    if (!existingSettings) {
      const { error: settingsError } = await supabase.from('schedule_settings').insert({
        lab_config: sched.labConfig || { 'tue-lab': null, 'thu-lab': null },
        aec_choice: sched.aecChoice || null,
        lateral_entry_student: !!sched.lateralEntryStudent,
        semester_start: sched.semesterStart || null,
        semester_end: sched.semesterEnd || null,
      });
      if (settingsError) throw new Error(`Failed inserting schedule settings: ${settingsError.message}`);
    }

    // 3. Schedule entries — skip entirely if this user already has any
    // (an all-or-nothing set inserted together, so "any" means "already done")
    const legacyEntries = Array.isArray(sched.entries) ? sched.entries : [];
    if (legacyEntries.length && !scheduleEntriesAlreadyPresent) {
      const rows = legacyEntries.map((e) => ({
        day_of_week: e.dayOfWeek,
        start_time: e.startTime || null,
        end_time: e.endTime || null,
        type: e.type,
        subject_id: e.subjectId ? subjectIdMap[e.subjectId] || null : null,
        title: e.title || null,
        slot_key: e.slotKey || null,
        configurable: !!e.configurable,
        for_lateral_entry: !!e.forLateralEntry,
        active: e.active !== false,
      }));
      const { error: entriesError } = await supabase.from('schedule_entries').insert(rows);
      if (entriesError) throw new Error(`Failed inserting schedule entries: ${entriesError.message}`);
    }

    // 4. Class records (walk every logged day) — skip any row that already
    // has an identical match remotely (see existingClassSignatures above)
    const days = legacy.days || {};
    for (const dateKey of Object.keys(days)) {
      const day = days[dateKey];
      const classes = Array.isArray(day.classes) ? day.classes : [];
      for (const c of classes) {
        const mappedSubjectId = c.subjectId ? subjectIdMap[c.subjectId] || null : null;
        const signature = `${mappedSubjectId || ''}|${dateKey}|${(c.time && c.time.start) || ''}|${(c.time && c.time.end) || ''}|${c.topic || ''}|${c.attendance || ''}`;
        if (existingClassSignatures.has(signature)) continue;
        const { error: classError } = await supabase.from('class_records').insert({
          subject_id: mappedSubjectId,
          date: dateKey,
          start_time: (c.time && c.time.start) || null,
          end_time: (c.time && c.time.end) || null,
          topic: c.topic || null,
          attendance: c.attendance || null,
          schedule_entry_id: null, // the legacy model didn't track this link explicitly
        });
        if (classError) throw new Error(`Failed inserting class record on ${dateKey}: ${classError.message}`);
      }
    }

    // 5. Daily notes (only non-empty ones)
    for (const dateKey of Object.keys(days)) {
      const note = days[dateKey].note;
      if (note && note.trim()) {
        const { error: noteError } = await supabase
          .from('daily_notes')
          .upsert({ date: dateKey, content: note }, { onConflict: 'user_id,date' });
        if (noteError) throw new Error(`Failed inserting note on ${dateKey}: ${noteError.message}`);
      }
    }

    // Only now — after every insert above has succeeded — mark it done.
    localStorage.setItem(migratedFlagKey(user.id), 'true');
    return {
      ran: true,
      success: true,
      counts: {
        subjects: legacySubjects.length,
        scheduleEntries: legacyEntries.length,
        classRecords: Object.values(days).reduce((n, d) => n + (d.classes ? d.classes.length : 0), 0),
      },
    };
  } catch (error) {
    // Deliberately do NOT set the flag and do NOT touch localStorage — the
    // next login will see legacy data + no flag and retry. The dedupe checks
    // above mean a retry reuses/skips rows already written in this attempt
    // rather than duplicating them.
    console.error('Migration failed:', error);
    return { ran: true, success: false, error: error.message };
  }
}
