-- ============================================================
-- RESET SAMPLE DATA — run this ONCE to clear out the duplicated
-- development/sample data (e.g. the "10 subjects instead of 5" bug)
-- for your account before re-seeding with the corrected schema.
--
-- This does NOT touch:
--   - auth.users (your account/login is untouched)
--   - RLS policies
--   - daily_notes (not implicated in the duplication bug)
--
-- It DOES delete, for the one account you specify below:
--   - class_records
--   - schedule_entries
--   - schedule_settings
--   - subjects
--
-- After running this, just log in again — seed_default_academic_data()
-- (called automatically on login) will recreate exactly five subjects
-- and the corrected timetable.
-- ============================================================

do $$
declare
  target_user uuid;
  target_email text := 'nikigo213431@gmail.com'; -- <-- replace with your account's email
begin
  select id into target_user from auth.users where email = target_email;

  if target_user is null then
    raise exception 'No user found with email %. Check Authentication -> Users for the exact email.', target_email;
  end if;

  delete from public.class_records     where user_id = target_user;
  delete from public.schedule_entries  where user_id = target_user;
  delete from public.schedule_settings where user_id = target_user;
  delete from public.subjects          where user_id = target_user;

  raise notice 'Sample academic data reset for user % (%)', target_email, target_user;
end $$;
