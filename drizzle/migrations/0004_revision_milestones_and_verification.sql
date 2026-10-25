-- Revision loop: faculty can send a request back to the student
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'needs_revision';

-- Project details per the allocation workflow
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS prerequisites text;
ALTER TABLE public.project_applications ADD COLUMN IF NOT EXISTS cgpa numeric(4,2);

-- Workflow C: semester milestones for allocated projects
CREATE TYPE public.milestone_status AS ENUM ('pending','submitted','approved');
CREATE TABLE public.milestones (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.project_applications(id) on delete cascade,
  seq int not null,
  title text not null,
  description text not null default '',
  due_date date,
  status public.milestone_status not null default 'pending',
  student_note text,
  supervisor_remarks text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (application_id, seq)
);
GRANT SELECT ON public.milestones TO authenticated;
GRANT ALL ON public.milestones TO service_role;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "milestones visible to participants"
  ON public.milestones FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_applications a
      JOIN public.projects p ON p.id = a.project_id
      WHERE a.id = milestones.application_id
        AND (a.student_id = auth.uid() OR p.faculty_id = auth.uid() OR public.has_role(auth.uid(), 'hod'))
    )
  );

-- Seed the standard milestone set for already-allocated students
INSERT INTO public.milestones (application_id, seq, title, description)
SELECT a.id, v.seq, v.title, v.description
FROM public.project_applications a
CROSS JOIN (VALUES
  (1, 'Topic presentation & synopsis defense', 'Present the topic and defend the synopsis before the review panel.'),
  (2, 'Mid-term progress review', 'Submit the mid-term progress report with supervisor sign-off.'),
  (3, 'Final report & evaluation', 'Submit the final report; supervisor and HOD complete the final evaluation.')
) AS v(seq, title, description)
WHERE a.status = 'allocated'
ON CONFLICT DO NOTHING;

-- Faculty asks the student to revise a pending request
CREATE OR REPLACE FUNCTION public.request_changes(_id uuid, _remarks text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
declare r public.requests; clean text := nullif(btrim(coalesce(_remarks, '')), '');
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if clean is null then raise exception 'Tell the student what to change'; end if;
  select * into r from public.requests where id = _id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.status <> 'pending_faculty' or r.faculty_id <> auth.uid() or not public.has_role(auth.uid(), 'faculty') then
    raise exception 'Only the assigned faculty can request changes now';
  end if;
  update public.requests set status = 'needs_revision'::request_status, faculty_remarks = clean, updated_at = now() where id = _id;
  insert into public.request_history(request_id, actor_id, action, remarks) values (_id, auth.uid(), 'faculty_requested_changes', clean);
end $fn$;

-- Student revises and resubmits a request that needs changes
CREATE OR REPLACE FUNCTION public.revise_request(_id uuid, _details text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
declare r public.requests; clean text := nullif(btrim(coalesce(_details, '')), '');
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if clean is null then raise exception 'Add the updated details before resubmitting'; end if;
  select * into r from public.requests where id = _id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.student_id <> auth.uid() or r.status <> 'needs_revision' then
    raise exception 'Only the student can revise a request that needs changes';
  end if;
  update public.requests set status = 'pending_faculty'::request_status, details = clean, faculty_remarks = null, updated_at = now() where id = _id;
  insert into public.request_history(request_id, actor_id, action) values (_id, auth.uid(), 'student_revised');
end $fn$;

-- Student submits a milestone
CREATE OR REPLACE FUNCTION public.submit_milestone(_id uuid, _note text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
declare clean text := nullif(btrim(coalesce(_note, '')), '');
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if clean is null then raise exception 'Add a short progress note'; end if;
  if not exists (
    select 1 from public.milestones m
    join public.project_applications a on a.id = m.application_id
    where m.id = _id and a.student_id = auth.uid() and a.status = 'allocated' and m.status = 'pending'
  ) then raise exception 'Milestone not found, not yours, or already submitted'; end if;
  update public.milestones set status = 'submitted', student_note = clean, completed_at = now() where id = _id;
end $fn$;

-- Supervisor (or HOD) reviews a submitted milestone
CREATE OR REPLACE FUNCTION public.act_on_milestone(_id uuid, _approve boolean, _remarks text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
declare clean text := nullif(btrim(coalesce(_remarks, '')), ''); ok boolean;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if not _approve and clean is null then raise exception 'Give feedback when sending a milestone back'; end if;
  if not exists (
    select 1 from public.milestones m
    join public.project_applications a on a.id = m.application_id
    join public.projects p on p.id = a.project_id
    where m.id = _id and a.status = 'allocated' and m.status = 'submitted'
      and (p.faculty_id = auth.uid() or public.has_role(auth.uid(), 'hod'))
  ) then raise exception 'Milestone not found or not waiting on you'; end if;
  update public.milestones
    set status = case when _approve then 'approved'::milestone_status else 'pending'::milestone_status end,
        supervisor_remarks = clean,
        completed_at = case when _approve then now() else null end
  where id = _id;
end $fn$;

-- Milestone seeding when the HOD allocates a project
CREATE OR REPLACE FUNCTION public.act_on_application(_id uuid, _approve boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
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
      insert into public.milestones (application_id, seq, title, description) values
        (_id, 1, 'Topic presentation & synopsis defense', 'Present the topic and defend the synopsis before the review panel.'),
        (_id, 2, 'Mid-term progress review', 'Submit the mid-term progress report with supervisor sign-off.'),
        (_id, 3, 'Final report & evaluation', 'Submit the final report; supervisor and HOD complete the final evaluation.')
      on conflict do nothing;
      if allocated + 1 >= p.max_students then update public.projects set is_open = false where id = p.id; end if;
    else update public.project_applications set status = 'rejected' where id = _id; end if;
  else raise exception 'Application already closed'; end if;
end $fn$;

-- Read-only certificate lookup for the public verification page
CREATE OR REPLACE FUNCTION public.get_public_verification(_request_id uuid)
RETURNS TABLE (request_type text, title text, student_name text, program public.program_level, approved_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $fn$
  SELECT r.request_type, r.title, s.full_name, r.program, r.updated_at
  FROM public.requests r JOIN public.profiles s ON s.id = r.student_id
  WHERE r.id = _request_id AND r.status = 'approved'
$fn$;

REVOKE EXECUTE ON FUNCTION public.request_changes(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.request_changes(uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.revise_request(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.revise_request(uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_milestone(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.submit_milestone(uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.act_on_milestone(uuid, boolean, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.act_on_milestone(uuid, boolean, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_public_verification(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_public_verification(uuid) TO anon, authenticated;
GRANT ALL ON FUNCTION public.request_changes(uuid, text) TO service_role;
GRANT ALL ON FUNCTION public.revise_request(uuid, text) TO service_role;
GRANT ALL ON FUNCTION public.submit_milestone(uuid, text) TO service_role;
GRANT ALL ON FUNCTION public.act_on_milestone(uuid, boolean, text) TO service_role;
GRANT ALL ON FUNCTION public.get_public_verification(uuid) TO service_role;