
-- Conference selections are franchise-owned, not commissioner-assigned.
alter table public.ssl_teams
  add column conference text not null
  constraint ssl_teams_conference_valid check (conference in ('supa','galaxy'));

-- This lock serializes selections across *different* GM slots, preventing races
-- in which two teams simultaneously claim the sixth remaining seat.
create function league_private.save_ssl_team(
 target_slot integer, team_name text, home_location uuid,
 team_logo_path text, chosen_conference text
) returns public.ssl_teams
language plpgsql security definer set search_path = '' as $$
declare
 a jsonb; result public.ssl_teams; town public.ssl_locations;
 previous_location uuid; previous_conference text;
 occupied integer;
begin
 if target_slot is null or target_slot not between 1 and 12 then raise exception 'Choose a team slot from 1 to 12'; end if;
 perform pg_advisory_xact_lock(736114225);
 perform 1 from league_private.access_codes where slot = target_slot for update;
 a := league_private.current_access();
 if auth.uid() is null or not (
  coalesce(a->>'role'='commissioner',false) or
  coalesce(a->>'role'='gm' and (a->>'slot')::integer=target_slot,false)
 ) then raise exception 'You can only edit your assigned team'; end if;
 if coalesce(char_length(trim(team_name)),0) not between 2 and 80 then raise exception 'Enter a team name (2–80 characters)'; end if;
 if chosen_conference is null or chosen_conference not in ('supa','galaxy') then raise exception 'Choose Supa Mario or Mario Galaxy Conference'; end if;
 select * into town from public.ssl_locations where id=home_location for share;
 if not found then raise exception 'Choose a listed home location'; end if;
 select location_id,conference into previous_location,previous_conference
 from public.ssl_teams where slot=target_slot;
 if not town.active and town.id is distinct from previous_location then raise exception 'This location is no longer available'; end if;
 if previous_conference is distinct from chosen_conference and exists (
  select 1 from league_private.ssl_season_states s,
    lateral jsonb_array_elements(coalesce(s.state->'teams','[]'::jsonb)) t
  where t.value->>'slot'=target_slot::text
    and s.state->>'status' not in ('setup','offseason','archived')
 ) then raise exception 'Your conference is locked once the draft-date poll begins'; end if;
 select count(*) into occupied from public.ssl_teams
 where conference=chosen_conference and slot<>target_slot;
 if occupied>=6 then raise exception 'This conference is full (6/6). Please choose the other conference'; end if;
 if team_logo_path is null or not league_private.can_upload_ssl_logo(team_logo_path)
   or split_part(team_logo_path,'/',1)::integer<>target_slot
   or not exists (select 1 from storage.objects where bucket_id='ssl-team-logos' and name=team_logo_path)
 then raise exception 'Upload a logo for this team first'; end if;
 insert into public.ssl_teams(slot,name,location_id,logo_path,conference)
 values(target_slot,trim(team_name),home_location,team_logo_path,chosen_conference)
 on conflict(slot) do update set name=excluded.name, location_id=excluded.location_id,
   logo_path=excluded.logo_path, conference=excluded.conference, updated_at=now()
 returning * into result;
 update league_private.access_codes set team_name=result.name where slot=target_slot;
 insert into league_private.access_audit(actor,action,slot)
 values(auth.uid(),'submit_team_identity',target_slot);
 return result;
exception when unique_violation then raise exception 'Another team already uses this name';
end $$;
revoke all on function league_private.save_ssl_team(integer,text,uuid,text,text) from public,anon,authenticated;

-- The original four-argument public endpoint must not be able to bypass the
-- required choice. The new five-argument endpoint is the only supported write path.
revoke all on function public.save_ssl_team(integer,text,uuid,text) from public,anon,authenticated;
create function public.save_ssl_team(
 target_slot integer, team_name text, home_location uuid,
 team_logo_path text, chosen_conference text
) returns public.ssl_teams
language sql security invoker set search_path='' as $$
 select league_private.save_ssl_team(target_slot,team_name,home_location,team_logo_path,chosen_conference);
$$;
revoke all on function public.save_ssl_team(integer,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.save_ssl_team(integer,text,uuid,text,text) to authenticated;

-- Season snapshots inherit each team's choice automatically; no manual
-- commissioner re-assignment and no mismatched seasonal standings.
create function league_private.ssl_sync_conferences() returns trigger
language plpgsql set search_path='' as $$
declare t jsonb; chosen text; all_teams jsonb:='[]'::jsonb;
 count_supa integer:=0; count_galaxy integer:=0; selected integer:=0;
begin
 if new.state->>'status' not in ('setup','poll','scheduled','drafting','postdraft') then return new; end if;
 if jsonb_typeof(new.state->'teams') is distinct from 'array' then return new; end if;
 for t in select value from jsonb_array_elements(new.state->'teams') loop
  select conference into chosen from public.ssl_teams where slot=(t->>'slot')::integer;
  if chosen not in ('supa','galaxy') or chosen is null then
   raise exception 'Register each selected team and conference first';
  end if;
  if chosen='supa' then count_supa:=count_supa+1; else count_galaxy:=count_galaxy+1; end if;
  selected:=selected+1;
  all_teams:=all_teams||jsonb_build_array(t||jsonb_build_object('conference',chosen));
 end loop;
 new.state:=jsonb_set(new.state,'{teams}',all_teams)
  ||jsonb_build_object('conferencesSet', selected=12 and count_supa=6 and count_galaxy=6);
 return new;
end $$;
create trigger ssl_sync_conferences_before_write
 before insert or update of state on league_private.ssl_season_states
 for each row execute function league_private.ssl_sync_conferences();
