import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=read('src/SeasonLeague.jsx');
const block=read('src/TradeBlockListings.jsx');
const nav=read('src/navigation.js');
const sql=read('supabase/migrations/20261106161500_ssl_public_trade_block.sql');
const cleanup=read('supabase/migrations/20261106220500_ssl_trade_block_roster_change_cleanup.sql');
const styles=read('src/season.css');

assert(nav.includes("'Trade Block'")&&!nav.includes("'Transactions'"),
  'Navigation must have the Trade Block main page');
assert(app.includes('"Trade Block",')&&app.includes('<TradeBlockHub league={l} />'));
for(const label of ["'Trade Proposal'","'Trade Block'","'Transactions'"])
  assert(app.includes(label),'Trade Block must retain subtab '+label);
assert(app.includes("setTab('Trade Proposal')")&&
  app.includes('rows.map(row=>({kind:')&&
  app.includes('teams:[actingTeam,...otherTeams]'),
  'Selecting players from one or multiple franchises seeds the trade proposal');
assert(app.includes('initialOffer.teams')&&app.includes('initialOffer.moves'),
  'Proposal composer must receive the chosen teams and all assets');
assert(app.includes('Message to all participating teams (optional)')&&
  app.includes('l.act(counter ? "edit_trade" : "submit_trade"'),
  'Team-visible messages and secure approval workflow are preserved');
assert(app.includes("view!=='proposals'")&&app.includes("view!=='transactions'"),
  'Completed transaction history is separate from trade proposals');

assert(block.includes("rpc('ssl_trade_block'")&&
  block.includes("rpc('ssl_trade_block_update'"),
  'Market and management must use secure RPCs');
assert(block.includes('listings.map(row=>')&&
  block.includes('TEAM: {teamName(row.team)}')&&
  block.includes('{row.note&&')&&
  block.includes('All listed players from every franchise appear together'),
  'Market immediately shows every franchise and labels each player with their current team');
assert(!block.includes('grouped.map(')&&!block.includes('Proposing / managing franchise'),
  'Market must not require a team filter for browsing');
assert(block.includes('OPEN MY ROSTER · MANAGE TRADE BLOCK')&&
  block.includes('setManageOpen(true)')&&
  block.includes('ownRoster(season,managementTeam)'),
  'GMs can open and manage their roster within the same Trade Block tab');
assert(block.includes('MANAGE A TEAM’S TRADE BLOCK')&&
  block.includes('Choose team to manage trade listings')&&
  block.indexOf('Choose team to manage trade listings')>block.indexOf('id="manage-trade-block"'),
  'Only the commissioner chooses a franchise, and only inside management');
assert(block.includes('REMOVE FROM TRADE BLOCK')&&
  block.includes('async function removeListing(row)')&&
  block.includes('async function saveBlock()')&&
  block.includes('filter(item=>Number(item.player)!==Number(row.player))'),
  'GMs can remove individual listings immediately or uncheck and save their roster');
assert(block.includes('roster_players:players,team_note:note.trim()'),
  'Trade Block edits save selected roster players and optional public note');
assert(block.includes('SELECT MULTIPLE')&&
  block.includes('chosenRows')&&
  block.includes('onPropose(candidates,myTeam)')&&
  block.includes('onPropose(pendingOffer,proposingTeam)'),
  'Multi-select works across teams, and commissioner acting-team choice occurs only when proposing');
assert(block.includes('setPendingOffer(candidates)')&&
  block.includes('continueCommissionerOffer')&&
  block.includes("pendingOffer.some(row=>sameTeam(row.team,proposingTeam))"),
  'Commissioner can browse without choosing a team and cannot acquire their own listed asset');
assert(block.includes('disabled={!allowed}')&&
  block.includes("l.access.role==='gm'"),
  'Guests cannot propose trades or manage rosters');
assert(styles.includes('.trade-block-market-team')&&
  styles.includes('.trade-block-management-selector'),
  'Market player team labels and isolated management chooser are styled');

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
  /delete from league_private\.ssl_trade_block_listings b/,
  /insert into league_private\.ssl_trade_block_listings/
])assert(match.test(sql),'Missing safe ownership and validation rule: '+match);
for(const match of [
  /function league_private\.ssl_trade_block_prune_roster_changes\(\)/,
  /after update of state on league_private\.ssl_season_states/,
  /old\.state->'rosters' is distinct from new\.state->'rosters'/,
  /b\.season=new\.id/,
  /new\.state->'rosters'->\(b\.team::text\)/,
  /delete from league_private\.ssl_trade_block_listings b/,
  /revoke all on function league_private\.ssl_trade_block_prune_roster_changes\(\)/
])assert(match.test(cleanup),'Automatic Trade Block cleanup missing: '+match);
assert(!/update league_private\.ssl_season_states/.test(cleanup),
  'Cleanup must not modify league rosters, trade approvals or draft assets');

console.log('PASS: global Trade Block, current team labels, own-roster management, GM removal, commissioner controls, multi-team offers and automatic traded-player cleanup');
