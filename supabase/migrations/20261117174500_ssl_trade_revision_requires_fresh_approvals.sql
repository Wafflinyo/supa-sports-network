-- Each revised SSL trade is a new offer version: nobody stays accepted automatically.
-- Preserve the existing conversation and proposal ID; do not process trades.
create or replace function league_private.ssl_trade_revision_resets_approvals()
returns trigger language plpgsql set search_path to '' as $$
begin
  if old.body->'moves' is distinct from new.body->'moves'
     or old.body->'note' is distinct from new.body->'note'
     or old.body->'revision' is distinct from new.body->'revision' then
    new.accepted := '[]'::jsonb;
    new.status := 'pending';
  end if;
  return new;
end $$;
revoke all on function league_private.ssl_trade_revision_resets_approvals()
  from public, anon, authenticated;

drop trigger if exists ssl_trade_revision_resets_approvals on league_private.ssl_offers;
create trigger ssl_trade_revision_resets_approvals
  before update of body on league_private.ssl_offers
  for each row execute function league_private.ssl_trade_revision_resets_approvals();

-- Keep all existing permissions, user access checks, status constraints and
-- non-trade behavior when patching the installed server routines in place.
do $patch$
declare
  src text;
  old_accept text;
  new_accept text;
begin
  select pg_get_functiondef(p.oid) into src
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='league_private' and p.proname='ssl_trade_manage';
  if src is null or strpos(src, 'accepted=case when actor_team is null then')=0 then
    raise exception 'Unexpected ssl_trade_manage revision implementation; abort';
  end if;
  src := regexp_replace(src,
    'accepted=case when actor_team is null then ''\[\]''::jsonb[[:space:]]+else jsonb_build_array\(actor_team::text\) end',
    'accepted=''[]''::jsonb');
  if strpos(src, 'accepted=case when actor_team is null then')>0
     or strpos(src, 'accepted=''[]''::jsonb')=0 then
    raise exception 'Could not safely replace trade revision acceptance logic';
  end if;
  execute src;

  select pg_get_functiondef(p.oid) into src
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='league_private' and p.proname='ssl_manage_core';
  old_accept := 'elsif op=''accept_trade'' then' || chr(10) || ' if team is null';
  new_accept := 'elsif op=''accept_trade'' then' || chr(10) ||
    ' if coalesce((payload->>''expectedRevision'')::integer,-1) <> ' ||
    'coalesce((offer.body->>''revision'')::integer,0) then ' ||
    'raise exception ''This trade was revised. Refresh and accept the current version'';end if;' ||
    chr(10) || ' if team is null';
  if src is null or strpos(src,old_accept)=0
     or strpos(src, 'expectedRevision' || chr(39) || ')::integer,-1) <>')>0 then
    raise exception 'Unexpected ssl_manage_core acceptance implementation; abort';
  end if;
  src := replace(src,old_accept,new_accept);
  execute src;
end $patch$;

-- Ruffians explicitly accepted version 2 after the Knights revised it.
-- Remove ONLY the Knights' inherited, automatic acceptance, not the Ruffians' vote.
-- If the Knights have since explicitly accepted version 2, leave it alone.
update league_private.ssl_offers o
set accepted=(
  select coalesce(jsonb_agg(t.value),'[]'::jsonb)
  from jsonb_array_elements_text(o.accepted) t(value)
  where t.value<>'91a52ee6-e6c7-4e88-8290-9bc2d7ecd14c'
), status='pending'
where o.id='d51b89f8-090b-4b94-a0ca-8ea91db40e58'::uuid
  and o.status in ('pending','ready')
  and (o.body->>'revision')::integer=1
  and o.accepted @> jsonb_build_array('91a52ee6-e6c7-4e88-8290-9bc2d7ecd14c')
  and exists (
    select 1 from league_private.ssl_actions a
    where a.operation='accept_trade'
      and a.details->>'offer'=o.id::text
      and a.details->>'team'='49e90e2b-202d-4a80-9e20-41bc74b89fca'
      and a.created_at>(select max(e.created_at)
        from league_private.ssl_actions e
        where e.operation='edit_trade' and e.details->>'offer'=o.id::text)
  )
  and not exists (
    select 1 from league_private.ssl_actions a
    where a.operation='accept_trade'
      and a.details->>'offer'=o.id::text
      and a.details->>'team'='91a52ee6-e6c7-4e88-8290-9bc2d7ecd14c'
      and a.created_at>(select max(e.created_at)
        from league_private.ssl_actions e
        where e.operation='edit_trade' and e.details->>'offer'=o.id::text)
  );
