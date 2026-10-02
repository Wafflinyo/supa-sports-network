-- Username accounts and session-scoped league authority. Public visitors remain read-only.
create schema if not exists league_private;
revoke all on schema league_private from public, anon, authenticated;
grant usage on schema league_private to authenticated, service_role;

create table public.league_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
 created_at timestamptz not null default now()
);
alter table public.league_profiles enable row level security;
revoke all on public.league_profiles from anon, authenticated;
grant select on public.league_profiles to authenticated;
create policy "Read own profile" on public.league_profiles for select to authenticated using (user_id=(select auth.uid()));

create table league_private.access_codes (
 slot integer primary key check(slot between 0 and 10),
 team_name text,
 code_hash text not null unique,
 version integer not null default 1,
 commissioner_user uuid references auth.users(id),
 changed_at timestamptz not null default now()
);
create table league_private.session_access (
 session_id uuid primary key references auth.sessions(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 slot integer not null references league_private.access_codes(slot),
 code_version integer not null,
 granted_at timestamptz not null default now()
);
create index session_access_user_idx on league_private.session_access(user_id);
create table league_private.code_attempts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 window_start timestamptz not null default now(), attempts integer not null default 0
);
create table league_private.access_audit (
 id bigint generated always as identity primary key,
 actor uuid references auth.users(id) on delete set null,
 action text not null, slot integer, created_at timestamptz not null default now()
);
-- Bootstrap receipt is dashboard-admin-only. No website API role can read it.
create table league_private.setup_receipt (
 purpose text primary key, code text not null, created_at timestamptz not null default now()
);
create table league_private.auth_throttle (
 bucket text primary key, window_start timestamptz not null, attempts integer not null
);
alter table league_private.access_codes enable row level security;
alter table league_private.session_access enable row level security;
alter table league_private.code_attempts enable row level security;
alter table league_private.access_audit enable row level security;
alter table league_private.setup_receipt enable row level security;
alter table league_private.auth_throttle enable row level security;
revoke all on all tables in schema league_private from public, anon, authenticated, service_role;

create function league_private.make_profile() returns trigger language plpgsql security definer set search_path='' as $$
declare name text;
begin
 name := split_part(new.email,'@',1);
 if new.email not like '%@accounts.supasports.invalid' or name !~ '^[a-z0-9_]{3,24}$' then
  raise exception 'Create a username account through the league website';
 end if;
 insert into public.league_profiles(user_id,username) values(new.id,name);
 return new;
end $$;
revoke all on function league_private.make_profile() from public, anon;
create trigger league_username_profile after insert on auth.users for each row execute function league_private.make_profile();

create function league_private.current_access() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r record;
begin
 if auth.uid() is null then return jsonb_build_object('role','viewer'); end if;
 select c.slot,c.team_name into r from league_private.session_access s
 join league_private.access_codes c on c.slot=s.slot and c.version=s.code_version
 join auth.sessions a on a.id=s.session_id and a.user_id=s.user_id
 where s.session_id=nullif(auth.jwt()->>'session_id','')::uuid and s.user_id=auth.uid()
 and (a.not_after is null or a.not_after>now());
 if not found then return jsonb_build_object('role','participant'); end if;
 return jsonb_build_object('role',case when r.slot=0 then 'commissioner' else 'gm' end,'slot',r.slot,'team',r.team_name);
end $$;
revoke all on function league_private.current_access() from public, anon;
grant execute on function league_private.current_access() to authenticated;
create function public.league_session_access() returns jsonb language sql security invoker set search_path='' as $$ select league_private.current_access(); $$;
revoke all on function public.league_session_access() from public, anon;
grant execute on function public.league_session_access() to authenticated;

create function league_private.activate_access(code text) returns jsonb language plpgsql security definer set search_path='' as $$
declare c league_private.access_codes%rowtype; sid uuid; tries integer;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 sid:=nullif(auth.jwt()->>'session_id','')::uuid;
 if sid is null or not exists(select 1 from auth.sessions where id=sid and user_id=auth.uid() and (not_after is null or not_after>now())) then
  raise exception 'Sign in again';
 end if;
 -- Serialize attempts per account. Return errors instead of raising to commit failed attempts.
 insert into league_private.code_attempts(user_id,attempts) values(auth.uid(),1)
 on conflict(user_id) do update set attempts=case when league_private.code_attempts.window_start < now()-interval '15 minutes' then 1 else league_private.code_attempts.attempts+1 end,
 window_start=case when league_private.code_attempts.window_start < now()-interval '15 minutes' then now() else league_private.code_attempts.window_start end
 returning attempts into tries;
 if tries>5 then return jsonb_build_object('error','Too many code attempts. Try again in 15 minutes.'); end if;
 if length(code)>128 then return jsonb_build_object('error','Invalid or inactive permission code.'); end if;
 select * into c from league_private.access_codes where code_hash=encode(extensions.digest(upper(trim(code)),'sha256'),'hex') for update;
 if not found or (c.slot<>0 and c.team_name is null) then return jsonb_build_object('error','Invalid or inactive permission code.'); end if;
 if c.slot=0 and c.commissioner_user is not null and c.commissioner_user<>auth.uid() then
  return jsonb_build_object('error','This commissioner code belongs to another account.');
 end if;
 if c.slot=0 and c.commissioner_user is null then
  update league_private.access_codes set commissioner_user=auth.uid() where slot=0;
 end if;
 insert into league_private.session_access(session_id,user_id,slot,code_version) values(sid,auth.uid(),c.slot,c.version)
 on conflict(session_id) do update set slot=excluded.slot,code_version=excluded.code_version,granted_at=now();
 insert into league_private.access_audit(actor,action,slot) values(auth.uid(),'code_login',c.slot);
 return league_private.current_access();
end $$;
revoke all on function league_private.activate_access(text) from public, anon;
grant execute on function league_private.activate_access(text) to authenticated;
create function public.activate_league_access(code text) returns jsonb language sql security invoker set search_path='' as $$ select league_private.activate_access(code); $$;
revoke all on function public.activate_league_access(text) from public, anon;
grant execute on function public.activate_league_access(text) to authenticated;

create function league_private.leave_access() returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 delete from league_private.session_access where session_id=nullif(auth.jwt()->>'session_id','')::uuid and user_id=auth.uid();
end $$;
revoke all on function league_private.leave_access() from public, anon;
grant execute on function league_private.leave_access() to authenticated;
create function public.leave_league_access() returns void language sql security invoker set search_path='' as $$ select league_private.leave_access(); $$;
revoke all on function public.leave_league_access() from public, anon;
grant execute on function public.leave_league_access() to authenticated;

create function league_private.code_list() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if (league_private.current_access()->>'role') <> 'commissioner' then raise exception 'Commissioner access required'; end if;
 return (select jsonb_agg(jsonb_build_object('slot',slot,'team',team_name,'version',version,'changedAt',changed_at) order by slot) from league_private.access_codes where slot<>0);
end $$;
revoke all on function league_private.code_list() from public, anon;
grant execute on function league_private.code_list() to authenticated;
create function public.league_code_list() returns jsonb language sql security invoker set search_path='' as $$ select league_private.code_list(); $$;
revoke all on function public.league_code_list() from public, anon;
grant execute on function public.league_code_list() to authenticated;

create function league_private.regenerate_code(target_slot integer, team_label text) returns jsonb language plpgsql security definer set search_path='' as $$
declare fresh text; old_name text;
begin
 if (league_private.current_access()->>'role') <> 'commissioner' then raise exception 'Commissioner access required'; end if;
 if target_slot not between 1 and 10 then raise exception 'Choose a GM slot from 1 to 10'; end if;
 if length(trim(team_label)) not between 2 and 80 then raise exception 'Enter a team name (2–80 characters)'; end if;
 select team_name into old_name from league_private.access_codes where slot=target_slot for update;
 if not found then raise exception 'Unknown GM slot'; end if;
 fresh:='GM-'||upper(encode(extensions.gen_random_bytes(24),'hex'));
 update league_private.access_codes set team_name=trim(team_label),code_hash=encode(extensions.digest(fresh,'sha256'),'hex'),version=version+1,changed_at=now() where slot=target_slot;
 -- Remove elevated grants; ordinary accounts, fantasy memberships and lineups remain intact.
 delete from league_private.session_access where slot=target_slot;
 insert into league_private.access_audit(actor,action,slot) values(auth.uid(),'regenerate_gm_code',target_slot);
 return jsonb_build_object('slot',target_slot,'team',trim(team_label),'code',fresh);
end $$;
revoke all on function league_private.regenerate_code(integer,text) from public, anon;
grant execute on function league_private.regenerate_code(integer,text) to authenticated;
create function public.regenerate_gm_code(target_slot integer,team_label text) returns jsonb language sql security invoker set search_path='' as $$ select league_private.regenerate_code(target_slot,team_label); $$;
revoke all on function public.regenerate_gm_code(integer,text) from public, anon;
grant execute on function public.regenerate_gm_code(integer,text) to authenticated;

-- Service-only throttle for the username registration/login gateway.
create function league_private.auth_allow(bucket_key text,max_attempts integer) returns boolean language plpgsql security definer set search_path='' as $$
declare tries integer;
begin
 if (select current_setting('request.jwt.claims',true)::jsonb->>'role') is distinct from 'service_role' then raise exception 'Server only'; end if;
 insert into league_private.auth_throttle(bucket,window_start,attempts) values(bucket_key,now(),1)
 on conflict(bucket) do update set attempts=case when league_private.auth_throttle.window_start<now()-interval '15 minutes' then 1 else league_private.auth_throttle.attempts+1 end,
 window_start=case when league_private.auth_throttle.window_start<now()-interval '15 minutes' then now() else league_private.auth_throttle.window_start end
 returning attempts into tries;
 return tries<=max_attempts;
end $$;
revoke all on function league_private.auth_allow(text,integer) from public, anon, authenticated;
grant execute on function league_private.auth_allow(text,integer) to service_role;
create function public.league_auth_allow(bucket_key text,max_attempts integer) returns boolean language sql security invoker set search_path='' as $$ select league_private.auth_allow(bucket_key,max_attempts); $$;
revoke all on function public.league_auth_allow(text,integer) from public, anon, authenticated;
grant execute on function public.league_auth_allow(text,integer) to service_role;

-- Generate only inside Postgres. No literal code belongs in source control.
do $$ declare secret text; i integer; begin
 secret:='SSL-COMM-'||upper(encode(extensions.gen_random_bytes(24),'hex'));
 insert into league_private.access_codes(slot,code_hash) values(0,encode(extensions.digest(secret,'sha256'),'hex'));
 insert into league_private.setup_receipt(purpose,code) values('Initial commissioner code',secret);
 for i in 1..10 loop
  insert into league_private.access_codes(slot,code_hash) values(i,encode(extensions.digest(encode(extensions.gen_random_bytes(24),'hex'),'sha256'),'hex'));
 end loop;
end $$;

-- Supabase default privileges may grant EXECUTE directly to anon as well as PUBLIC.
do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('is_fantasy_member','create_fantasy_league','join_fantasy_league','start_fantasy_draft','make_fantasy_pick','ensure_fantasy_week','swap_fantasy_lineup','league_session_access','activate_league_access','leave_league_access','league_code_list','regenerate_gm_code','league_auth_allow')
 loop execute format('revoke all on function %s from public, anon',f.signature); end loop;
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='league_private'
 loop execute format('revoke all on function %s from public, anon',f.signature); end loop;
end $$;

create function league_private.keep_login_identifier() returns trigger language plpgsql set search_path='' as $$
begin
 if old.email like '%@accounts.supasports.invalid' and new.email is distinct from old.email then
  raise exception 'Username account identifiers cannot be changed';
 end if;
 return new;
end $$;
revoke all on function league_private.keep_login_identifier() from public, anon, authenticated;
create trigger league_login_identifier before update of email on auth.users for each row execute function league_private.keep_login_identifier();
