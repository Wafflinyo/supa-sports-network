CREATE OR REPLACE FUNCTION league_private.make_fantasy_pick(target_league uuid, chosen_player integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare target public.fantasy_leagues%rowtype; managers integer; next_pick integer; round_index integer; expected_slot integer; my_slot integer;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if not exists(select 1 from league_private.ssl_catalog where id=chosen_player) then raise exception 'Unknown player ID';end if;
  if not exists(select 1 from league_private.ssl_season_states s cross join lateral jsonb_each(s.state->'rosters') r where s.number=(select max(number) from league_private.ssl_season_states) and s.state->>'status'<>'archived' and r.value @> jsonb_build_array(chosen_player)) then raise exception 'Fantasy players must be on a current SSL roster';end if;
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
