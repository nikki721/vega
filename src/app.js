/* ============================================================
   ACADEMIC DIARY — application logic
   A digital record of what was taught, each day.
   ============================================================ */
import { supabase } from './supabaseClient.js';
import { insertSubject, updateSubject as dbUpdateSubject, deleteSubject as dbDeleteSubject } from './db/subjects.js';
import { insertClassRecord, updateClassRecord as dbUpdateClassRecord, deleteClassRecord as dbDeleteClassRecord } from './db/classRecords.js';
import { upsertNote } from './db/notes.js';
import { updateScheduleSettings as dbUpdateScheduleSettings } from './db/schedule.js';

/* ---------- Icons (inline SVG strings, feather-style) ---------- */
const ICONS = {
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="1"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/></svg>',
  archive: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8M10 12h4"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
  chevLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
  chevRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  hash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/></svg>',
  satellite: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m13 7 5 5-3 3-5-5 3-3z"/><path d="m8 15-3.5 3.5M3 21l1.5-1.5M18 3l-2 2M21 6l-2 2"/></svg>',
  sparkle: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2c.6 3.6 1.4 6 2.8 7.6C16.2 11.2 18.4 12 22 12.6c-3.6.6-5.8 1.4-7.2 3-1.4 1.6-2.2 4-2.8 7.4-.6-3.4-1.4-5.8-2.8-7.4-1.4-1.6-3.6-2.4-7.2-3 3.6-.6 5.8-1.4 7.2-3C10.6 8 11.4 5.6 12 2z"/></svg>',
  inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
};
function icon(name){ return ICONS[name] || ''; }

/* ---------- Subject color palette — warm, magical, not neon ---------- */
const PALETTE = [
  { key:'gold',        value:'#f0b86e' },
  { key:'rose',        value:'#e8879c' },
  { key:'sage',        value:'#93c6a0' },
  { key:'periwinkle',  value:'#93a8e0' },
  { key:'amber',       value:'#e0954a' },
  { key:'lavender',    value:'#bb92d8' },
  { key:'teal-dusk',   value:'#6fb3ae' },
];

/* ---------- State ---------- */
// The app no longer owns persistence itself — main.js loads data from
// Supabase and calls hydrateState() once, then calls boot() to render.
// State shape is unchanged from the localStorage version so none of the
// render code below needs to change.
let state = { subjects: [], days: {}, schedule: null };

export function hydrateState(newState) {
  state = newState;
}

// Used on logout so no diary data lingers in memory after signing out.
export function resetAppState() {
  state = { subjects: [], days: {}, schedule: null };
}

function uid(){ return Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4); }

/* ---------- Row <-> app-state mapping (Supabase uses snake_case) ---------- */
export function mapSubjectFromDb(row){
  return { id: row.id, name: row.name, code: row.code || '', fullName: row.full_name || '', color: row.color };
}
export function mapScheduleEntryFromDb(row){
  return {
    id: row.id, dayOfWeek: row.day_of_week, startTime: row.start_time, endTime: row.end_time,
    type: row.type, subjectId: row.subject_id, title: row.title, slotKey: row.slot_key,
    configurable: row.configurable, forLateralEntry: row.for_lateral_entry, active: row.active,
  };
}
export function mapScheduleSettingsFromDb(row){
  return {
    settingsId: row.id, labGroup: row.lab_group || null,
    aecChoice: row.aec_choice, lateralEntryStudent: !!row.lateral_entry_student,
    semesterStart: row.semester_start, semesterEnd: row.semester_end,
  };
}
export function mapClassRecordFromDb(row){
  return {
    id: row.id, subjectId: row.subject_id, time: { start: row.start_time || '', end: row.end_time || '' },
    topic: row.topic || '', attendance: row.attendance || null, scheduleEntryId: row.schedule_entry_id,
  };
}
export function buildDaysFromRows(classRows, noteRows){
  const days = {};
  classRows.forEach(r => {
    const day = days[r.date] || (days[r.date] = { classes: [], note: '' });
    day.classes.push(mapClassRecordFromDb(r));
  });
  noteRows.forEach(r => {
    const day = days[r.date] || (days[r.date] = { classes: [], note: '' });
    day.note = r.content || '';
  });
  return days;
}

/* ---------- Sync status pill (top-right "ALL SAVED" indicator) ---------- */
// Reflects real Supabase persistence now, not a localStorage write that
// always succeeds. Updated directly in the DOM (not via a full render())
// so an in-flight save never disrupts whatever the person is doing —
// e.g. typing into the notes textarea.
let syncStatus = 'saved'; // 'saved' | 'saving' | 'error'
export function setSyncStatus(status){
  syncStatus = status;
  const pill = document.querySelector('.status-pill');
  if(!pill) return;
  pill.classList.remove('is-saving', 'is-error');
  if(status === 'saving'){ pill.classList.add('is-saving'); pill.innerHTML = `<span class="blip"></span> SAVING…`; }
  else if(status === 'error'){ pill.classList.add('is-error'); pill.innerHTML = `<span class="blip"></span> SAVE FAILED`; }
  else { pill.innerHTML = `<span class="blip"></span> ALL SAVED`; }
}
function currentSyncStatusClass(){
  if(syncStatus === 'saving') return 'is-saving';
  if(syncStatus === 'error') return 'is-error';
  return '';
}
function currentSyncStatusLabel(){
  if(syncStatus === 'saving') return 'SAVING…';
  if(syncStatus === 'error') return 'SAVE FAILED';
  return 'ALL SAVED';
}

/* ---------- Date helpers ---------- */
function pad(n){ return String(n).padStart(2,'0'); }
function toKey(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function keyToDate(key){ const [y,m,d] = key.split('-').map(Number); return new Date(y, m-1, d); }
function addDays(key, delta){ const d = keyToDate(key); d.setDate(d.getDate()+delta); return toKey(d); }
function todayKey(){ return toKey(new Date()); }
const DOW = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
const DOW_FULL = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
const MONTHS = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatFullDate(key){
  const d = keyToDate(key);
  return `${DOW_FULL[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function formatShortDate(key){
  const d = keyToDate(key);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/* ---------- Day / class data access ---------- */
function getDay(key){
  return state.days[key] || { classes: [], note: '' };
}
function ensureDay(key){
  if(!state.days[key]) state.days[key] = { classes: [], note: '' };
  return state.days[key];
}
function loggedDateKeysSorted(){
  return Object.keys(state.days)
    .filter(k => state.days[k].classes && state.days[k].classes.length > 0)
    .sort();
}
function dayNumberFor(key){
  const logged = loggedDateKeysSorted();
  const idx = logged.indexOf(key);
  if(idx !== -1) return idx + 1;
  return null;
}
function getSubject(id){
  return state.subjects.find(s => s.id === id);
}
function nextPaletteColor(){
  const used = state.subjects.map(s => s.color);
  const free = PALETTE.find(p => !used.includes(p.value));
  return (free || PALETTE[state.subjects.length % PALETTE.length]).value;
}

/* ---------- Attendance ---------- */
// Easy to change later.
const ATTENDANCE_WARNING_THRESHOLD = 75;

// Flattened list of every class ever logged, each tagged with its date key.
function allClasses(){
  const list = [];
  Object.keys(state.days).forEach(k => {
    (state.days[k].classes || []).forEach(c => list.push(Object.assign({ date:k }, c)));
  });
  return list;
}

// Core reusable calculation — unmarked classes are excluded from the denominator.
function attendanceStatsFor(classes){
  let attended = 0, absent = 0;
  classes.forEach(c => {
    if(c.attendance === 'present') attended++;
    else if(c.attendance === 'absent') absent++;
    // anything else (undefined/null/'') is "not marked" and is not counted
  });
  const marked = attended + absent;
  const percent = marked > 0 ? Math.round((attended / marked) * 100) : null;
  return { attended, absent, marked, percent };
}
function getSubjectAttendance(subjectId){
  return attendanceStatsFor(allClasses().filter(c => c.subjectId === subjectId));
}
function getOverallAttendance(){
  return attendanceStatsFor(allClasses());
}
function isLowAttendance(percent){
  return percent !== null && percent < ATTENDANCE_WARNING_THRESHOLD;
}
function subjectAttendanceHistory(subjectId){
  return allClasses()
    .filter(c => c.subjectId === subjectId)
    .sort((a,b) => (b.date + (b.time?.start||'')).localeCompare(a.date + (a.time?.start||'')));
}
function attendanceDisplay(att){
  if(att === 'present') return { text:'PRESENT', icon:'check', color:'var(--green)' };
  if(att === 'absent') return { text:'ABSENT', icon:'x', color:'var(--red)' };
  return { text:'NOT MARKED', icon:'clock', color:'var(--text-dimmer)' };
}

/* ============================================================
   WEEKLY SCHEDULE / TIMETABLE
   The schedule is separate from the diary: it describes what is
   SUPPOSED to happen each weekday. The diary's "classes" arrays
   (above) remain the record of what actually happened. The two
   are connected only by lookup (subjectId + startTime match) —
   never by auto-creating diary records from schedule entries.

   The default timetable itself is no longer defined here — it lives in a
   single place, the seed_default_academic_data() Postgres function (see
   supabase/schema.sql), so there is exactly one source of truth instead of
   a duplicate JS copy that could drift out of sync with the database.
   ============================================================ */

// The two lab days are a matched pair: whichever lab you don't get on
// Tuesday, you get on Thursday. One setting (D1/D2) drives both, rather
// than two independent per-day dropdowns that could describe an impossible
// combination.
const LAB_INFO = {
  ds: { code:'25CSLK32', label:'Data Structures Lab', subjectCode:'25CSK32' },
  dl: { code:'25CSLK33', label:'Digital Logic Lab', subjectCode:'25CSK33' },
};
const LAB_SLOT_GROUPS = {
  'tue-lab': { D1:'dl', D2:'ds' },
  'thu-lab': { D1:'ds', D2:'dl' },
};

const AEC_OPTIONS = {
  '25CSE361': 'Exploratory Data Analysis',
  '25CSE362': 'Project Management with Git',
  '25CSE363': 'Web Design Technologies',
};

function scheduleEntriesForDow(dow){
  return state.schedule.entries.filter(e => e.dayOfWeek === dow);
}

function isWithinSemester(dateKey){
  const { semesterStart, semesterEnd } = state.schedule;
  if(semesterStart && dateKey < semesterStart) return false;
  if(semesterEnd && dateKey > semesterEnd) return false;
  return true;
}

// Turns a raw schedule entry into display-ready info, or null if the entry
// should be hidden entirely (e.g. the lateral-entry slot for a normal user).
function resolveScheduleEntry(e){
  if(e.forLateralEntry && !state.schedule.lateralEntryStudent) return null;

  if(e.type === 'core'){
    if(e.subjectId){
      const s = getSubject(e.subjectId);
      return { title: s ? s.name : (e.title || 'Unknown subject'), code: s ? s.code : (e.code || ''), subjectId: e.subjectId, color: s ? s.color : 'var(--text-dimmer)', typeLabel:'CORE SUBJECT', configured:true };
    }
    // e.g. the lateral-entry Mathematics slot — a real course with no
    // subjects-page record, since it isn't one of the five core subjects
    return { title: e.title || 'Subject', code: e.code || '', subjectId:null, color:'var(--text-dimmer)', typeLabel:'CORE SUBJECT', configured:true };
  }
  if(e.type === 'lab'){
    const group = state.schedule.labGroup; // 'D1' | 'D2' | null
    const mapping = LAB_SLOT_GROUPS[e.slotKey];
    const which = (group && mapping) ? mapping[group] : null; // 'ds' | 'dl' | null
    if(which){
      const info = LAB_INFO[which];
      const s = state.subjects.find(su => su.code === info.subjectCode);
      return { title: info.label, code: info.code, subjectId: s ? s.id : null, color: s ? s.color : 'var(--periwinkle)', typeLabel:'LAB', configured:true };
    }
    return { title:'Laboratory Block', code:'', subjectId:null, color:'var(--text-dimmer)', typeLabel:'LAB', configured:false, needsConfig:'lab' };
  }
  if(e.type === 'aec'){
    const choice = state.schedule.aecChoice;
    if(choice && AEC_OPTIONS[choice]){
      return { title: AEC_OPTIONS[choice], code: choice, subjectId:null, color:'var(--purple)', typeLabel:'AEC', configured:true };
    }
    return { title:'AEC', code:'', subjectId:null, color:'var(--text-dimmer)', typeLabel:'AEC', configured:false, needsConfig:'aec' };
  }
  if(e.type === 'project'){
    return { title: e.title || 'Community Project', code: e.code || '', subjectId:null, color:'var(--green)', typeLabel:'PROJECT', configured:true };
  }
  if(e.type === 'institutional'){
    return { title: e.title || 'Institutional Activity', code: e.code || '', subjectId:null, color:'var(--teal-dusk, var(--green))', typeLabel:'INSTITUTIONAL', configured:true };
  }
  // 'activity' — Mentoring, Coaching, Library, LPSS
  return { title: e.title || 'Activity', code: e.code || '', subjectId:null, color:'var(--purple)', typeLabel:'ACTIVITY', configured:true };
}

// All schedule items for a given calendar date, resolved and time-sorted.
// Empty outside the configured semester range (when one is configured).
function scheduleForDate(dateKey){
  if((state.schedule.semesterStart || state.schedule.semesterEnd) && !isWithinSemester(dateKey)) return [];
  const dow = keyToDate(dateKey).getDay();
  return scheduleEntriesForDow(dow)
    .map(e => { const r = resolveScheduleEntry(e); return r ? Object.assign({ entry:e }, r) : null; })
    .filter(Boolean)
    .sort((a,b) => (a.entry.startTime||'99:99').localeCompare(b.entry.startTime||'99:99'));
}

// A scheduled item counts as logged when a class record exists for that date
// with the same subject and the same start time — deliberately simple, and
// never automatic: logging still requires the user to save a class record.
function findLoggedRecordForScheduleItem(dateKey, item){
  if(!item.subjectId) return null;
  const day = getDay(dateKey);
  return day.classes.find(c => c.subjectId === item.subjectId && c.time && c.time.start === item.entry.startTime) || null;
}

function timeDiffMinutes(start, end){
  const [sh,sm] = start.split(':').map(Number);
  const [eh,em] = end.split(':').map(Number);
  return (eh*60+em) - (sh*60+sm);
}
function formatMinutes(mins){
  const h = Math.floor(mins/60), m = mins%60;
  if(h && m) return `${h}h ${m}m`;
  if(h) return `${h}h`;
  return `${m}m`;
}

// Saturday is a real timetabled day (NCMC + the optional lateral-entry
// slot), so it's the sixth column of the same grid — not a separate panel.
const SCHEDULE_DAYS = [
  { dow:1, label:'MONDAY' }, { dow:2, label:'TUESDAY' }, { dow:3, label:'WEDNESDAY' },
  { dow:4, label:'THURSDAY' }, { dow:5, label:'FRIDAY' }, { dow:6, label:'SATURDAY' },
];
// 55-minute periods are kept as 55 minutes, not rounded up to an hour.
// Break rows are real rows (thinner, full-width) rather than implied gaps,
// and — critically — a lab or Community Project block spanning across a
// break row simply covers that cell for its column; see the occupancy-based
// gap fill in renderScheduleGridCells for how that's handled.
const SCHEDULE_ROWS = [
  { start:'08:40', end:'09:35', type:'period' },
  { start:'09:35', end:'10:30', type:'period' },
  { start:'10:30', end:'10:40', type:'break', label:'SHORT BREAK' },
  { start:'10:40', end:'11:40', type:'period' },
  { start:'11:40', end:'12:40', type:'period' },
  { start:'12:40', end:'13:30', type:'break', label:'LUNCH BREAK' },
  { start:'13:30', end:'14:30', type:'period' },
  { start:'14:30', end:'15:30', type:'period' },
  { start:'15:30', end:'16:30', type:'period' },
];

// Total weekly scheduled minutes + session count for one subject, derived
// from the timetable rather than hardcoded anywhere in the UI.
function scheduledLoadForSubject(subjectId){
  let minutes = 0, count = 0;
  SCHEDULE_DAYS.forEach(d => {
    scheduleEntriesForDow(d.dow).forEach(e => {
      if(!e.startTime || !e.endTime) return;
      const r = resolveScheduleEntry(e);
      if(r && r.subjectId === subjectId){ minutes += timeDiffMinutes(e.startTime, e.endTime); count++; }
    });
  });
  return { minutes, count };
}

function computeSemesterOverview(){
  let theoryMinutes = 0, labMinutes = 0;
  const coreSubjIds = new Set();
  SCHEDULE_DAYS.forEach(d => {
    scheduleEntriesForDow(d.dow).forEach(e => {
      if(!e.startTime || !e.endTime) return;
      const r = resolveScheduleEntry(e);
      if(!r) return;
      if(e.type === 'core' && r.subjectId){ theoryMinutes += timeDiffMinutes(e.startTime, e.endTime); coreSubjIds.add(r.subjectId); }
      else if(e.type === 'lab'){ labMinutes += timeDiffMinutes(e.startTime, e.endTime); if(r.subjectId) coreSubjIds.add(r.subjectId); }
    });
  });
  return { coreSubjectsCount: coreSubjIds.size || 5, theoryMinutes, labMinutes, academicMinutes: theoryMinutes + labMinutes };
}

/* ---------- App state (UI) ---------- */
const ui = {
  view: 'diary',           // diary | calendar | schedule | subjects | archive
  currentDate: todayKey(),
  calMonth: new Date().getMonth(),
  calYear: new Date().getFullYear(),
  modal: null,             // { mode: 'add'|'edit', classId }
  editingSubjectId: null,
  addingSubject: false,
};

/* ============================================================
   RENDER
   ============================================================ */
const root = document.getElementById('app');

function render(){
  root.innerHTML = `
    ${renderHeader()}
    <div class="hud-shell">
      ${renderLeftRail()}
      <div class="center-col">${renderCenter()}</div>
      ${renderRightRail()}
    </div>
    ${renderFooter()}
    ${ui.modal ? renderModal() : ''}
  `;
  bindEvents();
}

/* ---------- Header ---------- */
function renderHeader(){
  const cur = keyToDate(ui.currentDate);
  const strip = [];
  for(let i=-3;i<=3;i++){
    const k = addDays(ui.currentDate, i);
    const d = keyToDate(k);
    const isActive = k === ui.currentDate;
    const hasEntries = getDay(k).classes.length > 0;
    strip.push(`
      <div class="ds-cell ${isActive?'active':''} ${hasEntries?'has-entries':''}" data-date="${k}">
        <span class="dnum">${d.getDate()}</span>
        <span class="ddot"></span>
      </div>
    `);
  }
  const now = new Date();
  return `
  <header class="topbar">
    <div class="brand">
      <div class="brand-mark">${icon('sparkle')}</div>
      <div class="brand-text">
        <div class="title">Vega</div>
        <div class="subtitle">log · learn · remember</div>
      </div>
    </div>
    <div class="date-strip" id="dateStrip">${strip.join('')}</div>
    <div class="header-right">
      <div class="tagline">every class, on record</div>
      <div class="clock-box">
        <div class="time" id="liveClock">${formatClock(now)}</div>
        <div class="status-pill ${currentSyncStatusClass()}"><span class="blip"></span> ${currentSyncStatusLabel()}</div>
        <button type="button" class="logout-btn" data-act="logout">LOG OUT</button>
      </div>
    </div>
  </header>`;
}
function formatClock(d){
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/* ---------- Left rail ---------- */
function renderLeftRail(){
  const items = [
    { key:'diary', icon:'book', label:'DIARY', sub:'DAILY LOG' },
    { key:'calendar', icon:'calendar', label:'CALENDAR', sub:'VIEW DAYS' },
    { key:'schedule', icon:'grid', label:'SCHEDULE', sub:'TIMETABLE' },
    { key:'subjects', icon:'layers', label:'SUBJECTS', sub:'MANAGE' },
    { key:'archive', icon:'archive', label:'ARCHIVE', sub:'PAST ENTRIES' },
  ];
  const logged = loggedDateKeysSorted();
  const totalClasses = logged.reduce((sum,k)=> sum + getDay(k).classes.length, 0);
  const overallAttSide = getOverallAttendance();
  return `
  <div class="left-rail">
    <div class="panel nav-panel">
      <span class="panel-corner tl"></span>
      ${items.map(it => `
        <div class="nav-item ${ui.view===it.key?'active':''}" data-nav="${it.key}">
          ${icon(it.icon)}
          <div class="ntext">
            <div class="nlabel">${it.label}</div>
            <div class="nsub">${it.sub}</div>
          </div>
        </div>
      `).join('')}
    </div>
    <div class="panel radar-panel">
      <div class="radar"><div class="radar-sweep"></div></div>
    </div>
    <div class="panel side-status">
      <div class="side-status-row"><span>DAYS LOGGED</span><span class="val">${logged.length}</span></div>
      <div class="side-status-row"><span>TOTAL CLASSES</span><span class="val">${totalClasses}</span></div>
      <div class="side-status-row"><span>SUBJECTS</span><span class="val">${state.subjects.length}</span></div>
      <div class="side-status-row"><span>ATTENDANCE</span><span class="val" style="${overallAttSide.percent!==null && isLowAttendance(overallAttSide.percent) ? 'color:var(--red);' : ''}">${overallAttSide.percent===null ? '—' : overallAttSide.percent+'%'}</span></div>
    </div>
  </div>`;
}

/* ---------- Center column ---------- */
function renderCenter(){
  if(ui.view === 'diary') return renderDiaryView();
  if(ui.view === 'calendar') return renderCalendarView();
  if(ui.view === 'schedule') return renderScheduleView();
  if(ui.view === 'subjects') return renderSubjectsView();
  if(ui.view === 'archive') return renderArchiveView();
  return '';
}

function renderDiaryView(){
  const key = ui.currentDate;
  const day = getDay(key);
  const dn = dayNumberFor(key);
  const classes = [...day.classes].sort((a,b) => (a.time?.start||'').localeCompare(b.time?.start||''));

  return `
  <div class="panel day-header fade-in">
    <span class="panel-corner tl"></span>
    <div class="day-header-top">
      <button class="nav-btn" data-act="prev-day">${icon('chevLeft')} PREV DAY</button>
      <button class="datepick-btn" data-act="open-datepick" title="Jump to date">${icon('calendar')}</button>
      <input type="date" id="hiddenDateInput" value="${key}">
      <button class="nav-btn ${key===todayKey()?'today-btn':''}" data-act="goto-today">TODAY</button>
      <button class="nav-btn" data-act="next-day">NEXT DAY ${icon('chevRight')}</button>
    </div>
    <div class="day-quote">"Same classrooms. A clearer record."</div>
    <div class="day-full-date">${formatFullDate(key)}</div>
    <div class="day-title-row">
      <div class="day-num">${dn ? `DAY <span>${dn}</span>` : `<span style="color:var(--text-dimmer);font-size:22px;">NEW ENTRY</span>`}</div>
    </div>
  </div>

  ${renderTodaysSchedulePanel(key)}

  <div class="panel fade-in">
    <span class="panel-corner tl"></span>
    <div class="panel-head">
      <div class="panel-head-title"><span class="dot"></span> CLASSES RECORDED</div>
      <span>${classes.length} ${classes.length===1?'ENTRY':'ENTRIES'}</span>
    </div>
    <div class="panel-body">
      <div class="class-list">
        ${classes.length ? classes.map(c => renderClassEntry(c)).join('') : renderEmptyDay()}
        <div class="add-class-strip" data-act="open-add-class">${icon('plus')} ADD CLASS</div>
      </div>
    </div>
  </div>`;
}

// Shows what the timetable says is happening today — kept visually distinct
// from "CLASSES RECORDED" above, since scheduled and logged are two
// different concepts that must never be conflated.
function renderTodaysSchedulePanel(dateKey){
  if((state.schedule.semesterStart || state.schedule.semesterEnd) && !isWithinSemester(dateKey)){
    return `
    <div class="panel fade-in">
      <span class="panel-corner tl"></span>
      <div class="panel-head"><div class="panel-head-title"><span class="dot"></span> TODAY'S SCHEDULE</div></div>
      <div class="panel-body"><div class="legend-empty">OUTSIDE THE CONFIGURED SEMESTER DATES</div></div>
    </div>`;
  }
  const items = scheduleForDate(dateKey);
  if(!items.length) return '';
  const loggableCount = items.filter(it => it.subjectId).length;
  return `
  <div class="panel fade-in">
    <span class="panel-corner tl"></span>
    <div class="panel-head">
      <div class="panel-head-title"><span class="dot"></span> TODAY'S SCHEDULE</div>
      <span>${loggableCount} CLASS${loggableCount===1?'':'ES'}</span>
    </div>
    <div class="panel-body">
      <div class="sched-today-list">
        ${items.map(it => renderScheduleTodayRow(it, dateKey)).join('')}
      </div>
    </div>
  </div>`;
}

function renderScheduleTodayRow(it, dateKey){
  const isLoggable = !!it.subjectId;
  const logged = isLoggable ? findLoggedRecordForScheduleItem(dateKey, it) : null;
  const timeStr = it.entry.startTime || '—';
  let statusHtml, act = '';
  if(!isLoggable){
    statusHtml = `<span class="sti-status sti-activity">${it.typeLabel}</span>`;
  } else if(logged){
    const ad = attendanceDisplay(logged.attendance);
    statusHtml = `<span class="sti-status sti-logged">${icon('check')} LOGGED${logged.attendance ? ` · ${ad.text}` : ''}</span>`;
    act = `data-act="edit-logged-schedule" data-id="${logged.id}"`;
  } else {
    statusHtml = `<span class="sti-status sti-scheduled">○ SCHEDULED</span>`;
    act = `data-act="quick-fill-schedule" data-subject="${it.subjectId}" data-start="${it.entry.startTime||''}" data-end="${it.entry.endTime||''}"`;
  }
  return `
  <div class="sti-row ${isLoggable?'sti-clickable':''}" ${act} style="--entry-color:${it.color}">
    <span class="sti-time">${timeStr}</span>
    <span class="sti-title">${escapeHtml(it.title)}${it.code?` <span class="sti-code">${escapeHtml(it.code)}</span>`:''}</span>
    ${statusHtml}
  </div>`;
}

// A compact Present/Absent toggle, reused by Quick Add and the Add/Edit modal.
function renderAttendanceToggle(prefix, current){
  const val = current || '';
  return `
  <div class="qa-field">
    <label>ATTENDANCE</label>
    <div class="att-toggle">
      <button type="button" class="att-btn att-present ${val==='present'?'selected':''}" data-val="present">${icon('check')} PRESENT</button>
      <button type="button" class="att-btn att-absent ${val==='absent'?'selected':''}" data-val="absent">${icon('x')} ABSENT</button>
    </div>
    <input type="hidden" id="${prefix}Attendance" value="${val}">
    ${!val ? `<div class="att-unmarked-hint">Not marked yet</div>` : ''}
  </div>`;
}

function renderEmptyDay(){
  return `
  <div class="empty-day">
    ${icon('inbox')}
    <div>NO CLASSES LOGGED FOR THIS DAY</div>
  </div>`;
}

function renderClassEntry(c){
  const subj = getSubject(c.subjectId) || { name:'Unknown Subject', code:'', color:'var(--text-dimmer)' };
  const timeHtml = c.time && c.time.start
    ? `<span class="t-start">${c.time.start}</span>${c.time.end ? `<br>${c.time.end}` : ''}`
    : `<span style="color:var(--text-dimmer);">--:--</span>`;
  const topics = (c.topic || '').split('\n').map(t => t.trim()).filter(Boolean);
  const ad = attendanceDisplay(c.attendance);
  return `
  <div class="class-entry" style="--subj-color:${subj.color}">
    <div class="class-time">${timeHtml}</div>
    <div class="class-icon">${icon('hash')}</div>
    <div class="class-main">
      <div class="subj-name">${escapeHtml(subj.name)}</div>
      ${subj.code ? `<div class="subj-code">${escapeHtml(subj.code)}</div>` : ''}
      ${topics.length ? `
        <div class="topic-label">TOPIC COVERED</div>
        <ul class="topic-list">${topics.map(t=>`<li>${escapeHtml(t)}</li>`).join('')}</ul>
      ` : ''}
      <div class="topic-label">ATTENDANCE</div>
      <div class="att-status" style="color:${ad.color}">${icon(ad.icon)} ${ad.text}</div>
    </div>
    <div class="class-actions">
      <button class="icon-btn" data-act="edit-class" data-id="${c.id}">${icon('edit')} EDIT</button>
      <button class="icon-btn danger" data-act="delete-class" data-id="${c.id}">${icon('trash')} DELETE</button>
    </div>
  </div>`;
}

/* ---------- Calendar view ---------- */
function renderCalendarView(){
  const y = ui.calYear, m = ui.calMonth;
  const first = new Date(y, m, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(y, m+1, 0).getDate();
  let cells = '';
  for(let i=0;i<startDow;i++) cells += `<div class="mc-day empty"></div>`;
  for(let d=1; d<=daysInMonth; d++){
    const key = `${y}-${pad(m+1)}-${pad(d)}`;
    const isToday = key === todayKey();
    const isSelected = key === ui.currentDate;
    const has = getDay(key).classes.length > 0;
    cells += `<div class="mc-day ${isToday?'today':''} ${isSelected?'selected':''}" data-date="${key}">
      <span>${d}</span>${has?'<span class="mdot"></span>':''}
    </div>`;
  }
  return `
  <div class="panel fade-in">
    <span class="panel-corner tl"></span>
    <div class="view-heading">
      <div>
        <h2>CALENDAR</h2>
        <p>SELECT A DATE TO OPEN ITS DIARY ENTRY</p>
      </div>
      <div class="mc-nav" style="gap:8px;">
        <button class="mc-navbtn" data-act="cal-prev-month" style="width:30px;height:30px;">${icon('chevLeft')}</button>
        <div style="font-family:var(--font-display);font-weight:700;font-size:13px;letter-spacing:0.2px;padding:4px 10px;color:var(--yellow);">${MONTHS[m]} ${y}</div>
        <button class="mc-navbtn" data-act="cal-next-month" style="width:30px;height:30px;">${icon('chevRight')}</button>
      </div>
    </div>
    <div class="panel-body">
      <div class="mc-grid" style="gap:6px;">
        ${DOW.map(d=>`<div class="mc-dow">${d}</div>`).join('')}
      </div>
      <div class="mc-grid" style="margin-top:4px;gap:6px;">
        ${cells}
      </div>
    </div>
  </div>`;
}

/* ---------- Schedule view (weekly timetable) ---------- */
function renderScheduleView(){
  return `
  <div class="panel fade-in">
    <span class="panel-corner tl"></span>
    <div class="view-heading">
      <div>
        <h2>WEEKLY SCHEDULE</h2>
        <p>YOUR SEMESTER TIMETABLE — TAP QUICK ADD TO LOG A CLASS FROM HERE</p>
      </div>
    </div>
    <div class="panel-body">
      <div class="sched-grid-wrap">
        <div class="sched-grid">${renderScheduleGridCells()}</div>
      </div>
      ${!state.schedule.lateralEntryStudent ? `<div class="save-hint" style="margin-top:12px;">LATERAL-ENTRY MATHEMATICS (SATURDAY) IS HIDDEN — ENABLE IT IN SCHEDULE SETTINGS BELOW IF IT APPLIES TO YOU</div>` : ''}
    </div>
  </div>

  ${renderSemesterOverviewPanel()}
  ${renderScheduleSettingsPanel()}
  `;
}

function renderScheduleGridCells(){
  const colForDow = {1:2,2:3,3:4,4:5,5:6,6:7};
  const scheduleTime = time => typeof time === 'string' ? time.slice(0, 5) : time;
  let html = `<div class="sched-cell sched-corner" style="grid-column:1;grid-row:1;"></div>`;
  SCHEDULE_DAYS.forEach(d => {
    html += `<div class="sched-cell sched-daylabel" style="grid-column:${colForDow[d.dow]};grid-row:1;">${d.label}</div>`;
  });
  SCHEDULE_ROWS.forEach((r, i) => {
    const label = r.type === 'break' ? r.label : `${r.start}<br>${r.end}`;
    html += `<div class="sched-cell sched-timelabel${r.type==='break'?' sched-timelabel-break':''}" style="grid-column:1;grid-row:${i+2};">${label}</div>`;
  });

  // Occupancy is tracked so that a block spanning across a break row (the
  // Tue/Thu labs run straight through the 10:30–10:40 short break) simply
  // covers that cell for its column — the break filler below only appears
  // where nothing else already occupies that row.
  const occupied = new Set();
  SCHEDULE_DAYS.forEach(d => {
    const col = colForDow[d.dow];
    scheduleEntriesForDow(d.dow).forEach(e => {
      if(!e.startTime || !e.endTime) return;
      const resolved = resolveScheduleEntry(e);
      if(!resolved) return;
      const startTime = scheduleTime(e.startTime);
      const endTime = scheduleTime(e.endTime);
      const startIdx = SCHEDULE_ROWS.findIndex(r => r.start === startTime);
      const endIdx = SCHEDULE_ROWS.findIndex(r => r.end === endTime);
      if(startIdx === -1 || endIdx === -1) return;
      const span = (endIdx - startIdx) + 1;
      const rowStart = startIdx + 2;
      for(let rr = rowStart; rr < rowStart + span; rr++) occupied.add(col+'-'+rr);
      const cfgBtn = resolved.configured === false
        ? `<button type="button" class="sched-config-btn" data-act="${resolved.needsConfig==='lab'?'configure-lab':'configure-aec'}">CONFIGURE</button>`
        : '';
      html += `
      <div class="sched-cell sched-entry sched-type-${e.type}${resolved.configured===false?' sched-unconfigured':''}" style="grid-column:${col};grid-row:${rowStart} / span ${span};--entry-color:${resolved.color};">
        <div class="sched-entry-title">${escapeHtml(resolved.title)}</div>
        ${resolved.code ? `<div class="sched-entry-code">${escapeHtml(resolved.code)}</div>` : ''}
        <div class="sched-entry-type">${resolved.typeLabel}</div>
        ${cfgBtn}
      </div>`;
    });
  });

  SCHEDULE_DAYS.forEach(d => {
    const col = colForDow[d.dow];
    SCHEDULE_ROWS.forEach((r, i) => {
      const rowNum = i + 2;
      if(occupied.has(col+'-'+rowNum)) return;
      if(r.type === 'break'){
        html += `<div class="sched-cell sched-break" style="grid-column:${col};grid-row:${rowNum};">${r.label}</div>`;
      } else {
        html += `<div class="sched-cell sched-empty" style="grid-column:${col};grid-row:${rowNum};">FREE</div>`;
      }
    });
  });
  return html;
}

function renderSemesterOverviewPanel(){
  const o = computeSemesterOverview();
  return `
  <div class="panel fade-in">
    <span class="panel-corner tl"></span>
    <div class="panel-head"><div class="panel-head-title"><span class="dot"></span> SEMESTER OVERVIEW</div></div>
    <div class="panel-body">
      <div class="sem-overview-grid">
        <div class="sem-stat"><div class="sem-num">${o.coreSubjectsCount}</div><div class="sem-label">CORE SUBJECTS</div></div>
        <div class="sem-stat"><div class="sem-num">${formatMinutes(o.theoryMinutes)}</div><div class="sem-label">THEORY / WEEK</div></div>
        <div class="sem-stat"><div class="sem-num">${formatMinutes(o.labMinutes)}</div><div class="sem-label">LABS / WEEK</div></div>
        <div class="sem-stat"><div class="sem-num">${formatMinutes(o.academicMinutes)}</div><div class="sem-label">ACADEMIC HOURS / WEEK</div></div>
      </div>
    </div>
  </div>`;
}

function renderScheduleSettingsPanel(){
  const group = state.schedule.labGroup;
  const aec = state.schedule.aecChoice;
  return `
  <div class="panel fade-in" id="schedSettings">
    <span class="panel-corner tl"></span>
    <div class="panel-head"><div class="panel-head-title"><span class="dot"></span> SCHEDULE SETTINGS</div></div>
    <div class="panel-body">
      <div class="qa-field">
        <label>LAB GROUP (TUESDAY + THURSDAY)</label>
        <select class="qa-select" id="labGroupSelect">
          <option value="">Not configured</option>
          <option value="D1" ${group==='D1'?'selected':''}>D1 — Digital Logic Lab on Tue, Data Structures Lab on Thu</option>
          <option value="D2" ${group==='D2'?'selected':''}>D2 — Data Structures Lab on Tue, Digital Logic Lab on Thu</option>
        </select>
      </div>
      <div class="qa-field">
        <label>AEC (WEDNESDAY)</label>
        <select class="qa-select" id="aecConfig">
          <option value="">Not configured</option>
          <option value="25CSE361" ${aec==='25CSE361'?'selected':''}>Exploratory Data Analysis (25CSE361)</option>
          <option value="25CSE362" ${aec==='25CSE362'?'selected':''}>Project Management with Git (25CSE362)</option>
          <option value="25CSE363" ${aec==='25CSE363'?'selected':''}>Web Design Technologies (25CSE363)</option>
        </select>
      </div>
      <div class="qa-field">
        <label>SEMESTER DATES (OPTIONAL)</label>
        <div class="qa-row2">
          <input class="qa-input" type="date" id="semStart" value="${state.schedule.semesterStart||''}">
          <input class="qa-input" type="date" id="semEnd" value="${state.schedule.semesterEnd||''}">
        </div>
      </div>
      <div class="qa-field sched-lateral-field">
        <input type="checkbox" id="lateralToggle" ${state.schedule.lateralEntryStudent?'checked':''}>
        <label for="lateralToggle">I am a lateral-entry student — show Basic Applied Mathematics-I (25DMAT31) on Saturday</label>
      </div>
    </div>
  </div>`;
}

/* ---------- Subjects view ---------- */
function renderSubjectsView(){
  return `
  <div class="panel fade-in">
    <span class="panel-corner tl"></span>
    <div class="view-heading">
      <div>
        <h2>SUBJECTS</h2>
        <p>MANAGE THE SUBJECTS YOU LOG CLASSES AGAINST</p>
      </div>
      <button class="btn-ghost" data-act="new-subject" style="display:flex;align-items:center;gap:6px;">${icon('plus')} NEW SUBJECT</button>
    </div>
    <div class="panel-body">
      ${ui.addingSubject ? renderSubjectForm(null) : ''}
      ${state.subjects.map(s => ui.editingSubjectId === s.id ? renderSubjectForm(s) : renderSubjectCard(s)).join('') || renderEmptySubjects()}
    </div>
  </div>`;
}
function renderEmptySubjects(){
  return `<div class="empty-state">${icon('layers')}<div>NO SUBJECTS YET</div></div>`;
}
function renderSubjectCard(s){
  const count = loggedDateKeysSorted().reduce((n,k)=> n + getDay(k).classes.filter(c=>c.subjectId===s.id).length, 0);
  const att = getSubjectAttendance(s.id);
  const low = isLowAttendance(att.percent);
  const barColor = low ? 'var(--red)' : 'var(--yellow)';
  const load = scheduledLoadForSubject(s.id);
  return `
  <div class="subject-card" style="--subj-color:${s.color}">
    <div class="sc-icon">${icon('hash')}</div>
    <div class="sc-info">
      <div class="sc-name" data-act="open-subject-detail" data-id="${s.id}">${escapeHtml(s.name)}</div>
      <div class="sc-code">${s.code ? escapeHtml(s.code)+' · ' : ''}${count} CLASS${count===1?'':'ES'} LOGGED</div>
      ${load.count > 0 ? `<div class="sc-scheduled">${formatMinutes(load.minutes)} / week · ${load.count} scheduled session${load.count===1?'':'s'}</div>` : ''}
      <div class="sc-attendance">
        ${att.percent===null
          ? `<span class="att-none">NO ATTENDANCE MARKED</span>`
          : `<span class="att-pct" style="color:${barColor}">${att.percent}% ATTENDANCE</span><span class="att-frac">${att.attended}/${att.marked}</span>${low?`<span class="att-warning">LOW ATTENDANCE</span>`:''}`
        }
      </div>
      ${att.percent!==null ? `<div class="progress-track sc-progress"><div class="progress-fill" style="width:${att.percent}%;background:${barColor}"></div></div>` : ''}
    </div>
    <div class="sc-actions">
      <button class="icon-btn" data-act="edit-subject" data-id="${s.id}">${icon('edit')}</button>
      <button class="icon-btn danger" data-act="delete-subject" data-id="${s.id}">${icon('trash')}</button>
    </div>
  </div>`;
}
function renderSubjectForm(s){
  const color = s ? s.color : nextPaletteColor();
  return `
  <div class="panel" style="margin-bottom:14px;background:var(--bg-raised);">
    <div class="panel-body">
      <div class="qa-field">
        <label>SUBJECT NAME</label>
        <input class="qa-input" id="subjName" placeholder="e.g. Mathematics" value="${s ? escapeAttr(s.name) : ''}">
      </div>
      <div class="qa-field">
        <label>CODE (OPTIONAL)</label>
        <input class="qa-input" id="subjCode" placeholder="e.g. MA201" value="${s ? escapeAttr(s.code||'') : ''}">
      </div>
      <div class="qa-field">
        <label>ACCENT COLOR</label>
        <div class="swatch-row" id="swatchRow">
          ${PALETTE.map(p => `<div class="swatch ${p.value===color?'selected':''}" data-color="${p.value}" style="background:${p.value};color:${p.value};"></div>`).join('')}
        </div>
        <input type="hidden" id="subjColor" value="${color}">
      </div>
      <div style="display:flex;gap:10px;margin-top:14px;">
        <button class="btn-primary" data-act="save-subject" data-id="${s ? s.id : ''}" style="flex:1;">${icon('check')} ${s ? 'SAVE CHANGES' : 'ADD SUBJECT'}</button>
        <button class="btn-ghost" data-act="cancel-subject">CANCEL</button>
      </div>
    </div>
  </div>`;
}

/* ---------- Archive view ---------- */
function renderArchiveView(){
  const logged = loggedDateKeysSorted().slice().reverse();
  return `
  <div class="panel fade-in">
    <span class="panel-corner tl"></span>
    <div class="view-heading">
      <div>
        <h2>ARCHIVE</h2>
        <p>${logged.length} PAST ${logged.length===1?'ENTRY':'ENTRIES'} ON RECORD</p>
      </div>
    </div>
    <div class="panel-body">
      ${logged.length ? logged.map(k => renderArchiveItem(k)).join('') : `<div class="empty-state">${icon('archive')}<div>NOTHING LOGGED YET</div></div>`}
    </div>
  </div>`;
}
function renderArchiveItem(key){
  const day = getDay(key);
  const dn = dayNumberFor(key);
  const dots = day.classes.slice(0,8).map(c => {
    const s = getSubject(c.subjectId);
    return `<span class="archive-dot" style="background:${s?s.color:'var(--text-dimmer)'}"></span>`;
  }).join('');
  return `
  <div class="archive-item" data-date="${key}">
    <div class="archive-daynum">${dn ?? '—'}<small>DAY</small></div>
    <div class="archive-info">
      <div class="archive-date">${formatShortDate(key)} · ${DOW_FULL[keyToDate(key).getDay()].slice(0,3)}</div>
      <div class="archive-dots">${dots}</div>
    </div>
    <div class="archive-count">${day.classes.length} CLASS${day.classes.length===1?'':'ES'}</div>
  </div>`;
}

/* ---------- Right rail ---------- */
function renderRightRail(){
  if(ui.view !== 'diary'){
    return `<div class="right-rail">${renderMiniCalendarPanel()}${renderArchiveShortcutPanel()}</div>`;
  }
  const key = ui.currentDate;
  const day = getDay(key);
  const dn = dayNumberFor(key);

  return `
  <div class="right-rail">
    <div class="panel fade-in">
      <span class="panel-corner tl"></span>
      <div class="panel-head"><div class="panel-head-title"><span class="dot"></span> DAY OVERVIEW</div></div>
      <div class="panel-body">
        <div class="stat-row"><span class="slabel">CLASSES SCHEDULED</span><span class="sval">${scheduleForDate(key).filter(it=>it.subjectId).length}</span></div>
        <div class="stat-row"><span class="slabel">CLASSES LOGGED</span><span class="sval">${day.classes.length}</span></div>
        <div class="stat-row"><span class="slabel">DAY NUMBER</span><span class="sval">${dn ?? '—'}</span></div>
        <div class="stat-row"><span class="slabel">DATE</span><span class="sval" style="font-family:var(--font-body);font-size:12px;">${formatShortDate(key)}</span></div>
      </div>
    </div>

    ${renderAttendancePanel()}

    <div class="panel fade-in">
      <span class="panel-corner tl"></span>
      <div class="panel-head"><div class="panel-head-title"><span class="dot"></span> QUICK ADD</div></div>
      <div class="panel-body">
        ${renderQuickAddScheduleChips(key)}
        <div class="qa-field">
          <label>SUBJECT</label>
          <select class="qa-select" id="qaSubject">
            <option value="">Select subject</option>
            ${state.subjects.map(s=>`<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}
          </select>
        </div>
        <div class="qa-field">
          <label>TIME (OPTIONAL)</label>
          <div class="qa-row2">
            <input class="qa-input" type="time" id="qaStart">
            <input class="qa-input" type="time" id="qaEnd">
          </div>
        </div>
        <div class="qa-field">
          <label>TOPIC / WHAT WAS TAUGHT</label>
          <textarea class="qa-textarea" id="qaTopic" placeholder="Write the topic here..."></textarea>
        </div>
        ${renderAttendanceToggle('qa', 'present')}
        <button class="btn-primary" data-act="quick-add">${icon('plus')} ADD CLASS</button>
      </div>
    </div>

    <div class="panel fade-in">
      <span class="panel-corner tl"></span>
      <div class="panel-head"><div class="panel-head-title"><span class="dot"></span> TODAY'S CLASSES</div></div>
      <div class="panel-body">${renderDonut(day)}</div>
    </div>

    ${renderMiniCalendarPanel()}

    <div class="panel fade-in">
      <span class="panel-corner tl"></span>
      <div class="panel-head"><div class="panel-head-title"><span class="dot"></span> NOTES <span style="opacity:.5;font-weight:400;">(OPTIONAL)</span></div></div>
      <div class="panel-body">
        <textarea class="notes-area" id="dayNote" placeholder="Any additional note for today...">${escapeHtml(day.note||'')}</textarea>
        <div class="save-hint">${icon('check')} AUTO-SAVED</div>
      </div>
    </div>
  </div>`;
}

// Lets Quick Add be filled from today's timetable in one tap, without
// removing the manual subject selector that follows it.
function renderQuickAddScheduleChips(dateKey){
  const items = scheduleForDate(dateKey).filter(it => it.subjectId);
  if(!items.length) return '';
  return `
  <div class="qa-field">
    <label>TODAY'S SCHEDULE</label>
    <div class="qa-sched-chips">
      ${items.map(it => {
        const logged = findLoggedRecordForScheduleItem(dateKey, it);
        return logged
          ? `<div class="qa-sched-chip logged">${icon('check')} ${it.entry.startTime||''} ${escapeHtml(it.title)}</div>`
          : `<button type="button" class="qa-sched-chip" data-act="quick-fill-schedule" data-subject="${it.subjectId}" data-start="${it.entry.startTime||''}" data-end="${it.entry.endTime||''}">${it.entry.startTime||''} ${escapeHtml(it.title)}</button>`;
      }).join('')}
    </div>
  </div>`;
}

function renderAttendancePanel(){
  const rows = state.subjects.map(s => ({ s, att: getSubjectAttendance(s.id) })).filter(r => r.att.percent !== null);
  return `
  <div class="panel fade-in">
    <span class="panel-corner tl"></span>
    <div class="panel-head"><div class="panel-head-title"><span class="dot"></span> ATTENDANCE</div></div>
    <div class="panel-body">
      ${rows.length ? rows.map(({s,att}) => {
        const low = isLowAttendance(att.percent);
        return `
        <div class="stat-row">
          <span class="slabel" style="color:${s.color};">${escapeHtml(s.name)}</span>
          <span class="sval" style="color:${low?'var(--red)':'var(--yellow)'};display:inline-flex;align-items:center;gap:7px;">${att.percent}%${low?`<span class="att-warning">LOW</span>`:''}</span>
        </div>`;
      }).join('') : `<div class="legend-empty">NO ATTENDANCE MARKED YET</div>`}
    </div>
  </div>`;
}

function renderDonut(day){
  const dateKey = ui.currentDate;
  const bySubj = {};
  day.classes.forEach(c => { bySubj[c.subjectId] = (bySubj[c.subjectId]||0) + 1; });
  const entries = Object.keys(bySubj).map(id => ({ subj: getSubject(id), count: bySubj[id] })).filter(e=>e.subj);

  let donutHtml;
  if(!entries.length){
    donutHtml = `<div class="legend-empty">NO CLASSES LOGGED YET TODAY</div>`;
  } else {
    const total = entries.reduce((s,e)=>s+e.count,0);
    let acc = 0;
    const stops = entries.map(e => {
      const start = (acc/total)*360; acc += e.count;
      const end = (acc/total)*360;
      return `${e.subj.color} ${start}deg ${end}deg`;
    }).join(', ');
    donutHtml = `
    <div class="donut-wrap">
      <div class="donut" style="background:conic-gradient(${stops});">
        <div class="donut-hole"><div class="dnum">${total}</div><div class="dsub">CLASSES</div></div>
      </div>
      <div class="legend">
        ${entries.map(e => `
          <div class="legend-item"><span class="legend-dot" style="background:${e.subj.color}"></span>${escapeHtml(e.subj.name)} · ${e.count}</div>
        `).join('')}
      </div>
    </div>`;
  }

  // Scheduled-vs-logged awareness, alongside the (unchanged) logged donut above.
  const schedItems = scheduleForDate(dateKey).filter(it => it.subjectId);
  const schedHtml = schedItems.length ? `
    <div class="sched-mini-list">
      ${schedItems.map(it => {
        const logged = findLoggedRecordForScheduleItem(dateKey, it);
        return `
        <div class="smi-row">
          <span class="smi-dot" style="background:${logged?'var(--green)':'var(--text-dimmer)'}"></span>
          <span class="smi-title">${escapeHtml(it.title)}</span>
          <span class="smi-status">${logged ? 'LOGGED' + (logged.attendance?` · ${attendanceDisplay(logged.attendance).text}`:'') : 'SCHEDULED'}</span>
        </div>`;
      }).join('')}
    </div>` : '';

  return donutHtml + schedHtml;
}

function renderMiniCalendarPanel(){
  const y = ui.calYear, m = ui.calMonth;
  const first = new Date(y, m, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(y, m+1, 0).getDate();
  let cells = '';
  for(let i=0;i<startDow;i++) cells += `<div class="mc-day empty"></div>`;
  for(let d=1; d<=daysInMonth; d++){
    const key = `${y}-${pad(m+1)}-${pad(d)}`;
    const isToday = key === todayKey();
    const isSelected = key === ui.currentDate;
    const has = getDay(key).classes.length > 0;
    cells += `<div class="mc-day ${isToday?'today':''} ${isSelected?'selected':''}" data-date="${key}"><span>${d}</span>${has?'<span class="mdot"></span>':''}</div>`;
  }
  return `
  <div class="panel fade-in">
    <span class="panel-corner tl"></span>
    <div class="panel-head"><div class="panel-head-title"><span class="dot"></span> CALENDAR</div></div>
    <div class="panel-body">
      <div class="mc-head">
        <div class="mc-title">${MONTHS_SHORT[m]} ${y}</div>
        <div class="mc-nav">
          <button class="mc-navbtn" data-act="cal-prev-month">${icon('chevLeft')}</button>
          <button class="mc-navbtn" data-act="cal-next-month">${icon('chevRight')}</button>
        </div>
      </div>
      <div class="mc-grid">${DOW.map(d=>`<div class="mc-dow">${d[0]}</div>`).join('')}</div>
      <div class="mc-grid" style="margin-top:3px;">${cells}</div>
    </div>
  </div>`;
}

function renderArchiveShortcutPanel(){
  const logged = loggedDateKeysSorted();
  const totalClasses = logged.reduce((sum,k)=> sum + getDay(k).classes.length, 0);
  const overallAtt = getOverallAttendance();
  const low = isLowAttendance(overallAtt.percent);
  return `
  <div class="panel fade-in">
    <span class="panel-corner tl"></span>
    <div class="panel-head"><div class="panel-head-title"><span class="dot"></span> RECORD SUMMARY</div></div>
    <div class="panel-body">
      <div class="stat-row"><span class="slabel">DAYS LOGGED</span><span class="sval">${logged.length}</span></div>
      <div class="stat-row"><span class="slabel">TOTAL CLASSES</span><span class="sval">${totalClasses}</span></div>
      <div class="stat-row"><span class="slabel">SUBJECTS</span><span class="sval">${state.subjects.length}</span></div>
      <div class="stat-row"><span class="slabel">ATTENDANCE</span><span class="sval" style="${low?'color:var(--red);':''}">${overallAtt.percent===null?'—':overallAtt.percent+'%'}</span></div>
    </div>
  </div>`;
}

/* ---------- Footer ---------- */
function renderFooter(){
  return `
  <footer class="statusbar">
    <div class="sb-left">${icon('sparkle')} LOGGING A BETTER RECORD OF EVERY LECTURE.</div>
    <div class="sb-metrics">
      <div class="sb-metric">SYNC <span class="sb-bar"><span class="sb-bar-fill" style="width:100%;background:var(--green);"></span></span></div>
      <div class="sb-metric">STORAGE <span class="sb-bar"><span class="sb-bar-fill" style="width:${Math.min(90, 20 + loggedDateKeysSorted().length*2)}%;background:var(--yellow);"></span></span></div>
      <div>v1.0.0</div>
    </div>
  </footer>`;
}

/* ---------- Modal (add/edit class, or subject attendance detail) ---------- */
function renderModal(){
  if(ui.modal.mode === 'subject-detail') return renderSubjectDetailModal(ui.modal.subjectId);

  const isEdit = ui.modal.mode === 'edit';
  let cls = { subjectId:'', time:{start:'',end:''}, topic:'', attendance:'present' };
  if(isEdit){
    const day = getDay(ui.currentDate);
    cls = day.classes.find(c => c.id === ui.modal.classId) || cls;
  }
  return `
  <div class="modal-overlay" id="modalOverlay">
    <div class="modal-box">
      <div class="modal-head">
        <div class="mtitle">${isEdit ? 'EDIT CLASS' : 'ADD CLASS'}</div>
        <button class="modal-close" data-act="close-modal">${icon('x')}</button>
      </div>
      <div class="modal-body">
        <div class="qa-field">
          <label>SUBJECT</label>
          <select class="qa-select" id="mSubject">
            <option value="">Select subject</option>
            ${state.subjects.map(s=>`<option value="${s.id}" ${s.id===cls.subjectId?'selected':''}>${escapeHtml(s.name)}</option>`).join('')}
          </select>
        </div>
        <div class="qa-field">
          <label>TIME (OPTIONAL)</label>
          <div class="qa-row2">
            <input class="qa-input" type="time" id="mStart" value="${cls.time?.start||''}">
            <input class="qa-input" type="time" id="mEnd" value="${cls.time?.end||''}">
          </div>
        </div>
        <div class="qa-field">
          <label>WHAT WAS TAUGHT?</label>
          <textarea class="qa-textarea" id="mTopic" style="min-height:90px;" placeholder="One point per line...">${escapeHtml(cls.topic||'')}</textarea>
        </div>
        ${renderAttendanceToggle('m', isEdit ? (cls.attendance || '') : 'present')}
      </div>
      <div class="modal-foot">
        <button class="btn-primary" data-act="save-modal-class" data-mode="${ui.modal.mode}" data-id="${isEdit?cls.id:''}">${icon('check')} ${isEdit?'SAVE CHANGES':'ADD CLASS'}</button>
      </div>
    </div>
  </div>`;
}

function renderSubjectDetailModal(subjectId){
  const s = getSubject(subjectId);
  if(!s){
    return `
    <div class="modal-overlay" id="modalOverlay">
      <div class="modal-box">
        <div class="modal-head"><div class="mtitle">SUBJECT NOT FOUND</div><button class="modal-close" data-act="close-modal">${icon('x')}</button></div>
      </div>
    </div>`;
  }
  const att = getSubjectAttendance(subjectId);
  const low = isLowAttendance(att.percent);
  const barColor = low ? 'var(--red)' : 'var(--yellow)';
  const history = subjectAttendanceHistory(subjectId).slice(0, 30);
  return `
  <div class="modal-overlay" id="modalOverlay">
    <div class="modal-box" style="max-width:480px;">
      <div class="modal-head">
        <div class="mtitle">${escapeHtml(s.name)}${s.code?` · ${escapeHtml(s.code)}`:''}</div>
        <button class="modal-close" data-act="close-modal">${icon('x')}</button>
      </div>
      <div class="modal-body">
        <div class="panel-head-title" style="margin-bottom:10px;"><span class="dot" style="background:${s.color};box-shadow:0 0 7px ${s.color};"></span> ATTENDANCE</div>
        ${att.percent===null ? `
          <div class="legend-empty">NO ATTENDANCE MARKED YET</div>
        ` : `
          <div class="stat-row"><span class="slabel">ATTENDED</span><span class="sval">${att.attended}</span></div>
          <div class="stat-row"><span class="slabel">ABSENT</span><span class="sval">${att.absent}</span></div>
          <div class="stat-row"><span class="slabel">MARKED CLASSES</span><span class="sval">${att.marked}</span></div>
          <div class="progress-track" style="margin:12px 0 10px;"><div class="progress-fill" style="width:${att.percent}%;background:${barColor}"></div></div>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-family:var(--font-display);font-weight:700;font-size:24px;color:${barColor};">${att.percent}%</span>
            ${low?`<span class="att-warning">BELOW ${ATTENDANCE_WARNING_THRESHOLD}%</span>`:''}
          </div>
        `}
        ${history.length ? `
          <div class="topic-label" style="margin-top:20px;">CLASS HISTORY</div>
          <div class="att-history">
            ${history.map(c => {
              const ad = attendanceDisplay(c.attendance);
              const topics = (c.topic||'').split('\n').map(t=>t.trim()).filter(Boolean);
              return `
              <div class="att-history-item">
                <div class="att-history-date">${formatShortDate(c.date)}</div>
                <div class="att-history-status" style="color:${ad.color}">${icon(ad.icon)} ${ad.text}</div>
                <div class="att-history-topic">${topics[0] ? escapeHtml(topics[0]) : '—'}</div>
              </div>`;
            }).join('')}
          </div>
        ` : ''}
      </div>
    </div>
  </div>`;
}

/* ---------- Utils ---------- */
function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function escapeAttr(str){ return escapeHtml(str); }
export function showToast(msg){
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `${icon('check')} ${msg}`;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 2000);
}

/* ============================================================
   EVENTS
   ============================================================ */
function bindEvents(){
  // Logout — sign out of Supabase; main.js's auth listener takes it from here
  const logoutBtn = root.querySelector('[data-act="logout"]');
  if(logoutBtn) logoutBtn.addEventListener('click', async () => {
    logoutBtn.disabled = true;
    await supabase.auth.signOut();
  });

  // Nav
  root.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => { ui.view = el.dataset.nav; ui.editingSubjectId=null; ui.addingSubject=false; render(); });
  });

  // Date strip
  root.querySelectorAll('#dateStrip .ds-cell').forEach(el => {
    el.addEventListener('click', () => { ui.currentDate = el.dataset.date; ui.view='diary'; render(); });
  });

  // Diary nav
  const prevBtn = root.querySelector('[data-act="prev-day"]');
  if(prevBtn) prevBtn.addEventListener('click', () => { ui.currentDate = addDays(ui.currentDate, -1); render(); });
  const nextBtn = root.querySelector('[data-act="next-day"]');
  if(nextBtn) nextBtn.addEventListener('click', () => { ui.currentDate = addDays(ui.currentDate, 1); render(); });
  const todayBtn = root.querySelector('[data-act="goto-today"]');
  if(todayBtn) todayBtn.addEventListener('click', () => { ui.currentDate = todayKey(); render(); });
  const dpBtn = root.querySelector('[data-act="open-datepick"]');
  if(dpBtn) dpBtn.addEventListener('click', () => {
    const input = root.querySelector('#hiddenDateInput');
    if(input.showPicker) input.showPicker(); else input.click();
  });
  const hiddenDate = root.querySelector('#hiddenDateInput');
  if(hiddenDate) hiddenDate.addEventListener('change', (e) => { ui.currentDate = e.target.value; render(); });

  // Add / edit / delete class
  const addBtn = root.querySelector('[data-act="open-add-class"]');
  if(addBtn) addBtn.addEventListener('click', () => { ui.modal = { mode:'add' }; render(); });
  root.querySelectorAll('[data-act="edit-class"]').forEach(el => {
    el.addEventListener('click', () => { ui.modal = { mode:'edit', classId: el.dataset.id }; render(); });
  });
  root.querySelectorAll('[data-act="delete-class"]').forEach(el => {
    el.addEventListener('click', async () => {
      if(!confirm('Delete this class entry?')) return;
      const id = el.dataset.id;
      setSyncStatus('saving');
      try{
        await dbDeleteClassRecord(id);
        const day = ensureDay(ui.currentDate);
        day.classes = day.classes.filter(c => c.id !== id);
        setSyncStatus('saved');
        render();
      }catch(err){
        console.error(err);
        setSyncStatus('error');
        showToast('COULD NOT DELETE — CHECK YOUR CONNECTION');
      }
    });
  });

  // Attendance toggle (Present/Absent) — used in Quick Add and the modal
  root.querySelectorAll('.att-toggle').forEach(group => {
    const hidden = group.parentElement.querySelector('input[type="hidden"]');
    group.querySelectorAll('.att-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        group.querySelectorAll('.att-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        if(hidden) hidden.value = btn.dataset.val;
        const hint = group.parentElement.querySelector('.att-unmarked-hint');
        if(hint) hint.remove();
      });
    });
  });

  // Subject attendance detail
  root.querySelectorAll('[data-act="open-subject-detail"]').forEach(el => {
    el.addEventListener('click', () => { ui.modal = { mode:'subject-detail', subjectId: el.dataset.id }; render(); });
  });

  // Schedule -> Quick Add: fill in subject + time from a scheduled (not yet logged) item
  root.querySelectorAll('[data-act="quick-fill-schedule"]').forEach(el => {
    el.addEventListener('click', () => {
      const subjSel = root.querySelector('#qaSubject');
      const startInp = root.querySelector('#qaStart');
      const endInp = root.querySelector('#qaEnd');
      if(subjSel) subjSel.value = el.dataset.subject;
      if(startInp) startInp.value = el.dataset.start || '';
      if(endInp) endInp.value = el.dataset.end || '';
      const topic = root.querySelector('#qaTopic');
      if(topic) topic.focus();
      showToast('SCHEDULE FILLED IN — ADD TOPIC & SAVE');
    });
  });
  // Schedule -> already logged: open that class record for editing
  root.querySelectorAll('[data-act="edit-logged-schedule"]').forEach(el => {
    el.addEventListener('click', () => { ui.modal = { mode:'edit', classId: el.dataset.id }; render(); });
  });

  // Schedule settings (lab config, AEC config, semester dates, lateral entry)
  const patchScheduleSettings = async (patch, applyLocally) => {
    setSyncStatus('saving');
    try{
      await dbUpdateScheduleSettings(state.schedule.settingsId, patch);
      applyLocally();
      setSyncStatus('saved');
      render();
    }catch(err){
      console.error(err);
      setSyncStatus('error');
      showToast('SETTING COULD NOT BE SAVED');
    }
  };
  const labGroupSelect = root.querySelector('#labGroupSelect');
  if(labGroupSelect) labGroupSelect.addEventListener('change', (e) => {
    const v = e.target.value || null;
    patchScheduleSettings({ labGroup: v }, () => { state.schedule.labGroup = v; });
  });
  const aecSel = root.querySelector('#aecConfig');
  if(aecSel) aecSel.addEventListener('change', (e) => {
    const v = e.target.value || null;
    patchScheduleSettings({ aecChoice: v }, () => { state.schedule.aecChoice = v; });
  });
  const semStart = root.querySelector('#semStart');
  if(semStart) semStart.addEventListener('change', (e) => {
    const v = e.target.value || null;
    patchScheduleSettings({ semesterStart: v }, () => { state.schedule.semesterStart = v; });
  });
  const semEnd = root.querySelector('#semEnd');
  if(semEnd) semEnd.addEventListener('change', (e) => {
    const v = e.target.value || null;
    patchScheduleSettings({ semesterEnd: v }, () => { state.schedule.semesterEnd = v; });
  });
  const lateralToggle = root.querySelector('#lateralToggle');
  if(lateralToggle) lateralToggle.addEventListener('change', (e) => {
    const v = e.target.checked;
    patchScheduleSettings({ lateralEntryStudent: v }, () => { state.schedule.lateralEntryStudent = v; });
  });

  // Schedule grid "CONFIGURE" buttons -> jump to the settings panel
  root.querySelectorAll('[data-act="configure-lab"], [data-act="configure-aec"]').forEach(el => {
    el.addEventListener('click', () => {
      const target = root.querySelector('#schedSettings');
      if(target) target.scrollIntoView({ behavior:'smooth', block:'center' });
    });
  });

  // Modal
  const overlay = root.querySelector('#modalOverlay');
  if(overlay){
    overlay.addEventListener('click', (e) => { if(e.target === overlay) { ui.modal=null; render(); } });
    const closeBtn = root.querySelector('[data-act="close-modal"]');
    if(closeBtn) closeBtn.addEventListener('click', () => { ui.modal=null; render(); });
    const saveModalBtn = root.querySelector('[data-act="save-modal-class"]');
    if(saveModalBtn) saveModalBtn.addEventListener('click', async (e) => {
      const subjectId = root.querySelector('#mSubject').value;
      const start = root.querySelector('#mStart').value;
      const end = root.querySelector('#mEnd').value;
      const topic = root.querySelector('#mTopic').value.trim();
      const attendance = root.querySelector('#mAttendance').value || null;
      if(!subjectId){ showToast('SELECT A SUBJECT'); return; }
      const mode = e.currentTarget.dataset.mode;
      const btn = e.currentTarget;
      btn.disabled = true;
      setSyncStatus('saving');
      try{
        const day = ensureDay(ui.currentDate);
        if(mode === 'edit'){
          const classId = e.currentTarget.dataset.id;
          await dbUpdateClassRecord(classId, { subjectId, start, end, topic, attendance });
          const c = day.classes.find(c => c.id === classId);
          if(c){ c.subjectId = subjectId; c.time = {start,end}; c.topic = topic; c.attendance = attendance; }
        } else {
          const row = await insertClassRecord({ subjectId, date: ui.currentDate, start, end, topic, attendance });
          day.classes.push(mapClassRecordFromDb(row));
        }
        setSyncStatus('saved');
        ui.modal = null;
        render();
      }catch(err){
        console.error(err);
        setSyncStatus('error');
        btn.disabled = false;
        showToast('COULD NOT SAVE — CHECK YOUR CONNECTION');
      }
    });
  }

  // Quick add (right sidebar)
  const qaBtn = root.querySelector('[data-act="quick-add"]');
  if(qaBtn) qaBtn.addEventListener('click', async () => {
    const subjectId = root.querySelector('#qaSubject').value;
    const start = root.querySelector('#qaStart').value;
    const end = root.querySelector('#qaEnd').value;
    const topic = root.querySelector('#qaTopic').value.trim();
    const attendance = root.querySelector('#qaAttendance').value || null;
    if(!subjectId){ showToast('SELECT A SUBJECT'); return; }
    qaBtn.disabled = true;
    setSyncStatus('saving');
    try{
      const row = await insertClassRecord({ subjectId, date: ui.currentDate, start, end, topic, attendance });
      const day = ensureDay(ui.currentDate);
      day.classes.push(mapClassRecordFromDb(row));
      setSyncStatus('saved');
      render();
      showToast('CLASS ADDED');
    }catch(err){
      console.error(err);
      setSyncStatus('error');
      qaBtn.disabled = false;
      showToast('COULD NOT SAVE — CHECK YOUR CONNECTION');
    }
  });

  // Notes
  const noteArea = root.querySelector('#dayNote');
  if(noteArea){
    let t;
    noteArea.addEventListener('input', () => {
      clearTimeout(t);
      const dateKey = ui.currentDate;
      const content = noteArea.value;
      t = setTimeout(async () => {
        setSyncStatus('saving');
        try{
          await upsertNote(dateKey, content);
          const day = ensureDay(dateKey);
          day.note = content;
          setSyncStatus('saved');
        }catch(err){
          console.error(err);
          setSyncStatus('error');
          showToast('NOTE COULD NOT BE SAVED');
        }
      }, 400);
    });
  }

  // Calendar navigation (both full + mini)
  root.querySelectorAll('[data-act="cal-prev-month"]').forEach(el => el.addEventListener('click', () => {
    ui.calMonth--; if(ui.calMonth<0){ ui.calMonth=11; ui.calYear--; } render();
  }));
  root.querySelectorAll('[data-act="cal-next-month"]').forEach(el => el.addEventListener('click', () => {
    ui.calMonth++; if(ui.calMonth>11){ ui.calMonth=0; ui.calYear++; } render();
  }));
  root.querySelectorAll('.mc-day[data-date]').forEach(el => {
    el.addEventListener('click', () => { ui.currentDate = el.dataset.date; ui.view = 'diary'; render(); });
  });

  // Archive
  root.querySelectorAll('.archive-item[data-date]').forEach(el => {
    el.addEventListener('click', () => { ui.currentDate = el.dataset.date; ui.view = 'diary'; render(); });
  });

  // Subjects
  const newSubjBtn = root.querySelector('[data-act="new-subject"]');
  if(newSubjBtn) newSubjBtn.addEventListener('click', () => { ui.addingSubject = true; ui.editingSubjectId = null; render(); });
  root.querySelectorAll('[data-act="edit-subject"]').forEach(el => {
    el.addEventListener('click', () => { ui.editingSubjectId = el.dataset.id; ui.addingSubject = false; render(); });
  });
  root.querySelectorAll('[data-act="delete-subject"]').forEach(el => {
    el.addEventListener('click', async () => {
      if(!confirm('Delete this subject? Classes already logged under it will keep their record but show as unknown.')) return;
      const id = el.dataset.id;
      setSyncStatus('saving');
      try{
        await dbDeleteSubject(id);
        state.subjects = state.subjects.filter(s => s.id !== id);
        // Mirror the database's ON DELETE SET NULL locally, so cached state
        // matches what Supabase now actually holds without a full refetch.
        Object.values(state.days).forEach(day => {
          day.classes.forEach(c => { if(c.subjectId === id) c.subjectId = null; });
        });
        state.schedule.entries.forEach(e => { if(e.subjectId === id) e.subjectId = null; });
        setSyncStatus('saved');
        render();
      }catch(err){
        console.error(err);
        setSyncStatus('error');
        showToast('COULD NOT DELETE — CHECK YOUR CONNECTION');
      }
    });
  });
  const cancelSubjBtn = root.querySelector('[data-act="cancel-subject"]');
  if(cancelSubjBtn) cancelSubjBtn.addEventListener('click', () => { ui.addingSubject=false; ui.editingSubjectId=null; render(); });
  root.querySelectorAll('.swatch').forEach(el => {
    el.addEventListener('click', () => {
      root.querySelectorAll('.swatch').forEach(s=>s.classList.remove('selected'));
      el.classList.add('selected');
      root.querySelector('#subjColor').value = el.dataset.color;
    });
  });
  const saveSubjBtn = root.querySelector('[data-act="save-subject"]');
  if(saveSubjBtn) saveSubjBtn.addEventListener('click', async () => {
    const name = root.querySelector('#subjName').value.trim();
    const code = root.querySelector('#subjCode').value.trim();
    const color = root.querySelector('#subjColor').value;
    if(!name){ showToast('ENTER A SUBJECT NAME'); return; }
    const id = saveSubjBtn.dataset.id;
    saveSubjBtn.disabled = true;
    setSyncStatus('saving');
    try{
      if(id){
        const row = await dbUpdateSubject(id, { name, code, color });
        const s = state.subjects.find(s => s.id === id);
        if(s){ s.name = row.name; s.code = row.code || ''; s.color = row.color; }
      } else {
        const row = await insertSubject({ name, code, color });
        state.subjects.push(mapSubjectFromDb(row));
      }
      setSyncStatus('saved');
      ui.addingSubject = false; ui.editingSubjectId = null;
      render();
    }catch(err){
      console.error(err);
      setSyncStatus('error');
      saveSubjBtn.disabled = false;
      showToast('COULD NOT SAVE — CHECK YOUR CONNECTION');
    }
  });
}

/* ---------- Live clock ---------- */
setInterval(() => {
  const el = document.getElementById('liveClock');
  if(el) el.textContent = formatClock(new Date());
}, 1000);

/* ============================================================
   STARFIELD — small, warm, twinkling backdrop. Purely decorative.
   ============================================================ */
function initStarfield(){
  const holder = document.getElementById('bgStars');
  if(!holder) return;
  const COUNT = 46; // sparse — not too much
  const vh = window.innerHeight;
  for(let i=0;i<COUNT;i++){
    const s = document.createElement('span');
    s.className = 'star';
    // concentrate stars in the upper 70% of the viewport, thinning out lower down
    const top = Math.pow(Math.random(), 1.4) * 0.72 * 100;
    const size = 1 + Math.random() * 2.2;
    s.style.left = (Math.random()*100) + '%';
    s.style.top = top + '%';
    s.style.width = size + 'px';
    s.style.height = size + 'px';
    s.style.setProperty('--dur', (3 + Math.random()*4).toFixed(2) + 's');
    s.style.setProperty('--delay', (Math.random()*6).toFixed(2) + 's');
    s.style.setProperty('--peak', (0.45 + Math.random()*0.45).toFixed(2));
    holder.appendChild(s);
  }
}
initStarfield();

/* ---------- Init ---------- */
// Rendering is deferred until main.js has authenticated and hydrated state
// with the user's real data from Supabase — never rendered speculatively.
export function boot(){
  render();
}
