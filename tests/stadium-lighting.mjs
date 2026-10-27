import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DRAFT_STAGES} from '../src/draft-stages.js';
import {DAY_NIGHT_STADIUMS,STADIUM_VARIANTS,supportsStadiumVariant,
  matchupStadiumVariant,canEditStadiumVariant,homeGames,homeOpponent}
  from '../src/stadium-lighting.js';

assert.equal(DAY_NIGHT_STADIUMS.length,6);
assert.deepEqual(STADIUM_VARIANTS,['Day','Night']);
assert(DAY_NIGHT_STADIUMS.every(x=>DRAFT_STAGES.includes(x)),
  'all six must use the exact existing Stadium draft names');
assert.equal(new Set(DAY_NIGHT_STADIUMS).size,6);
assert.equal(DRAFT_STAGES.filter(s=>!supportsStadiumVariant(s)).length,7,
  'remaining seven Stadiums must not show Day/Night controls');
for(const name of ['Mario Stadium','Peach Ice Garden','DK Jungle',
 'Wario City','Daisy Cruiser','Yoshi Park'])
 assert(supportsStadiumVariant(name),name);

const season={status:'regular',teams:[
  {id:'home',name:'New Donk City Knights'},
  {id:'away',name:'Decalburg Dedennes'}],
 picks:[{team:'home',kind:'stage',stage:'Mario Stadium'}],
 games:[
  {id:'future',phase:'regular',home:'home',away:'away',week:17,startsAt:null,stage:'scheduled',lineups:{}},
  {id:'away-game',phase:'regular',home:'away',away:'home',week:1,startsAt:null,stage:'scheduled'},
  {id:'past',phase:'regular',home:'home',away:'away',week:2,stage:'final',stadiumVariant:'Day'},
  {id:'night',phase:'regular',home:'home',away:'away',week:4,stage:'scheduled',stadiumVariant:'Night'},
  {id:'locked',phase:'regular',home:'home',away:'away',week:5,stage:'scheduled',lockedAt:'2026-12-01T10:00:00Z'},
  {id:'playoff',phase:'playoffs',home:'home',away:'away',week:23,startsAt:null,stage:'scheduled'},
 ]};
const future=season.games[0];
assert(canEditStadiumVariant(season,future,'home'),
  'home GM can choose Day/Night for any future week even before dates are entered');
assert(!canEditStadiumVariant(season,future,'away'),'visiting GM cannot change Stadium version');
assert(!canEditStadiumVariant(season,season.games[2],'home'),'played game is locked');
assert(!canEditStadiumVariant(season,season.games[4],'home'),'locked result prevents edits');
assert(canEditStadiumVariant(season,season.games[5],'home'),'future home playoff games supported');
assert.equal(matchupStadiumVariant(season,future),null,'never assume Day or Night');
assert.equal(matchupStadiumVariant(season,season.games[3]),'Night');
assert.equal(homeGames(season,'home').length,5,'only home games appear in GM Tools');
assert.equal(homeGames(season,'away').length,1);
assert.equal(homeOpponent(season,future),'Decalburg Dedennes');
season.status='postdraft';
assert(canEditStadiumVariant(season,future,'home'),
  'future weeks can be set immediately after scheduling games following draft');
season.status='archived';
assert(!canEditStadiumVariant(season,future,'home'));
season.status='regular';
season.picks[0].stage='Luigi’s Mansion';
assert(!canEditStadiumVariant(season,future,'home'));
assert.equal(matchupStadiumVariant(season,season.games[3]),null,
  'single-version Stadiums cannot show historical Day/Night labels');

const main=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
const schedule=readFileSync(new URL('../src/SeasonLeague.jsx',import.meta.url),'utf8');
const tools=readFileSync(new URL('../src/GmStadiumMatchups.jsx',import.meta.url),'utf8');
const sql=readFileSync(new URL('../supabase/migrations/20261027090500_ssl_home_stadium_day_night.sql',import.meta.url),'utf8');
assert(main.includes("'Home Games'")&&main.includes("'My Team'"),
  'Day/Night must be inside GM Tools as its own section');
assert(main.includes("gmToolsTab==='Home Games'?<GmStadiumMatchups"));
assert(schedule.includes('matchupStadiumVariant(season,game)'), 'schedule read-only variant display');
assert(!schedule.includes('ssl_set_stadium_variant'),
  'public site Schedule tab must never expose edit operation');
assert(tools.includes("p_game:String(game.id),p_variant:choice"));
assert(tools.includes('SAVE DAY / NIGHT'),'GM must save, not auto-select on tap');
assert(tools.includes('homeGames(s,team.id)'),'GM can only see their home matchups');
assert(tools.includes("dateLabel(game.startsAt)"),'future undated matchups must render');
assert(sql.includes("access_record->>'role','') <> 'gm'"),
  'server must limit selection to GMs');
assert(sql.includes("game_record->>'home'<>franchise::text"),
  'server must enforce home franchise ownership');
assert(sql.includes("game_record->>'stage'<>'scheduled'"),
  'server must forbid changing locked/played games');
assert(sql.includes("pg_catalog.pg_advisory_xact_lock(736114221)"),
  'server must serialize updates with the official result uploader');
assert(sql.includes('revoke all on function')&&sql.includes('to authenticated'),
  'RPC must not be executable anonymously');
console.log('PASS: six Stadium variants, any future home game, home-GM-only, game locks, GM Tools editor, public read-only labels');
