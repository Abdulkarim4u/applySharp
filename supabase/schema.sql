-- Applyflow schema. Run in Supabase SQL editor.

-- Profiles linked to auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Statements (each application's supporting statement)
create table if not exists public.statements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled statement',
  sector text not null default 'nhs',
  job_advert_text text,
  cv_text text,
  person_spec jsonb,
  gap_fills jsonb,
  draft_text text,
  final_text text,
  status text not null default 'draft' check (status in ('draft', 'in_progress', 'completed')),
  step int not null default 0,
  last_score int,
  last_decision text check (last_decision in ('shortlist', 'borderline', 'reject')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Backfill for existing deployments (idempotent).
alter table public.statements add column if not exists last_score int;
alter table public.statements add column if not exists last_decision text
  check (last_decision in ('shortlist', 'borderline', 'reject'));

create index if not exists statements_user_id_idx on public.statements(user_id);
create index if not exists statements_updated_at_idx on public.statements(updated_at desc);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.statements enable row level security;

-- Profiles: users see and edit only their own row
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Statements: full CRUD scoped to owner
drop policy if exists "statements_select_own" on public.statements;
create policy "statements_select_own" on public.statements
  for select using (auth.uid() = user_id);

drop policy if exists "statements_insert_own" on public.statements;
create policy "statements_insert_own" on public.statements
  for insert with check (auth.uid() = user_id);

drop policy if exists "statements_update_own" on public.statements;
create policy "statements_update_own" on public.statements
  for update using (auth.uid() = user_id);

drop policy if exists "statements_delete_own" on public.statements;
create policy "statements_delete_own" on public.statements
  for delete using (auth.uid() = user_id);

-- Auto-create profile when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Maintain updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists statements_set_updated_at on public.statements;
create trigger statements_set_updated_at
  before update on public.statements
  for each row execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
