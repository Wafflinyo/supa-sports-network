-- Automatically retire Trade Block listings as soon as a player leaves the
-- franchise that listed them. This includes approved trades, free-agent moves,
-- commissioner roster changes, and any other official season roster update.
-- A new team must explicitly relist the player before they reappear.
-- The public read RPC already guards against stale ownership; this trigger
-- also deletes obsolete stored listings in the same transaction as the move.
create or replace function league_private.ssl_trade_block_prune_roster_changes()
returns trigger
language plpgsql security definer set search_path=''
as $block_cleanup$
begin
  delete from league_private.ssl_trade_block_listings b
  where b.season=new.id
    and not coalesce(
      (new.state->'rosters'->(b.team::text)) @> pg_catalog.jsonb_build_array(b.player),
      false
    );
  return new;
end;
$block_cleanup$;

revoke all on function league_private.ssl_trade_block_prune_roster_changes()
  from public,anon,authenticated;

drop trigger if exists ssl_trade_block_prune_on_roster_change
  on league_private.ssl_season_states;
create trigger ssl_trade_block_prune_on_roster_change
after update of state on league_private.ssl_season_states
for each row
when (old.state->'rosters' is distinct from new.state->'rosters')
execute function league_private.ssl_trade_block_prune_roster_changes();

-- The same check cleans up any stale entries that predate installation.
delete from league_private.ssl_trade_block_listings b
using league_private.ssl_season_states s
where s.id=b.season
  and not coalesce(
    (s.state->'rosters'->(b.team::text)) @> pg_catalog.jsonb_build_array(b.player),
    false
  );
