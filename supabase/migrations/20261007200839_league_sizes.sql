begin;
alter table league_private.access_codes drop constraint access_codes_slot_check;
alter table league_private.access_codes add constraint access_codes_slot_check check(slot between 0 and 12);
alter table public.ssl_teams drop constraint ssl_teams_slot_check;
alter table public.ssl_teams add constraint ssl_teams_slot_check check(slot between 1 and 12);
insert into league_private.access_codes(slot,code_hash)
select i,encode(extensions.digest(extensions.gen_random_bytes(24),'sha256'),'hex') from generate_series(11,12) i on conflict(slot) do nothing;
alter table public.fantasy_leagues add column team_limit integer not null default 8 check(team_limit in (6,8,10));
alter table public.fantasy_draft_order drop constraint fantasy_draft_order_slot_check;
alter table public.fantasy_draft_order add constraint fantasy_draft_order_slot_check check(slot between 1 and 10);
CREATE OR REPLACE FUNCTION league_private.can_upload_ssl_logo(object_name text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare access jsonb;
begin
 if auth.uid() is null or object_name is null or object_name !~ '^(1[0-2]|[1-9])/[0-9a-f-]{36}\.(png|jpg|webp)$' then return false;end if;
 access:=league_private.current_access();
 return access->>'role'='commissioner' or (access->>'role'='gm' and (access->>'slot')::integer=split_part(object_name,'/',1)::integer);
end $function$
;
CREATE OR REPLACE FUNCTION league_private.create_fantasy_league(league_name text, league_size integer)
 RETURNS fantasy_leagues
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare new_league public.fantasy_leagues;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if char_length(trim(league_name)) not between 2 and 60 then raise exception 'Enter a league name (2–60 characters)'; end if;
  if league_size is null or league_size not in (6,8,10) then raise exception 'Choose 6, 8, or 10 teams'; end if;
  insert into public.fantasy_leagues (name, owner_id, team_limit) values (trim(league_name), auth.uid(), league_size) returning * into new_league;
  insert into public.fantasy_memberships (league_id, user_id, role) values (new_league.id, auth.uid(), 'commissioner');
  return new_league;
end;
$function$
;
CREATE OR REPLACE FUNCTION league_private.join_fantasy_league(code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare target public.fantasy_leagues%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into target from public.fantasy_leagues where invite_code = upper(trim(code)) for update;
  if target.id is null then raise exception 'Invite code not found'; end if;
  if exists(select 1 from public.fantasy_memberships where league_id = target.id and user_id = auth.uid()) then return target.id; end if;
  if target.state <> 'waiting' then raise exception 'This league has already started its draft'; end if;
  if (select count(*) from public.fantasy_memberships where league_id = target.id) >= target.team_limit then
    raise exception 'This league is full (% teams)', target.team_limit;
  end if;
  insert into public.fantasy_memberships (league_id, user_id) values (target.id, auth.uid());
  return target.id;
end;
$function$
;
CREATE OR REPLACE FUNCTION league_private.regenerate_code(target_slot integer, team_label text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare fresh text; old_name text;
begin
 if (league_private.current_access()->>'role') is distinct from 'commissioner' then raise exception 'Commissioner access required'; end if;
 if target_slot not between 1 and 12 then raise exception 'Choose a GM slot from 1 to 12'; end if;
 if length(trim(team_label)) not between 2 and 80 then raise exception 'Enter a team name (2–80 characters)'; end if;
 select team_name into old_name from league_private.access_codes where slot=target_slot for update;
 if not found then raise exception 'Unknown GM slot'; end if;
 fresh:='GM-'||upper(encode(extensions.gen_random_bytes(24),'hex'));
 update league_private.access_codes set team_name=trim(team_label),code_hash=encode(extensions.digest(fresh,'sha256'),'hex'),version=version+1,changed_at=now() where slot=target_slot;
 -- Remove elevated grants; ordinary accounts, fantasy memberships and lineups remain intact.
 delete from league_private.session_access where slot=target_slot;
 insert into league_private.access_audit(actor,action,slot) values(auth.uid(),'regenerate_gm_code',target_slot);
 return jsonb_build_object('slot',target_slot,'team',trim(team_label),'code',fresh);
end $function$
;
CREATE OR REPLACE FUNCTION league_private.save_ssl_team(target_slot integer, team_name text, home_location uuid, team_logo_path text)
 RETURNS ssl_teams
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare access jsonb; result public.ssl_teams; town public.ssl_locations; previous_location uuid;
begin
 if target_slot is null or target_slot not between 1 and 12 then raise exception 'Choose a team slot from 1 to 12';end if;
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
end $function$
;
CREATE OR REPLACE FUNCTION league_private.start_fantasy_draft(target_league uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare target public.fantasy_leagues%rowtype; managers integer;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into target from public.fantasy_leagues where id = target_league for update;
  if target.id is null or target.owner_id is distinct from auth.uid() then raise exception 'Only the commissioner can start the draft'; end if;
  if target.state <> 'waiting' then raise exception 'Draft already started'; end if;
  select count(*) into managers from public.fantasy_memberships where league_id = target_league;
  if managers <> target.team_limit then raise exception 'The draft requires exactly % managers', target.team_limit; end if;
  insert into public.fantasy_draft_order (league_id, user_id, slot)
  select target_league, user_id, row_number() over (order by joined_at, user_id)
  from public.fantasy_memberships where league_id = target_league;
  update public.fantasy_leagues set state = 'drafting', draft_started_at = now() where id = target_league;
end;
$function$
;
create or replace function public.create_fantasy_league(league_name text, league_size integer)
returns public.fantasy_leagues language sql security invoker set search_path='' as $$ select league_private.create_fantasy_league(league_name,league_size); $$;
create or replace function league_private.create_fantasy_league(league_name text)
returns public.fantasy_leagues language sql security definer set search_path='' as $$ select league_private.create_fantasy_league(league_name,8); $$;
revoke all on function public.create_fantasy_league(text,integer),league_private.create_fantasy_league(text,integer) from public,anon;
grant execute on function public.create_fantasy_league(text,integer),league_private.create_fantasy_league(text,integer) to authenticated;
commit;
