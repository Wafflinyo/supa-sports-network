-- Matchup-first schedule generation and explicit date entry.
CREATE OR REPLACE FUNCTION league_private.ssl_manage_calendar(op text, target uuid, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a jsonb:=league_private.current_access();s league_private.ssl_season_states;st jsonb;answer jsonb;d date;deadline timestamptz;ended timestamptz;old_status text;teams text[];rot text[];arr jsonb;g jsonb;i integer;j integer;r integer;away text;home text;first_time time;begin
 if auth.uid() is null or coalesce(a->>'role','') not in ('commissioner','gm') then raise exception 'GM or commissioner access required';end if;
 perform pg_advisory_xact_lock(736114221);
 if op='create' then
  if a->>'role'<>'commissioner' then raise exception 'Commissioner access required';end if;
  for s in select * from league_private.ssl_season_states where state->>'status'<>'archived' order by number loop
   perform league_private.ssl_tick(s.id);select * into s from league_private.ssl_season_states where id=s.id;
   if s.state->>'status'<>'offseason' then raise exception 'Next season opens after the extension period ends';end if;
   update league_private.ssl_season_states set state=s.state||jsonb_build_object('status','archived','archivedAt',now(),'offseasonRosterSnapshot',s.state->'rosters','rosters',coalesce(s.state->'completedRosters',s.state->'rosters'),'defaults',coalesce(s.state->'completedDefaults','{}'::jsonb),'archivedBalances',(select coalesce(jsonb_agg(jsonb_build_object('team',id,'tokens',tokens)),'[]') from league_private.ssl_franchises),'archivedPickAssets',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'season',season_number,'originalTeam',original_team,'round',round,'owner',owner)),'[]') from league_private.ssl_pick_assets where season_number=s.number+1)) where id=s.id;
   update league_private.ssl_offers set status='expired' where season=s.id and status in ('pending','ready');
   insert into league_private.ssl_actions(season,actor,operation) values(s.id,auth.uid(),'archive_for_next_season');
  end loop;
  answer:=league_private.ssl_manage_core(op,target,payload);
  if exists(select 1 from league_private.ssl_season_states where number>1 and id=(answer->>'id')::uuid) then update league_private.ssl_season_states set state=state||jsonb_build_object('offseasonTrading',true,'tradingOpen',true) where id=(answer->>'id')::uuid;end if;return answer;
 end if;
 perform league_private.ssl_tick(target);select * into s from league_private.ssl_season_states where id=target for update;if not found then raise exception 'Season not found';end if;st:=s.state;
 if op in ('generate_schedule','season_calendar') then
  if a->>'role'<>'commissioner' or st->>'status'<>'postdraft' then raise exception 'Commissioner may set the calendar after the draft and before opening day';end if;
  d:=case when op='season_calendar' then (payload->>'weekOne')::date else (st->>'weekOne')::date end;if op='season_calendar' and d is null then raise exception 'Choose Week 1 Sunday';end if;if d is not null and extract(dow from d)<>0 then raise exception 'Week 1 must start on a Sunday (Eastern Time)';end if;
  deadline:=case when d is not null then (d+84)::timestamp at time zone 'America/New_York' else null end;
  st:=st||jsonb_build_object('weekOne',d,'allStarBreakAfterWeek',11,'regularWeeks',22,'tradeDeadlineAt',deadline,'extensionsOpen',false);
  if op='generate_schedule' then
   if exists(select 1 from jsonb_array_elements(st->'games') z where z->>'stage'<>'scheduled') then raise exception 'Cannot replace played games';end if;
   if jsonb_array_length(st->'teams')<>12 then raise exception 'Select twelve teams first';end if;
   select array_agg(value->>'id' order by (value->>'slot')::int) into teams from jsonb_array_elements(st->'teams');rot:=teams;arr:='[]';
   for r in 0..10 loop
    for j in 1..6 loop
     home:=rot[j];away:=rot[13-j];if r%2=1 then home:=rot[13-j];away:=rot[j];end if;
     for i in 0..1 loop
      g:=jsonb_build_object('id',gen_random_uuid(),'away',case when i=0 then away else home end,'home',case when i=0 then home else away end,'startsAt',null,'phase','regular','week',r+i*11+1,'label','Week '||(r+i*11+1),'stage','scheduled','lineups','{}'::jsonb);arr:=arr||jsonb_build_array(g);
     end loop;
    end loop;
    rot:=array[rot[1],rot[12]]||rot[2:11];
   end loop;
   delete from public.fantasy_player_schedule where game_key in(select 'ssl:'||(value->>'id') from jsonb_array_elements(st->'games'));
   st:=st||jsonb_build_object('games',(select jsonb_agg(value order by (value->>'week')::integer,value->>'away',value->>'home') from jsonb_array_elements(arr)),'schedulePublished',false);
  end if;
  update league_private.ssl_season_states set state=st where id=target;
  insert into league_private.ssl_actions(season,actor,operation) values(target,auth.uid(),op);return jsonb_build_object('ok',true);
 end if;
 if op='set_matchup_time' then
  if a->>'role'<>'commissioner' or st->>'status' not in ('postdraft','regular') then raise exception 'Commissioner access and an active scheduling phase required';end if;
  if coalesce((st->>'schedulePublished')::boolean,false) then raise exception 'Use RESCHEDULE GAME after publication';end if;
  select value,ordinality::int-1 into g,i from jsonb_array_elements(coalesce(st->'games','[]'::jsonb)) with ordinality where value->>'id'=payload->>'game';
  if g is null or g->>'stage'<>'scheduled' or g->>'phase'<>'regular' then raise exception 'Choose an unplayed regular-season matchup';end if;
  if payload->>'startsAt' is null then raise exception 'Enter game date and time';end if;
  begin
   deadline:=(payload->>'startsAt')::timestamptz;
  exception when others then raise exception 'Invalid game date/time';
  end;
  if deadline is null then raise exception 'Enter a valid date/time';end if;
  if st->>'weekOne' is not null and ((deadline at time zone 'America/New_York')::date-(st->>'weekOne')::date)/7 <> (g->>'week')::int-1 then raise exception 'Date must be within matchup Week %',g->>'week';end if;
  g:=jsonb_set(g,'{startsAt}',to_jsonb(deadline));
  st:=jsonb_set(st,array['games',i::text],g);
  update league_private.ssl_season_states set state=st where id=target;
  insert into league_private.ssl_actions(season,actor,operation,details) values(target,auth.uid(),op,jsonb_build_object('game',g->>'id','week',g->>'week'));
  return jsonb_build_object('ok',true);
 end if;
 if op in ('publish_schedule','start_season') then
  if a->>'role'<>'commissioner' then raise exception 'Commissioner access required';end if;
  if st->>'weekOne' is null then
   select min((value->>'startsAt')::timestamptz at time zone 'America/New_York')::date into d from jsonb_array_elements(st->'games') where value->>'phase'='regular';d:=d-extract(dow from d)::int;
   if d is null then raise exception 'Set the season calendar first';end if;
   st:=st||jsonb_build_object('weekOne',d,'allStarBreakAfterWeek',11,'regularWeeks',22,'tradeDeadlineAt',(d+84)::timestamp at time zone 'America/New_York');
  end if;
  d:=(st->>'weekOne')::date;
  if exists(select 1 from jsonb_array_elements(st->'games') where value->>'phase'='regular' and (value->>'startsAt') is null) then raise exception 'Date and time required for all 132 matchups before publication';end if;
  if d is null then raise exception 'Set dates for Week 1 before publication';end if;
  if (select count(*) from jsonb_array_elements(st->'games') where value->>'phase'='regular')<>132 then raise exception 'Regular season requires 132 games: each of 12 teams plays 22 games';end if;
  if exists(select 1 from jsonb_array_elements(st->'teams') ta cross join jsonb_array_elements(st->'teams') tb where ta->>'id'<>tb->>'id' and (select count(*) from jsonb_array_elements(st->'games') z where z->>'phase'='regular' and z->>'away'=ta->>'id' and z->>'home'=tb->>'id')<>1) then raise exception 'Each matchup must be scheduled once at each home park';end if;
  if exists(select 1 from jsonb_array_elements(st->'games') z where z->>'phase'='regular' and (((z->>'startsAt')::timestamptz at time zone 'America/New_York')::date-d)/7 not between 0 and 21) then raise exception 'Regular games must fall in Weeks 1 through 22';end if;
  if exists(select 1 from jsonb_array_elements(st->'games') z where z->>'phase'='regular' and (z->>'week')::int<>1+((((z->>'startsAt')::timestamptz at time zone 'America/New_York')::date-d)/7)) then raise exception 'Games must be dated inside their assigned Week 1-22';end if;
  if exists(select 1 from jsonb_array_elements(st->'teams') t cross join generate_series(0,21) w where (select count(*) from jsonb_array_elements(st->'games') z where z->>'phase'='regular' and t->>'id' in(z->>'away',z->>'home') and (((z->>'startsAt')::timestamptz at time zone 'America/New_York')::date-d)/7=w)<>1) then raise exception 'Schedule one game per team per week';end if;
  update league_private.ssl_season_states set state=st where id=target;
 end if;
 if op in ('submit_trade','accept_trade','approve_trade') and ((st->>'status' not in ('postdraft','regular','offseason') and not (coalesce((st->>'offseasonTrading')::boolean,false) and st->>'status' in ('setup','poll','scheduled'))) or not coalesce((st->>'tradingOpen')::boolean,false)) then raise exception 'Trading is closed until offseason; regular-season trades end after Week 12';end if;
 if op='archive' then raise exception 'Use Set Up Next Season in the draft room after the extension period ends';end if;
 if op='finish' then
  ended:=coalesce((payload->>'endedAt')::timestamptz,(select max(coalesce((value->>'releasedAt')::timestamptz,(value->>'releaseAt')::timestamptz,(value->'result'->>'postedAt')::timestamptz)) from jsonb_array_elements(st->'games') where value->>'phase'='playoffs'),now());
  if ended>now() or ended<(select max((value->>'startsAt')::timestamptz) from jsonb_array_elements(st->'games') where value->>'phase'='playoffs') then raise exception 'Championship end must be after the last playoff game started and cannot be in the future';end if;
  answer:=league_private.ssl_manage_core(op,target,payload);
  update league_private.ssl_season_states set state=state||jsonb_build_object('championshipEndedAt',ended,'extensionClosesAt',((ended at time zone 'America/New_York')+interval '1 month') at time zone 'America/New_York','tradingOpen',false,'extensionsOpen',true) where id=target;
  perform league_private.ssl_tick(target);return answer;
 end if;
 if op='extension' then
  if st->>'status' not in ('regular','postseason','retention') or not coalesce((st->>'extensionsOpen')::boolean,false) then raise exception 'Extensions open after the Week 12 trade deadline and close two weeks after the championship';end if;
  old_status:=st->>'status';update league_private.ssl_season_states set state=jsonb_set(state,'{status}','"retention"') where id=target;
  answer:=league_private.ssl_manage_core(op,target,payload);
  update league_private.ssl_season_states set state=jsonb_set(state,'{status}',to_jsonb(old_status)) where id=target;return answer;
 end if;
 return league_private.ssl_manage_core(op,target,payload);
end$function$;
