-- Expand the stable website player ID range without changing existing identities or permissions.
BEGIN;
CREATE OR REPLACE FUNCTION league_private.create_ssl_season(season_name text, team_entries jsonb, draft_rounds integer, snake_order boolean)
 RETURNS ssl_draft_seasons
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result public.ssl_draft_seasons; entry jsonb; lottery jsonb; total integer;
begin
 if auth.uid() is null or (league_private.current_access()->>'role') is distinct from 'commissioner' then raise exception 'Commissioner access required'; end if;
 if jsonb_typeof(team_entries) is distinct from 'array' then raise exception 'Supply a team list'; end if;
 total:=jsonb_array_length(team_entries);
 if total not between 2 and 16 or draft_rounds is null or draft_rounds not between 1 and 20 or total*draft_rounds>173 then raise exception 'Use 2–16 teams and rounds within the 173-player pool'; end if;
 for entry in select value from jsonb_array_elements(team_entries) loop
  if jsonb_typeof(entry) is distinct from 'object' or coalesce(char_length(trim(entry->>'name')),0) not between 2 and 80 or coalesce(char_length(entry->>'id'),0) not between 1 and 40 then raise exception 'Each team needs an ID and name'; end if;
  if coalesce(entry->>'logo','')<>'' and ((entry->>'logo') !~ '^https://' or char_length(entry->>'logo')>500) then raise exception 'Logo URLs must use HTTPS'; end if;
 end loop;
 if (select count(distinct value->>'id') from jsonb_array_elements(team_entries))<>total or (select count(distinct lower(trim(value->>'name'))) from jsonb_array_elements(team_entries))<>total then raise exception 'Teams must be unique'; end if;
 insert into public.ssl_draft_seasons(name,teams,rounds,snake) values(trim(season_name),team_entries,draft_rounds,coalesce(snake_order,true)) returning * into result;
 select jsonb_agg(value order by draw) into lottery from (select value,random() draw from jsonb_array_elements(team_entries)) shuffled;
 insert into league_private.ssl_lottery_order values(result.id,lottery);
 return result;
end $function$
;
CREATE OR REPLACE FUNCTION league_private.make_fantasy_pick(target_league uuid, chosen_player integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare target public.fantasy_leagues%rowtype; managers integer; next_pick integer; round_index integer; expected_slot integer; my_slot integer;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if chosen_player not between 1 and 173 then raise exception 'Unknown player ID'; end if;
  select * into target from public.fantasy_leagues where id = target_league for update;
  if target.id is null or target.state <> 'drafting' then raise exception 'Draft is not open'; end if;
  select count(*) into managers from public.fantasy_draft_order where league_id = target_league;
  select count(*) + 1 into next_pick from public.fantasy_draft_picks where league_id = target_league;
  if next_pick > managers * 10 then raise exception 'Draft is complete'; end if;
  round_index := (next_pick - 1) / managers;
  expected_slot := case when round_index % 2 = 0 then (next_pick - 1) % managers + 1
                        else managers - (next_pick - 1) % managers end;
  select slot into my_slot from public.fantasy_draft_order where league_id = target_league and user_id = auth.uid();
  if my_slot is distinct from expected_slot then raise exception 'It is not your turn'; end if;
  insert into public.fantasy_draft_picks (league_id, pick_number, user_id, player_id)
    values (target_league, next_pick, auth.uid(), chosen_player);
  if next_pick = managers * 10 then update public.fantasy_leagues set state = 'active' where id = target_league; end if;
  return next_pick;
end;
$function$
;
CREATE OR REPLACE FUNCTION league_private.ssl_draft_action(season uuid, operation text, player integer DEFAULT NULL::integer)
 RETURNS ssl_draft_seasons
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result public.ssl_draft_seasons; lottery jsonb; count_teams integer; pick_no integer; round_no integer; slot integer;
begin
 if auth.uid() is null or (league_private.current_access()->>'role') is distinct from 'commissioner' then raise exception 'Commissioner access required'; end if;
 select * into result from public.ssl_draft_seasons where id=season for update;
 if not found then raise exception 'Season not found'; end if;
 count_teams:=jsonb_array_length(result.teams);
 if operation='draw' then
  if result.stage<>'lottery' then raise exception 'Lottery is already finished'; end if;
  select draw_order into lottery from league_private.ssl_lottery_order where season_id=season;
  result.draft_order:=result.draft_order || jsonb_build_array(lottery->jsonb_array_length(result.draft_order));
  if jsonb_array_length(result.draft_order)=count_teams then result.stage:='ready'; end if;
 elsif operation='start' then
  if result.stage<>'ready' then raise exception 'Finish the lottery first'; end if;
  result.stage:='drafting';
 elsif operation='pick' then
  if result.stage<>'drafting' then raise exception 'Draft is not open'; end if;
  if player is null or player not between 1 and 173 then raise exception 'Unknown player'; end if;
  if exists(select 1 from jsonb_array_elements(result.picks) p where (p->>'player')::integer=player) then raise exception 'Player already drafted'; end if;
  pick_no:=jsonb_array_length(result.picks); round_no:=pick_no/count_teams;
  slot:=case when result.snake and round_no%2=1 then count_teams-1-(pick_no%count_teams) else pick_no%count_teams end;
  result.picks:=result.picks || jsonb_build_array(jsonb_build_object('number',pick_no+1,'round',round_no+1,'team',result.draft_order->slot->>'id','player',player));
  if jsonb_array_length(result.picks)=count_teams*result.rounds then result.stage:='complete'; end if;
 else raise exception 'Unknown draft action';
 end if;
 update public.ssl_draft_seasons set draft_order=result.draft_order,picks=result.picks,stage=result.stage where id=season;
 return result;
end $function$
;
ALTER TABLE public.fantasy_draft_picks DROP CONSTRAINT fantasy_draft_picks_player_id_check;
ALTER TABLE public.fantasy_draft_picks ADD CONSTRAINT fantasy_draft_picks_player_id_check CHECK (player_id BETWEEN 1 AND 173);
ALTER TABLE public.fantasy_week_lineups DROP CONSTRAINT fantasy_week_lineups_player_id_check;
ALTER TABLE public.fantasy_week_lineups ADD CONSTRAINT fantasy_week_lineups_player_id_check CHECK (player_id BETWEEN 1 AND 173);
ALTER TABLE public.fantasy_player_schedule DROP CONSTRAINT fantasy_player_schedule_player_id_check;
ALTER TABLE public.fantasy_player_schedule ADD CONSTRAINT fantasy_player_schedule_player_id_check CHECK (player_id BETWEEN 1 AND 173);
COMMIT;
