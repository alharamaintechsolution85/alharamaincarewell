create or replace function public.current_app_role()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'patient');
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  role text not null default 'patient'
    check (role in ('patient', 'doctor', 'nurse', 'administrator')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on table public.profiles from anon, authenticated;
grant select, insert on table public.profiles to authenticated;

create or replace function public.create_patient_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), ''),
    'patient'
  );
  return new;
end;
$$;

create trigger on_auth_user_created_create_profile
  after insert on auth.users
  for each row execute function public.create_patient_profile();

revoke all on function public.create_patient_profile() from public;

create policy "Users can read their own profile"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "Patients can create their own patient profile"
  on public.profiles for insert
  to authenticated
  with check (
    id = (select auth.uid())
    and role = 'patient'
  );

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users (id) on delete cascade,
  clinician_id uuid references auth.users (id) on delete set null,
  starts_at timestamptz not null,
  visit_type text not null check (visit_type in ('video', 'in_person')),
  status text not null default 'requested'
    check (status in ('requested', 'confirmed', 'cancelled', 'completed')),
  created_at timestamptz not null default now()
);

alter table public.appointments enable row level security;
revoke all on table public.appointments from anon, authenticated;
grant select, insert on table public.appointments to authenticated;
create index if not exists appointments_patient_starts_at_idx
  on public.appointments (patient_id, starts_at);
create index if not exists appointments_clinician_starts_at_idx
  on public.appointments (clinician_id, starts_at);

create policy "Patients and assigned clinicians can read appointments"
  on public.appointments for select
  to authenticated
  using (
    patient_id = (select auth.uid())
    or (
      clinician_id = (select auth.uid())
      and (select public.current_app_role()) in ('doctor', 'nurse', 'administrator')
    )
  );

create policy "Patients can request their own appointments"
  on public.appointments for insert
  to authenticated
  with check (
    patient_id = (select auth.uid())
    and status = 'requested'
    and clinician_id is null
  );

create policy "Assigned clinicians can update appointments"
  on public.appointments for update
  to authenticated
  using (
    clinician_id = (select auth.uid())
    and (select public.current_app_role()) in ('doctor', 'nurse', 'administrator')
  )
  with check (
    clinician_id = (select auth.uid())
    and (select public.current_app_role()) in ('doctor', 'nurse', 'administrator')
  );

revoke update on table public.appointments from authenticated;
grant update (status, starts_at, visit_type)
  on table public.appointments to authenticated;

create table if not exists public.clinical_ai_reviews (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users (id) on delete cascade,
  clinician_id uuid not null references auth.users (id) on delete cascade,
  suggestion jsonb not null,
  confidence numeric(5, 2) not null check (confidence >= 0 and confidence <= 100),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null)
    or
    (status in ('approved', 'rejected') and reviewed_by is not null and reviewed_at is not null)
  )
);

alter table public.clinical_ai_reviews enable row level security;
revoke all on table public.clinical_ai_reviews from anon, authenticated;
grant select on table public.clinical_ai_reviews to authenticated;
create index if not exists clinical_ai_reviews_clinician_created_at_idx
  on public.clinical_ai_reviews (clinician_id, created_at desc);

create or replace function public.set_clinical_review_metadata()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.reviewed_by := (select auth.uid());
  new.reviewed_at := now();
  return new;
end;
$$;

create trigger set_clinical_review_metadata_before_update
  before update on public.clinical_ai_reviews
  for each row
  when (old.status = 'pending' and new.status in ('approved', 'rejected'))
  execute function public.set_clinical_review_metadata();

create policy "Assigned clinicians can read clinical suggestions"
  on public.clinical_ai_reviews for select
  to authenticated
  using (
    clinician_id = (select auth.uid())
    and (select public.current_app_role()) in ('doctor', 'administrator')
  );

create policy "Assigned clinicians can review pending suggestions"
  on public.clinical_ai_reviews for update
  to authenticated
  using (
    clinician_id = (select auth.uid())
    and (select public.current_app_role()) in ('doctor', 'administrator')
    and status = 'pending'
  )
  with check (
    clinician_id = (select auth.uid())
    and (select public.current_app_role()) in ('doctor', 'administrator')
    and status in ('approved', 'rejected')
  );

revoke update on table public.clinical_ai_reviews from authenticated;
grant update (status)
  on table public.clinical_ai_reviews to authenticated;

revoke all on function public.current_app_role() from public;
grant execute on function public.current_app_role() to authenticated;
revoke all on function public.set_clinical_review_metadata() from public;
