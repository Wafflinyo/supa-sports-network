import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=read('src/SeasonLeague.jsx');
const block=read('src/TradeBlockListings.jsx');
const nav=read('src/navigation.js');
const sql=read('supabase/migrations/20261106161500_ssl_public_trade_block.sql');

assert(nav.includes("'Trade Block'")&&!nav.includes("'Transactions'"),
  'Top-level Transactions navigation must be renamed Trade Block');
assert(app.includes('"Trade Block",')&&app.includes('<TradeBlockHub league={l} />'),
  'Trade Block must be a public season page');
for(const label of ["'Trade Proposal'","'Trade Block'","'Transactions'"])
  assert(app.includes(label),'Missing Trade Block subtab '+label);
assert(app.includes("setTab('Trade Proposal')")&&
  app.includes('rows.map(row=>({kind:')&&
  app.includes('teams:[actingTeam,...otherTeams]'),
  'Selecting one or many offered players must seed the existing multi-team proposal composer');
assert(app.includes('initialOffer.teams')&&app.includes('initialOffer.moves'),
  'Trade proposal composer must receive prefilled teams and all selected assets');
assert(app.includes('Message to all participating teams (optional)')&&
  app.includes("l.act(counter ? \"edit_trade\" : \"submit_trade\""),
  'Prefilled trade proposals still use participant-visible notes and official secure trading RPC');
assert(app.includes("view!=='proposals'")&&app.includes("view!=='transactions'"),
  'Submitted proposals and the public completed transaction feed should occupy separate tabs');
assert(block.includes("rpc('ssl_trade_block'")&&
  block.includes("rpc('ssl_trade_block_update'"),
  'Public trade block and GM save actions must use the secure Supabase RPCs');
assert(block.includes("roster_players:editingPlayers")&&block.includes("team_note:teamNote.trim()"),
  'GMs must save selected roster players and an optional league-facing message');
assert(block.includes('SELECT MULTIPLE')&&block.includes('selectedRows')&&
  block.includes("onPropose(eligibleRows,actingTeam)"),
  'Trade Block supports selecting multiple players from any number of different franchises');
assert(block.includes('row.team!==actingTeam')&&block.includes('if(own)return;'),
  'A franchise cannot offer to acquire its own player');
assert(block.includes('disabled={!canManage')&&block.includes("l.access.role==='gm'"),
  'Guest viewers cannot perform GM-only actions');

for(const match of [
  /create table if not exists league_private\.ssl_trade_block_listings/,
  /alter table league_private\.ssl_trade_block_listings enable row level security/,
  /revoke all on league_private\.ssl_trade_block_listings from public,anon,authenticated/,
  /create or replace function public\.ssl_trade_block\(target_season uuid\)/,
  /public\.ssl_trade_block\(uuid\) to anon,authenticated/,
  /create or replace function public\.ssl_trade_block_update\(/,
  /public\.ssl_trade_block_update\(uuid,uuid,jsonb,text\) to authenticated/,
  /league_private\.current_access\(\)/,
  /auth\.uid\(\) is null/,
  /actor_team is distinct from acting_team/,
  /s\.state->'rosters'->\(acting_team::text\)/,
  /player_id=any\(seen\)/,
  /jsonb_array_length\(roster_players\)>14/,
  /delete from league_private\.ssl_trade_block_listings b/,
  /insert into league_private\.ssl_trade_block_listings/
])assert(match.test(sql),'Missing database Trade Block authorization / integrity rule: '+match);

assert(!/update league_private\.ssl_season_states/.test(sql),
  'Listing migration must never modify live rosters, trades, draft picks or schedule');
console.log('PASS: public Trade Block, signed-in GM ownership, multi-team offer seeding and completed transaction tabs');
