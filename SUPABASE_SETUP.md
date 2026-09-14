# Supabase Setup — Academic Diary

This document is everything you need to do **manually in Supabase** to make
authentication and database persistence work. Claude cannot create your
Supabase project or run SQL on it — you'll do that here, once.

---

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in (or create an account).
2. Click **New Project**.
3. Pick an organization, name the project (e.g. `academic-diary`), set a
   database password (save it somewhere safe — you won't need it for the
   app itself, only if you ever connect a Postgres client directly), and
   choose a region close to you.
4. Wait for the project to finish provisioning (usually 1–2 minutes).

## 2. Run the database SQL

1. In your project, open the **SQL Editor** (left sidebar).
2. Click **New query**.
3. Open `supabase/schema.sql` from this repo, copy the entire contents, and
   paste it into the SQL Editor.
4. Click **Run**.
5. You should see "Success. No rows returned." If you see an error, read it
   carefully — the script is written to be safe to re-run, so re-running it
   after fixing something won't create duplicates.

This creates: `subjects`, `schedule_settings`, `schedule_entries`,
`class_records`, `daily_notes` — all with Row Level Security **enabled** and
policies restricting every row to `user_id = auth.uid()`. It also creates:
trigger functions that stop one user's rows from referencing another user's
subjects/schedule entries; `updated_at` auto-maintenance; a **unique
constraint on `subjects(user_id, code)`**; and a `seed_default_academic_data()`
function that safely (idempotently) creates the five core subjects and the
weekly timetable the first time each user logs in.

If you're re-running this after previously running the v1 version of this
file, it will safely upgrade your existing tables in place (add the new
`code` column on `schedule_entries`, replace `lab_config` with `lab_group`
on `schedule_settings`, add the unique index, etc.) without losing data in
`class_records` or `daily_notes`.

### If you already have duplicated sample data

If your account currently has more subjects than it should (e.g. 10 instead
of 5) from before this fix, run `supabase/reset_sample_data.sql` once,
after running `schema.sql` above:

1. Open `supabase/reset_sample_data.sql`.
2. Replace `'YOUR_EMAIL_HERE'` with your account's email.
3. Run it in the SQL Editor.

This deletes only that user's `subjects`, `schedule_entries`,
`schedule_settings`, and `class_records` — it never touches `auth.users`,
RLS policies, or `daily_notes`. The next time you log in, the corrected
five subjects and timetable are recreated automatically.

## 3. Create the first (and only) user

There is no signup form in the app on purpose. Create your account directly:

1. Go to **Authentication → Users** in the Supabase dashboard.
2. Click **Add user → Create new user**.
3. Enter your email and a password.
4. Leave "Auto Confirm User" **checked** (so you don't need to click an email
   confirmation link) — or confirm it yourself under Authentication → Users
   if you forget.
5. Click **Create user**.

That's the only account the app will ever need.

## 4. Disable public signup

Even though the frontend has no signup form, it's worth closing the door at
the platform level too:

1. Go to **Authentication → Providers → Email**.
2. Turn **off** "Allow new users to sign up" (sometimes labelled "Enable
   sign ups" depending on dashboard version).
3. Save.

## 5. Configure email/password authentication

Email/password is enabled by default on new Supabase projects. Just confirm:

1. **Authentication → Providers → Email** is toggled **on**.
2. All other providers (Google, GitHub, etc.) are toggled **off** — the app
   never uses them, and leaving them off keeps the surface area small.

## 6. Get your project URL and publishable (anon) key

1. Go to **Project Settings → API**.
2. Copy the **Project URL** — this is `VITE_SUPABASE_URL`.
3. Copy the **anon / public** key (labelled "anon public" or "publishable"
   depending on dashboard version) — this is `VITE_SUPABASE_PUBLISHABLE_KEY`.
4. **Do not** copy the `service_role` key anywhere near this project. It
   must never appear in frontend code.

## 7. Set up your local environment file

See the **Environment Variables** section below.

## 8. Test that RLS is actually working

Don't just trust that it's on — verify it:

1. In the SQL Editor, run:
   ```sql
   select tablename, rowsecurity
   from pg_tables
   where schemaname = 'public';
   ```
   Every table (`subjects`, `schedule_settings`, `schedule_entries`,
   `class_records`, `daily_notes`) should show `rowsecurity = true`.

2. Run the app, sign in, and add a subject or a class. Then in the SQL
   Editor run (as the Postgres superuser, which bypasses RLS by design —
   this just confirms the row actually landed with the right owner):
   ```sql
   select id, user_id, name from public.subjects order by created_at desc limit 5;
   ```
   Confirm `user_id` matches your user's id (**Authentication → Users**
   shows it).

3. To confirm RLS actually blocks cross-user access (not just that the
   frontend happens to filter correctly), you'd need a second user — since
   this is a single-account app that's optional, but if you want to check:
   create a second temporary user, sign in as them in a private/incognito
   window, and confirm they see an empty diary with no access to the first
   user's rows. Delete the temporary user afterward.

4. As an extra check, in the SQL Editor try selecting from a table using the
   `anon` role directly (Supabase's SQL Editor has a role switcher, or you
   can use `set role anon;` before a query) — it should return zero rows
   with no session context, since `auth.uid()` is null for an unauthenticated
   request and no row has `user_id = null`.

---

## Environment variables

Copy `.env.example` to `.env.local` in the project root and fill in the two
values from step 6 above:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-public-key
```

`.env.local` is already listed in `.gitignore` — it will never be committed.

Then:

```
npm install
npm run dev
```

---

## How migration works

**Not currently active.** This build intentionally does not run the
localStorage migration — this is still development/sample data, so there's
nothing to migrate, and the app seeds the corrected timetable directly into
Supabase on first login instead (see `seed_default_academic_data()` above).
The migration code (`src/migrate.js`) is left in the project, unused, for
whenever real migration is needed again; it is not called from `src/main.js`
in this build. The description below is for when it's reconnected later.

The very first time you sign in on a browser that still has the old
localStorage diary data (key `academic-diary-v1`), the app will:

1. Read your existing subjects, timetable, class records, and notes.
2. Insert them into Supabase under your authenticated user.
3. Only mark migration as complete (a flag in localStorage, scoped to your
   user id) once every insert has succeeded.
4. Show a small toast summarizing what was migrated.

Your old localStorage data is **never deleted** by this process — it's only
read. If migration fails partway through (e.g. you lose network mid-way),
nothing is marked complete, and the next time you sign in it will safely
retry. The retry logic recognizes rows it already inserted (by matching
subject name+code, and by matching class records on subject/date/time/topic/
attendance) so a retry won't create duplicates of what already made it into
Supabase on a failed first attempt.

If you ever want to force a re-migration from scratch (not normally needed),
you'd need to manually clear the relevant tables in Supabase and delete the
`academic-diary-migrated:<your-user-id>` key from localStorage.

---

## Testing checklist

Use this after setup to confirm everything works end to end (mirrors what
was tested locally against a mock server during development — see the
"What I could not test" note at the end of the implementation summary for
what still needs verifying against your real project):

**Auth**
- [ ] Logged out → login screen only, no diary flash.
- [ ] Wrong password → inline error, no crash.
- [ ] Correct password → diary loads.
- [ ] Refresh → still logged in.
- [ ] Log out → back to login screen, diary data cleared from memory.

**Database**
- [ ] Add a subject → check it lands in Supabase (Table Editor).
- [ ] Refresh → subject still there.
- [ ] Edit a subject → Supabase row updates.
- [ ] Delete a subject → Supabase row deleted; any class records that
      referenced it show "unknown subject" rather than disappearing.

**Timetable**
- [ ] Schedule page loads from Supabase (Table Editor → `schedule_entries`
      should be populated after your first login).
- [ ] Each weekday shows the right classes.
- [ ] Quick Add on the Diary page shows today's scheduled classes.
- [ ] Changing a lab/AEC/semester-date setting persists after refresh.

**Class records**
- [ ] Add a class (manually and via a schedule chip) → row appears in
      `class_records`.
- [ ] Edit a class → row updates.
- [ ] Delete a class → row deleted.
- [ ] A scheduled-but-unlogged class never appears in `class_records`.

**Attendance**
- [ ] Mark present/absent, change it, delete the class — attendance
      percentage recalculates each time, and unmarked classes are excluded.

**Migration** (only if you have old localStorage data to test with)
- [ ] Existing data detected and migrated on first login.
- [ ] Refresh/re-login doesn't duplicate anything.
- [ ] A deliberately interrupted migration (e.g. throttle network) can be
      retried safely.

---

## Where everything is stored after this implementation

| Data | Stored in |
|---|---|
| Authentication (account, password, session) | Supabase Auth |
| Subjects | Supabase PostgreSQL (`subjects`) |
| Weekly timetable | Supabase PostgreSQL (`schedule_entries`, `schedule_settings`) |
| Class records | Supabase PostgreSQL (`class_records`) |
| Attendance | Calculated live from `class_records.attendance` — never stored as a percentage |
| Daily notes | Supabase PostgreSQL (`daily_notes`) |
| LocalStorage | Only the migration-completed flag (`academic-diary-migrated:<user-id>`) and the original pre-migration data (kept, never deleted, never read again once migrated) |
