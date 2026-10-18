-- Only intended fields are editable through the Data API.
revoke update on public.projects from authenticated;
grant update (is_open) on public.projects to authenticated;
revoke delete on public.projects from authenticated;
revoke update on public.profiles from authenticated;
grant update (full_name, program, roll_no) on public.profiles to authenticated;

alter policy "students create" on public.requests with check (student_id = auth.uid() and public.has_role(auth.uid(), 'student') and status = 'pending_faculty' and public.has_role(faculty_id, 'faculty') and faculty_remarks is null and hod_remarks is null);
alter table public.requests add constraint request_title_required check (length(btrim(title)) > 0);
alter table public.projects add constraint project_title_required check (length(btrim(title)) > 0);
create unique index one_allocated_project_per_student on public.project_applications(student_id) where status = 'allocated';

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare first_account boolean;
begin
  perform pg_advisory_xact_lock(918273);
  first_account := not exists (select 1 from public.profiles);
  insert into public.profiles (id, full_name, email)
    values (new.id, coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'), ''), nullif(new.raw_user_meta_data->>'name',''), split_part(new.email,'@',1)), new.email);
  insert into public.user_roles (user_id, role) values (new.id, case when first_account then 'hod'::public.app_role else 'student'::public.app_role end);
  return new;
end $$;

create or replace function public.protect_own_hod_role()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.user_id = auth.uid() and old.role = 'hod' then raise exception 'You cannot remove your own HOD role'; end if;
  return old;
end $$;
create trigger protect_hod before delete on public.user_roles for each row execute function public.protect_own_hod_role();

create or replace function public.check_project_availability()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_open and (select count(*) from public.project_applications where project_id = new.id and status = 'allocated') >= new.max_students then
    raise exception 'Project is already full';
  end if;
  return new;
end $$;
create trigger check_project_availability before update on public.projects for each row execute function public.check_project_availability();

create or replace function public.act_on_request(_id uuid, _approve boolean, _remarks text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.requests;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into r from public.requests where id = _id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.status = 'pending_faculty' then
    if r.faculty_id <> auth.uid() or not public.has_role(auth.uid(),'faculty') then raise exception 'Only the assigned faculty can act now'; end if;
    update public.requests set status = case when _approve then 'pending_hod'::request_status else 'rejected' end, faculty_remarks = _remarks, updated_at = now() where id = _id;
    insert into public.request_history(request_id,actor_id,action,remarks) values (_id,auth.uid(),case when _approve then 'faculty_approved' else 'faculty_rejected' end,_remarks);
  elsif r.status = 'pending_hod' then
    if not public.has_role(auth.uid(),'hod') then raise exception 'Only the HOD can act now'; end if;
    update public.requests set status = case when _approve then 'approved'::request_status else 'rejected' end, hod_remarks = _remarks, updated_at = now() where id = _id;
    insert into public.request_history(request_id,actor_id,action,remarks) values (_id,auth.uid(),case when _approve then 'hod_approved' else 'hod_rejected' end,_remarks);
  else raise exception 'Request already closed'; end if;
end $$;

create or replace function public.act_on_application(_id uuid, _approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare a public.project_applications; p public.projects; allocated int;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into a from public.project_applications where id = _id for update;
  if not found then raise exception 'Application not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended(a.student_id::text, 0));
  select * into p from public.projects where id = a.project_id for update;
  if a.status = 'applied' then
    if p.faculty_id <> auth.uid() or not (public.has_role(auth.uid(),'faculty') or public.has_role(auth.uid(),'hod')) then raise exception 'Only the project guide can act now'; end if;
    update public.project_applications set status = case when _approve then 'faculty_accepted'::application_status else 'rejected' end where id = _id;
  elsif a.status = 'faculty_accepted' then
    if not public.has_role(auth.uid(),'hod') then raise exception 'Only the HOD can allocate'; end if;
    if _approve then
      select count(*) into allocated from public.project_applications where project_id = p.id and status = 'allocated';
      if allocated >= p.max_students then raise exception 'Project is already full'; end if;
      if exists(select 1 from public.project_applications where student_id = a.student_id and status = 'allocated') then raise exception 'Student already has an allocated project'; end if;
      update public.project_applications set status = 'allocated' where id = _id;
      if allocated + 1 >= p.max_students then update public.projects set is_open = false where id = p.id; end if;
    else update public.project_applications set status = 'rejected' where id = _id; end if;
  else raise exception 'Application already closed'; end if;
end $$;
revoke execute on function public.act_on_request(uuid,boolean,text) from public, anon;
revoke execute on function public.act_on_application(uuid,boolean) from public, anon;
grant execute on function public.act_on_request(uuid,boolean,text), public.act_on_application(uuid,boolean) to authenticated;
revoke execute on function public.handle_new_user(), public.log_request_created(), public.protect_own_hod_role(), public.check_project_availability() from public, anon, authenticated;