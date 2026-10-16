-- Authoritative returning-season lottery and season-owned Star Coin ledger.
-- All changes use the league's existing transaction lock and access checks.
create function league_private.ssl_lottery_order(teams jsonb, ranking jsonb, draws jsonb default null) returns jsonb
language plpgsql volatile set search_path='' as $$
declare pool jsonb; result jsonb:='[]'; selected text; roll numeric; total integer; i integer;begin
 if jsonb_array_length(teams)<>12 then raise exception 'Lottery requires twelve teams';end if;
 if ranking is null then select jsonb_agg(t->'id' order by random()) into result from jsonb_array_elements(teams) t;return result;end if;
 if jsonb_array_length(ranking)<>12 or (select count(distinct r->>'id') from jsonb_array_elements(ranking) r)<>12 or exists(select 1 from jsonb_array_elements(teams) t where not exists(select 1 from jsonb_array_elements(ranking) r where r->>'id'=t->>'id')) then raise exception 'Previous season standings must contain all twelve current franchises';end if;
 select jsonb_agg(jsonb_build_object('id',r->>'id','weight',case (r->>'rank')::int when 12 then 55 when 11 then 25 when 10 then 15 when 9 then 5 end) order by (r->>'rank')::int desc) into pool from jsonb_array_elements(ranking) r where (r->>'rank')::int>=9;
 if jsonb_array_length(pool)<>4 then raise exception 'Invalid previous-season seeds';end if;
 for i in 0..3 loop
  select sum((p->>'weight')::int) into total from jsonb_array_elements(pool) p;
  roll:=coalesce((draws->>i)::numeric,random())*total;
  if roll<0 or roll>=total then raise exception 'Invalid lottery draw';end if;
  select id into selected from (select p->>'id' id,sum((p->>'weight')::int) over(order by ord) running from jsonb_array_elements(pool) with ordinality a(p,ord)) q where running>roll order by running limit 1;
  result:=result||jsonb_build_array(selected);
  select coalesce(jsonb_agg(p),'[]') into pool from jsonb_array_elements(pool) p where p->>'id'<>selected;
 end loop;
 select result||jsonb_agg(r->'id' order by (r->>'rank')::int desc) into result from jsonb_array_elements(ranking) r where (r->>'rank')::int<=8;
 return result;
end$$;
revoke all on function league_private.ssl_lottery_order(jsonb,jsonb,jsonb) from public,anon,authenticated;

create or replace function league_private.ssl_tick_draft(target uuid) returns void language plpgsql security definer set search_path='' as $$
declare s league_private.ssl_season_states;st jsonb; ranking jsonb;ord jsonb;begin
 perform pg_advisory_xact_lock(736114221);
 select * into s from league_private.ssl_season_states where id=target for update;if not found then return;end if;st:=s.state;
 if st->>'status'='scheduled' and now()>=(st->>'lotteryAt')::timestamptz and jsonb_array_length(st->'order')=0 then
  if s.number>1 then select state->'finalStandings' into ranking from league_private.ssl_season_states where number=s.number-1;if ranking is null then raise exception 'Complete and archive previous-season standings before drawing the lottery';end if;end if;
  ord:=league_private.ssl_lottery_order(st->'teams',ranking);
  st:=st||jsonb_build_object('order',ord,'lotteryDrawnAt',now(),'lotteryType',case when s.number=1 then 'equal' else 'weighted' end,'lotteryStandings',coalesce(ranking,'[]'));
  insert into league_private.ssl_actions(season,operation,details) values(target,'lottery',jsonb_build_object('order',ord,'weights',case when s.number=1 then '{}'::jsonb else '{"12":55,"11":25,"10":15,"9":5}'::jsonb end));
 end if;
 if st->>'status'='scheduled' and now()>=(st->>'draftAt')::timestamptz and jsonb_array_length(st->'order')=12 then st:=st||jsonb_build_object('status','drafting','pickStartedAt',st->>'draftAt');end if;
 if st<>s.state then update league_private.ssl_season_states set state=st where id=target;end if;
end$$;

create or replace function league_private.ssl_rankings(st jsonb) returns jsonb language sql immutable set search_path='' as $$
 with teams as(select t->>'id' id,(t->>'slot')::int slot from jsonb_array_elements(st->'teams') t),results as(select t.id,t.slot,
 coalesce(avg(case when (g->'result'->'scores'->>t.id)::int>(g->'result'->'scores'->>(case when g->>'away'=t.id then g->>'home' else g->>'away' end))::int then 1.0 else 0.0 end) filter(where g->>'stage'='final'),0) pct,
 coalesce(sum((g->'result'->'scores'->>t.id)::int-(g->'result'->'scores'->>(case when g->>'away'=t.id then g->>'home' else g->>'away' end))::int) filter(where g->>'stage'='final'),0) diff,
 coalesce(sum((g->'result'->'scores'->>(case when g->>'away'=t.id then g->>'home' else g->>'away' end))::int) filter(where g->>'stage'='final'),0) allowed
 from teams t left join lateral jsonb_array_elements(st->'games') g on g->>'phase'='regular' and t.id in(g->>'away',g->>'home') group by t.id,t.slot),ranked as(select id,row_number()over(order by pct desc,diff desc,allowed,slot) rank from results)
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'rank',rank) order by rank),'[]') from ranked
$$;

-- Projection is recomputed from immutable locked-game charges and signed transfers.
-- Future reservations are repriced together so editing an earlier lineup cannot overspend later ones.
create function league_private.ssl_star_view(st jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare balances jsonb:='{}';recharge jsonb:='{}';info jsonb:='{}';sim jsonb;g jsonb;t jsonb;m jsonb;p jsonb;sel jsonb;players jsonb;costs jsonb;need jsonb;b jsonb;cost integer;price integer;tid text;pid text;expired boolean;begin
 expired:=st->>'champion' is not null or exists(select 1 from jsonb_array_elements(coalesce(st->'playoffSeries','[]')) x where x->>'round'='final' and x->>'winner' is not null);
 for t in select value from jsonb_array_elements(coalesce(st->'teams','[]')) loop balances:=jsonb_set(balances,array[t->>'id'],'{"allocation":55,"transfers":0,"spent":0,"reserved":0,"available":55}');end loop;
 for m in select value from jsonb_array_elements(coalesce(st->'starTransfers','[]')) loop
  for tid in select unnest(array[m->>'from',m->>'to']) loop
   b:=balances->tid;
   b:=jsonb_set(b,'{transfers}',to_jsonb((b->>'transfers')::int+case when tid=m->>'from' then -(m->>'quantity')::int else (m->>'quantity')::int end));balances:=jsonb_set(balances,array[tid],b);
  end loop;
 end loop;
 for g in select value from jsonb_array_elements(coalesce(st->'games','[]')) where value ? 'starRecord' and value->>'stage'<>'cancelled' order by (value->'starRecord'->>'sequence')::int loop
  for tid in select unnest(array[g->>'away',g->>'home']) loop
   m:=g->'starRecord'->'teams'->tid;sel:=coalesce(m->'selected','[]');cost:=coalesce((m->>'cost')::int,0);
   b:=balances->tid;b:=jsonb_set(b,'{spent}',to_jsonb((b->>'spent')::int+cost));balances:=jsonb_set(balances,array[tid],b);
   for p in select value from jsonb_array_elements(coalesce(g->'frozenRosters'->tid,'[]')) loop recharge:=jsonb_set(recharge,array[p#>>'{}'],to_jsonb(sel @> jsonb_build_array(p)));end loop;
   info:=jsonb_set(info,array[g->>'id'],coalesce(info->(g->>'id'),'{}')||jsonb_build_object(tid,m||'{"status":"spent"}'::jsonb));
  end loop;
 end loop;
 sim:=recharge;
 for g in select value from jsonb_array_elements(coalesce(st->'games','[]')) where not value ? 'starRecord' and value->>'stage' in ('scheduled','live') order by (value->>'startsAt')::timestamptz,value->>'id' loop
  for tid in select unnest(array[g->>'away',g->>'home']) loop
   sel:=coalesce(g->'starRequests'->tid,'[]');players:=league_private.ssl_roster(st,tid);need:='[]';costs:='{}';cost:=0;
   for p in select value from jsonb_array_elements(players) loop
    pid:=p#>>'{}';price:=case when coalesce((sim->>pid)::boolean,false) then 6 else 1 end;
    if price=6 then need:=need||jsonb_build_array(p);end if;
    if sel @> jsonb_build_array(p) then cost:=cost+price;costs:=jsonb_set(costs,array[pid],to_jsonb(price));end if;
    sim:=jsonb_set(sim,array[pid],to_jsonb(sel @> jsonb_build_array(p)));
   end loop;
   b:=balances->tid;b:=jsonb_set(b,'{reserved}',to_jsonb((b->>'reserved')::int+cost));balances:=jsonb_set(balances,array[tid],b);
   info:=jsonb_set(info,array[g->>'id'],coalesce(info->(g->>'id'),'{}')||jsonb_build_object(tid,jsonb_build_object('selected',sel,'cost',cost,'byPlayer',costs,'recharging',need,'status','reserved')));
  end loop;
 end loop;
 for tid,b in select * from jsonb_each(balances) loop
  b:=b||jsonb_build_object('available',case when expired then 0 else 55+(b->>'transfers')::int-(b->>'spent')::int-(b->>'reserved')::int end,'expired',expired);
  balances:=jsonb_set(balances,array[tid],b);
 end loop;
 return jsonb_build_object('balances',balances,'games',info,'recharging',recharge,'expired',expired);
end$$;
revoke all on function league_private.ssl_star_view(jsonb) from public,anon,authenticated;

-- Accept coin assets in the existing trade pipeline; the outer wrapper applies and validates their ledger.
do $$declare def text;begin
 def:=pg_get_functiondef('league_private.ssl_manage_core(text,uuid,jsonb)'::regprocedure);
 if position('not in (''player'',''pick'',''contract'')' in def)=0 then raise exception 'Unexpected trade validator; review before replacing';end if;
 def:=replace(def,'not in (''player'',''pick'',''contract'')','not in (''player'',''pick'',''contract'',''coin'')');
 def:=replace(def,'if not (st->>''schedulePublished'')::boolean then continue;end if;','if g->>''stage''=''cancelled'' or not (st->>''schedulePublished'')::boolean then continue;end if;');execute def;
 def:=pg_get_functiondef('league_private.ssl_manage(text,uuid,jsonb)'::regprocedure);
 def:=replace(def,'if not coalesce((st->>''schedulePublished'')::boolean,false) then continue;end if;','if g->>''stage''=''cancelled'' or not coalesce((st->>''schedulePublished'')::boolean,false) then continue;end if;');
 def:=replace(def,'value->>''stage''<>''final'') then raise exception ''Release the previous game','value->>''stage'' not in (''final'',''cancelled'')) then raise exception ''Release the previous game');
 def:=replace(def,'where value->>''seriesId''=series->>''id'';','where value->>''seriesId''=series->>''id'' and value->>''stage''<>''cancelled'';');
 def:=replace(def,'where value->>''seriesId''=series->>''id''))','where value->>''seriesId''=series->>''id'' and value->>''stage''<>''cancelled''))');execute def;
end$$;

alter function league_private.ssl_manage(text,uuid,jsonb) rename to ssl_manage_before_stars;
revoke all on function league_private.ssl_manage_before_stars(text,uuid,jsonb) from public,anon,authenticated;
create function league_private.ssl_manage(op text,target uuid,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare a jsonb:=league_private.current_access();s league_private.ssl_season_states;st jsonb;before_st jsonb;answer jsonb;g jsonb;m jsonb;arr jsonb;view jsonb;team text;f text;tid text;idx integer;seq integer;selected jsonb;record_teams jsonb;offer league_private.ssl_offers;qty integer;new_payload jsonb:=payload;begin
 if auth.uid() is null then raise exception 'Sign in first';end if;
 if pg_column_size(payload)>1000000 then raise exception 'Request too large';end if;
 perform pg_advisory_xact_lock(736114221);
 if op='create' then return league_private.ssl_manage_before_stars(op,target,payload);end if;
 perform league_private.ssl_tick(target);
 select * into s from league_private.ssl_season_states where id=target for update;if not found then raise exception 'Season not found';end if;st:=s.state;before_st:=st;
 if op='ballot' then return league_private.ssl_manage_before_stars(op,target,payload);end if;
 if coalesce(a->>'role','') not in ('commissioner','gm') then raise exception 'GM or commissioner access required';end if;
 if st->>'status'='archived' then raise exception 'Archived season is read only';end if;
 select id::text into f from league_private.ssl_franchises where slot=(a->>'slot')::int;team:=case when a->>'role'='commissioner' then payload->>'team' else f end;
 if a->>'role'='gm' and not exists(select 1 from jsonb_array_elements(st->'teams') t where t->>'id'=f) then raise exception 'Your franchise is not in this season';end if;
 if op in ('game_lineup','result','cancel_game') then
  select value,ordinality::int-1 into g,idx from jsonb_array_elements(st->'games') with ordinality where value->>'id'=payload->>'game';if g is null then raise exception 'Game not found';end if;
 end if;
 if op='game_lineup' then
  if team is null or team not in(g->>'away',g->>'home') or g ? 'lockedAt' or g->>'stage' not in('scheduled','live') then raise exception 'This lineup is closed or belongs to another team';end if;
  selected:=coalesce(payload->'stars','[]');
  if jsonb_typeof(selected) is distinct from 'array' or jsonb_array_length(selected)>3 or (select count(distinct value) from jsonb_array_elements(selected))<>jsonb_array_length(selected) then raise exception 'Select up to three different starred players';end if;
  for m in select value from jsonb_array_elements(selected) loop if jsonb_typeof(m)<>'number' or (m::text)::numeric<>trunc((m::text)::numeric) or not league_private.ssl_roster(st,team) @> jsonb_build_array(m) then raise exception 'Star selections must be players on this roster';end if;end loop;
  g:=g||jsonb_build_object('starRequests',coalesce(g->'starRequests','{}')||jsonb_build_object(team,selected));st:=jsonb_set(st,array['games',idx::text],g);
  update league_private.ssl_season_states set state=st where id=target;
 elsif op='result' and not g ? 'starRecord' then
  if coalesce(a->>'role','')<>'commissioner' then raise exception 'Commissioner access required';end if;
  if exists(select 1 from jsonb_array_elements(st->'games') x where x->>'id'<>g->>'id' and x->>'stage' in('scheduled','live') and not x ? 'lockedAt' and ((x->>'startsAt')::timestamptz,x->>'id')<((g->>'startsAt')::timestamptz,g->>'id') and (x->>'away' in(g->>'away',g->>'home') or x->>'home' in(g->>'away',g->>'home'))) then raise exception 'Upload earlier scheduled games for these teams first so recharge remains in game order';end if;
  view:=league_private.ssl_star_view(st);record_teams:=view->'games'->(g->>'id');
  if record_teams is null then raise exception 'Star selections are unavailable for this game';end if;
  select coalesce(max((x->'starRecord'->>'sequence')::int),0)+1 into seq from jsonb_array_elements(st->'games') x;
 elsif op in ('submit_trade','approve_trade') then
  if op='approve_trade' then
   if coalesce(a->>'role','')<>'commissioner' then raise exception 'Commissioner access required';end if;
   select * into offer from league_private.ssl_offers where id=(payload->>'offer')::uuid and season=target for update;
   arr:=offer.body->'moves';
   if exists(select 1 from jsonb_array_elements(st->'games') x where x->>'stage'='recorded' and (offer.body->'teams' @> jsonb_build_array(x->>'away') or offer.body->'teams' @> jsonb_build_array(x->>'home'))) then raise exception 'Release involved teams recorded results before trading';end if;
  else arr:=payload->'moves';end if;
  for m in select value from jsonb_array_elements(coalesce(arr,'[]')) where value->>'kind'='coin' loop
   if jsonb_typeof(m->'quantity') is distinct from 'number' or (m->>'quantity')::numeric<>trunc((m->>'quantity')::numeric) or (m->>'quantity')::numeric not between 1 and 100000 then raise exception 'Trade a positive whole number of Star Coins';end if;
  end loop;
 elsif op='cancel_game' then
  if coalesce(a->>'role','')<>'commissioner' then raise exception 'Commissioner access required';end if;
  if g->>'stage' not in('scheduled','live','recorded') then raise exception 'Only an unreleased game can be cancelled';end if;
  if g ? 'starRecord' and exists(select 1 from jsonb_array_elements(st->'games') x where (x->'starRecord'->>'sequence')::int>(g->'starRecord'->>'sequence')::int and x->>'stage'<>'cancelled') then raise exception 'A later game is already recorded; correct game order before cancelling this result';end if;
  g:=(g-'result'-'releaseAt')||jsonb_build_object('stage','cancelled','cancelledAt',now(),'cancellationReason',left(coalesce(payload->>'reason','Cancelled by commissioner'),500));st:=jsonb_set(st,array['games',idx::text],g);
  update league_private.ssl_season_states set state=st where id=target;
  delete from public.fantasy_player_schedule where game_key='ssl:'||(g->>'id');
  insert into league_private.ssl_actions(season,actor,operation,details) values(target,auth.uid(),op,jsonb_build_object('game',g->>'id','refunded',coalesce(g->'starRecord'->'teams','{}')));
  return jsonb_build_object('ok',true);
 end if;
 if op='reschedule' then
  select value,ordinality::int-1 into g,idx from jsonb_array_elements(st->'games') with ordinality where value->>'id'=payload->>'game';
  if g->>'stage'='cancelled' then
   if coalesce(a->>'role','')<>'commissioner' then raise exception 'Commissioner access required';end if;
   g:=(g-'starRecord'-'lockedAt'-'frozenRosters'-'releaseAt'-'releasedAt')||jsonb_build_object('stage','scheduled','starRequests','{}'::jsonb,'lineups','{}'::jsonb);
   st:=jsonb_set(st,array['games',idx::text],g);update league_private.ssl_season_states set state=st where id=target;
  end if;
 end if;
 answer:=league_private.ssl_manage_before_stars(op,target,new_payload);
 select state into st from league_private.ssl_season_states where id=target;
 if op='result' and record_teams is not null then
  select value,ordinality::int-1 into g,idx from jsonb_array_elements(st->'games') with ordinality where value->>'id'=payload->>'game';
  g:=g||jsonb_build_object('starRecord',jsonb_build_object('sequence',seq,'teams',record_teams,'chargedAt',now()));st:=jsonb_set(st,array['games',idx::text],g);
 elsif op='approve_trade' then
  for m in select value from jsonb_array_elements(coalesce(arr,'[]')) where value->>'kind'='coin' loop
   st:=st||jsonb_build_object('starTransfers',coalesce(st->'starTransfers','[]')||jsonb_build_array(m||jsonb_build_object('offer',offer.id,'at',now())));
  end loop;
 end if;
 -- Prune only unlocked star requests after roster changes. Locked charges never change.
 if op in ('approve_trade','drop_player','add_player','random_fill') then
  arr:='[]';for g in select value from jsonb_array_elements(st->'games') loop
   if not g ? 'lockedAt' then
    for tid,selected in select * from jsonb_each(coalesce(g->'starRequests','{}')) loop
     select coalesce(jsonb_agg(p),'[]') into selected from jsonb_array_elements(selected) p where league_private.ssl_roster(st,tid) @> jsonb_build_array(p);
     g:=jsonb_set(g,array['starRequests',tid],selected);
    end loop;
   end if;arr:=arr||jsonb_build_array(g);
  end loop;st:=st||jsonb_build_object('games',arr);
 end if;
 view:=league_private.ssl_star_view(st);
 if op='game_lineup' and jsonb_array_length(coalesce(payload->'stars','[]'))>0 and coalesce((view->>'expired')::boolean,false) then raise exception 'These season Star Coins have expired';end if;
 if exists(select 1 from jsonb_each(view->'balances') b where (b.value->>'available')::int<0) then raise exception 'Not enough available Star Coins after reservations and recharge fees';end if;
 if op in ('submit_trade','approve_trade') and exists(select 1 from jsonb_array_elements(coalesce(case when op='submit_trade' then payload->'moves' else offer.body->'moves' end,'[]')) trade_move where trade_move->>'kind'='coin') then
  if coalesce((view->>'expired')::boolean,false) then raise exception 'These season Star Coins have expired';end if;
  if op='submit_trade' then
   for tid in select distinct trade_move->>'from' from jsonb_array_elements(payload->'moves') trade_move where trade_move->>'kind'='coin' loop
    select sum((trade_move->>'quantity')::int) into qty from jsonb_array_elements(payload->'moves') trade_move where trade_move->>'kind'='coin' and trade_move->>'from'=tid;
    if qty>coalesce((view->'balances'->tid->>'available')::int,0) then raise exception 'Not enough unreserved Star Coins to offer';end if;
   end loop;
  end if;
 end if;
 update league_private.ssl_season_states set state=st where id=target;
 return answer;
end$$;
revoke all on function league_private.ssl_manage(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function league_private.ssl_manage(text,uuid,jsonb) to authenticated;
create or replace function public.ssl_manage(operation text,season uuid default null,payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select league_private.ssl_manage(operation,season,payload)$$;

alter function league_private.ssl_read() rename to ssl_read_before_stars;
revoke all on function league_private.ssl_read_before_stars() from public,anon,authenticated;
create function league_private.ssl_read() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb:='[]';st jsonb;begin
 for st in select value from jsonb_array_elements(league_private.ssl_read_before_stars()) loop result:=result||jsonb_build_array(st||jsonb_build_object('starCoins',league_private.ssl_star_view(st)));end loop;return result;
end$$;
revoke all on function league_private.ssl_read() from public,anon,authenticated;
grant execute on function league_private.ssl_read() to anon,authenticated;
create or replace function public.ssl_seasons() returns jsonb language sql security invoker set search_path='' as $$select league_private.ssl_read()$$;
