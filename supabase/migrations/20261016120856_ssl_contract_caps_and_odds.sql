update league_private.ssl_franchises set tokens=least(tokens,5) where tokens>5;
alter table league_private.ssl_franchises add constraint ssl_contract_balance_cap check(tokens<=5);
alter table league_private.ssl_extension_offers add column breakdown jsonb not null default '{}';
create or replace function league_private.ssl_tick(target uuid) returns void language plpgsql security definer set search_path='' as $$
declare s league_private.ssl_season_states;st jsonb;t jsonb;r jsonb:='{}';n integer;begin
 perform pg_advisory_xact_lock(736114221);
 perform league_private.ssl_tick_draft(target);
 select * into s from league_private.ssl_season_states where id=target for update;if not found then return;end if;st:=s.state;
 if st->>'status' in ('regular','postseason','retention') and st->>'tradeDeadlineAt' is not null and now()>=(st->>'tradeDeadlineAt')::timestamptz then
  if not coalesce((st->>'extensionsOpen')::boolean,false) then
   for t in select value from jsonb_array_elements(st->'teams') loop
    insert into league_private.ssl_token_grants values(target,(t->>'id')::uuid) on conflict do nothing;get diagnostics n=row_count;
    if n=1 then update league_private.ssl_franchises set tokens=least(5,tokens+3) where id=(t->>'id')::uuid;end if;
   end loop;
   update league_private.ssl_offers set status='expired' where season=target and status in ('pending','ready');
  end if;
  st:=st||jsonb_build_object('tradingOpen',false,'extensionsOpen',true);
 end if;
 if st->>'status'='retention' and st->>'extensionClosesAt' is not null and now()>=(st->>'extensionClosesAt')::timestamptz then
  for t in select value from jsonb_array_elements(st->'teams') loop
   r:=jsonb_set(r,array[t->>'id'],(select coalesce(jsonb_agg(e.player),'[]') from league_private.ssl_extensions e where e.season_number=s.number+1 and e.franchise=(t->>'id')::uuid));
  end loop;
  st:=st||jsonb_build_object('status','offseason','extensionsOpen',false,'tradingOpen',true,'offseasonAt',st->>'extensionClosesAt','completedRosters',st->'rosters','completedDefaults',st->'defaults','rosters',r,'defaults','{}'::jsonb,'needsDefault','[]'::jsonb);
  insert into league_private.ssl_actions(season,operation) values(target,'extension_period_closed');
 end if;
 if coalesce((st->>'offseasonTrading')::boolean,false) and st->>'status'='drafting' then st:=st||jsonb_build_object('offseasonTrading',false,'tradingOpen',false);update league_private.ssl_offers set status='expired' where season=target and status in ('pending','ready');end if;
 if st<>s.state then update league_private.ssl_season_states set state=st where id=target;end if;
end$$;
create or replace function league_private.ssl_manage_core(op text,target uuid,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
<<manager>>
declare a jsonb:=league_private.current_access();commissioner boolean;f uuid;team text;tid text;fr league_private.ssl_franchises;s league_private.ssl_season_states;st jsonb;t jsonb;x jsonb;y jsonb;g jsonb;arr jsonb;ids jsonb;entry jsonb;offer league_private.ssl_offers;team_count integer;player integer;idx integer;cnt integer;n integer;seconds numeric;chance integer;repeats integer;roll integer;balance integer;asset uuid;qty integer;available integer[];needed integer;receipt uuid;lineup jsonb;changed boolean;newid uuid:=gen_random_uuid();allowed_stats text[]:=array['atBats','plateAppearances','runs','hits','rbi','homeRuns','batStrikeouts','batWalks','hitByPitch','singles','doubles','triples','oneHr','twoHr','threeHr','grandSlams','itpHomeRuns','totalBases','sacFlys','doublePlaysHitInto','triplePlaysHitInto','buddyJumpsHitInto','starSwings','starHits','batStarsUsed','stolenBases','caughtStealing','stealAttempts','putouts','assists','buddyJumpPutouts','buddyJumpAttempts','doublePlays','triplePlays','bobbles','battersFaced','outs','pitches','strikes','balls','pitchStrikeouts','pitchWalks','beanBalls','hitsAllowed','runsAllowed','singlesAllowed','doublesAllowed','triplesAllowed','hrAllowed','earnedRuns','inheritedRuns','starPitches','pitchStarsUsed','pickoffs','pickoffAttempts','starBases','mvps'];
begin
 if auth.uid() is null or coalesce(a->>'role','') not in ('commissioner','gm') then raise exception 'GM or commissioner access required';end if;
 commissioner:=a->>'role'='commissioner';
 if pg_column_size(payload)>1000000 then raise exception 'Request too large';end if;
 perform pg_advisory_xact_lock(736114221);
 select id into f from league_private.ssl_franchises where slot=(a->>'slot')::integer;
 if op='create' then
 if not commissioner then raise exception 'Commissioner access required';end if;
 if exists(select 1 from league_private.ssl_season_states where state->>'status'<>'archived') then raise exception 'Archive the previous season first';end if;
 n:=coalesce((select max(number) from league_private.ssl_season_states),0)+1;
 if char_length(trim(coalesce(payload->>'name','S'||n))) not between 2 and 60 then raise exception 'Season name must have 2–60 characters';end if;
 insert into league_private.ssl_season_states(number,name,state) values(n,trim(coalesce(payload->>'name','S'||n)),jsonb_build_object('status','setup','teams','[]'::jsonb,'order','[]'::jsonb,'picks','[]'::jsonb,'rosters','{}'::jsonb,'defaults','{}'::jsonb,'needsDefault','[]'::jsonb,'games','[]'::jsonb,'schedulePublished',false,'tradingOpen',false,'paused',false,'pickElapsed',0)) returning * into s;
 insert into league_private.ssl_actions(season,actor,operation) values(s.id,auth.uid(),op);return jsonb_build_object('id',s.id);
 end if;
 perform league_private.ssl_tick(target);
 select * into s from league_private.ssl_season_states where id=target for update;if not found then raise exception 'Season not found';end if;st:=s.state;
 team:=case when commissioner then coalesce(payload->>'team',f::text) else f::text end;
 if not commissioner and (f is null or not exists(select 1 from jsonb_array_elements(st->'teams') z where z->>'id'=f::text)) then raise exception 'Your franchise is not in this season';end if;
 if st->>'status'='archived' then raise exception 'Archived season is read only';end if;
 if op in ('teams','poll','schedule_draft','pause','undo_pick','schedule','reschedule','publish_schedule','start_season','start_game','result','postseason','finish','archive','approve_trade') and not commissioner then raise exception 'Commissioner access required';end if;
 if op='teams' then
 if st->>'status' not in ('setup','poll') or jsonb_typeof(payload->'slots')<>'array' or jsonb_array_length(payload->'slots')>12 then raise exception 'Select up to 12 registered teams during setup';end if;
 if (select count(distinct value::integer) from jsonb_array_elements(payload->'slots'))<>jsonb_array_length(payload->'slots') then raise exception 'Duplicate team selection';end if;
 arr:='[]';ids:='{}';
 for x in select value from jsonb_array_elements(payload->'slots') loop
 select to_jsonb(z) into entry from public.ssl_teams z where z.slot=x::integer;
 if entry is null then raise exception 'Register each team and logo first';end if;
 -- Stable slot identities persist through rebrands and GM changes.
 insert into league_private.ssl_franchises(slot) values(x::integer) on conflict(slot) do nothing;select * into fr from league_private.ssl_franchises where slot=x::integer;
 select to_jsonb(z) into entry from public.ssl_teams z where z.slot=x::integer;
 arr:=arr||jsonb_build_array(jsonb_build_object('id',fr.id,'slot',fr.slot,'name',entry->>'name','logoPath',entry->>'logo_path'));
 select coalesce(jsonb_agg(e.player),'[]') into y from league_private.ssl_extensions e where e.franchise=fr.id and e.season_number=s.number;
 ids:=jsonb_set(ids,array[fr.id::text],y);
 insert into league_private.ssl_pick_assets(season_number,original_team,round,owner) select s.number,fr.id,i,fr.id from generate_series(1,11) i on conflict do nothing;
 end loop;
 st:=st||jsonb_build_object('teams',arr,'rosters',ids,'poll',null,'status','setup');
 elsif op='poll' then
 if st->>'status' not in ('setup','poll') or jsonb_array_length(st->'teams')<>12 then raise exception 'Select all 12 teams before opening a draft-date poll';end if;
 if jsonb_typeof(payload->'options')<>'array' or jsonb_array_length(payload->'options') not between 2 and 12 or (payload->>'closesAt')::timestamptz<=now() then raise exception 'Enter 2–12 date options and a future poll deadline';end if;
 for x in select value from jsonb_array_elements(payload->'options') loop if (x->>'date')::timestamptz<=(payload->>'closesAt')::timestamptz then raise exception 'Draft options must be after the voting deadline';end if;end loop;
 st:=st||jsonb_build_object('status','poll','poll',jsonb_build_object('options',payload->'options','closesAt',payload->>'closesAt','votes','{}'::jsonb));
 elsif op='vote' then
 if st->>'status'<>'poll' or now()>=(st->'poll'->>'closesAt')::timestamptz then raise exception 'Poll is closed';end if;
 if team is null or not exists(select 1 from jsonb_array_elements(st->'teams') z where z->>'id'=team) then raise exception 'Select your franchise';end if;
 if not exists(select 1 from jsonb_array_elements(st->'poll'->'options') z where z->>'id'=payload->>'option') then raise exception 'Invalid poll option';end if;
 st:=jsonb_set(st,array['poll','votes',team],to_jsonb(payload->>'option'));
 elsif op='schedule_draft' then
 if st->>'status' not in ('poll','scheduled') or jsonb_array_length(st->'picks')>0 or jsonb_array_length(st->'order')>0 then raise exception 'Complete the poll before setting the draft';end if;
 if (payload->>'draftAt')::timestamptz<=now() or (payload->>'lotteryAt')::timestamptz not between (payload->>'draftAt')::timestamptz-interval '30 minutes' and (payload->>'draftAt')::timestamptz-interval '15 minutes' then raise exception 'Draft must be in the future; lottery must be 15–30 minutes before it';end if;
 st:=st||jsonb_build_object('status','scheduled','draftAt',payload->>'draftAt','lotteryAt',payload->>'lotteryAt','order','[]'::jsonb);
 elsif op='pause' then
 if st->>'status'<>'drafting' then raise exception 'Draft is not running';end if;
 if coalesce((st->>'paused')::boolean,false) then st:=st||jsonb_build_object('paused',false,'pickStartedAt',now());
 else st:=st||jsonb_build_object('paused',true,'pickElapsed',coalesce((st->>'pickElapsed')::numeric,0)+greatest(0,extract(epoch from now()-(st->>'pickStartedAt')::timestamptz)));end if;
 elsif op='pick' then
 if st->>'status'<>'drafting' or (st->>'paused')::boolean then raise exception 'Draft is not open or is paused';end if;
 cnt:=jsonb_array_length(st->'picks');idx:=case when (cnt/12)%2=1 then 11-cnt%12 else cnt%12 end;tid:=st->'order'->>idx;
 -- Future pick ownership follows the traded asset, not the original team.
 select owner::text into team from league_private.ssl_pick_assets where season_number=s.number and original_team=tid::uuid and round=cnt/12+1;
 if not commissioner and team<>f::text then raise exception 'It is another team''s turn';end if;
 player:=(payload->>'player')::integer;
 if not exists(select 1 from league_private.ssl_catalog where id=player) or exists(select 1 from jsonb_each(st->'rosters') z where z.value @> jsonb_build_array(player)) then raise exception 'Player unavailable';end if;
 seconds:=coalesce((st->>'pickElapsed')::numeric,0)+greatest(0,extract(epoch from now()-(st->>'pickStartedAt')::timestamptz));
 st:=jsonb_set(st,array['rosters',team],league_private.ssl_roster(st,team)||jsonb_build_array(player));
 st:=st||jsonb_build_object('picks',st->'picks'||jsonb_build_array(jsonb_build_object('number',cnt+1,'round',cnt/12+1,'team',team,'player',player,'seconds',round(seconds,2),'pickedAt',now())),'pickStartedAt',now(),'pickElapsed',0);
 if cnt+1=132 then
 st:=st||jsonb_build_object('status','postdraft','needsDefault',st->'order');
 for x in select value from jsonb_array_elements(st->'teams') loop insert into league_private.ssl_pick_assets(season_number,original_team,round,owner) select s.number+1,(x->>'id')::uuid,i,(x->>'id')::uuid from generate_series(1,11) i on conflict do nothing;end loop;
 end if;
 elsif op='undo_pick' then
 cnt:=jsonb_array_length(st->'picks');if cnt=0 or st->>'status' not in ('drafting','postdraft') or (st->>'tradingOpen')::boolean then raise exception 'Only unfinalized draft picks can be corrected';end if;
 x:=st->'picks'->(cnt-1);team:=x->>'team';st:=jsonb_set(st,array['rosters',team],(select coalesce(jsonb_agg(value),'[]') from jsonb_array_elements(league_private.ssl_roster(st,team)) where value<>x->'player'));
 st:=st||jsonb_build_object('picks',(st->'picks')-(cnt-1),'status','drafting','pickStartedAt',now(),'pickElapsed',0,'needsDefault','[]'::jsonb);
 elsif op='default_lineup' then
 if st->>'status' not in ('postdraft','regular','postseason','retention') or not league_private.ssl_valid_lineup(st,team,payload->'lineup') then raise exception 'Choose nine starters, all nine positions, and the remaining roster as bench; roster minimum is 11';end if;
 st:=jsonb_set(st,array['defaults',team],payload->'lineup');st:=jsonb_set(st,'{needsDefault}',coalesce(st->'needsDefault','[]')-team);
 if st->>'status'='postdraft' and jsonb_array_length(st->'needsDefault')=0 then st:=st||jsonb_build_object('tradingOpen',true);end if;
 elsif op in ('add_player','drop_player','random_fill') then
 if st->>'status' not in ('postdraft','regular','postseason','retention') then raise exception 'Roster moves open after the draft';end if;
 if exists(select 1 from jsonb_array_elements(st->'games') z where z->>'stage'='live' and team in (z->>'away',z->>'home')) then raise exception 'Wait until this team''s game result is posted';end if;
 ids:=league_private.ssl_roster(st,team);if not exists(select 1 from jsonb_array_elements(st->'teams') z where z->>'id'=team) then raise exception 'Unknown team';end if;
 if op='drop_player' then
 player:=(payload->>'player')::integer;if jsonb_array_length(ids)<=11 then raise exception 'A drop cannot leave fewer than 11 players';end if;
 if not ids @> jsonb_build_array(player) then raise exception 'Player is not on this team';end if;
 ids:=(select jsonb_agg(value) from jsonb_array_elements(ids) where value<>to_jsonb(player));delete from league_private.ssl_extensions where franchise=team::uuid and season_number=s.number+1 and ssl_extensions.player=manager.player;
 else
 select array_agg(id order by random()) into available from league_private.ssl_catalog c where not exists(select 1 from jsonb_each(st->'rosters') z where z.value @> jsonb_build_array(c.id));
 needed:=case when op='random_fill' then greatest(0,11-jsonb_array_length(ids)) else 1 end;
 if coalesce(array_length(available,1),0)<needed then raise exception 'Not enough free agents to fill the roster';end if;
 if op='add_player' then player:=(payload->>'player')::integer;if player is null or not coalesce(player=any(available),false) then raise exception 'Player is not a free agent';end if;ids:=ids||jsonb_build_array(player);
 else if needed>0 then ids:=ids||to_jsonb(available[1:needed]);end if;end if;
 end if;
 st:=jsonb_set(st,array['rosters',team],ids);if not coalesce(st->'needsDefault','[]') @> jsonb_build_array(team) then st:=jsonb_set(st,'{needsDefault}',coalesce(st->'needsDefault','[]')||jsonb_build_array(team));end if;
 elsif op='schedule' then
 if st->>'status' not in ('postdraft','regular','postseason') then raise exception 'Finish the draft first';end if;
 if not exists(select 1 from jsonb_array_elements(st->'teams') z where z->>'id'=payload->>'away') or not exists(select 1 from jsonb_array_elements(st->'teams') z where z->>'id'=payload->>'home') or payload->>'away'=payload->>'home' then raise exception 'Choose two different season teams';end if;
 if (payload->>'startsAt')::timestamptz is null then raise exception 'Set a game time';end if;
 if payload->>'phase'='playoffs' and st->>'status'<>'postseason' then raise exception 'Open the postseason first';end if;
 g:=jsonb_build_object('id',newid,'away',payload->>'away','home',payload->>'home','startsAt',payload->>'startsAt','phase',case when st->>'status'='postseason' then 'playoffs' else 'regular' end,'label',left(coalesce(payload->>'label',''),80),'stage','scheduled','lineups','{}'::jsonb);
 st:=jsonb_set(st,'{games}',st->'games'||jsonb_build_array(g));
 elsif op='reschedule' then
 if st->>'status' not in ('postdraft','regular','postseason') or (payload->>'startsAt')::timestamptz is null then raise exception 'Choose a valid game time during an open season';end if;
 select value,ordinality-1 into g,idx from jsonb_array_elements(st->'games') with ordinality where value->>'id'=payload->>'game';
 if g is null or g->>'stage'<>'scheduled' then raise exception 'Only an unplayed game can be rescheduled';end if;
 g:=g||jsonb_build_object('startsAt',payload->>'startsAt','label',left(coalesce(payload->>'label',g->>'label',''),80));st:=jsonb_set(st,array['games',idx::text],g);
 elsif op='publish_schedule' then
 if jsonb_array_length(st->'games')=0 then raise exception 'Enter at least one game';end if;st:=st||jsonb_build_object('schedulePublished',true);
 elsif op='start_season' then
 if st->>'status'<>'postdraft' or not (st->>'schedulePublished')::boolean then raise exception 'Publish the schedule after the draft first';end if;
 for x in select value from jsonb_array_elements(st->'teams') loop if not league_private.ssl_valid_lineup(st,x->>'id',st->'defaults'->(x->>'id')) then raise exception 'All teams need valid default lineups and 11 players';end if;end loop;
 st:=st||jsonb_build_object('status','regular');
 elsif op in ('game_lineup','start_game','result') then
 select value,ordinality::integer-1 into g,idx from jsonb_array_elements(st->'games') with ordinality where value->>'id'=payload->>'game';if g is null then raise exception 'Game not found';end if;
 if op='game_lineup' then
 if not (st->>'schedulePublished')::boolean or g->>'stage'<>'scheduled' or now()>=(g->>'startsAt')::timestamptz or team not in (g->>'away',g->>'home') then raise exception 'This lineup is closed or belongs to another team';end if;
 lineup:=case when coalesce((payload->>'useDefault')::boolean,false) then st->'defaults'->team else payload->'lineup' end;
 if not league_private.ssl_valid_lineup(st,team,lineup) then raise exception 'Submit a valid nine-player lineup and bench';end if;g:=jsonb_set(g,array['lineups',team],lineup);
 elsif op='start_game' then
 if st->>'status' not in ('regular','postseason') or g->>'stage'<>'scheduled' then raise exception 'Start the season first, and choose an unplayed game';end if;
 if now()<(g->>'startsAt')::timestamptz then raise exception 'Game cannot start before its scheduled time';end if;
 for tid in select unnest(array[g->>'away',g->>'home']) loop
 lineup:=g->'lineups'->tid;if not league_private.ssl_valid_lineup(st,tid,lineup) then lineup:=st->'defaults'->tid;end if;
 if not league_private.ssl_valid_lineup(st,tid,lineup) or st->'needsDefault' @> jsonb_build_array(tid) then raise exception 'Both teams need valid default lineups before starting';end if;
 g:=jsonb_set(g,array['lineups',tid],lineup);
 end loop;
 g:=g||jsonb_build_object('stage','live','frozenRosters',jsonb_build_object(g->>'away',league_private.ssl_roster(st,g->>'away'),g->>'home',league_private.ssl_roster(st,g->>'home')));
 else
 if g->>'stage' not in ('live','final') then raise exception 'Mark this game started before importing its result';end if;
 if st->>'status' not in ('regular','postseason') then raise exception 'Results can only be corrected during the regular season or postseason';end if;
 entry:=payload->'report';if jsonb_typeof(entry->'players') is distinct from 'array' or jsonb_array_length(entry->'players') not between 18 and 50 or coalesce(entry->>'fingerprint','') !~ '^[a-f0-9]{64}$' then raise exception 'Invalid report or player list';end if;
 if exists(select 1 from league_private.ssl_season_states ss cross join lateral jsonb_array_elements(ss.state->'games') z where z->'result'->>'fingerprint'=entry->>'fingerprint' and z->>'id'<>g->>'id') then raise exception 'This report was already uploaded for another game';end if;
 if (select count(distinct value->>'player') from jsonb_array_elements(entry->'players'))<>jsonb_array_length(entry->'players') then raise exception 'Map each report row to a distinct player';end if;
 ids:='{}';
 for x in select value from jsonb_array_elements(entry->'players') loop
 player:=(x->>'player')::integer;tid:=x->>'team';if tid is null or tid not in (g->>'away',g->>'home') or not g->'frozenRosters'->tid @> jsonb_build_array(player) then raise exception 'Report player is not on this game''s roster';end if;
 if jsonb_typeof(x->'positions') is distinct from 'array' or jsonb_array_length(x->'positions') not between 1 and 9 or exists(select 1 from jsonb_array_elements_text(x->'positions') p where p not in ('P','C','1B','2B','3B','SS','LF','CF','RF')) then raise exception 'Invalid positions played';end if;
 if jsonb_typeof(x->'stats') is distinct from 'object' then raise exception 'Invalid player stats';end if;
 for team,y in select * from jsonb_each(x->'stats') loop if not team=any(allowed_stats) or jsonb_typeof(y)<>'number' or (y::text)::numeric not between 0 and 100000 or (y::text)::numeric<>trunc((y::text)::numeric) then raise exception 'Invalid counting stat: %',team;end if;end loop;
 end loop;
 if (select count(distinct value->>'team') from jsonb_array_elements(entry->'players'))<>2 then raise exception 'Report must contain both teams';end if;
 for tid in select unnest(array[g->>'away',g->>'home']) loop
 select coalesce(sum((value->'stats'->>'runs')::integer),0) into n from jsonb_array_elements(entry->'players') where value->>'team'=tid;ids:=ids||jsonb_build_object(tid,n);
 if (select count(*) from jsonb_array_elements(entry->'players') where value->>'team'=tid)<9 then raise exception 'Each team needs at least nine players';end if;
 end loop;
 if ids->(g->>'away')=ids->(g->>'home') then raise exception 'A finished game cannot be tied';end if;
 arr:='[]';
 for x in select value from jsonb_array_elements(entry->'players') loop
 tid:=x->>'team';cnt:=(select count(*) from jsonb_array_elements(entry->'players') z where z->>'team'=tid and (coalesce((z->'stats'->>'outs')::integer,0)>0 or coalesce((z->'stats'->>'battersFaced')::integer,0)>0 or coalesce((z->'stats'->>'pitches')::integer,0)>0));
 seconds:=league_private.ssl_points(x->'stats',cnt=1,((ids->>(case when tid=g->>'away' then g->>'home' else g->>'away' end))::integer=0));arr:=arr||jsonb_build_array(x||jsonb_build_object('fantasyPoints',seconds));
 end loop;
 g:=g||jsonb_build_object('stage','final','result',jsonb_build_object('fingerprint',entry->>'fingerprint','filename',left(entry->>'filename',200),'players',arr,'scores',ids,'postedAt',now()));
 end if;
 st:=jsonb_set(st,array['games',idx::text],g);
 elsif op='postseason' then
 if st->>'status'<>'regular' or exists(select 1 from jsonb_array_elements(st->'games') z where z->>'stage'<>'final') then raise exception 'Finish all regular-season games first';end if;st:=st||jsonb_build_object('status','postseason');
 elsif op='finish' then
 if st->>'status'<>'postseason' or exists(select 1 from jsonb_array_elements(st->'games') z where z->>'stage'<>'final') then raise exception 'Finish the championship series and all games first';end if;
 if payload->>'champion'=payload->>'finalist' or not exists(select 1 from jsonb_array_elements(st->'games') z where z->>'phase'='playoffs' and payload->>'champion' in(z->>'away',z->>'home')) or not exists(select 1 from jsonb_array_elements(st->'games') z where z->>'phase'='playoffs' and payload->>'finalist' in(z->>'away',z->>'home')) then raise exception 'Select the two championship finalists';end if;
 st:=st||jsonb_build_object('status','retention','champion',payload->>'champion','finalist',payload->>'finalist');
 for x in select value from jsonb_array_elements(st->'teams') loop
 insert into league_private.ssl_token_grants values(target,(x->>'id')::uuid) on conflict do nothing;get diagnostics cnt=row_count;
 if cnt=1 then update league_private.ssl_franchises set tokens=least(5,tokens+3) where id=(x->>'id')::uuid;end if;
 end loop;
 elsif op='extension' then
 if st->>'status'<>'retention' then raise exception 'Extensions open after the championship series';end if;
 player:=(payload->>'player')::integer;if not league_private.ssl_roster(st,team) @> jsonb_build_array(player) then raise exception 'Choose a player on your roster';end if;
 if exists(select 1 from league_private.ssl_extension_offers o where o.season=target and o.franchise=team::uuid and o.player=manager.player) or exists(select 1 from league_private.ssl_extensions e where e.season_number=s.number+1 and e.player=manager.player) then raise exception 'This player already received an offer or is already extended';end if;
 select tokens into balance from league_private.ssl_franchises where id=team::uuid for update;if coalesce(balance,0)<1 then raise exception 'No unused extension contracts';end if;
 select coalesce(h.accepted,0) into repeats from league_private.ssl_extension_history h where h.franchise=team::uuid and h.player=manager.player;repeats:=coalesce(repeats,0);
 chance:=case repeats when 0 then 100 when 1 then 85 when 2 then 70 when 3 then 50 when 4 then 25 else 15 end;
 if repeats>0 then
 if team=st->>'champion' then chance:=chance+20;elsif team=st->>'finalist' then chance:=chance+15;elsif exists(select 1 from jsonb_array_elements(st->'games') z where z->>'phase'='playoffs' and team in(z->>'away',z->>'home')) then chance:=chance+10;
 end if;
 -- Last place is lowest regular-season winning percentage, then run differential, then stable slot.
 select q.id into tid from (select tm->>'id' id,(select slot from league_private.ssl_franchises where id=(tm->>'id')::uuid) slot,
 (select coalesce(avg(case when (g1->'result'->'scores'->>(tm->>'id'))::integer>(g1->'result'->'scores'->>(case when g1->>'away'=tm->>'id' then g1->>'home' else g1->>'away' end))::integer then 1.0 else 0.0 end),0) from jsonb_array_elements(st->'games') g1 where g1->>'phase'='regular' and g1->>'stage'='final' and tm->>'id' in(g1->>'away',g1->>'home')) pct,
 (select coalesce(sum((g1->'result'->'scores'->>(tm->>'id'))::integer-(g1->'result'->'scores'->>(case when g1->>'away'=tm->>'id' then g1->>'home' else g1->>'away' end))::integer),0) from jsonb_array_elements(st->'games') g1 where g1->>'phase'='regular' and g1->>'stage'='final' and tm->>'id' in(g1->>'away',g1->>'home')) rd from jsonb_array_elements(st->'teams') tm) q order by pct,rd,slot desc limit 1;
 if tid=team then chance:=chance-10;end if;end if;
 chance:=least(100,greatest(0,chance));roll:=floor(random()*100)+1;
 update league_private.ssl_franchises set tokens=tokens-1 where id=team::uuid;
 insert into league_private.ssl_extension_offers values(target,team::uuid,player,chance,roll,roll<=chance);
 if roll<=chance then
 insert into league_private.ssl_extension_history values(team::uuid,player,1) on conflict on constraint ssl_extension_history_pkey do update set accepted=ssl_extension_history.accepted+1;
 insert into league_private.ssl_extensions values(s.number+1,player,team::uuid);
 end if;
 elsif op='archive' then
 if st->>'status'<>'retention' then raise exception 'Complete the season and open extensions first';end if;st:=st||jsonb_build_object('status','archived');
 elsif op='submit_trade' then
 if not coalesce((st->>'tradingOpen')::boolean,false) then raise exception 'Trading opens after all default lineups are saved';end if;
 if jsonb_typeof(payload->'teams') is distinct from 'array' or jsonb_array_length(payload->'teams') not between 2 and 12 or not payload->'teams' @> jsonb_build_array(team) then raise exception 'Include your team and another team';end if;
 if (select count(distinct value) from jsonb_array_elements(payload->'teams'))<>jsonb_array_length(payload->'teams') then raise exception 'Duplicate trade teams';end if;
 for x in select value from jsonb_array_elements(payload->'teams') loop if not exists(select 1 from jsonb_array_elements(st->'teams') z where z->>'id'=x#>>'{}') then raise exception 'Unknown trade team';end if;end loop;
 if jsonb_typeof(payload->'moves') is distinct from 'array' or jsonb_array_length(payload->'moves') not between 1 and 50 then raise exception 'Choose trade assets';end if;
 if (select count(*) from league_private.ssl_offers o where o.season=target and o.status in ('pending','ready') and o.body->>'sender'=team)>=20 then raise exception 'Resolve pending offers before adding more';end if;
 -- Ownership and pick minimums are rechecked on approval, because assets can change while negotiating.
 for x in select value from jsonb_array_elements(payload->'moves') loop
 if x->>'kind' not in ('player','pick','contract') or x->>'from'=x->>'to' or not payload->'teams' @> jsonb_build_array(x->>'from') or not payload->'teams' @> jsonb_build_array(x->>'to') then raise exception 'Invalid trade move';end if;end loop;
 insert into league_private.ssl_offers(id,season,body,accepted) values(newid,target,jsonb_build_object('sender',team,'teams',payload->'teams','moves',payload->'moves','note',left(coalesce(payload->>'note',''),1000)),jsonb_build_array(team));
 if payload->>'counterTo' is not null then update league_private.ssl_offers set status='countered' where id=(payload->>'counterTo')::uuid and season=target and status in ('pending','ready') and body->'teams' @> jsonb_build_array(team);end if;
 elsif op in ('accept_trade','reject_trade','cancel_trade','approve_trade') then
 select * into offer from league_private.ssl_offers where id=(payload->>'offer')::uuid and season=target for update;if not found or offer.status not in ('pending','ready') then raise exception 'Trade is no longer pending';end if;
 if not commissioner and not offer.body->'teams' @> jsonb_build_array(team) then raise exception 'This offer belongs to other teams';end if;
 if op='cancel_trade' then if not commissioner and offer.body->>'sender'<>team then raise exception 'Only the sender can cancel';end if;update league_private.ssl_offers set status='cancelled' where id=offer.id;
 elsif op='reject_trade' then update league_private.ssl_offers set status='rejected' where id=offer.id;
 elsif op='accept_trade' then
 if team is null or not offer.body->'teams' @> jsonb_build_array(team) then raise exception 'Select the accepting franchise';end if;
 ids:=offer.accepted;if not ids @> jsonb_build_array(team) then ids:=ids||jsonb_build_array(team);end if;
 update league_private.ssl_offers set accepted=ids,status=case when jsonb_array_length(ids)=jsonb_array_length(body->'teams') then 'ready' else 'pending' end where id=offer.id;
 else
 if jsonb_array_length(offer.accepted)<>jsonb_array_length(offer.body->'teams') then raise exception 'Every participating team must accept first';end if;
 if exists(select 1 from jsonb_array_elements(st->'games') z where z->>'stage'='live' and (offer.body->'teams' @> jsonb_build_array(z->>'away') or offer.body->'teams' @> jsonb_build_array(z->>'home'))) then raise exception 'Wait for involved teams'' live game results';end if;
 ids:='[]';
 for x in select value from jsonb_array_elements(offer.body->'moves') loop
 tid:=x->>'from';team:=x->>'to';
 if x->>'kind' in ('player','pick') then
 if ids @> jsonb_build_array((x->>'kind')||':'||(x->>'id')) then raise exception 'An asset appears twice';end if;ids:=ids||jsonb_build_array((x->>'kind')||':'||(x->>'id'));
 end if;
 if x->>'kind'='player' then
 player:=(x->>'id')::integer;if not league_private.ssl_roster(st,tid) @> jsonb_build_array(player) then raise exception 'Player ownership changed; submit a new offer';end if;
 st:=jsonb_set(st,array['rosters',tid],(select coalesce(jsonb_agg(value),'[]') from jsonb_array_elements(league_private.ssl_roster(st,tid)) where value<>to_jsonb(player)));st:=jsonb_set(st,array['rosters',team],league_private.ssl_roster(st,team)||jsonb_build_array(player));
 for y in select to_jsonb(v) from unnest(array[tid,team]) v loop if not st->'needsDefault' @> jsonb_build_array(y#>>'{}') then st:=jsonb_set(st,'{needsDefault}',st->'needsDefault'||jsonb_build_array(y#>>'{}'));end if;end loop;
 update league_private.ssl_extensions set franchise=team::uuid where season_number=(case when coalesce((st->>'offseasonTrading')::boolean,false) then s.number else s.number+1 end) and ssl_extensions.player=manager.player and franchise=tid::uuid;
 elsif x->>'kind'='pick' then
 asset:=(x->>'id')::uuid;update league_private.ssl_pick_assets set owner=team::uuid where id=asset and owner=tid::uuid and season_number=(case when coalesce((st->>'offseasonTrading')::boolean,false) then s.number else s.number+1 end);get diagnostics cnt=row_count;if cnt<>1 then raise exception 'Pick ownership changed';end if;
 elsif x->>'kind'='contract' then
 qty:=(x->>'quantity')::integer;if qty is null or qty<1 then raise exception 'Enter a positive number of contracts';end if;
 -- Contract transfers are applied together below, using net balances.
 end if;
 end loop;
 with deltas as (select id,sum(delta)::int delta from (select (m->>'from')::uuid id,-(m->>'quantity')::int delta from jsonb_array_elements(offer.body->'moves') m where m->>'kind'='contract' union all select (m->>'to')::uuid,(m->>'quantity')::int from jsonb_array_elements(offer.body->'moves') m where m->>'kind'='contract') z group by id)
 update league_private.ssl_franchises f set tokens=f.tokens+d.delta from deltas d where f.id=d.id;
 for x in select value from jsonb_array_elements(offer.body->'teams') loop if (select count(*) from league_private.ssl_pick_assets where owner=(x#>>'{}')::uuid and season_number=(case when coalesce((st->>'offseasonTrading')::boolean,false) then s.number else s.number+1 end))<9 then raise exception 'Each team must keep at least nine next-season picks';end if;end loop;
 update league_private.ssl_offers set status='approved' where id=offer.id;
 end if;
 else raise exception 'Unknown operation';end if;
 -- Synchronize fantasy locks to posted official games and current game rosters.
 if op in ('publish_schedule','schedule','start_game','add_player','drop_player','random_fill','approve_trade') then
 for g in select value from jsonb_array_elements(st->'games') loop
 if not (st->>'schedulePublished')::boolean then continue;end if;
 delete from public.fantasy_player_schedule where game_key='ssl:'||(g->>'id');
 for tid in select unnest(array[g->>'away',g->>'home']) loop
 for x in select value from jsonb_array_elements(case when g ? 'frozenRosters' then g->'frozenRosters'->tid else league_private.ssl_roster(st,tid) end) loop
 insert into public.fantasy_player_schedule(game_key,player_id,starts_at) values('ssl:'||(g->>'id'),x::integer,(g->>'startsAt')::timestamptz) on conflict do nothing;
 end loop;end loop;end loop;end if;
 update league_private.ssl_season_states set state=st where id=target;
 insert into league_private.ssl_actions(season,actor,operation,details) values(target,auth.uid(),op,jsonb_build_object('team',case when commissioner then payload->>'team' else f::text end,'game',payload->>'game','offer',payload->>'offer'));
 return jsonb_build_object('ok',true,'id',target);
end$$;

create function league_private.ssl_rankings(st jsonb) returns jsonb language sql immutable set search_path='' as $$
 with teams as(select t->>'id' id,(t->>'slot')::int slot from jsonb_array_elements(st->'teams') t),results as(select t.id,t.slot,
 coalesce(avg(case when (g->'result'->'scores'->>t.id)::int>(g->'result'->'scores'->>(case when g->>'away'=t.id then g->>'home' else g->>'away' end))::int then 1.0 else 0.0 end) filter(where g->>'stage'='final'),0) pct,
 coalesce(sum((g->'result'->'scores'->>t.id)::int-(g->'result'->'scores'->>(case when g->>'away'=t.id then g->>'home' else g->>'away' end))::int) filter(where g->>'stage'='final'),0) diff
 from teams t left join lateral jsonb_array_elements(st->'games') g on g->>'phase'='regular' and t.id in(g->>'away',g->>'home') group by t.id,t.slot),ranked as(select id,row_number()over(order by pct desc,diff desc,slot) rank from results)
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'rank',rank) order by rank),'[]') from ranked
$$;
create function league_private.ssl_extension_quote(st jsonb,team uuid,accepted integer) returns jsonb language plpgsql immutable set search_path='' as $$
declare base integer;modifier integer:=0;label text:='No finish modifier earned yet';ranking integer;result jsonb;begin
 base:=case accepted when 0 then 100 when 1 then 85 when 2 then 70 when 3 then 50 when 4 then 25 else 15 end;
 select (value->>'rank')::int into ranking from jsonb_array_elements(coalesce(st->'finalStandings','[]')) where value->>'id'=team::text;
 if st->>'champion'=team::text then modifier:=20;label:='Won finals';
 elsif st->>'finalist'=team::text or exists(select 1 from jsonb_array_elements(st->'games') g where g->>'phase'='playoffs' and g->>'playoffRound'='final' and team::text in(g->>'away',g->>'home')) then modifier:=15;label:='Made finals';
 elsif exists(select 1 from jsonb_array_elements(st->'games') g where g->>'phase'='playoffs' and g->>'playoffRound'='semifinal' and team::text in(g->>'away',g->>'home')) then modifier:=10;label:='Made semifinals';
 elsif ranking between 1 and 8 then modifier:=5;label:='Made playoffs';
 elsif ranking in(9,10) then modifier:=-10;label:='Finished '||ranking||case when ranking=9 then 'th' else 'th' end;
 elsif ranking=11 then modifier:=-15;label:='Finished 11th';
 elsif ranking=12 then modifier:=-20;label:='Finished 12th';end if;
 result:=jsonb_build_object('ordinal',accepted+1,'priorAccepted',accepted,'base',base,'modifier',modifier,'modifierLabel',label,'rank',ranking,'total',least(100,greatest(0,base+modifier)));
 return result||jsonb_build_object('fingerprint',md5(result::text));
end$$;
revoke all on function league_private.ssl_rankings(jsonb),league_private.ssl_extension_quote(jsonb,uuid,integer) from public,anon,authenticated;
create function league_private.ssl_extension_preview(target uuid,franchise uuid,chosen integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare a jsonb:=league_private.current_access();s league_private.ssl_season_states;f uuid;n integer;begin
 if auth.uid() is null or coalesce(a->>'role','') not in ('commissioner','gm') then raise exception 'GM or commissioner access required';end if;
 select id into f from league_private.ssl_franchises where slot=(a->>'slot')::int;
 if a->>'role'<>'commissioner' and franchise is distinct from f then raise exception 'Choose your own franchise';end if;
 perform league_private.ssl_tick(target);select * into s from league_private.ssl_season_states where id=target;
 if s.id is null or not league_private.ssl_roster(s.state,franchise::text) @> jsonb_build_array(chosen) then raise exception 'Choose a rostered player';end if;
 select coalesce(h.accepted,0) into n from league_private.ssl_extension_history h where h.franchise=ssl_extension_preview.franchise and h.player=chosen;
 return league_private.ssl_extension_quote(s.state,franchise,coalesce(n,0))||jsonb_build_object('contracts',(select tokens from league_private.ssl_franchises where id=franchise));
end$$;
revoke all on function league_private.ssl_extension_preview(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function league_private.ssl_extension_preview(uuid,uuid,integer) to authenticated;
create function public.ssl_extension_preview(season uuid,team uuid,player integer) returns jsonb language sql security invoker set search_path='' as $$select league_private.ssl_extension_preview(season,team,player)$$;
revoke all on function public.ssl_extension_preview(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.ssl_extension_preview(uuid,uuid,integer) to authenticated;
alter function league_private.ssl_manage(text,uuid,jsonb) rename to ssl_manage_calendar;
revoke all on function league_private.ssl_manage_calendar(text,uuid,jsonb) from public,anon,authenticated;
create function league_private.ssl_manage(op text,target uuid,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
<<contract_manager>>
declare a jsonb:=league_private.current_access();s league_private.ssl_season_states;f uuid;team uuid;player integer;quote jsonb;n integer;dice integer;accepted_offer boolean;answer jsonb;ranking jsonb;qualified jsonb;arr jsonb;g jsonb;round_name text;begin
 if auth.uid() is null or coalesce(a->>'role','') not in ('commissioner','gm') then raise exception 'GM or commissioner access required';end if;
 perform pg_advisory_xact_lock(736114221);
 if op='create' then return league_private.ssl_manage_calendar(op,target,payload);end if;
 perform league_private.ssl_tick(target);select * into s from league_private.ssl_season_states where id=target for update;
 if not found then raise exception 'Season not found';end if;
 if op='extension' then
 select id into f from league_private.ssl_franchises where slot=(a->>'slot')::int;team:=case when a->>'role'='commissioner' then (payload->>'team')::uuid else f end;player:=(payload->>'player')::int;
 if s.state->>'status' not in ('regular','postseason','retention') or not coalesce((s.state->>'extensionsOpen')::boolean,false) then raise exception 'The extension window is closed';end if;
 quote:=league_private.ssl_extension_preview(target,team,player);
 if payload->>'quoteFingerprint' is distinct from quote->>'fingerprint' then raise exception 'Acceptance odds changed. Review the updated chance before applying.';end if;
 if exists(select 1 from league_private.ssl_extension_offers o where o.season=target and o.franchise=team and o.player=contract_manager.player) or exists(select 1 from league_private.ssl_extensions e where e.season_number=s.number+1 and e.player=contract_manager.player) then raise exception 'This player already received an offer or signed an extension';end if;
 update league_private.ssl_franchises set tokens=tokens-1 where id=team and tokens>0;get diagnostics n=row_count;if n<>1 then raise exception 'No unused extension contracts';end if;
 dice:=floor(random()*100)+1;accepted_offer:=dice<=(quote->>'total')::int;
 insert into league_private.ssl_extension_offers(season,franchise,player,chance,roll,accepted,breakdown) values(target,team,player,(quote->>'total')::int,dice,accepted_offer,quote);
 if accepted_offer then
 insert into league_private.ssl_extension_history values(team,player,1) on conflict on constraint ssl_extension_history_pkey do update set accepted=ssl_extension_history.accepted+1;
 insert into league_private.ssl_extensions values(s.number+1,player,team);
 end if;
 insert into league_private.ssl_actions(season,actor,operation,details) values(target,auth.uid(),'extension',jsonb_build_object('team',team,'player',player,'chance',quote->'total','accepted',accepted_offer));
 return jsonb_build_object('ok',true,'accepted',accepted_offer,'quote',quote,'remaining',(select tokens from league_private.ssl_franchises where id=team));
 end if;
 if op='postseason' then
 answer:=league_private.ssl_manage_calendar(op,target,payload);ranking:=league_private.ssl_rankings(s.state);select jsonb_agg(value->'id' order by (value->>'rank')::int) into qualified from jsonb_array_elements(ranking) where (value->>'rank')::int<=8;
 update league_private.ssl_season_states set state=state||jsonb_build_object('finalStandings',ranking,'playoffTeams',qualified) where id=target;return answer;
 end if;
 if op='schedule' and s.state->>'status'='postseason' then
 round_name:=coalesce(payload->>'playoffRound','quarterfinal');if round_name not in ('quarterfinal','semifinal','final') then raise exception 'Select a playoff round';end if;
 qualified:=coalesce(s.state->'playoffTeams',(select jsonb_agg(value->'id') from jsonb_array_elements(league_private.ssl_rankings(s.state)) where (value->>'rank')::int<=8));
 if not qualified @> jsonb_build_array(payload->>'away') or not qualified @> jsonb_build_array(payload->>'home') then raise exception 'Only the top eight teams qualify for playoffs';end if;
 answer:=league_private.ssl_manage_calendar(op,target,payload);select state->'games' into arr from league_private.ssl_season_states where id=target;g:=arr->(jsonb_array_length(arr)-1);g:=g||jsonb_build_object('playoffRound',round_name);arr:=jsonb_set(arr,array[(jsonb_array_length(arr)-1)::text],g);
 update league_private.ssl_season_states set state=jsonb_set(state,'{games}',arr) where id=target;return answer;
 end if;
 return league_private.ssl_manage_calendar(op,target,payload);
end$$;
revoke all on function league_private.ssl_manage(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function league_private.ssl_manage(text,uuid,jsonb) to authenticated;
create or replace function public.ssl_manage(operation text,season uuid default null,payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select league_private.ssl_manage(operation,season,payload)$$;
