-- Contempo's in-app reports and the /feedback/ form now go to FeedbackKit (its public ingest API),
-- so the admin site's feedback triage is gone. Both tables were empty in production when this was
-- written (2026-10-17). Written by hand: the declarative diff needs the local stack.

drop policy if exists "read own or admin app feedback" on contempo.app_feedback;
drop policy if exists "add own app feedback" on contempo.app_feedback;
drop policy if exists "admins triage app feedback" on contempo.app_feedback;
drop trigger if exists app_feedback_guard on contempo.app_feedback;
drop table if exists contempo.app_feedback;
drop function if exists contempo.app_feedback_guard();

drop policy if exists "anyone sends feedback" on contempo.feedback;
drop policy if exists "admins read feedback" on contempo.feedback;
drop trigger if exists feedback_server_time on contempo.feedback;
drop table if exists contempo.feedback;
drop function if exists contempo.feedback_server_time();

-- Admins no longer read <uid>/feedback/ screenshots; files are owner-only again.
drop policy if exists "contempo: own files read" on storage.objects;
create policy "contempo: own files read" on storage.objects for select
  using (bucket_id = 'contempo' and (storage.foldername(name))[1] = auth.uid()::text);
