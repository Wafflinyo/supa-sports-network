-- A Stadium is an exclusive franchise asset in each season.
-- A selected OR successfully retained stadium cannot be drafted by any
-- other GM. Uses the already-serialized ssl_manage_core transaction.
create or replace function league_private.ssl_stadium_claimed(st jsonb, chosen text)
returns boolean
language sql immutable
set search_path to ''
as $body$
  select exists(
    select 1
    from pg_catalog.jsonb_array_elements(
      coalesce(st->'picks','[]'::jsonb)
    ) as p(value)
    where p.value->>'kind'='stage' and p.value->>'stage'=chosen
  ) or exists(
    select 1
    from pg_catalog.jsonb_each(
      coalesce(st->'retainedStadiums','{}'::jsonb)
    ) as r(owner,stadiums)
    where r.stadiums @> pg_catalog.jsonb_build_array(chosen)
  );
$body$;

do $patch$
declare
  definition text;
  needle text := $anchor$  ]::text[]) then raise exception 'Choose a Stadium from the official Stadium list';end if;$anchor$;
  guard text := $guard$
  if league_private.ssl_stadium_claimed(st, payload->>'stage') then
    raise exception 'This Stadium has already been drafted or retained by another team';
  end if;
$guard$;
begin
  definition:=pg_catalog.pg_get_functiondef('league_private.ssl_manage_core(text,uuid,jsonb)'::regprocedure);
  if position('This Stadium has already been drafted or retained by another team' in definition)>0 then
    return;
  end if;
  if position(needle in definition)=0 then
    raise exception 'Unexpected Stadium-selection validator: review before modifying live draft';
  end if;
  definition:=pg_catalog.replace(definition,needle,needle||guard);
  execute definition;
end;
$patch$;
