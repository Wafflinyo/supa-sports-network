-- Remove tier/cost Star Coin mechanics; support automatic Heating Up from Rio Game Score.
-- The Game Score lives on each official result.players[] record and is never
-- confused with the league's separately calculated fantasyPoints.
CREATE OR REPLACE FUNCTION league_private.ssl_manage(op text, target uuid, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a jsonb:=league_private.current_access();st jsonb;team uuid;answer jsonb;n integer;g jsonb;idx integer;score_row jsonb;begin
 if op='extension_stadium' then
    return league_private.ssl_stadium_extension_apply(target,payload);
  end if;
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
 -- Retire coin transfers and tiered/manual star selection.
 if op='submit_trade' and exists (
   select 1 from jsonb_array_elements(coalesce(payload->'moves','[]'::jsonb)) m
   where m->>'kind'='coin'
 ) then raise exception 'Star Coins are retired. Only players and draft picks can be traded.';end if;
 if op='approve_trade' and exists (
   select 1 from league_private.ssl_offers o
   cross join lateral jsonb_array_elements(coalesce(o.body->'moves','[]'::jsonb)) m
   where o.id=(payload->>'offer')::uuid and m->>'kind'='coin'
 ) then raise exception 'Legacy Star Coin offers cannot be approved. Create a new player/pick offer.';end if;
 if op='result' then
   -- Enforce the new in-game Game Score independent of client-side validation.
   if jsonb_typeof(payload->'report'->'players') is distinct from 'array'
     then raise exception 'A Project Rio report with player Game Scores is required';end if;
   for score_row in select value from jsonb_array_elements(payload->'report'->'players') loop
     if jsonb_typeof(score_row->'gameScore') is distinct from 'number' or
       (score_row->>'gameScore')::numeric not between 0 and 999.99
       then raise exception 'Every report player needs a numeric Game Score from 0 to 999.99';end if;
   end loop;
 end if;
 if op='cancel_game' then
   if auth.uid() is null or a->>'role'<>'commissioner' then raise exception 'Commissioner access required';end if;
   perform pg_advisory_xact_lock(736114221);
   select state into st from league_private.ssl_season_states where id=target for update;
   select value,ordinality::int-1 into g,idx from jsonb_array_elements(coalesce(st->'games','[]'::jsonb)) with ordinality where value->>'id'=payload->>'game';
   if g is null or g->>'stage' not in ('scheduled','live','recorded') then raise exception 'Choose an unreleased game to cancel';end if;
   g:=(g-'result'-'releaseAt'-'starRequests'-'starRecord')||jsonb_build_object('stage','cancelled','cancelledAt',now(),'cancellationReason',left(coalesce(payload->>'reason','Cancelled by commissioner'),500));
   st:=jsonb_set(st,array['games',idx::text],g);
   update league_private.ssl_season_states set state=st where id=target;
   delete from public.fantasy_player_schedule where game_key='ssl:'||(g->>'id');
   insert into league_private.ssl_actions(season,actor,operation,details) values(target,auth.uid(),op,jsonb_build_object('game',g->>'id'));
   return jsonb_build_object('ok',true);
 end if;
 if op='reschedule' then
   -- A cancelled game can be rescheduled without legacy Star Coin reset logic.
   perform pg_advisory_xact_lock(736114221);
   select state into st from league_private.ssl_season_states where id=target for update;
   select value,ordinality::int-1 into g,idx from jsonb_array_elements(coalesce(st->'games','[]'::jsonb)) with ordinality where value->>'id'=payload->>'game';
   if g is not null and g->>'stage'='cancelled' then
     if auth.uid() is null or a->>'role'<>'commissioner' then raise exception 'Commissioner access required';end if;
     g:=(g-'starRecord'-'starRequests'-'lockedAt'-'frozenRosters'-'releaseAt'-'releasedAt'-'cancelledAt')||jsonb_build_object('stage','scheduled','lineups','{}'::jsonb);
     st:=jsonb_set(st,array['games',idx::text],g);
     update league_private.ssl_season_states set state=st where id=target;
   end if;
 end if;
 answer:=league_private.ssl_manage_before_stars(op,target,payload);
 if op='create' and answer ? 'id' then
    update league_private.ssl_season_states s set state=s.state ||
    jsonb_build_object('retainedStadiums',(
      select coalesce(jsonb_object_agg(franchise::text,stadiums),'{}'::jsonb)
      from (select e.franchise,jsonb_agg(e.stadium ORDER BY e.stadium) as stadiums
       from league_private.ssl_stadium_extensions e
       WHERE e.season_number=s.number GROUP BY e.franchise) q))
    where s.id=(answer->>'id')::uuid;
  end if;
  if op='extension' then perform league_private.ssl_tick(target);end if;
 return answer;
end$function$;


create or replace function league_private.ssl_read()
returns jsonb language sql security definer set search_path='' as $$
  select league_private.ssl_read_before_stars()
$$;


-- Remove stored legacy coin fields and star selections. The action audit ledger
-- remains untouched; official baseball results are preserved.
update league_private.ssl_season_states s
set state=(s.state-'starTransfers'-'starCoins') || jsonb_build_object(
  'games',coalesce((
    select jsonb_agg(g.value-'starRequests'-'starRecord' order by g.ordinality)
    from jsonb_array_elements(coalesce(s.state->'games','[]'::jsonb)) with ordinality g
  ),'[]'::jsonb))
where s.state ? 'starTransfers' or s.state ? 'starCoins' or exists(
  select 1 from jsonb_array_elements(coalesce(s.state->'games','[]'::jsonb)) g
  where g ? 'starRequests' or g ? 'starRecord'
);
