import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {preseasonReady,preseasonSeeds,preseasonBracket,preseasonHasLeagueOpener} from '../src/preseason.js';
import {powerRankings,POWER_WEIGHTS,TRAJECTORY_OFFENSE_WEIGHT,TRAJECTORY_SCORES,offenseRating,rosterPowerComponents,rankingParticipants,PITCHER_PRIORITY_ORDER,POWER_PITCHER_COUNT} from '../src/power-rankings.js';
import {pitcherPriorityFor} from '../src/player-roles.js';
import {earnedAchievements,GM_ACHIEVEMENTS} from '../src/gm-achievements.js';

// Explicit scoring contract: defense outranks pitching, and otherwise-identical
// batters rank High > Medium > Low for hit trajectory.
assert.deepEqual(POWER_WEIGHTS,{offense:.40,pitching:.20,defense:.25,running:.10,chemistry:.05});
assert.equal(Object.values(POWER_WEIGHTS).reduce((sum,n)=>sum+n,0),1);
assert.equal(TRAJECTORY_OFFENSE_WEIGHT,.20);
assert.deepEqual(TRAJECTORY_SCORES,{High:100,Medium:60,Low:20});
const hitter={ 'slap hit power':50,'charge hit power':50,
  'slap contact size':50,'charge contact size':50,
  'displayed batting':1, 'displayed pitching':1 };
assert.equal(offenseRating({...hitter,'hit trajectory':'High'}),60);
assert.equal(offenseRating({...hitter,'hit trajectory':'Medium'}),52);
assert.equal(offenseRating({...hitter,'hit trajectory':'Low'}),44);
assert.equal(offenseRating({...hitter,'hit trajectory':'High',
  'displayed batting':10,'displayed pitching':10}),60,
  'hidden attribute calculation must never use the removed displayed ratings');

const t=Array.from({length:12},(_,i)=>({id:'t'+(i+1),name:'Franchise '+(i+1),slot:i+1,logoPath:''}));
const playerIds=JSON.parse(readFileSync(new URL('../src/players.json',import.meta.url),'utf8')).map(p=>p.id);
const season={id:'preseason-season-1',name:'Season 1',number:1,status:'drafting',
 teams:t,order:t.map(x=>x.id),picks:[],games:[],rosters:{},preseasonResults:[]};
for(let i=0;i<12;i++){
 season.rosters[t[i].id]=playerIds.slice(i*11,i*11+11);
 for(let j=0;j<12;j++)
  season.picks.push({number:season.picks.length+1,team:t[i].id,kind:j===11?'stage':'player',
    seconds:(i+1)*10});
}
// Only the three leading pitchers contribute to pitching; priority tier
// wins before raw skill. Every player still contributes to offense / fielding
// / running / team chemistry, with no artificial nine-player filtering.
assert.deepEqual(PITCHER_PRIORITY_ORDER,{P1P:1,P2P:2,other:3});
assert.equal(POWER_PITCHER_COUNT,3);
const gamePlayers=JSON.parse(readFileSync(new URL('../src/players.json',import.meta.url),'utf8'));
const stats=JSON.parse(readFileSync(new URL('../src/player-data.json',import.meta.url),'utf8')).players;
const byName=new Map(gamePlayers.map(p=>[p.name,p]));
const powerNames=['Bowser','Donkey Kong','Funky Kong','Petey Piranha','Wario',
  'Ice Bro','Flower Fields Monty','Boom Boom','Hammer Bro'];
const balancedNames=['Mario','Luigi','Peach','Daisy','Yoshi','Diddy Kong',
  'Birdo','Tropical Wiggler','Orange Pianta'];
const powerIds=powerNames.map(n=>byName.get(n).id);
const balancedIds=balancedNames.map(n=>byName.get(n).id);
const round1=x=>Math.round(x*10)/10;
const pitchRaw=(s)=>{
 const clamp100=x=>Math.max(0,Math.min(100,x));
 return .52*clamp100(Number(s['pitching stamina'])||0)+
   .22*clamp100(((Number(s['charge pitch speed'])||90)-90)/80*100)+
   .16*clamp100(((Number(s['curveball speed'])||90)-90)/65*100)+
   .10*clamp100(Number(s.curve)||0);
};
for(const names of [powerNames,balancedNames]){
 const ids=names.map(n=>byName.get(n).id);
 const ranked=rosterPowerComponents(ids);
 assert.equal(ranked.rosterSize,9);
 const members=ids.map(id=>{
   const s=stats[id].stats,player=gamePlayers.find(p=>p.id===id);
   return {
     id,offense:offenseRating(s),pitch:pitchRaw(s),
     defense:.53*Math.max(0,Math.min(100,Number(s.fielding)||0))+
       .47*Math.max(0,Math.min(100,Number(s['outfield throwing speed'])||0)),
     running:Math.max(0,Math.min(100,Number(s.speed)||0)),
     role:pitcherPriorityFor(player,stats[id])?.code||'other'
   };
 });
 const avg=k=>members.reduce((total,x)=>total+x[k],0)/9;
 const selected=[...members].sort((a,b)=>
   PITCHER_PRIORITY_ORDER[a.role]-PITCHER_PRIORITY_ORDER[b.role]||
   b.pitch-a.pitch||a.id-b.id).slice(0,3);
 assert.equal(ranked.offense,round1(avg('offense')),'every offensive player counts');
 assert.equal(ranked.defense,round1(avg('defense')),'every defender counts');
 assert.equal(ranked.running,round1(avg('running')),'all nine runners count');
 assert.equal(ranked.pitching,round1(selected.reduce((sum,p)=>sum+p.pitch,0)/3),
   'only three tier-priority pitchers determine pitching rating');
 assert.deepEqual(ranked.selectedPitchers.map(p=>p.id),selected.map(p=>p.id),
   'must select designated P1P first, then P2P, then others by ability');
 const withoutNinth=rosterPowerComponents(ids.slice(0,8));
 assert.notEqual(ranked.offense,withoutNinth.offense);
 assert.notEqual(ranked.defense,withoutNinth.defense);
 assert.notEqual(ranked.running,withoutNinth.running);
 console.log('Example nine-player power index',names[0],JSON.stringify({
   overall:round1(ranked.rosterScore),offense:ranked.offense,
   defense:ranked.defense,pitching:ranked.pitching,
   running:ranked.running,chemistry:ranked.chemistry,
   selectedPitchers:ranked.selectedPitchers.map(x=>({
     name:gamePlayers.find(p=>p.id===x.id)?.name,role:x.role,pitching:x.pitching
   }))
 }));
}
// Top-tier captains beat P2P even when a P2P's raw pitching ability is higher,
// and all tagged pitchers beat untagged players when filling the three slots.
const prioritized=rosterPowerComponents([
  byName.get('Wario').id,byName.get('Tropical Wiggler').id,
  byName.get('Petey Piranha').id,byName.get('Funky Kong').id,
  byName.get('Ice Bro').id,byName.get('Flower Fields Monty').id
]);
assert.equal(prioritized.selectedPitchers[0].id,byName.get('Wario').id,
  'P1P must be selected ahead of a higher-ability P2P');
assert.equal(prioritized.selectedPitchers[1].id,byName.get('Tropical Wiggler').id,
  'P2P goes before nonpriority when no other P1P remains');
assert.equal(prioritized.selectedPitchers[2].id,byName.get('Petey Piranha').id,
  'fill the remaining slot from highest-ability untagged pitcher');
assert.equal(rosterPowerComponents([byName.get('Wario').id]).selectedPitchers.length,1,
  'rosters with fewer than three players should not invent pitching stats');

const lineupSeason={rosters:{test:powerIds.concat([balancedIds[0],balancedIds[1]])},
 defaults:{test:{starters:powerIds.map(id=>({player:id,position:'P'}))}}};
assert.deepEqual(rankingParticipants(lineupSeason,'test'),powerIds,
  'use actual lineup starters for a completed eleven-player franchise');
delete lineupSeason.defaults;
assert.deepEqual(rankingParticipants(lineupSeason,'test'),lineupSeason.rosters.test,
  'before the GM sets a nine-player lineup, do not arbitrarily discard bench players');
assert(!preseasonReady(season),'live drafting must not publish ratings or a bracket');
assert.deepEqual(preseasonSeeds(season),[]);
assert.deepEqual(powerRankings(season),[]);
season.status='postdraft';
assert(preseasonReady(season));
const seeds=preseasonSeeds(season);
assert.equal(seeds.length,12);
assert.deepEqual(seeds.map(x=>x.seed),Array.from({length:12},(_,i)=>i+1));
assert.equal(seeds[0].avgSeconds,10);
assert.equal(seeds[11].avgSeconds,120);
assert.equal(powerRankings(season).length,12);
assert.equal(new Set(powerRankings(season).map(x=>x.rank)).size,12);
assert(!preseasonHasLeagueOpener(season));

let bracket=preseasonBracket(season);
assert.deepEqual(bracket.rounds[0].games.map(g=>[g.high.seed,g.low.seed]),
  [[1,12],[2,11],[3,10],[4,9],[5,8],[6,7]],
  'opening bracket must be 1v12 through 6v7 with no byes');
assert.equal(bracket.rounds[1].pending,true);
assert.equal(bracket.champion,null);
function saveRound(round,pickWinner){
  const games=preseasonBracket(season).rounds[round-1].games;
  assert(games.length);
  for(const g of games){
    const high=pickWinner?pickWinner(g):true;
    season.preseasonResults.push({season_id:season.id,match_key:g.key,
      team_a:g.high.id,team_b:g.low.id,
      score_a:high?5:2,score_b:high?2:5,
      recorded_at:'2026-10-30T00:00:00Z'});
  }
}
saveRound(1);
bracket=preseasonBracket(season);
assert.deepEqual(bracket.rounds[1].games.map(g=>[g.high.seed,g.low.seed]),[[1,6],[2,5],[3,4]],
 'six survivors reseed highest vs lowest');
assert.equal(bracket.rounds[1].bye,null);
saveRound(2);
bracket=preseasonBracket(season);
assert.equal(bracket.rounds[2].bye.seed,1,
 'highest of three surviving seeds skips the semifinal match only');
assert.deepEqual(bracket.rounds[2].games.map(g=>[g.high.seed,g.low.seed]),[[2,3]]);
saveRound(3);
bracket=preseasonBracket(season);
assert.deepEqual(bracket.rounds[3].games.map(g=>[g.high.seed,g.low.seed]),[[1,2]]);
saveRound(4);
bracket=preseasonBracket(season);
assert.equal(bracket.completedGames,11);
assert.equal(bracket.totalGames,11);
assert.equal(bracket.champion.id,'t1');
assert.equal(bracket.rounds.every(r=>r.complete),true);

const championBadge='preseason-tournament-champion';
assert.equal(GM_ACHIEVEMENTS.filter(b=>b.id===championBadge).length,1);
assert.equal(earnedAchievements([season],1).find(b=>b.id===championBadge).earned,true);
assert.equal(earnedAchievements([season],2).find(b=>b.id===championBadge).earned,false);
assert.equal(earnedAchievements([{...season,preseasonResults:season.preseasonResults.slice(0,-1)}],1)
 .find(b=>b.id===championBadge).earned,false,'never award until actual championship result');
assert.equal(earnedAchievements([season,{...season,id:'other',preseasonResults:[]}],1)
 .find(b=>b.id===championBadge).count,1,'GM earns the award once per career');

const season2={...season,preseasonResults:[],games:[{id:'opener',phase:'regular',stage:'final',
 home:'t1',away:'t2',result:{scores:{t1:6,t2:4}}}]};
assert(preseasonHasLeagueOpener(season2),'first published regular game moves rankings to Teams tab');
assert.equal(powerRankings(season2).length,12,'live regular-season power rankings remain available');
assert.equal(powerRankings(season2).find(x=>x.id==='t1').games,1);
assert.equal(powerRankings(season2).find(x=>x.id==='t1').formWeight,7.5);
assert.equal(powerRankings(season2).find(x=>x.id==='t3').formWeight,0);
const badgesStill=earnedAchievements([season2],1);
assert(!badgesStill.find(b=>b.id===championBadge).earned,
 'no tournament badge is awarded from a league game instead of preseason bracket');

const powerUi=readFileSync(new URL('../src/SeasonPreseason.jsx',import.meta.url),'utf8');
assert(powerUi.includes('POWER_WEIGHTS.defense')&&powerUi.includes('POWER_WEIGHTS.pitching')&&
  powerUi.includes('TRAJECTORY_OFFENSE_WEIGHT')&&powerUi.includes('TRAJECTORY_SCORES.High'),
  'Home and Teams must explain the exact weights and trajectory ordering');
const scoringUi=readFileSync(new URL('../src/SeasonPreseason.jsx',import.meta.url),'utf8');
assert(scoringUi.includes('top {POWER_PITCHER_COUNT} priority pitchers') &&
 scoringUi.includes('P1P first, P2P next'),
 'Home and Teams scoring text must clearly explain the strict three-player priority');
const s=readFileSync(new URL('../src/SeasonLeague.jsx',import.meta.url),'utf8');
assert(s.includes('ssl_preseason_results')&&s.includes("rpc('ssl_preseason_record'"));
assert(s.includes('preseasonHasLeagueOpener(s)'));
assert(s.includes('<PowerRankings season={s} supabase={l.supabase}/>'));
assert(s.includes('<PreseasonTournament league={l} />'));
assert(s.includes('Power Rankings'));
const schema=readFileSync(new URL('../supabase/migrations/20261028162000_ssl_preseason_tournament.sql',import.meta.url),'utf8');
assert(schema.includes("access->>'role'<>'commissioner'"));
assert(schema.includes("public.ssl_preseason_results"));
assert(schema.includes("league_private.ssl_preseason_pair"));
assert(!schema.includes('update league_private.ssl_season_states'),
  'preseason must NEVER mutate the live official draft');
console.log('PASS: 12 seeds, 11 knockouts, re-seeding, 3-team bye, 93rd badge, power rankings and protected separate result storage');
