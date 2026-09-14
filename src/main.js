/* ============================================================
   MAIN — boot sequence
   LOADING -> CHECK SESSION -> (SESSION -> LOAD DATA -> DIARY)
                             -> (NO SESSION -> LOGIN)

   NOTE: localStorage migration is intentionally not run in this build —
   this is still development/sample data, so there is nothing to migrate.
   (src/migrate.js still exists, untouched, for whenever real migration
   is needed again — it's simply not called here.)

   ROBUSTNESS: every Supabase call in this file is wrapped in withTimeout()
   and has an explicit .catch()/try-catch path. Previously, the initial
   supabase.auth.getSession() call (and the data-loading call for an
   authenticated session) had neither — if either hung or rejected, the
   boot screen had no way to ever leave "OPENING YOUR DIARY…", for EITHER
   branch (logged in or not), because handleSessionChange() was simply
   never reached. See the diagnostic log lines below (all prefixed
   "[boot]") if you need to pinpoint a hang again — none of them print the
   Supabase URL/key, password, or any token.
   ============================================================ */
import { supabase, isSupabaseConfigured } from './supabaseClient.js';
import { showAuthScreen, hideAuthScreen } from './auth.js';
import { fetchSubjects } from './db/subjects.js';
import {
  fetchScheduleEntries, seedDefaultAcademicData,
  fetchScheduleSettings, insertScheduleSettings,
} from './db/schedule.js';
import { fetchClassRecords } from './db/classRecords.js';
import { fetchNotes } from './db/notes.js';
import {
  hydrateState, resetAppState, boot,
  mapSubjectFromDb, mapScheduleEntryFromDb, mapScheduleSettingsFromDb, buildDaysFromRows,
} from './app.js';

const bootScreen = document.getElementById('bootScreen');
const appEl = document.getElementById('app');

function showBoot(){
  bootScreen.style.display = 'flex';
  appEl.style.display = 'none';
}
function showApp(){
  bootScreen.style.display = 'none';
  hideAuthScreen();
  appEl.style.display = '';
}

// Races any promise against a timeout so a hung network call (or a hung
// RPC on the database side) can never keep the app stuck on the boot
// screen forever — it always eventually resolves into an error state
// the person can see and act on.
function withTimeout(promise, ms, label){
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out waiting for: ${label}`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Loads everything the app needs from Supabase and hands it to app.js.
// seedDefaultAcademicData() is called every time and is always safe to
// call — see supabase/schema.sql for why (advisory lock + existence check
// + a real unique constraint on subjects as a second line of defense).
async function loadAllDataAndHydrate(){
  console.log('[boot] seeding default academic data (idempotent)…');
  await withTimeout(seedDefaultAcademicData(), 15000, 'seed_default_academic_data()');
  console.log('[boot] seed step complete, fetching subjects/schedule/classes/notes…');

  let [subjectRows, entryRows, settingsRow, classRows, noteRows] = await withTimeout(
    Promise.all([fetchSubjects(), fetchScheduleEntries(), fetchScheduleSettings(), fetchClassRecords(), fetchNotes()]),
    15000,
    'fetching subjects/schedule entries/schedule settings/class records/notes'
  );
  console.log('[boot] fetched', {
    subjects: subjectRows.length, scheduleEntries: entryRows.length,
    hasSettings: !!settingsRow, classRecords: classRows.length, notes: noteRows.length,
  });

  // Defensive fallback only: seeding above already creates a settings row.
  // This only matters for an account that had subjects before a settings
  // row ever existed for it, which shouldn't happen in normal use.
  if(!settingsRow){
    console.log('[boot] no schedule_settings row found — creating a default one');
    settingsRow = await withTimeout(insertScheduleSettings({
      labGroup: null, aecChoice: null, lateralEntryStudent: false, semesterStart: null, semesterEnd: null,
    }), 10000, 'insertScheduleSettings() fallback');
  }

  const subjects = subjectRows.map(mapSubjectFromDb);
  const entries = entryRows.map(mapScheduleEntryFromDb);
  const settings = mapScheduleSettingsFromDb(settingsRow);
  const days = buildDaysFromRows(classRows, noteRows);

  hydrateState({
    subjects,
    days,
    schedule: {
      entries,
      labGroup: settings.labGroup,
      aecChoice: settings.aecChoice,
      lateralEntryStudent: settings.lateralEntryStudent,
      semesterStart: settings.semesterStart,
      semesterEnd: settings.semesterEnd,
      settingsId: settings.settingsId,
    },
  });
  console.log('[boot] state hydrated');
}

async function handleAuthenticated(){
  showBoot();
  try{
    await loadAllDataAndHydrate();
    boot();
    showApp();
    console.log('[boot] diary shown');
  }catch(err){
    // Whatever failed (timeout, network error, RPC error, RLS rejection,
    // etc.) — never leave the person staring at "OPENING YOUR DIARY…"
    // forever. Show the login screen with a plain-language explanation.
    console.error('[boot] failed to load diary data:', err?.message || err);
    showAuthScreen('Could not load your diary (' + (err?.message || 'unknown error') + '). Please check your connection and sign in again.');
  }
}

let currentUserId = undefined; // sentinel: distinct from a real "no session" (null), so the first transition always runs

function handleSessionChange(session){
  const newUserId = session?.user?.id || null;
  if(newUserId === currentUserId) return; // ignore duplicate events (e.g. token refresh) for the same user
  currentUserId = newUserId;
  if(session?.user){
    console.log('[boot] session found — loading diary');
    handleAuthenticated();
  } else {
    console.log('[boot] no session — showing login');
    resetAppState();
    showAuthScreen();
  }
}

supabase.auth.onAuthStateChange((_event, session) => {
  console.log('[boot] onAuthStateChange event:', _event, session ? '(session present)' : '(no session)');
  handleSessionChange(session);
});

// Explicit initial check — covers the case where onAuthStateChange's initial
// event fires before or after this resolves; handleSessionChange's
// same-user guard means whichever arrives first wins and the other is a
// no-op. This call is timed out and explicitly caught: previously it had
// neither, so a hang or a silent rejection here left BOTH the login screen
// and the diary unreachable — exactly the "stuck on OPENING YOUR DIARY"
// symptom, regardless of whether a session existed or not.
console.log('[boot] checking for an existing session…');
showBoot();

if(!isSupabaseConfigured){
  // Fail fast and clearly rather than let a broken client hang or time out
  // 10 seconds later on a call that was never going to succeed.
  console.error('[boot] Supabase is not configured — see console warning above.');
  showAuthScreen('Supabase is not configured. Check .env.local has VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY set, then restart the dev server.');
} else {
  withTimeout(supabase.auth.getSession(), 10000, 'auth.getSession()')
    .then(({ data: { session } }) => {
      console.log('[boot] initial session check resolved:', session ? '(session present)' : '(no session)');
      handleSessionChange(session);
    })
    .catch((err) => {
      console.error('[boot] initial session check failed:', err?.message || err);
      showAuthScreen('Could not reach Supabase to check your session (' + (err?.message || 'unknown error') + '). Please check your connection and try again.');
    });
}
