-- Post-draft trade access and private participant-only negotiations.
-- The 22-week Season 1 schedule, draft picks and all saved rosters remain untouched.
create table if not exists league_private.ssl_trade_messages (
  id uuid primary key default gen_random_uuid(),
  season uuid not null references league_private.ssl_season_states(id) on delete cascade,
  offer_id uuid not null references league_private.ssl_offers(id) on delete cascade,
  sender_team uuid references league_private.ssl_franchises(id),
  sender_user uuid not null,
  kind text not null default 'message' check (kind in ('message','revision')),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists ssl_trade_messages_offer_time
  on league_private.ssl_trade_messages(offer_id,created_at,id);
alter table league_private.ssl_trade_messages enable row level security;
revoke all on league_private.ssl_trade_messages from public,anon,authenticated;

-- Private schema only; authenticated users see a thread through the checked RPC.
create or replace function league_private.ssl_trade_thread(target_season uuid,target_offer uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $thread$
declare
 a jsonb:=league_private.current_access();
 f uuid;
 o league_private.ssl_offers;
begin
 if auth.uid() is null or coalesce(a->>'role','') not in ('gm','commissioner') then
  raise exception 'GM or commissioner access required';
 end if;
 if a->>'role'='gm' then
  select id into f from league_private.ssl_franchises where slot=(a->>'slot')::int;
 end if;
 select * into o from league_private.ssl_offers
  where id=target_offer and season=target_season;
 if not found or (a->>'role'<>'commissioner'
    and (f is null or not o.body->'teams' @> jsonb_build_array(f::text))) then
  raise exception 'This trade conversation is not available to your team';
 end if;
 return (select coalesce(jsonb_agg(jsonb_build_object(
  'id',m.id,'senderTeam',m.sender_team,'commissioner',m.sender_team is null,
  'text',m.body,'kind',m.kind,'sentAt',m.created_at
 ) order by m.created_at,m.id),'[]'::jsonb)
 from (select * from league_private.ssl_trade_messages
   where offer_id=target_offer and season=target_season
   order by created_at desc,id desc limit 250) m);
end $thread$;

create or replace function public.ssl_trade_thread(target_season uuid,target_offer uuid)
returns jsonb language sql security invoker set search_path='' as $rpc$
 select league_private.ssl_trade_thread(target_season,target_offer)
$rpc$;
revoke all on function league_private.ssl_trade_thread(uuid,uuid),
 public.ssl_trade_thread(uuid,uuid) from public,anon,authenticated;
grant execute on function league_private.ssl_trade_thread(uuid,uuid),
 public.ssl_trade_thread(uuid,uuid) to authenticated;

-- Route trade messages/revisions/cancellations through an isolated manager,
-- preserving the existing commissioner approval and roster/pick validators.
create or replace function league_private.ssl_trade_manage(op text,target uuid,payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $manager$
declare
 a jsonb:=league_private.current_access();
 actor_team uuid;
 s league_private.ssl_season_states;
 o league_private.ssl_offers;
 x jsonb;
 teams jsonb;
 changed_team text;
 rev integer;
 note text;
 txt text;
 move_key text;
 seen_keys text[]:='{}';
begin
 if auth.uid() is null or coalesce(a->>'role','') not in ('gm','commissioner') then
  raise exception 'GM or commissioner access required';
 end if;
 if op not in ('trade_message','edit_trade','cancel_trade') then
  raise exception 'Unsupported trade action';
 end if;
 if op='edit_trade' then perform league_private.ssl_tick(target);end if;
 perform pg_advisory_xact_lock(736114221);
 select * into s from league_private.ssl_season_states where id=target for update;
 if not found then raise exception 'Season not found';end if;
 if a->>'role'='gm' then
  select id into actor_team from league_private.ssl_franchises where slot=(a->>'slot')::int;
  if actor_team is null or not exists (
    select 1 from jsonb_array_elements(s.state->'teams') t where t->>'id'=actor_team::text
  ) then raise exception 'Your franchise is not in this season';end if;
 end if;
 if nullif(payload->>'offer','') is null then raise exception 'Select a trade offer';end if;
 select * into o from league_private.ssl_offers
  where id=(payload->>'offer')::uuid and season=target for update;
 if not found or (a->>'role'<>'commissioner'
    and not o.body->'teams' @> jsonb_build_array(actor_team::text)) then
  raise exception 'This trade is not available to your team';
 end if;
 if o.status not in ('pending','ready') then
  raise exception 'This trade is no longer open for negotiation';
 end if;
 if op='trade_message' then
  txt:=btrim(coalesce(payload->>'message',''));
  if char_length(txt) not between 1 and 1000 then
   raise exception 'Messages must be between 1 and 1000 characters';
  end if;
  if (select count(*) from league_private.ssl_trade_messages where offer_id=o.id)>=500 then
   raise exception 'This conversation has reached its message limit';
  end if;
  if (select count(*) from league_private.ssl_trade_messages
       where offer_id=o.id and sender_user=auth.uid()
       and kind='message' and created_at>now()-interval '5 seconds')>=4 then
   raise exception 'Please avoid sending messages too quickly';
  end if;
  insert into league_private.ssl_trade_messages(season,offer_id,sender_team,sender_user,body)
   values(target,o.id,actor_team,auth.uid(),txt);
  return jsonb_build_object('ok',true,'offer',o.id);
 end if;
 if op='cancel_trade' then
  update league_private.ssl_offers set status='cancelled' where id=o.id;
  insert into league_private.ssl_actions(season,actor,operation,details)
   values(target,auth.uid(),op,jsonb_build_object('offer',o.id));
  return jsonb_build_object('ok',true,'status','cancelled');
 end if;
 -- Editing a pending proposal is allowed only while trading itself is open.
 if not coalesce((s.state->>'tradingOpen')::boolean,false) or
   (s.state->>'status' not in ('postdraft','regular','offseason')
    and not (coalesce((s.state->>'offseasonTrading')::boolean,false)
      and s.state->>'status' in ('setup','poll','scheduled'))) then
  raise exception 'Trading is currently closed';
 end if;
 rev:=coalesce((o.body->>'revision')::int,0);
 if coalesce((payload->>'expectedRevision')::int,-1)<>rev then
  raise exception 'This proposal changed. Refresh the inbox before editing again';
 end if;
 if jsonb_typeof(payload->'moves') is distinct from 'array'
    or jsonb_array_length(payload->'moves') not between 1 and 50 then
  raise exception 'Choose between 1 and 50 trade assets';
 end if;
 teams:=o.body->'teams';
 for x in select value from jsonb_array_elements(payload->'moves') loop
  if x->>'kind' not in ('player','pick') or
     nullif(x->>'id','') is null or x->>'from'=x->>'to'
     or not teams @> jsonb_build_array(x->>'from')
     or not teams @> jsonb_build_array(x->>'to') then
   raise exception 'Invalid trade asset or participating team';
  end if;
  move_key:=(x->>'kind')||':'||(x->>'id');
  if move_key=any(seen_keys) then raise exception 'An asset cannot appear twice';end if;
  seen_keys:=array_append(seen_keys,move_key);
 end loop;
 note:=left(coalesce(payload->>'note',''),1000);
 update league_private.ssl_offers set
  body=body||jsonb_build_object('moves',payload->'moves','note',note,'revision',rev+1),
  accepted=case when actor_team is null then '[]'::jsonb
                else jsonb_build_array(actor_team::text) end,
  status='pending'
 where id=o.id;
 insert into league_private.ssl_trade_messages(season,offer_id,sender_team,sender_user,kind,body)
  values(target,o.id,actor_team,auth.uid(),'revision',
    'The proposal was revised. Every team must review and accept the updated terms.');
 insert into league_private.ssl_actions(season,actor,operation,details)
  values(target,auth.uid(),op,jsonb_build_object('offer',o.id,'revision',rev+1));
 return jsonb_build_object('ok',true,'offer',o.id,'revision',rev+1);
end $manager$;
revoke all on function league_private.ssl_trade_manage(text,uuid,jsonb)
 from public,anon,authenticated;
grant execute on function league_private.ssl_trade_manage(text,uuid,jsonb) to authenticated;

-- Keep original server-side trade execution, results, draft, and calendar intact.
do $patch$
declare src text; begin
 select pg_get_functiondef('league_private.ssl_manage(text,uuid,jsonb)'::regprocedure) into src;
 if strpos(src,'if op in (''trade_message'',''edit_trade'',''cancel_trade'')')=0 then
  if strpos(src,' answer:=league_private.ssl_manage_before_stars(op,target,payload);')=0 then
   raise exception 'Unknown SSL manager version; no patch applied';
  end if;
  src:=replace(src,
   ' answer:=league_private.ssl_manage_before_stars(op,target,payload);',
   ' if op in (''trade_message'',''edit_trade'',''cancel_trade'') then return league_private.ssl_trade_manage(op,target,payload);end if;
 answer:=league_private.ssl_manage_before_stars(op,target,payload);');
  execute src;
 end if;
 select pg_get_functiondef('league_private.ssl_manage_core(text,uuid,jsonb)'::regprocedure) into src;
 if strpos(src,'''status'',''postdraft'',''needsDefault'',st->''order'',''tradingOpen'',true')=0 then
  if strpos(src,'''status'',''postdraft'',''needsDefault'',st->''order''')=0 then
   raise exception 'Unknown SSL draft completion flow; no patch applied';
  end if;
  src:=replace(src,
   '''status'',''postdraft'',''needsDefault'',st->''order''',
   '''status'',''postdraft'',''needsDefault'',st->''order'',''tradingOpen'',true');
  execute src;
 end if;
end $patch$;

-- Activate trading on the already-completed live Season 1 draft.
-- Never regenerate the draft or modify lineups, picks, rosters, or schedule.
update league_private.ssl_season_states
 set state=jsonb_set(state,'{tradingOpen}','true'::jsonb)
 where number=1
  and state->>'status'='postdraft'
  and jsonb_array_length(coalesce(state->'teams','[]'::jsonb))=12
  and jsonb_array_length(coalesce(state->'picks','[]'::jsonb))=144
  and not coalesce((state->>'tradingOpen')::boolean,false);
