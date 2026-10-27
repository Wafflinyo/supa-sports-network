-- Secure, per-game Day/Night selection. Matchups are displayed publicly
-- through the existing ssl_seasons() projection; only the hosting GM can edit.
-- Picks/retentions are the authority for the home Stadium (not client names).
create or replace function public.ssl_set_stadium_variant(
  p_season uuid,
  p_game text,
  p_variant text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $body$
declare
  access_record jsonb;
  franchise uuid;
  season_record league_private.ssl_season_states%rowtype;
  game_record jsonb;
  game_idx integer;
  stadium_name text;
  retained text[];
begin
  if auth.uid() is null then
    raise exception 'Sign in as the home-team GM';
  end if;
  access_record := league_private.current_access();
  if coalesce(access_record->>'role','') <> 'gm' then
    raise exception 'Only the home-team GM may select Day or Night';
  end if;
  select id into franchise from league_private.ssl_franchises
  where slot=(access_record->>'slot')::integer;
  if franchise is null then
    raise exception 'No GM franchise assigned';
  end if;
  if p_variant is null or p_variant not in ('Day','Night') then
    raise exception 'Select Day or Night';
  end if;
  if p_season is null or p_game is null or length(p_game)>100 then
    raise exception 'Select a valid season matchup';
  end if;

  -- Share the same transaction lock as ssl_manage_core: changes and official
  -- result uploads cannot race each other.
  perform pg_catalog.pg_advisory_xact_lock(736114221);
  select * into season_record from league_private.ssl_season_states
  where id=p_season for update;
  if not found or season_record.state->>'status' not in
     ('postdraft','regular','postseason') then
    raise exception 'Home Stadium choices are available after the draft';
  end if;
  if not exists(
    select 1 from pg_catalog.jsonb_array_elements(
      coalesce(season_record.state->'teams','[]'::jsonb)
    ) as team(value) where team.value->>'id'=franchise::text
  ) then
    raise exception 'This franchise does not participate in the season';
  end if;

  select value,ordinality::integer-1 into game_record,game_idx
  from pg_catalog.jsonb_array_elements(
    coalesce(season_record.state->'games','[]'::jsonb)
  ) with ordinality
  where value->>'id'=p_game;

  if game_record is null or game_record->>'home'<>franchise::text then
    raise exception 'You may select the Stadium version for your home games only';
  end if;
  if game_record->>'stage'<>'scheduled'
    or game_record->>'phase' not in ('regular','playoffs')
    or game_record->>'lockedAt' is not null then
    raise exception 'The game is already locked or cannot be edited';
  end if;

  select p.value->>'stage' into stadium_name
  from pg_catalog.jsonb_array_elements(
    coalesce(season_record.state->'picks','[]'::jsonb)
  ) as p(value)
  where p.value->>'team'=franchise::text and p.value->>'kind'='stage'
  limit 1;
  if stadium_name is null then
    select pg_catalog.array_agg(distinct value) into retained
    from pg_catalog.jsonb_array_elements_text(coalesce(
      season_record.state->'retainedStadiums'->(franchise::text),'[]'::jsonb
    )) as r(value);
    if pg_catalog.cardinality(retained)=1 then stadium_name:=retained[1];end if;
  end if;
  if stadium_name is null or stadium_name not in (
    'Mario Stadium','Peach Ice Garden','DK Jungle','Wario City',
    'Daisy Cruiser','Yoshi Park'
  ) then
    raise exception 'This home Stadium does not offer Day/Night versions';
  end if;

  update league_private.ssl_season_states
  set state=pg_catalog.jsonb_set(
    state,array['games',game_idx::text,'stadiumVariant'],
    pg_catalog.to_jsonb(p_variant),true
  ) where id=p_season;

  insert into league_private.ssl_actions(season,actor,operation,details)
  values(p_season,auth.uid(),'set_stadium_variant',
    pg_catalog.jsonb_build_object('game',p_game,'variant',p_variant,
      'team',franchise::text,'stadium',stadium_name));
  return pg_catalog.jsonb_build_object('ok',true,'game',p_game,
    'stadium',stadium_name,'variant',p_variant);
end
$body$;

revoke all on function public.ssl_set_stadium_variant(uuid,text,text) from public,anon;
grant execute on function public.ssl_set_stadium_variant(uuid,text,text) to authenticated;
