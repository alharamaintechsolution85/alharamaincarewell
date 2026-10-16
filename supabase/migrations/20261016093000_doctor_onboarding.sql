alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in (
    'patient',
    'visitor',
    'caregiver',
    'doctor',
    'nurse',
    'administrator',
    'reception',
    'lab_technician',
    'pharmacist',
    'auditor'
  ));

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select profile.role from public.profiles as profile where profile.id = (select auth.uid())),
    'patient'
  );
$$;

revoke all on function public.current_app_role() from public;
grant execute on function public.current_app_role() to authenticated;

create table if not exists public.doctor_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 2 and 120),
  contact_email text not null check (length(trim(contact_email)) <= 254),
  contact_phone text not null check (length(trim(contact_phone)) between 7 and 32),
  specialty text not null check (specialty in (
    'primary-care',
    'cardiology',
    'neurology',
    'pediatrics',
    'orthopedics',
    'ophthalmology',
    'dermatology',
    'psychiatry',
    'oncology',
    'gynecology',
    'emergency-medicine',
    'other'
  )),
  qualification text not null check (length(trim(qualification)) between 2 and 160),
  institution text not null check (length(trim(institution)) between 2 and 180),
  medical_license_number text not null check (length(trim(medical_license_number)) between 3 and 100),
  license_region text not null check (length(trim(license_region)) between 2 and 120),
  graduation_year integer not null check (graduation_year between 1950 and 2100),
  years_experience integer not null check (years_experience between 0 and 70),
  biography text not null default '' check (length(biography) <= 1200),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text check (rejection_reason is null or length(rejection_reason) <= 1000),
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null)
    or
    (status in ('approved', 'rejected') and reviewed_by is not null and reviewed_at is not null)
  ),
  check (status <> 'rejected' or nullif(trim(rejection_reason), '') is not null)
);

create unique index if not exists doctor_applications_license_region_unique_idx
  on public.doctor_applications (lower(trim(medical_license_number)), lower(trim(license_region)));
create index if not exists doctor_applications_status_created_at_idx
  on public.doctor_applications (status, created_at);

alter table public.doctor_applications enable row level security;
revoke all on table public.doctor_applications from anon, authenticated;
grant select, insert on table public.doctor_applications to authenticated;
grant update (status, rejection_reason)
  on table public.doctor_applications to authenticated;

create policy "Applicants can view their own doctor application"
  on public.doctor_applications for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.current_app_role()) = 'administrator'
  );

create policy "Patient accounts can submit one doctor application"
  on public.doctor_applications for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.current_app_role()) in ('patient', 'visitor')
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
  );

create policy "Administrators can decide pending doctor applications"
  on public.doctor_applications for update
  to authenticated
  using (
    (select public.current_app_role()) = 'administrator'
    and status = 'pending'
  )
  with check (
    (select public.current_app_role()) = 'administrator'
    and status in ('approved', 'rejected')
    and reviewed_by = (select auth.uid())
    and reviewed_at is not null
  );

create or replace function public.set_doctor_application_review_metadata()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select public.current_app_role()) <> 'administrator' then
    raise exception 'Only a hospital administrator can review doctor applications';
  end if;

  new.reviewed_by := (select auth.uid());
  new.reviewed_at := now();
  return new;
end;
$$;

create trigger set_doctor_application_review_metadata_before_update
  before update on public.doctor_applications
  for each row
  when (old.status = 'pending' and new.status in ('approved', 'rejected'))
  execute function public.set_doctor_application_review_metadata();

revoke all on function public.set_doctor_application_review_metadata() from public;

create table if not exists public.doctor_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  contact_email text not null,
  contact_phone text not null,
  specialty text not null,
  qualification text not null,
  institution text not null,
  license_region text not null,
  graduation_year integer not null,
  years_experience integer not null,
  biography text not null default '',
  created_at timestamptz not null default now()
);

alter table public.doctor_profiles enable row level security;
revoke all on table public.doctor_profiles from anon, authenticated;
grant select on table public.doctor_profiles to authenticated;

create policy "Authenticated users can view approved doctors"
  on public.doctor_profiles for select
  to authenticated
  using (true);

create or replace function public.publish_approved_doctor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'approved' and old.status = 'pending' then
    update public.profiles
      set display_name = new.full_name, role = 'doctor'
      where id = new.user_id and role in ('patient', 'visitor');

    if not found then
      raise exception 'Doctor applicant profile is missing or already has an elevated role';
    end if;

    insert into public.doctor_profiles (
      id,
      full_name,
      contact_email,
      contact_phone,
      specialty,
      qualification,
      institution,
      license_region,
      graduation_year,
      years_experience,
      biography
    )
    values (
      new.user_id,
      new.full_name,
      lower(trim(new.contact_email)),
      new.contact_phone,
      new.specialty,
      new.qualification,
      new.institution,
      new.license_region,
      new.graduation_year,
      new.years_experience,
      new.biography
    );
  end if;
  return new;
end;
$$;

create trigger publish_approved_doctor_after_update
  after update of status on public.doctor_applications
  for each row execute function public.publish_approved_doctor();

revoke all on function public.publish_approved_doctor() from public;

create or replace function public.create_patient_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_access text := new.raw_user_meta_data ->> 'requested_access';
  assigned_role text := 'patient';
begin
  if requested_access = 'visitor' then
    assigned_role := 'visitor';
  end if;

  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), ''),
    assigned_role
  );
  return new;
end;
$$;

revoke all on function public.create_patient_profile() from public;

alter publication supabase_realtime add table public.doctor_applications;
