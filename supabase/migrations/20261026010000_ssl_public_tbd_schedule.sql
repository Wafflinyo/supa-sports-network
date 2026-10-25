-- Allow public schedule with undated weekly matchups; date edits propagate to public/fantasy views.
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
  -- Published matchups remain editable by the commissioner until the game is locked.
  select value,ordinality::int-1 into g,i from jsonb_array_elements(coalesce(st->'games','[]'::jsonb)) with ordinality where value->>'id'=payload->>'game';
  if g is null or g->>'stage'<>'scheduled' or g->>'phase'<>'regular' then raise exception 'Choose an unplayed regular-season matchup';end if;
  if payload->>'startsAt' is null then raise exception 'Enter game date and time';end if;
  begin
   deadline:=(payload->>'startsAt')::timestamptz;
  exception when others then raise exception 'Invalid game date/time';
  end;
  if deadline is null then raise exception 'Enter a valid date/time';end if;
  if st->>'weekOne' is null and (g->>'week')::int=1 then
   d:=(deadline at time zone 'America/New_York')::date;
   d:=d-extract(dow from d)::int;
   st:=st||jsonb_build_object('weekOne',d,'tradeDeadlineAt',(d+84)::timestamp at time zone 'America/New_York');
  end if;
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
   -- A public matchup-only slate can have zero dated games. Infer calendar
   -- from a dated Week 1 game when possible; otherwise retain TBD.
   select min((value->>'startsAt')::timestamptz at time zone 'America/New_York')::date into d
   from jsonb_array_elements(st->'games') where value->>'phase'='regular' and (value->>'week')::int=1 and value->>'startsAt' is not null;
   if d is not null then
     d:=d-extract(dow from d)::int;
     st:=st||jsonb_build_object('weekOne',d,'allStarBreakAfterWeek',11,'regularWeeks',22,'tradeDeadlineAt',(d+84)::timestamp at time zone 'America/New_York');
   end if;
  end if;
  d:=(st->>'weekOne')::date;
  -- Public schedule publication validates matchups, not their dates.
  -- Undated games stay visible as TBD and can be dated at any point.

  if (select count(*) from jsonb_array_elements(st->'games') where value->>'phase'='regular')<>132 then raise exception 'Regular season requires 132 games: each of 12 teams plays 22 games';end if;
  if exists(select 1 from jsonb_array_elements(st->'teams') ta cross join jsonb_array_elements(st->'teams') tb where ta->>'id'<>tb->>'id' and (select count(*) from jsonb_array_elements(st->'games') z where z->>'phase'='regular' and z->>'away'=ta->>'id' and z->>'home'=tb->>'id')<>1) then raise exception 'Each matchup must be scheduled once at each home park';end if;
  if d is not null and exists(select 1 from jsonb_array_elements(st->'games') z where z->>'phase'='regular' and z->>'startsAt' is not null and (((z->>'startsAt')::timestamptz at time zone 'America/New_York')::date-d)/7 not between 0 and 21) then raise exception 'Dated games must fall in Weeks 1 through 22';end if;
  if d is not null and exists(select 1 from jsonb_array_elements(st->'games') z where z->>'phase'='regular' and z->>'startsAt' is not null and (z->>'week')::int<>1+((((z->>'startsAt')::timestamptz at time zone 'America/New_York')::date-d)/7)) then raise exception 'Dated games must match their assigned Week 1-22';end if;
  if exists(select 1 from jsonb_array_elements(st->'teams') t cross join generate_series(1,22) w where (select count(*) from jsonb_array_elements(st->'games') z where z->>'phase'='regular' and t->>'id' in(z->>'away',z->>'home') and (z->>'week')::int=w)<>1) then raise exception 'Schedule each team in exactly one matchup per numbered week';end if;
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

CREATE OR REPLACE FUNCTION league_private.ssl_manage_before_stars(op text, target uuid, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
<<rules>>
declare a jsonb:=league_private.current_access();s league_private.ssl_season_states;st jsonb;g jsonb;x jsonb;arr jsonb;answer jsonb;tid text;f text;team text;idx integer;n integer;i integer;r integer;round_name text;ids jsonb;participants jsonb;series jsonb;next_round text;needed integer;release_time timestamptz;kind text;options jsonb;counts jsonb;begin
 if pg_column_size(payload)>1000000 then raise exception 'Request too large';end if;
 perform pg_advisory_xact_lock(736114221);
 if op='create' then return league_private.ssl_manage_contracts(op,target,payload);end if;
 perform league_private.ssl_tick(target);select * into s from league_private.ssl_season_states where id=target for update;if not found then raise exception 'Season not found';end if;st:=s.state;
 if op='ballot' then
  if auth.uid() is null then raise exception 'Sign in to vote';end if;
  kind:=payload->>'kind';x:=st->'ballotWindows'->kind;
  if x is null or not coalesce((x->>'open')::boolean,false) or now()>=(x->>'closesAt')::timestamptz then raise exception 'Voting is closed';end if;
  ids:=payload->'choices';if jsonb_typeof(ids) is distinct from 'array' then raise exception 'Select players for your ballot';end if;
  needed:=case when kind='allstar' then 18 else 1 end;
  if jsonb_array_length(ids)<>needed or (select count(distinct value) from jsonb_array_elements(ids))<>needed then raise exception 'Select % different players',needed;end if;
  if exists(select 1 from jsonb_array_elements(ids) p where not exists(select 1 from jsonb_array_elements(x->'candidates') c where c->'player'=p)) then raise exception 'Player is not an eligible candidate';end if;
  if kind='allstar' then
   for tid in select unnest(array['supa','galaxy']) loop
    if (select count(*) from jsonb_array_elements(x->'candidates') c where c->>'conference'=tid and ids @> jsonb_build_array(c->'player'))<>9 then raise exception 'Select nine players from each conference';end if;
   end loop;
  end if;
  insert into league_private.ssl_ballots(season,voter,kind,choices) values(target,auth.uid(),kind,ids) on conflict on constraint ssl_ballots_pkey do update set choices=excluded.choices,updated_at=now();
  return jsonb_build_object('ok',true);
 end if;
 if auth.uid() is null or coalesce(a->>'role','') not in ('gm','commissioner') then raise exception 'GM or commissioner access required';end if;
 if st->>'status'='archived' then raise exception 'Archived season is read only';end if;
 select id::text into f from league_private.ssl_franchises where slot=(a->>'slot')::int;team:=case when a->>'role'='commissioner' then coalesce(payload->>'team',f) else f end;
 if op in ('conferences','open_ballot','close_ballot','ceremony','advance_playoffs','broadcast','release_result') and a->>'role'<>'commissioner' then raise exception 'Commissioner access required';end if;
 if op='conferences' then
  if st->>'status' not in ('setup','poll','scheduled','postdraft') or exists(select 1 from jsonb_array_elements(st->'games') where value->>'stage'<>'scheduled') then raise exception 'Set conferences before the season starts';end if;
  if jsonb_typeof(payload->'supa') is distinct from 'array' or jsonb_array_length(payload->'supa')<>6 or (select count(distinct value) from jsonb_array_elements(payload->'supa'))<>6 or exists(select 1 from jsonb_array_elements_text(payload->'supa') p where not exists(select 1 from jsonb_array_elements(st->'teams') t where t->>'id'=p)) or jsonb_array_length(st->'teams')<>12 then raise exception 'Select exactly six season teams for Supa; the remaining six form Galaxy';end if;
  select jsonb_agg(value||jsonb_build_object('conference',case when payload->'supa' @> jsonb_build_array(value->>'id') then 'supa' else 'galaxy' end)) into arr from jsonb_array_elements(st->'teams');st:=st||jsonb_build_object('teams',arr,'conferencesSet',true);
 elsif op='open_ballot' then
  kind:=payload->>'kind';if kind is null or kind !~ '^(allstar|award_[a-z0-9_]{1,40})$' then raise exception 'Select All-Star or an award category';end if;
  if not coalesce((st->>'conferencesSet')::boolean,false) then raise exception 'Assign both conferences first';end if;
  if kind='allstar' and st->>'status'<>'regular' then raise exception 'All-Star voting opens during the regular season';end if;
  if kind<>'allstar' and (st->>'status'<>'regular' or jsonb_array_length(coalesce(st->'finalStandings','[]'))<>12) then raise exception 'Awards voting opens after all regular-season results are public';end if;
  if (payload->>'closesAt')::timestamptz is null or (payload->>'closesAt')::timestamptz<=now() then raise exception 'Choose a future voting deadline';end if;
  if st->'ballotWindows' ? kind then raise exception 'This season ballot already exists; close it when finished';end if;
  select jsonb_agg(jsonb_build_object('player',p.value,'team',t->>'id','conference',t->>'conference')) into options from jsonb_array_elements(st->'teams') t cross join lateral jsonb_array_elements(league_private.ssl_roster(st,t->>'id')) p;
  st:=st||jsonb_build_object('ballotWindows',coalesce(st->'ballotWindows','{}')||jsonb_build_object(kind,jsonb_build_object('label',left(coalesce(payload->>'label',case when kind='allstar' then 'All-Star Voting' else 'Season Award' end),80),'open',true,'closesAt',payload->>'closesAt','candidates',options)));
 elsif op='close_ballot' then
  kind:=payload->>'kind';if not coalesce(st->'ballotWindows','{}') ? kind then raise exception 'Ballot not found';end if;
  st:=jsonb_set(st,array['ballotWindows',kind,'open'],'false');
 elsif op='ceremony' then
  if jsonb_array_length(coalesce(st->'finalStandings','[]'))<>12 or st->>'status'<>'regular' then raise exception 'Finish the regular season before the awards ceremony';end if;
  if not exists(select 1 from jsonb_each(coalesce(st->'ballotWindows','{}')) where key like 'award_%') then raise exception 'Open and complete season awards voting before the ceremony';end if;
  if exists(select 1 from jsonb_each(coalesce(st->'ballotWindows','{}')) where coalesce((value->>'open')::boolean,false) and (value->>'closesAt')::timestamptz>now()) then raise exception 'Close voting before publishing the ceremony';end if;
  if char_length(trim(coalesce(payload->>'announcement','')))<5 then raise exception 'Enter the awards and conference champions announcement';end if;
  st:=st||jsonb_build_object('awardsComplete',true,'awardsAnnouncement',left(payload->>'announcement',6000),'awardsPublishedAt',now());
 elsif op='advance_playoffs' then
  if st->>'status'<>'postseason' then raise exception 'Open the postseason first';end if;
  ids:=coalesce(st->'playoffSeries','[]');
  if jsonb_array_length(ids)=0 then
   participants:=st->'playoffTeams';next_round:='quarterfinal';
   -- Display the requested bracket grouping: 1/8, 4/5, 2/7, 3/6.
   participants:=jsonb_build_array(participants->0,participants->3,participants->1,participants->2,participants->5,participants->6,participants->4,participants->7);
  else
   select case when bool_or(value->>'round'='final') then 'final' when bool_or(value->>'round'='semifinal') then 'semifinal' else 'quarterfinal' end into round_name from jsonb_array_elements(ids);
   if round_name='final' then raise exception 'Championship series already exists';end if;
   if exists(select 1 from jsonb_array_elements(ids) where value->>'round'=round_name and value->>'winner' is null) then raise exception 'Finish and release all current-round series first';end if;
   select jsonb_agg(z->'winner' order by (rankrow->>'rank')::int) into participants from jsonb_array_elements(ids) z join jsonb_array_elements(st->'finalStandings') rankrow on rankrow->>'id'=z->>'winner' where z->>'round'=round_name;
   next_round:=case when round_name='quarterfinal' then 'semifinal' else 'final' end;
  end if;
  n:=jsonb_array_length(participants);if n not in(2,4,8) then raise exception 'Invalid playoff field';end if;
  for i in 0..(n/2-1) loop
   series:=jsonb_build_object('id',gen_random_uuid(),'round',next_round,'high',participants->>i,'low',participants->>(n-i-1),'bestOf',case when next_round='final' then 5 else 3 end,'highWins',0,'lowWins',0);
   select (value->>'rank')::int into r from jsonb_array_elements(st->'finalStandings') where value->>'id'=series->>'high';series:=series||jsonb_build_object('highSeed',r);
   select (value->>'rank')::int into r from jsonb_array_elements(st->'finalStandings') where value->>'id'=series->>'low';series:=series||jsonb_build_object('lowSeed',r);ids:=ids||jsonb_build_array(series);
  end loop;st:=st||jsonb_build_object('playoffSeries',ids);
 elsif op in ('broadcast','release_result') then
  select value,ordinality::int-1 into g,idx from jsonb_array_elements(st->'games') with ordinality where value->>'id'=payload->>'game';if g is null then raise exception 'Game not found';end if;
  if op='release_result' then
   if g->>'stage'<>'recorded' or coalesce((g->>'postponed')::boolean,false) or now()<(g->>'startsAt')::timestamptz then raise exception 'Only release a recorded result after its premiere has ended';end if;
   g:=g||jsonb_build_object('releaseAt',now(),'premiereEndConfirmedAt',now());
  else
   if g->>'stage' in ('final','cancelled') then raise exception 'Broadcast is finished';end if;
   if coalesce(payload->>'youtubeUrl','')<>'' and payload->>'youtubeUrl' !~ '^https://(www\.)?(youtube\.com/watch\?|youtu\.be/)' then raise exception 'Use a YouTube video URL';end if;
   release_time:=(payload->>'releaseAt')::timestamptz;if release_time is not null and release_time<=coalesce((payload->>'startsAt')::timestamptz,(g->>'startsAt')::timestamptz) then raise exception 'Release time must be after premiere start';end if;
   g:=(g-'releaseAt')||jsonb_build_object('youtubeUrl',left(payload->>'youtubeUrl',300),'announcement',left(coalesce(payload->>'announcement',''),1000),'postponed',coalesce((payload->>'postponed')::boolean,false));
   if release_time is not null then g:=g||jsonb_build_object('releaseAt',release_time);end if;
   if payload->>'startsAt' is not null then g:=g||jsonb_build_object('startsAt',(payload->>'startsAt')::timestamptz);end if;
  end if;st:=jsonb_set(st,array['games',idx::text],g);
 else
  if op='submit_trade' and exists(select 1 from jsonb_array_elements(coalesce(payload->'moves','[]')) where value->>'kind'='contract') then raise exception 'Extension contracts are not tradable';end if;
  if op='approve_trade' and exists(select 1 from league_private.ssl_offers o cross join lateral jsonb_array_elements(o.body->'moves') m where o.id=(payload->>'offer')::uuid and m->>'kind'='contract') then raise exception 'Extension contracts are not tradable; submit a revised offer';end if;
  if op='poll' and not coalesce((st->>'conferencesSet')::boolean,false) then raise exception 'Assign six teams to each conference first';end if;
  if op='postseason' and not coalesce((st->>'awardsComplete')::boolean,false) then raise exception 'Complete awards voting, ceremony and announcements before playoffs';end if;
  if op='schedule' and st->>'status'='postseason' then
   select value into series from jsonb_array_elements(coalesce(st->'playoffSeries','[]')) where value->>'id'=payload->>'seriesId';
   if series is null or series->>'winner' is not null then raise exception 'Choose an unfinished playoff series';end if;
   if exists(select 1 from jsonb_array_elements(st->'games') where value->>'seriesId'=series->>'id' and value->>'stage' not in ('final','cancelled')) then raise exception 'Release the previous game before scheduling the next series game';end if;
   select count(*)+1 into i from jsonb_array_elements(st->'games') where value->>'seriesId'=series->>'id' and value->>'stage'<>'cancelled';
   if i>(series->>'bestOf')::int then raise exception 'Series game limit reached';end if;
   if payload->>'home' is distinct from (case when i%2=1 then series->>'high' else series->>'low' end) or payload->>'away' is distinct from (case when i%2=1 then series->>'low' else series->>'high' end) then raise exception 'Home field alternates, starting with the higher seed';end if;
   payload:=payload||jsonb_build_object('playoffRound',series->>'round');
  end if;
  if op='finish' then
   select value into x from jsonb_array_elements(coalesce(st->'playoffSeries','[]')) where value->>'round'='final';
   if x->>'winner' is null or payload->>'champion' is distinct from x->>'winner' or payload->>'finalist' is distinct from (case when x->>'winner'=x->>'high' then x->>'low' else x->>'high' end) then raise exception 'Championship winner and runner-up must match the completed best-of-five finals';end if;
  end if;
  if op='start_game' then raise exception 'Upload the result to lock lineups; no separate start action is needed';end if;
  if op='result' then
   select value,ordinality::int-1 into g,idx from jsonb_array_elements(st->'games') with ordinality where value->>'id'=payload->>'game';if g is null then raise exception 'Game not found';end if;
   if g->>'stage'='scheduled' then perform league_private.ssl_manage_core('start_game',target,jsonb_build_object('game',g->>'id'));end if;
   if g->>'stage'='recorded' then update league_private.ssl_season_states set state=jsonb_set(state,array['games',idx::text,'stage'],'"live"') where id=target;end if;
  end if;
  answer:=league_private.ssl_manage_contracts(op,target,payload);
  select state into st from league_private.ssl_season_states where id=target;
  if op='teams' then
   -- No default conference assignment: commissioner chooses all twelve explicitly.
   st:=st||jsonb_build_object('conferencesSet',false);
  elsif op='result' then
   select value,ordinality::int-1 into g,idx from jsonb_array_elements(st->'games') with ordinality where value->>'id'=payload->>'game';
   g:=g||jsonb_build_object('lockedAt',coalesce(g->>'lockedAt',now()::text),'stage',case when g->>'releasedAt' is not null then 'final' else 'recorded' end);
   st:=jsonb_set(st,array['games',idx::text],g);
  elsif op='schedule' and st->>'status'='postseason' then
   i:=jsonb_array_length(st->'games')-1;g:=st->'games'->i;g:=g||jsonb_build_object('seriesId',series->>'id','seriesGame',(select count(*)+1 from jsonb_array_elements(s.state->'games') where value->>'seriesId'=series->>'id' and value->>'stage'<>'cancelled'));st:=jsonb_set(st,array['games',i::text],g);
  elsif op='approve_trade' then
   if exists(select 1 from jsonb_each(st->'rosters') where jsonb_array_length(value)>14) then raise exception 'Trade would exceed the 14-player roster maximum';end if;
  end if;
 end if;
 update league_private.ssl_season_states set state=st where id=target;
 -- SSL fantasy locks use upload time; scoring stays in the scheduled premiere week.
 for g in select value from jsonb_array_elements(st->'games') loop
  if g->>'stage'='cancelled' or (g->>'startsAt') is null or not coalesce((st->>'schedulePublished')::boolean,false) then continue;end if;
  delete from public.fantasy_player_schedule where game_key='ssl:'||(g->>'id');
  for tid in select unnest(array[g->>'away',g->>'home']) loop
   for x in select value from jsonb_array_elements(case when g ? 'lockedAt' then g->'frozenRosters'->tid else league_private.ssl_roster(st,tid) end) loop
    insert into public.fantasy_player_schedule(game_key,player_id,starts_at,locked_at) values('ssl:'||(g->>'id'),x::int,(g->>'startsAt')::timestamptz,(g->>'lockedAt')::timestamptz) on conflict do nothing;
   end loop;
  end loop;
 end loop;
 insert into league_private.ssl_actions(season,actor,operation,details) values(target,auth.uid(),op,jsonb_build_object('game',payload->>'game','kind',payload->>'kind'));
 perform league_private.ssl_tick(target);return coalesce(answer,jsonb_build_object('ok',true));
end$function$;
