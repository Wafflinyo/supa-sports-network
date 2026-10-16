-- Complete the previously approved post-championship extension workflow.
alter table league_private.ssl_extension_offers add column attempt bigint generated always as identity;
alter table league_private.ssl_extension_offers drop constraint ssl_extension_offers_pkey;
alter table league_private.ssl_extension_offers add primary key(attempt);
create index ssl_extension_attempts_player on league_private.ssl_extension_offers(season,franchise,player);

do $$declare def text;old_guard text:='exists(select 1 from league_private.ssl_extension_offers o where o.season=target and o.franchise=team and o.player=contract_manager.player) or ';begin
 def:=pg_get_functiondef('league_private.ssl_manage_contracts(text,uuid,jsonb)'::regprocedure);
 if position(old_guard in def)=0 then raise exception 'Unexpected extension validator';end if;
 def:=replace(def,old_guard,'');def:=replace(def,'This player already received an offer or signed an extension','This player already signed an extension');execute def;
 def:=pg_get_functiondef('league_private.ssl_manage_calendar(text,uuid,jsonb)'::regprocedure);
 if position('interval ''14 days''' in def)=0 then raise exception 'Unexpected extension calendar';end if;
 def:=replace(def,'interval ''14 days''','interval ''1 month''');def:=replace(def,'Next season opens after the two-week extension period ends','Next season opens after the extension period ends');
 def:=replace(def,'max((value->''result''->>''postedAt'')::timestamptz)','max(coalesce((value->>''releasedAt'')::timestamptz,(value->>''releaseAt'')::timestamptz,(value->''result''->>''postedAt'')::timestamptz))');execute def;
end$$;

create or replace function league_private.ssl_tick_contracts(target uuid) returns void language plpgsql security definer set search_path='' as $$
declare s league_private.ssl_season_states;st jsonb;t jsonb;r jsonb:='{}';begin
 perform pg_advisory_xact_lock(736114221);perform league_private.ssl_tick_draft(target);
 select * into s from league_private.ssl_season_states where id=target for update;if not found then return;end if;st:=s.state;
 if st->>'status' in ('regular','postseason') and st->>'tradeDeadlineAt' is not null and now()>=(st->>'tradeDeadlineAt')::timestamptz then
  st:=st||jsonb_build_object('tradingOpen',false,'extensionsOpen',false);
  update league_private.ssl_offers set status='expired' where season=target and status in('pending','ready');
 end if;
 if st->>'status'='retention' and st->>'championshipEndedAt' is not null then
  st:=st||jsonb_build_object('extensionsOpen',true);
  if now()>=(st->>'extensionClosesAt')::timestamptz or not exists(select 1 from league_private.ssl_franchises f join jsonb_array_elements(st->'teams') tm on tm->>'id'=f.id::text where f.tokens>0) then
   for t in select value from jsonb_array_elements(st->'teams') loop
    r:=jsonb_set(r,array[t->>'id'],(select coalesce(jsonb_agg(e.player),'[]') from league_private.ssl_extensions e where e.season_number=s.number+1 and e.franchise=(t->>'id')::uuid));
   end loop;
   update league_private.ssl_franchises set tokens=0 where id in(select (value->>'id')::uuid from jsonb_array_elements(st->'teams'));
   st:=st||jsonb_build_object('status','offseason','extensionsOpen',false,'tradingOpen',true,'offseasonAt',least(now(),(st->>'extensionClosesAt')::timestamptz),'completedRosters',st->'rosters','completedDefaults',st->'defaults','rosters',r,'defaults','{}'::jsonb,'needsDefault','[]'::jsonb);
   insert into league_private.ssl_actions(season,operation) values(target,'extension_period_closed');
  end if;
 end if;
 if coalesce((st->>'offseasonTrading')::boolean,false) and st->>'status'='drafting' then st:=st||jsonb_build_object('offseasonTrading',false,'tradingOpen',false);update league_private.ssl_offers set status='expired' where season=target and status in('pending','ready');end if;
 if st<>s.state then update league_private.ssl_season_states set state=st where id=target;end if;
end$$;

alter function league_private.ssl_manage(text,uuid,jsonb) rename to ssl_manage_with_stars;
revoke all on function league_private.ssl_manage_with_stars(text,uuid,jsonb) from public,anon,authenticated;
create function league_private.ssl_manage(op text,target uuid,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare a jsonb:=league_private.current_access();st jsonb;team uuid;answer jsonb;n integer;begin
 if op in('extension','void_extensions') then
  if auth.uid() is null or coalesce(a->>'role','') not in('commissioner','gm') then raise exception 'GM or commissioner access required';end if;
  perform pg_advisory_xact_lock(736114221);perform league_private.ssl_tick(target);
  select state into st from league_private.ssl_season_states where id=target for update;
  if st->>'status' is distinct from 'retention' or not coalesce((st->>'extensionsOpen')::boolean,false) then raise exception 'Extensions open after the championship series and close after one calendar month or all decisions';end if;
  if op='void_extensions' then
   if a->>'role'='commissioner' then team:=(payload->>'team')::uuid;else select id into team from league_private.ssl_franchises where slot=(a->>'slot')::int;end if;
   if team is null or not exists(select 1 from jsonb_array_elements(st->'teams') t where t->>'id'=team::text) then raise exception 'Select a season franchise';end if;
   select tokens into n from league_private.ssl_franchises where id=team for update;
   update league_private.ssl_franchises set tokens=0 where id=team;
   insert into league_private.ssl_actions(season,actor,operation,details) values(target,auth.uid(),op,jsonb_build_object('team',team,'voided',n));
   perform league_private.ssl_tick(target);return jsonb_build_object('ok',true,'voided',n);
  end if;
 end if;
 answer:=league_private.ssl_manage_with_stars(op,target,payload);
 if op='extension' then perform league_private.ssl_tick(target);end if;
 return answer;
end$$;
revoke all on function league_private.ssl_manage(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function league_private.ssl_manage(text,uuid,jsonb) to authenticated;
create or replace function public.ssl_manage(operation text,season uuid default null,payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select league_private.ssl_manage(operation,season,payload)$$;
