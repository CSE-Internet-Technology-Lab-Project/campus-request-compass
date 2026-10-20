alter type public.request_status add value if not exists 'withdrawn';

alter table public.requests add column if not exists needed_by date;

create or replace function public.act_on_request(_id uuid, _approve boolean, _remarks text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.requests; clean text := nullif(btrim(coalesce(_remarks, '')), '');
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if not _approve and clean is null then raise exception 'Give a reason when rejecting'; end if;
  select * into r from public.requests where id = _id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.status = 'pending_faculty' then
    if r.faculty_id <> auth.uid() or not public.has_role(auth.uid(),'faculty') then raise exception 'Only the assigned faculty can act now'; end if;
    update public.requests set status = case when _approve then 'pending_hod'::request_status else 'rejected'::request_status end, faculty_remarks = clean, updated_at = now() where id = _id;
    insert into public.request_history(request_id,actor_id,action,remarks) values (_id,auth.uid(),case when _approve then 'faculty_approved' else 'faculty_rejected' end,clean);
  elsif r.status = 'pending_hod' then
    if not public.has_role(auth.uid(),'hod') then raise exception 'Only the HOD can act now'; end if;
    update public.requests set status = case when _approve then 'approved'::request_status else 'rejected'::request_status end, hod_remarks = clean, updated_at = now() where id = _id;
    insert into public.request_history(request_id,actor_id,action,remarks) values (_id,auth.uid(),case when _approve then 'hod_approved' else 'hod_rejected' end,clean);
  else raise exception 'Request already closed'; end if;
end $$;

create or replace function public.withdraw_request(_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r public.requests;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into r from public.requests where id = _id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.student_id <> auth.uid() then raise exception 'Only the student who submitted this can withdraw it'; end if;
  if r.status::text not in ('pending_faculty','pending_hod') then raise exception 'Only pending requests can be withdrawn'; end if;
  update public.requests set status = 'withdrawn'::request_status, updated_at = now() where id = _id;
  insert into public.request_history(request_id,actor_id,action) values (_id,auth.uid(),'withdrawn');
end $$;

revoke execute on function public.act_on_request(uuid,boolean,text) from public, anon;
revoke execute on function public.withdraw_request(uuid) from public, anon;
grant execute on function public.act_on_request(uuid,boolean,text), public.withdraw_request(uuid) to authenticated;