-- An editor approves the trade terms they just submitted. All OTHER
-- participating teams must reaccept after every revision.
-- Undo the stricter no-auto-accept change without processing a trade.
drop trigger if exists ssl_trade_revision_resets_approvals on league_private.ssl_offers;
drop function if exists league_private.ssl_trade_revision_resets_approvals();

do $patch$
declare
 src text;
 old_guard text;
begin
 select pg_get_functiondef(p.oid) into src
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='league_private' and p.proname='ssl_trade_manage';
 if src is null or strpos(src, 'accepted=''[]''::jsonb')=0 then
  raise exception 'Unexpected live trade manager; review before rollback';
 end if;
 src := replace(src, 'accepted=''[]''::jsonb',
    'accepted=case when actor_team is null then ''[]''::jsonb' ||
    chr(10) || '                else jsonb_build_array(actor_team::text) end');
 if strpos(src,'accepted=case when actor_team is null then')=0 then
  raise exception 'Could not restore reviser acceptance';
 end if;
 execute src;

 -- Revert the temporary revision-token requirement in the Accept RPC:
 -- existing site clients do not send expectedRevision for accept_trade.
 -- Edit continues to validate expectedRevision under ssl_trade_manage.
 select pg_get_functiondef(p.oid) into src
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='league_private' and p.proname='ssl_manage_core';
 old_guard := ' if coalesce((payload->>''expectedRevision'')::integer,-1) <> ' ||
   'coalesce((offer.body->>''revision'')::integer,0) then ' ||
   'raise exception ''This trade was revised. Refresh and accept the current version'';end if;' || chr(10);
 if src is null or strpos(src,old_guard)=0 then
  raise exception 'Unexpected version guard; review before rollback';
 end if;
 src := replace(src,old_guard,'');
 execute src;
end $patch$;

-- The Knights submitted revision 1 (automatic acceptance under the intended
-- policy), and the Ruffians explicitly accepted that revision afterward.
-- Restore exactly that previously valid ready state, but never execute it.
update league_private.ssl_offers o
set accepted=o.accepted || jsonb_build_array('91a52ee6-e6c7-4e88-8290-9bc2d7ecd14c'),
    status='ready'
where o.id='d51b89f8-090b-4b94-a0ca-8ea91db40e58'::uuid
  and o.status='pending'
  and (o.body->>'revision')::integer=1
  and o.accepted=jsonb_build_array('49e90e2b-202d-4a80-9e20-41bc74b89fca')
  and exists (
    select 1 from league_private.ssl_actions e
    where e.operation='edit_trade'
      and e.details->>'offer'=o.id::text
      and e.details->>'revision'='1'
      and exists (
        select 1 from league_private.ssl_trade_messages m
        where m.offer_id=o.id and m.kind='revision'
          and m.sender_team::text='91a52ee6-e6c7-4e88-8290-9bc2d7ecd14c'
          and m.created_at=e.created_at
      )
      and exists (
        select 1 from league_private.ssl_actions a
        where a.operation='accept_trade'
          and a.details->>'offer'=o.id::text
          and a.details->>'team'='49e90e2b-202d-4a80-9e20-41bc74b89fca'
          and a.created_at>e.created_at
      )
  );
