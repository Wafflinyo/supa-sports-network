-- Run in the Supabase SQL editor. Authentication uses Supabase email sign-in.
create extension if not exists pgcrypto;
create table if not exists public.fantasy_leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 60),
  invite_code text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 10)),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.fantasy_memberships (
  league_id uuid not null references public.fantasy_leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('commissioner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);
create index if not exists fantasy_memberships_user_idx on public.fantasy_memberships(user_id);
create or replace function public.is_fantasy_member(target_league uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.fantasy_memberships m
                where m.league_id = target_league and m.user_id = (select auth.uid()));
$$;
revoke all on function public.is_fantasy_member(uuid) from public;
grant execute on function public.is_fantasy_member(uuid) to authenticated;
alter table public.fantasy_leagues enable row level security;
alter table public.fantasy_memberships enable row level security;
create policy "Members can read their leagues" on public.fantasy_leagues
  for select to authenticated using (public.is_fantasy_member(id));
create policy "Members can read league members" on public.fantasy_memberships
  for select to authenticated using (public.is_fantasy_member(league_id));
create or replace function public.create_fantasy_league(league_name text)
returns public.fantasy_leagues language plpgsql security definer set search_path = '' as $$
declare new_league public.fantasy_leagues;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if char_length(trim(league_name)) not between 2 and 60 then raise exception 'Enter a league name (2–60 characters)'; end if;
  insert into public.fantasy_leagues (name, owner_id) values (trim(league_name), auth.uid()) returning * into new_league;
  insert into public.fantasy_memberships (league_id, user_id, role) values (new_league.id, auth.uid(), 'commissioner');
  return new_league;
end;
$$;
revoke all on function public.create_fantasy_league(text) from public;
grant execute on function public.create_fantasy_league(text) to authenticated;
create or replace function public.join_fantasy_league(code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare target_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select id into target_id from public.fantasy_leagues where invite_code = upper(trim(code));
  if target_id is null then raise exception 'Invite code not found'; end if;
  insert into public.fantasy_memberships (league_id, user_id) values (target_id, auth.uid()) on conflict do nothing;
  return target_id;
end;
$$;
revoke all on function public.join_fantasy_league(text) from public;
grant execute on function public.join_fantasy_league(text) to authenticated;
