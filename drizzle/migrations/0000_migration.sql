create type public.app_role as enum ('student','faculty','hod');
create type public.program_level as enum ('UG','PG');
create type public.request_status as enum ('pending_faculty','pending_hod','approved','rejected');
create type public.application_status as enum ('applied','faculty_accepted','allocated','rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  program program_level,
  roll_no text,
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable" on public.profiles for select to authenticated using (true);
create policy "update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select, insert, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "roles readable" on public.user_roles for select to authenticated using (true);
create policy "hod manages roles insert" on public.user_roles for insert to authenticated with check (public.has_role(auth.uid(),'hod'));
create policy "hod manages roles delete" on public.user_roles for delete to authenticated using (public.has_role(auth.uid(),'hod'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), new.email);
  if not exists (select 1 from public.user_roles where role = 'hod') then
    insert into public.user_roles (user_id, role) values (new.id, 'hod');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'student');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Requests workflow
create table public.requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  faculty_id uuid not null references public.profiles(id),
  request_type text not null,
  program program_level not null,
  title text not null,
  details text not null default '',
  status request_status not null default 'pending_faculty',
  faculty_remarks text,
  hod_remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert on public.requests to authenticated;
grant all on public.requests to service_role;
alter table public.requests enable row level security;
create policy "view requests" on public.requests for select to authenticated
  using (student_id = auth.uid() or faculty_id = auth.uid() or public.has_role(auth.uid(),'hod'));
create policy "students create" on public.requests for insert to authenticated
  with check (student_id = auth.uid() and status = 'pending_faculty' and public.has_role(faculty_id,'faculty'));

create table public.request_history (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  action text not null,
  remarks text,
  created_at timestamptz not null default now()
);
grant select on public.request_history to authenticated;
grant all on public.request_history to service_role;
alter table public.request_history enable row level security;
create policy "view history" on public.request_history for select to authenticated
  using (exists (select 1 from public.requests r where r.id = request_id and (r.student_id = auth.uid() or r.faculty_id = auth.uid() or public.has_role(auth.uid(),'hod'))));

create or replace function public.log_request_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.request_history (request_id, actor_id, action) values (new.id, new.student_id, 'submitted');
  return new;
end $$;
create trigger request_created after insert on public.requests for each row execute function public.log_request_created();

create or replace function public.act_on_request(_id uuid, _approve boolean, _remarks text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.requests;
begin
  select * into r from public.requests where id = _id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.status = 'pending_faculty' then
    if r.faculty_id <> auth.uid() then raise exception 'Only the assigned faculty can act now'; end if;
    update public.requests set status = case when _approve then 'pending_hod'::request_status else 'rejected' end,
      faculty_remarks = _remarks, updated_at = now() where id = _id;
    insert into public.request_history (request_id, actor_id, action, remarks)
      values (_id, auth.uid(), case when _approve then 'faculty_approved' else 'faculty_rejected' end, _remarks);
  elsif r.status = 'pending_hod' then
    if not public.has_role(auth.uid(),'hod') then raise exception 'Only the HOD can act now'; end if;
    update public.requests set status = case when _approve then 'approved'::request_status else 'rejected' end,
      hod_remarks = _remarks, updated_at = now() where id = _id;
    insert into public.request_history (request_id, actor_id, action, remarks)
      values (_id, auth.uid(), case when _approve then 'hod_approved' else 'hod_rejected' end, _remarks);
  else
    raise exception 'Request already closed';
  end if;
end $$;
grant execute on function public.act_on_request(uuid, boolean, text) to authenticated;

-- Projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  program program_level not null,
  faculty_id uuid not null references public.profiles(id),
  max_students int not null default 1 check (max_students > 0),
  is_open boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.projects to authenticated;
grant all on public.projects to service_role;
alter table public.projects enable row level security;
create policy "projects readable" on public.projects for select to authenticated using (true);
create policy "faculty create" on public.projects for insert to authenticated
  with check (faculty_id = auth.uid() and (public.has_role(auth.uid(),'faculty') or public.has_role(auth.uid(),'hod')));
create policy "owner or hod update" on public.projects for update to authenticated
  using (faculty_id = auth.uid() or public.has_role(auth.uid(),'hod'));
create policy "owner or hod delete" on public.projects for delete to authenticated
  using (faculty_id = auth.uid() or public.has_role(auth.uid(),'hod'));

create table public.project_applications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  statement text not null default '',
  status application_status not null default 'applied',
  created_at timestamptz not null default now(),
  unique (project_id, student_id)
);
grant select, insert, delete on public.project_applications to authenticated;
grant all on public.project_applications to service_role;
alter table public.project_applications enable row level security;
create policy "view applications" on public.project_applications for select to authenticated
  using (student_id = auth.uid() or public.has_role(auth.uid(),'hod')
    or exists (select 1 from public.projects p where p.id = project_id and p.faculty_id = auth.uid()));
create policy "students apply" on public.project_applications for insert to authenticated
  with check (student_id = auth.uid() and status = 'applied' and public.has_role(auth.uid(),'student')
    and exists (select 1 from public.projects p where p.id = project_id and p.is_open));
create policy "withdraw own pending" on public.project_applications for delete to authenticated
  using (student_id = auth.uid() and status = 'applied');

create or replace function public.act_on_application(_id uuid, _approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare a public.project_applications; p public.projects; allocated int;
begin
  select * into a from public.project_applications where id = _id for update;
  if not found then raise exception 'Application not found'; end if;
  select * into p from public.projects where id = a.project_id;
  if a.status = 'applied' then
    if p.faculty_id <> auth.uid() then raise exception 'Only the project guide can act now'; end if;
    update public.project_applications set status = case when _approve then 'faculty_accepted'::application_status else 'rejected' end where id = _id;
  elsif a.status = 'faculty_accepted' then
    if not public.has_role(auth.uid(),'hod') then raise exception 'Only the HOD can allocate'; end if;
    if _approve then
      select count(*) into allocated from public.project_applications where project_id = p.id and status = 'allocated';
      if allocated >= p.max_students then raise exception 'Project is already full'; end if;
      if exists (select 1 from public.project_applications where student_id = a.student_id and status = 'allocated') then
        raise exception 'Student already has an allocated project'; end if;
      update public.project_applications set status = 'allocated' where id = _id;
      if allocated + 1 >= p.max_students then update public.projects set is_open = false where id = p.id; end if;
    else
      update public.project_applications set status = 'rejected' where id = _id;
    end if;
  else
    raise exception 'Application already closed';
  end if;
end $$;
grant execute on function public.act_on_application(uuid, boolean) to authenticated;