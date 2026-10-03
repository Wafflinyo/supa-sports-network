begin;
create table public.ssl_locations (
 id uuid primary key default gen_random_uuid(),
 name text not null check(char_length(trim(name)) between 2 and 80),
 description text not null default '' check(char_length(description)<=240),
 active boolean not null default true, created_at timestamptz not null default now()
);
create unique index ssl_location_name_unique on public.ssl_locations(lower(trim(name)));
create table public.ssl_teams (
 slot integer primary key references league_private.access_codes(slot) check(slot between 1 and 10),
 name text not null check(char_length(trim(name)) between 2 and 80),
 location_id uuid not null references public.ssl_locations(id),
 logo_path text not null, updated_at timestamptz not null default now()
);
create unique index ssl_team_name_unique on public.ssl_teams(lower(trim(name)));
create index ssl_team_location_idx on public.ssl_teams(location_id);
alter table public.ssl_locations enable row level security;
alter table public.ssl_teams enable row level security;
revoke all on public.ssl_locations,public.ssl_teams from anon,authenticated;
grant select on public.ssl_locations,public.ssl_teams to anon,authenticated;
create policy "Public home locations" on public.ssl_locations for select to anon,authenticated using(true);
create policy "Public registered teams" on public.ssl_teams for select to anon,authenticated using(true);

create function league_private.save_ssl_location(location uuid,location_name text,location_description text,is_active boolean)
returns public.ssl_locations language plpgsql security definer set search_path='' as $$
declare result public.ssl_locations;
begin
 if auth.uid() is null or (league_private.current_access()->>'role') is distinct from 'commissioner' then raise exception 'Commissioner access required';end if;
 if coalesce(char_length(trim(location_name)),0) not between 2 and 80 or char_length(coalesce(location_description,''))>240 or is_active is null then raise exception 'Enter a location name (2–80 characters) and description up to 240 characters';end if;
 if location is null then
  insert into public.ssl_locations(name,description,active) values(trim(location_name),trim(coalesce(location_description,'')),is_active) returning * into result;
 else
  update public.ssl_locations set name=trim(location_name),description=trim(coalesce(location_description,'')),active=is_active where id=location returning * into result;
  if not found then raise exception 'Location not found';end if;
 end if;
 insert into league_private.access_audit(actor,action,slot) values(auth.uid(),'save_home_location',0);
 return result;
exception when unique_violation then raise exception 'This location is already listed';
end $$;
create function public.save_ssl_location(location uuid,location_name text,location_description text,is_active boolean)
returns public.ssl_locations language sql security invoker set search_path='' as $$ select league_private.save_ssl_location(location,location_name,location_description,is_active); $$;

create function league_private.can_upload_ssl_logo(object_name text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare access jsonb;
begin
 if auth.uid() is null or object_name is null or object_name !~ '^(10|[1-9])/[0-9a-f-]{36}\.(png|jpg|webp)$' then return false;end if;
 access:=league_private.current_access();
 return access->>'role'='commissioner' or (access->>'role'='gm' and (access->>'slot')::integer=split_part(object_name,'/',1)::integer);
end $$;
create function public.can_upload_ssl_logo(object_name text) returns boolean
language sql stable security invoker set search_path='' as $$ select league_private.can_upload_ssl_logo(object_name); $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('ssl-team-logos','ssl-team-logos',true,5242880,array['image/png','image/jpeg','image/webp']);
create policy "Assigned GMs and commissioner upload team logos" on storage.objects for insert to authenticated
with check(bucket_id='ssl-team-logos' and (select public.can_upload_ssl_logo(name)));
-- New unique paths preserve the published logo until team submission succeeds.
-- Failed uploads can be removed; a logo attached to a team cannot be deleted through this policy.
create policy "Remove unused team logo uploads" on storage.objects for delete to authenticated
using(bucket_id='ssl-team-logos' and (select public.can_upload_ssl_logo(name)) and not exists(select 1 from public.ssl_teams where logo_path=storage.objects.name));
create policy "Manage own slot logo metadata" on storage.objects for select to authenticated
using(bucket_id='ssl-team-logos' and (select public.can_upload_ssl_logo(name)));

create function league_private.save_ssl_team(target_slot integer,team_name text,home_location uuid,team_logo_path text)
returns public.ssl_teams language plpgsql security definer set search_path='' as $$
declare access jsonb; result public.ssl_teams; town public.ssl_locations; previous_location uuid;
begin
 if target_slot is null or target_slot not between 1 and 10 then raise exception 'Choose a team slot from 1 to 10';end if;
 perform 1 from league_private.access_codes where slot=target_slot for update;
 access:=league_private.current_access();
 if auth.uid() is null or not(coalesce(access->>'role'='commissioner',false) or coalesce(access->>'role'='gm' and (access->>'slot')::integer=target_slot,false)) then raise exception 'You can only edit your assigned team';end if;
 if coalesce(char_length(trim(team_name)),0) not between 2 and 80 then raise exception 'Enter a team name (2–80 characters)';end if;
 select * into town from public.ssl_locations where id=home_location for share;
 if not found then raise exception 'Choose a listed home location';end if;
 select location_id into previous_location from public.ssl_teams where slot=target_slot;
 if not town.active and town.id is distinct from previous_location then raise exception 'This location is no longer available';end if;
 if team_logo_path is null or not league_private.can_upload_ssl_logo(team_logo_path) or split_part(team_logo_path,'/',1)::integer<>target_slot
 or not exists(select 1 from storage.objects where bucket_id='ssl-team-logos' and name=team_logo_path) then raise exception 'Upload a logo for this team first';end if;
 insert into public.ssl_teams(slot,name,location_id,logo_path) values(target_slot,trim(team_name),home_location,team_logo_path)
 on conflict(slot) do update set name=excluded.name,location_id=excluded.location_id,logo_path=excluded.logo_path,updated_at=now() returning * into result;
 update league_private.access_codes set team_name=result.name where slot=target_slot;
 insert into league_private.access_audit(actor,action,slot) values(auth.uid(),'submit_team_identity',target_slot);
 return result;
exception when unique_violation then raise exception 'Another team already uses this name';
end $$;
create function public.save_ssl_team(target_slot integer,team_name text,home_location uuid,team_logo_path text)
returns public.ssl_teams language sql security invoker set search_path='' as $$ select league_private.save_ssl_team(target_slot,team_name,home_location,team_logo_path); $$;

-- Stable slot identity keeps existing GM codes and shared coach access valid after a team rename.
create or replace function league_private.current_access() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r record;
begin
 if auth.uid() is null then return jsonb_build_object('role','viewer');end if;
 select c.slot,coalesce(t.name,c.team_name) team_name into r from league_private.session_access s
 join league_private.access_codes c on c.slot=s.slot and c.version=s.code_version
 join auth.sessions a on a.id=s.session_id and a.user_id=s.user_id
 left join public.ssl_teams t on t.slot=c.slot
 where s.session_id=nullif(auth.jwt()->>'session_id','')::uuid and s.user_id=auth.uid()
 and (a.not_after is null or a.not_after>now());
 if not found then return jsonb_build_object('role','participant');end if;
 return jsonb_build_object('role',case when r.slot=0 then 'commissioner' else 'gm' end,'slot',r.slot,'team',r.team_name);
end $$;
revoke all on function public.save_ssl_location(uuid,text,text,boolean),league_private.save_ssl_location(uuid,text,text,boolean),public.can_upload_ssl_logo(text),league_private.can_upload_ssl_logo(text),public.save_ssl_team(integer,text,uuid,text),league_private.save_ssl_team(integer,text,uuid,text) from public,anon;
grant execute on function public.save_ssl_location(uuid,text,text,boolean),league_private.save_ssl_location(uuid,text,text,boolean),public.can_upload_ssl_logo(text),league_private.can_upload_ssl_logo(text),public.save_ssl_team(integer,text,uuid,text),league_private.save_ssl_team(integer,text,uuid,text) to authenticated;
commit;
