-- Explicitly remove default privileges as well as application grants.
revoke update, delete on public.requests from public, anon, authenticated;
revoke update on public.project_applications from public, anon, authenticated;
revoke all on public.requests, public.project_applications, public.request_history, public.profiles, public.projects, public.user_roles from anon;
revoke update on public.user_roles from public, authenticated;
revoke insert, update, delete on public.request_history from public, authenticated;
revoke insert, delete on public.profiles from public, authenticated;
-- Existing policies still scope pending withdrawal and HOD-only role management.
grant select, insert, delete on public.project_applications to authenticated;
grant select, insert on public.requests to authenticated;
grant select on public.request_history to authenticated;
grant all on public.requests, public.project_applications, public.request_history, public.profiles, public.projects, public.user_roles to service_role;