-- Customer enquiry/case foundation for Supabase.
-- Apply only to a new Supabase project after reviewing docs/customer-case-portal-setup.md.
-- This migration does not change the live GitHub Pages site.

create table if not exists public.staff_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.staff_members enable row level security;
-- Intentionally create no client-facing policies on staff_members.
-- Manage staff membership only through the Supabase SQL editor / trusted admin tooling.

create table if not exists public.customer_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null check (char_length(trim(subject)) between 4 and 120),
  category text not null check (char_length(trim(category)) between 2 and 80),
  message text not null check (char_length(trim(message)) between 10 and 5000),
  status text not null default 'new'
    check (status in ('new', 'in_progress', 'waiting_for_customer', 'resolved', 'closed')),
  staff_response text check (staff_response is null or char_length(staff_response) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_cases_user_created_idx
  on public.customer_cases (user_id, created_at desc);
create index if not exists customer_cases_status_created_idx
  on public.customer_cases (status, created_at desc);

create or replace function public.set_customer_case_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists customer_cases_set_updated_at on public.customer_cases;
create trigger customer_cases_set_updated_at
before update on public.customer_cases
for each row execute function public.set_customer_case_updated_at();

create or replace function public.is_case_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_members sm
    where sm.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_case_staff() from public;
grant execute on function public.is_case_staff() to authenticated;

alter table public.customer_cases enable row level security;

drop policy if exists "customers and staff can read permitted cases" on public.customer_cases;
create policy "customers and staff can read permitted cases"
on public.customer_cases
for select
to authenticated
using (user_id = (select auth.uid()) or public.is_case_staff());

drop policy if exists "customers can create their own cases" on public.customer_cases;
create policy "customers can create their own cases"
on public.customer_cases
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'new'
  and staff_response is null
);

drop policy if exists "staff can update cases" on public.customer_cases;
create policy "staff can update cases"
on public.customer_cases
for update
to authenticated
using (public.is_case_staff())
with check (public.is_case_staff());

-- Clients may read cases, but may only insert the limited customer-supplied columns.
-- Staff updates are further restricted to status and the customer-visible response.
revoke all on table public.customer_cases from anon, authenticated;
grant select on table public.customer_cases to authenticated;
grant insert (user_id, subject, category, message) on table public.customer_cases to authenticated;
grant update (status, staff_response) on table public.customer_cases to authenticated;

-- Anonymous visitors cannot access case records. Do not add an anon policy.
-- Add server-side rate limiting, spam controls, and email notifications before production.
