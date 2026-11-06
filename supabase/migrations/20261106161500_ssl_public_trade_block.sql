-- Publicly visible Trade Block; only the verified GM for a franchise (or commissioner)
-- can change its listings. Offers/negotiations continue through existing trade RPCs.
-- No existing rosters, picks, trades, or season records are changed.
create table if not exists league_private.ssl_trade_block_listings(
  season uuid not null references league_private.ssl_season_states(id) on delete cascade,
  team uuid not null references league_private.ssl_franchises(id),
  player integer not null check(player > 0),
  note text not null default '' check(char_length(note) <= 240),
  updated_at timestamptz not null default now(),
  primary key(season,player)
);
create index if not exists ssl_trade_block_by_team
 on league_private.ssl_trade_block_listings(season,team);
alter table league_private.ssl_trade_block_listings enable row level security;
revoke all on league_private.ssl_trade_block_listings from public,anon,authenticated;

-- Public response includes only listed players, the current owning franchise,
-- the GM's public block note and date (no account identities or private trades).
create or replace function league_private.ssl_trade_block_read(target_season uuid)
returns jsonb language sql stable security definer set search_path='' as $read$
  select coalesce(jsonb_agg(jsonb_build_object(
    'team',b.team,'player',b.player,'note',b.note,'updatedAt',b.updated_at
  ) order by b.updated_at desc,b.player),'[]'::jsonb)
  from league_private.ssl_trade_block_listings b
  join league_private.ssl_season_states s on s.id=b.season
  where b.season=target_season
   and coalesce((s.state->'rosters'->(b.team::text)) @> jsonb_build_array(b.player),false);
$read$;
create or replace function public.ssl_trade_block(target_season uuid)
returns jsonb language sql stable security invoker set search_path='' as $rpc$
  select league_private.ssl_trade_block_read(target_season);
$rpc$;
revoke all on function league_private.ssl_trade_block_read(uuid),
 public.ssl_trade_block(uuid) from public,anon,authenticated;
grant execute on function league_private.ssl_trade_block_read(uuid),
 public.ssl_trade_block(uuid) to anon,authenticated;

-- Replacing a team's whole block is atomic, allowing additions, removals, and note edits.
-- Validation always uses current server state, never client-provided ownership.
create or replace function league_private.ssl_trade_block_write(
  target_season uuid,acting_team uuid,roster_players jsonb,team_note text
) returns jsonb language plpgsql security definer set search_path='' as $write$
declare
  a jsonb:=league_private.current_access();
  s league_private.ssl_season_states;
  actor_team uuid;
  raw_id text;
  player_id integer;
  seen integer[]:=array[]::integer[];
  clean_note text:=btrim(coalesce(team_note,''));
begin
  if auth.uid() is null or coalesce(a->>'role','') not in ('gm','commissioner') then
    raise exception 'A signed-in GM or commissioner is required';
  end if;
  if acting_team is null then raise exception 'Choose the franchise managing this block';end if;
  if char_length(clean_note)>240 then raise exception 'Trade Block message must be at most 240 characters';end if;
  if jsonb_typeof(roster_players) is distinct from 'array' then
    raise exception 'Trade Block players must be an array';
  end if;
  if jsonb_array_length(roster_players)>14 then
    raise exception 'Choose up to fourteen rostered players';
  end if;
  perform pg_advisory_xact_lock(736114221);
  select * into s from league_private.ssl_season_states
   where id=target_season for update;
  if not found then raise exception 'Season not found';end if;
  if s.state->>'status' not in ('postdraft','preseason','regular','postseason','retention','offseason') then
    raise exception 'The Trade Block is not editable during this season phase';
  end if;
  if not exists(select 1 from jsonb_array_elements(coalesce(s.state->'teams','[]'::jsonb)) t
    where t->>'id'=acting_team::text) then
    raise exception 'Franchise does not participate in this season';
  end if;
  if a->>'role'='gm' then
    select id into actor_team from league_private.ssl_franchises
     where slot=(a->>'slot')::integer;
    if actor_team is distinct from acting_team then
      raise exception 'You can only manage your own franchise Trade Block';
    end if;
  end if;
  for raw_id in select value from jsonb_array_elements_text(roster_players) loop
    if raw_id !~ '^[0-9]{1,5}$' then raise exception 'Invalid player ID';end if;
    player_id:=raw_id::integer;
    if player_id=any(seen) then raise exception 'A player cannot appear twice';end if;
    if not coalesce((s.state->'rosters'->(acting_team::text)) @> jsonb_build_array(player_id),false) then
      raise exception 'Only current roster players can be listed';
    end if;
    seen:=array_append(seen,player_id);
  end loop;
  -- Remove old, no-longer-owned listings before a newly traded player can be relisted.
  delete from league_private.ssl_trade_block_listings b
  where b.season=target_season
    and not coalesce((s.state->'rosters'->(b.team::text)) @> jsonb_build_array(b.player),false);
  delete from league_private.ssl_trade_block_listings
    where season=target_season and team=acting_team;
  insert into league_private.ssl_trade_block_listings(season,team,player,note)
    select target_season,acting_team,p,clean_note from unnest(seen) p;
  return jsonb_build_object('ok',true,'listed',cardinality(seen),'team',acting_team);
end $write$;
create or replace function public.ssl_trade_block_update(
  target_season uuid,acting_team uuid,roster_players jsonb,team_note text
) returns jsonb language sql security invoker set search_path='' as $rpc$
 select league_private.ssl_trade_block_write(target_season,acting_team,roster_players,team_note);
$rpc$;
revoke all on function league_private.ssl_trade_block_write(uuid,uuid,jsonb,text),
 public.ssl_trade_block_update(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function league_private.ssl_trade_block_write(uuid,uuid,jsonb,text),
 public.ssl_trade_block_update(uuid,uuid,jsonb,text) to authenticated;
