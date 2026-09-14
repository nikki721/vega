-- ============================================================
-- ACADEMIC DIARY — Supabase schema (v2)
-- Safe to re-run on either a fresh project or the v1 schema from the
-- previous iteration: every statement is guarded (IF NOT EXISTS / OR
-- REPLACE / DROP ... IF EXISTS) so re-running it converges to the same
-- final state without erroring or duplicating objects.
--
-- v2 changes vs v1:
--   - schedule_entries.type vocabulary corrected to: core, lab, aec,
--     project, institutional, activity, break
--   - schedule_entries gains a `code` column (e.g. '25CPD37')
--   - schedule_settings.lab_config (jsonb) replaced by a single
--     lab_group ('D1' | 'D2' | null) — the two lab days are a matched
--     pair (whichever lab you don't get Tuesday, you get Thursday),
--     so one setting drives both instead of two independent dropdowns
--   - subjects(user_id, code) now has a real UNIQUE constraint — the
--     root cause of the duplicate-subjects bug was that "does this
--     subject already exist" was only ever checked in application code
--     (a classic check-then-insert race: two tabs/refreshes landing in
--     the empty-account window both see zero subjects and each insert
--     their own set of five). A database constraint closes that gap
--     permanently, regardless of what the frontend does.
--   - all default-data seeding moved into a single Postgres function,
--     seed_default_academic_data(), guarded by an advisory lock plus an
--     existence check, so calling it from every login is always safe
-- ============================================================

create extension if not exists "pgcrypto"; -- gives us gen_random_uuid()

-- ------------------------------------------------------------
-- SUBJECTS
-- ------------------------------------------------------------
create table if not exists public.subjects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  full_name   text,               -- optional long form, e.g. official course title
  code        text,               -- e.g. '25CSK32' — the stable identity used for idempotent seeding
  color       text,               -- hex value used by the existing UI palette
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists subjects_user_id_idx on public.subjects(user_id);

-- THE fix for the duplicate-subjects bug: a real uniqueness guarantee,
-- not just an application-level check. Two concurrent inserts of the same
-- (user_id, code) can no longer both succeed.
create unique index if not exists subjects_user_code_unique
  on public.subjects(user_id, code) where code is not null;

-- ------------------------------------------------------------
-- SCHEDULE SETTINGS  (one row per user — the small config values
-- that sit alongside the timetable)
-- ------------------------------------------------------------
create table if not exists public.schedule_settings (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null unique default auth.uid() references auth.users(id) on delete cascade,
  lab_group              text,               -- 'D1' | 'D2' | null — see check constraint below
  aec_choice             text,               -- one of the AEC course codes, e.g. '25CSE361', or null
  lateral_entry_student  boolean not null default false,
  semester_start         date,
  semester_end           date,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
-- v1 -> v2: drop the old per-slot jsonb config in favor of one lab_group value
alter table public.schedule_settings add column if not exists lab_group text;
alter table public.schedule_settings drop column if exists lab_config;
alter table public.schedule_settings drop constraint if exists schedule_settings_lab_group_check;
alter table public.schedule_settings add constraint schedule_settings_lab_group_check
  check (lab_group in ('D1','D2') or lab_group is null);

-- ------------------------------------------------------------
-- SCHEDULE ENTRIES  (the weekly timetable — what is SUPPOSED to
-- happen; never automatically becomes a class_records row)
-- ------------------------------------------------------------
create table if not exists public.schedule_entries (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day_of_week       smallint not null check (day_of_week between 0 and 6), -- 0 = Sunday .. 6 = Saturday
  start_time        time,
  end_time          time,
  type              text not null,
  subject_id        uuid references public.subjects(id) on delete set null,
  title             text,          -- used when there's no subject_id (labs, AEC, activities)
  code              text,          -- display code for non-subject entries, e.g. '25CPD37'
  slot_key          text,          -- e.g. 'tue-lab' / 'thu-lab' — ties a lab block to lab_group
  configurable      boolean not null default false,
  for_lateral_entry boolean not null default false,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
-- v1 -> v2: add the display-code column for non-subject entries
alter table public.schedule_entries add column if not exists code text;
-- v1 -> v2: corrected type vocabulary (was: subject/lab/project/activity/
-- aec/lpss/mentoring/coaching/library/ncmc — collapsed into the smaller,
-- clearer set below; lpss/mentoring/coaching/library are all "activity")
alter table public.schedule_entries drop constraint if exists schedule_entries_type_check;
alter table public.schedule_entries add constraint schedule_entries_type_check
  check (type in ('core','lab','aec','project','institutional','activity','break'));
create index if not exists schedule_entries_user_id_idx on public.schedule_entries(user_id);
create index if not exists schedule_entries_user_dow_idx on public.schedule_entries(user_id, day_of_week);

-- ------------------------------------------------------------
-- CLASS RECORDS  (what actually happened — logged by the user)
-- ------------------------------------------------------------
create table if not exists public.class_records (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_id         uuid references public.subjects(id) on delete set null,
  date               date not null,
  start_time         time,
  end_time           time,
  topic              text,
  attendance         text check (attendance in ('present','absent') or attendance is null),
  schedule_entry_id  uuid references public.schedule_entries(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists class_records_user_id_idx on public.class_records(user_id);
create index if not exists class_records_user_date_idx on public.class_records(user_id, date);
create index if not exists class_records_subject_idx on public.class_records(subject_id);

-- ------------------------------------------------------------
-- DAILY NOTES
-- ------------------------------------------------------------
create table if not exists public.daily_notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date        date not null,
  content     text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, date)
);
create index if not exists daily_notes_user_id_idx on public.daily_notes(user_id);

-- ============================================================
-- updated_at maintenance
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_subjects_updated_at on public.subjects;
create trigger trg_subjects_updated_at before update on public.subjects
  for each row execute function public.set_updated_at();

drop trigger if exists trg_schedule_settings_updated_at on public.schedule_settings;
create trigger trg_schedule_settings_updated_at before update on public.schedule_settings
  for each row execute function public.set_updated_at();

drop trigger if exists trg_schedule_entries_updated_at on public.schedule_entries;
create trigger trg_schedule_entries_updated_at before update on public.schedule_entries
  for each row execute function public.set_updated_at();

drop trigger if exists trg_class_records_updated_at on public.class_records;
create trigger trg_class_records_updated_at before update on public.class_records
  for each row execute function public.set_updated_at();

drop trigger if exists trg_daily_notes_updated_at on public.daily_notes;
create trigger trg_daily_notes_updated_at before update on public.daily_notes
  for each row execute function public.set_updated_at();

-- ============================================================
-- CROSS-USER REFERENCE GUARDS
-- A foreign key only checks that the referenced row exists — it does NOT
-- check that it belongs to the same user. These triggers close that gap.
-- ============================================================
create or replace function public.enforce_same_user_subject()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.subject_id is not null then
    if not exists (
      select 1 from public.subjects s
      where s.id = new.subject_id and s.user_id = new.user_id
    ) then
      raise exception 'subject_id does not belong to the same user';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_schedule_entries_subject_owner on public.schedule_entries;
create trigger trg_schedule_entries_subject_owner
  before insert or update on public.schedule_entries
  for each row execute function public.enforce_same_user_subject();

drop trigger if exists trg_class_records_subject_owner on public.class_records;
create trigger trg_class_records_subject_owner
  before insert or update on public.class_records
  for each row execute function public.enforce_same_user_subject();

create or replace function public.enforce_same_user_schedule_entry()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.schedule_entry_id is not null then
    if not exists (
      select 1 from public.schedule_entries e
      where e.id = new.schedule_entry_id and e.user_id = new.user_id
    ) then
      raise exception 'schedule_entry_id does not belong to the same user';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_class_records_schedule_entry_owner on public.class_records;
create trigger trg_class_records_schedule_entry_owner
  before insert or update on public.class_records
  for each row execute function public.enforce_same_user_schedule_entry();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.subjects           enable row level security;
alter table public.schedule_settings  enable row level security;
alter table public.schedule_entries   enable row level security;
alter table public.class_records      enable row level security;
alter table public.daily_notes        enable row level security;

-- subjects
drop policy if exists "select own subjects" on public.subjects;
create policy "select own subjects" on public.subjects
  for select using (user_id = auth.uid());
drop policy if exists "insert own subjects" on public.subjects;
create policy "insert own subjects" on public.subjects
  for insert with check (user_id = auth.uid());
drop policy if exists "update own subjects" on public.subjects;
create policy "update own subjects" on public.subjects
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "delete own subjects" on public.subjects;
create policy "delete own subjects" on public.subjects
  for delete using (user_id = auth.uid());

-- schedule_settings
drop policy if exists "select own schedule_settings" on public.schedule_settings;
create policy "select own schedule_settings" on public.schedule_settings
  for select using (user_id = auth.uid());
drop policy if exists "insert own schedule_settings" on public.schedule_settings;
create policy "insert own schedule_settings" on public.schedule_settings
  for insert with check (user_id = auth.uid());
drop policy if exists "update own schedule_settings" on public.schedule_settings;
create policy "update own schedule_settings" on public.schedule_settings
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "delete own schedule_settings" on public.schedule_settings;
create policy "delete own schedule_settings" on public.schedule_settings
  for delete using (user_id = auth.uid());

-- schedule_entries
drop policy if exists "select own schedule_entries" on public.schedule_entries;
create policy "select own schedule_entries" on public.schedule_entries
  for select using (user_id = auth.uid());
drop policy if exists "insert own schedule_entries" on public.schedule_entries;
create policy "insert own schedule_entries" on public.schedule_entries
  for insert with check (user_id = auth.uid());
drop policy if exists "update own schedule_entries" on public.schedule_entries;
create policy "update own schedule_entries" on public.schedule_entries
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "delete own schedule_entries" on public.schedule_entries;
create policy "delete own schedule_entries" on public.schedule_entries
  for delete using (user_id = auth.uid());

-- class_records
drop policy if exists "select own class_records" on public.class_records;
create policy "select own class_records" on public.class_records
  for select using (user_id = auth.uid());
drop policy if exists "insert own class_records" on public.class_records;
create policy "insert own class_records" on public.class_records
  for insert with check (user_id = auth.uid());
drop policy if exists "update own class_records" on public.class_records;
create policy "update own class_records" on public.class_records
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "delete own class_records" on public.class_records;
create policy "delete own class_records" on public.class_records
  for delete using (user_id = auth.uid());

-- daily_notes
drop policy if exists "select own daily_notes" on public.daily_notes;
create policy "select own daily_notes" on public.daily_notes
  for select using (user_id = auth.uid());
drop policy if exists "insert own daily_notes" on public.daily_notes;
create policy "insert own daily_notes" on public.daily_notes
  for insert with check (user_id = auth.uid());
drop policy if exists "update own daily_notes" on public.daily_notes;
create policy "update own daily_notes" on public.daily_notes
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "delete own daily_notes" on public.daily_notes;
create policy "delete own daily_notes" on public.daily_notes
  for delete using (user_id = auth.uid());

-- ============================================================
-- DEFAULT DATA SEEDING — the fix for "insert subjects on every login"
--
-- Runs as the calling user (SECURITY INVOKER — the default), so it is
-- bound by the exact same RLS policies as any other insert from the
-- frontend; it has no elevated access.
--
-- Safe to call on every single login:
--   - pg_advisory_xact_lock serializes concurrent calls from the same
--     user (two tabs, a double-click, a rapid refresh) so they run one
--     after another rather than racing each other
--   - the existence check (+ the unique index above, as a second line
--     of defense) means a user who already has subjects gets a no-op
-- ============================================================
create or replace function public.seed_default_academic_data()
returns void
language plpgsql
as $$
declare
  uid uuid := auth.uid();
  v_nm uuid; v_ds uuid; v_dl uuid; v_ot uuid; v_se uuid;
  existing_count int;
begin
  if uid is null then
    raise exception 'seed_default_academic_data requires an authenticated user';
  end if;

  perform pg_advisory_xact_lock(hashtext(uid::text));

  select count(*) into existing_count from public.subjects where user_id = uid;
  if existing_count > 0 then
    return; -- already seeded (or the user has their own subjects) — do nothing
  end if;

  insert into public.subjects (user_id, name, code, full_name) values
    (uid, 'Numerical Methods', '25MAC31', 'Numerical Methods, Vector Spaces and Probability Distributions')
    returning id into v_nm;
  insert into public.subjects (user_id, name, code, full_name) values
    (uid, 'Data Structures', '25CSK32', 'Data Structures')
    returning id into v_ds;
  insert into public.subjects (user_id, name, code, full_name) values
    (uid, 'Digital Logic & Comp. Org.', '25CSK33', 'Digital Logic and Computer Organization')
    returning id into v_dl;
  insert into public.subjects (user_id, name, code, full_name) values
    (uid, 'Optimization Techniques', '25CSK34', 'Optimization Techniques')
    returning id into v_ot;
  insert into public.subjects (user_id, name, code, full_name) values
    (uid, 'Software Engg. & Proj. Mgmt.', '25CSK35', 'Software Engineering and Project Management')
    returning id into v_se;

  insert into public.schedule_entries
    (user_id, day_of_week, start_time, end_time, type, subject_id, title, code, slot_key, configurable, for_lateral_entry)
  values
    -- MONDAY (1)
    (uid, 1, '08:40', '09:35', 'core', v_se, null, null, null, false, false),
    (uid, 1, '09:35', '10:30', 'core', v_nm, null, null, null, false, false),
    (uid, 1, '10:40', '11:40', 'core', v_ot, null, null, null, false, false),
    (uid, 1, '11:40', '12:40', 'core', v_nm, null, null, null, false, false),
    (uid, 1, '13:30', '15:30', 'project', null, 'Community Project', '25CPD37', null, false, false),
    (uid, 1, '15:30', '16:30', 'activity', null, 'Mentoring', null, null, false, false),
    -- TUESDAY (2) — lab block D1=Digital Logic Lab, D2=Data Structures Lab
    (uid, 2, '08:40', '09:35', 'core', v_ot, null, null, null, false, false),
    (uid, 2, '09:35', '12:40', 'lab', null, 'Laboratory Block', null, 'tue-lab', true, false),
    (uid, 2, '13:30', '14:30', 'core', v_se, null, null, null, false, false),
    (uid, 2, '14:30', '15:30', 'core', v_ot, null, null, null, false, false),
    (uid, 2, '15:30', '16:30', 'core', v_ds, null, null, null, false, false),
    -- WEDNESDAY (3) — 13:30-14:30 intentionally has no entry (no core class)
    (uid, 3, '08:40', '09:35', 'core', v_dl, null, null, null, false, false),
    (uid, 3, '09:35', '10:30', 'core', v_nm, null, null, null, false, false),
    (uid, 3, '10:40', '11:40', 'core', v_dl, null, null, null, false, false),
    (uid, 3, '11:40', '12:40', 'aec', null, 'AEC', null, null, true, false),
    (uid, 3, '14:30', '15:30', 'activity', null, 'Coaching Class', null, null, false, false),
    (uid, 3, '15:30', '16:30', 'activity', null, 'Library', null, null, false, false),
    -- THURSDAY (4) — lab block D1=Data Structures Lab, D2=Digital Logic Lab (swapped)
    (uid, 4, '08:40', '09:35', 'core', v_dl, null, null, null, false, false),
    (uid, 4, '09:35', '12:40', 'lab', null, 'Laboratory Block', null, 'thu-lab', true, false),
    (uid, 4, '13:30', '14:30', 'core', v_ds, null, null, null, false, false),
    (uid, 4, '14:30', '15:30', 'core', v_se, null, null, null, false, false),
    (uid, 4, '15:30', '16:30', 'activity', null, 'Mentoring', null, null, false, false),
    -- FRIDAY (5)
    (uid, 5, '08:40', '09:35', 'core', v_ds, null, null, null, false, false),
    (uid, 5, '09:35', '10:30', 'core', v_nm, null, null, null, false, false),
    (uid, 5, '10:40', '11:40', 'core', v_dl, null, null, null, false, false),
    (uid, 5, '11:40', '12:40', 'core', v_ot, null, null, null, false, false),
    (uid, 5, '13:30', '14:30', 'core', v_se, null, null, null, false, false),
    (uid, 5, '14:30', '15:30', 'activity', null, 'LPSS', null, null, false, false),
    (uid, 5, '15:30', '16:30', 'core', v_ds, null, null, null, false, false),
    -- SATURDAY (6) — lateral-entry math hidden by default; NCMC institutional
    (uid, 6, '08:40', '10:30', 'core', null, 'Basic Applied Mathematics-I', '25DMAT31', null, false, true),
    (uid, 6, '10:40', '12:40', 'institutional', null, 'NCMC / Institutional Activity', null, null, false, false),
    (uid, 6, '13:30', '16:30', 'institutional', null, 'NCMC / Institutional Activity', null, null, false, false);

  insert into public.schedule_settings (user_id, lab_group, aec_choice, lateral_entry_student, semester_start, semester_end)
  values (uid, null, null, false, null, null);
end;
$$;

grant execute on function public.seed_default_academic_data() to authenticated;
revoke execute on function public.seed_default_academic_data() from anon;

-- ============================================================
-- Done. See SUPABASE_SETUP.md for setup, and reset_sample_data.sql to
-- clear out a previously-duplicated sample account before re-seeding.
-- ============================================================
