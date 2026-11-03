import assert from 'node:assert/strict';
import fs from 'node:fs';
import {preseasonBracket} from '../src/preseason.js';
import {allPreseasonGames,preseasonPlayerStats} from '../src/preseason-game-data.js';
import {preseasonChampionshipFeature,latestPreseasonChampionship} from '../src/preseason-champion-feature.js';
import {leagueNews} from '../src/league-news.js';
import {homeRecentResults} from '../src/home-dashboard-data.js';

const teams=Array.from({length:12},(_,i)=>({
  id:'t'+(i+1),slot:i+1,
  name:i===0?'Petalburg Petilils':'SSL Test Team '+(i+1),
  logoPath:i===0?'1/petilils-original-logo.png':undefined,
}));
const season={id:'season-1',name:'Season 1',number:1,status:'postdraft',teams,
  picks:teams.map((team,i)=>({team:team.id,seconds:i+1,kind:'player',player:i+101})),
  order:teams.map(t=>t.id),
  preseasonResults:[],preseasonReports:[],games:[],transactions:[],
};
const players=[
  {id:901,name:'Champion A'},
  {id:902,name:'Champion B'},
  {id:903,name:'Champion C'},
  {id:904,name:'Runner-up Player'},
];
const stamp='2026-11-03T21:00:00.000Z';
function releaseRoundInBracket(roundNumber){
  const round=preseasonBracket(season).rounds[roundNumber-1];
  assert(!round.pending);
  for(const game of round.games)season.preseasonResults.push({
    season_id:season.id,match_key:game.key,
    team_a:game.high.id,team_b:game.low.id,
    score_a:7,score_b:5,recorded_at:stamp,
  });
}
for(let r=1;r<=3;r++)releaseRoundInBracket(r);
const final=preseasonBracket(season).rounds[3].games[0];
assert.equal(final.high.name,'Petalburg Petilils');
assert.equal(preseasonChampionshipFeature(season,players),null,
  'Semifinals alone may never show the champion feature');

const score={season_id:season.id,match_key:final.key,
  team_a:final.high.id,team_b:final.low.id,
  score_a:7,score_b:5,recorded_at:stamp};
season.preseasonResults.push(score);
assert.equal(preseasonBracket(season).champion.name,'Petalburg Petilils');
assert.equal(preseasonChampionshipFeature(season,players),null,
  'A bracket score without the officially released final sheet must not show the feature');
assert(!leagueNews([season],players).some(item=>item.category==='preseason-champion'));

const compact={
  gameId:'rio:season-1:R4-1',round:4,matchKey:final.key,
  away:final.high.name,home:final.low.name,
  awayScore:7,homeScore:5,mvp:901,
  fields:['hits','runs','rbi','itemScore'],
  players:[
    [901,false,'C',{0:9,1:3,2:4,3:12}],
    [902,false,'LF',{0:5,1:2,2:2,3:8}],
    [903,false,'SS',{0:2,1:1,2:1,3:3}],
    [904,true,'P',{0:1,1:1,2:1,3:1}],
  ],
};
season.preseasonReports.push(compact);
const feature=preseasonChampionshipFeature(season,players);
assert(feature,'Releasing the final sheet should unlock championship content');
assert.equal(feature.champion.name,'Petalburg Petilils');
assert.equal(feature.champion.logoPath,'1/petilils-original-logo.png',
  'Feature should use registered SSL team logo, not a generated logo');
assert.equal(feature.at,stamp);
assert(feature.topPlayers.length>0);
assert(feature.topPlayers.every(p=>Number.isFinite(p.agp)&&p.gamesPlayed>0));
const expected=preseasonPlayerStats(allPreseasonGames(season))
  .filter(p=>p.teamName==='Petalburg Petilils')
  .sort((a,b)=>b.stats.agp-a.stats.agp||b.stats.tgp-a.stats.tgp||
    b.stats.gamesPlayed-a.stats.gamesPlayed||
    (players.find(x=>String(x.id)===String(a.playerId))?.name||a.playerName||'')
      .localeCompare(players.find(x=>String(x.id)===String(b.playerId))?.name||b.playerName||''))
  .slice(0,3);
assert.deepEqual(feature.topPlayers.map(p=>p.playerId),expected.map(p=>Number(p.playerId)),
  'Top 3 must be derived from all released preseason sheets, not sample values');
assert.deepEqual(feature.topPlayers.map(p=>p.agp),expected.map(p=>p.stats.agp));

const news=leagueNews([season],players);
const headline=news.find(n=>n.category==='preseason-champion');
assert(headline,'Champion headline must automatically appear once final sheet is released');
assert.match(headline.title,/Petalburg Petilils.*Season 1/i);
assert.match(headline.summary,/average Game Points/i);
assert.equal(headline.at,stamp);
assert.equal(latestPreseasonChampionship([season],players)?.champion.name,'Petalburg Petilils');

const future={...season,id:'season-2',name:'Season 2',number:2,
  preseasonResults:[],preseasonReports:[],games:[]};
assert.equal(latestPreseasonChampionship([future,season],players)?.seasonName,'Season 1',
  'Previous season champion must stay featured until the NEXT final has been publicly released');
assert.equal(latestPreseasonChampionship([future],players),null,
  'A fresh season without released finals should not have a champion hero');
assert.equal(allPreseasonGames(future).length,0,
  'Season 1 legacy preseason player reports may not contaminate a future season');
assert.equal(preseasonBracket(future).completedGames,0,
  'A new preseason bracket must not inherit Season 1 Round 1 final scores');

// Season 2: automatic seeding, commissioner releases rounds, and only the
// published championship finals sheet switches the public homepage feature.
for(let r=1;r<=3;r++){
  const round=preseasonBracket(future).rounds[r-1];
  assert(!round.pending,'New season should advance after prior released rounds');
  for(const game of round.games){
    future.preseasonResults.push({season_id:future.id,match_key:game.key,
      team_a:game.high.id,team_b:game.low.id,score_a:7,score_b:5,
      recorded_at:'2027-11-03T21:00:00Z'});
  }
}
const nextFinal=preseasonBracket(future).rounds[3].games[0];
assert(nextFinal.high&&nextFinal.low,'Next season should have a championship final');
future.preseasonResults.push({season_id:future.id,match_key:nextFinal.key,
  team_a:nextFinal.high.id,team_b:nextFinal.low.id,score_a:5,score_b:7,
  recorded_at:'2027-11-03T21:00:00Z'});
assert.equal(latestPreseasonChampionship([future,season],players)?.seasonName,'Season 1',
  'Even with a released bracket final score, do not publish until the final report is released');
future.preseasonReports.push({...compact,gameId:'rio:season-2:R4-1',
  away:nextFinal.high.name,home:nextFinal.low.name,awayScore:5,homeScore:7});
const secondChampion=latestPreseasonChampionship([season,future],players);
assert.equal(secondChampion?.seasonId,future.id,
  'Season 2 published final must replace the Season 1 banner immediately');
assert.equal(secondChampion?.seasonName,'Season 2');
assert.equal(secondChampion?.champion.name,nextFinal.low.name,
  'Never hardcode the Petilils as winners of later tournaments');
assert.equal(latestPreseasonChampionship([future,season],players)?.seasonId,future.id,
  'Hero selection should not depend on raw seasons array order');
assert.equal(leagueNews([season,future],players).filter(n=>
  n.category==='preseason-champion').length,2,
  'Every season must receive its own championship news post');

// No unrelated game stages may contaminate Recent Results.
const fake={result:{scores:{'t1':7,'t2':5}},stage:'final',week:1,away:'t1',home:'t2'};
const normal={...fake,id:'regular',phase:'regular'};
const later={...fake,id:'playoff',phase:'playoffs'};
const pre={...fake,id:'exhibition',phase:'preseason'};
assert.deepEqual(homeRecentResults({games:[pre]}),[]);
assert.deepEqual(homeRecentResults({games:[pre,normal]}).map(g=>g.id),['regular']);
assert.deepEqual(homeRecentResults({games:[pre,normal,later]}).map(g=>g.id),['playoff']);
assert.deepEqual(homeRecentResults({...season,games:[pre]}),[],
  'Preseason finals must not be mixed into regular-season homepage Recent Results');

const home=fs.readFileSync('src/HomeDashboard.jsx','utf8');
assert.match(home,/latestPreseasonChampionship\(/);
assert.match(home,/<ChampionshipHero/);
assert.match(home,/teamLogo\(supabase,champion\.logoPath\)/);
assert.match(home,/VIEW PRESEASON RESULTS/);
assert.match(home,/onResults=\{\(\)=>openPreseason\(championship\.seasonId\)\}/);
assert.match(home,/item\.category==='preseason-champion'/);
console.log('PASS: championship hero locked behind published final, real team logo, dynamic preseason AGP top three, latest champion across all seasons, news release and non-preseason Recent Results');
