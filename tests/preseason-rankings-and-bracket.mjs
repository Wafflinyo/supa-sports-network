import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {preseasonReady,preseasonSeeds,preseasonBracket,preseasonHasLeagueOpener} from '../src/preseason.js';
import {powerRankings,POWER_WEIGHTS,TRAJECTORY_OFFENSE_WEIGHT,TRAJECTORY_SCORES,offenseRating,rosterPowerComponents,rankingParticipants,PITCHING_ROLE_WEIGHTS} from '../src/power-rankings.js';
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
// Rank all nine players equally for offense, defense and running. Pitching
// includes all nine too, with preference for the documented P1P/P2P roles.
assert.deepEqual(PITCHING_ROLE_WEIGHTS,{P1P:3,P2P:2,other:1});
const gamePlayers=JSON.parse(readFileSync(new URL('../src/players.json',import.meta.url),'utf8'));
const stats=JSON.parse(readFileSync(new URL('../src/player-data.json',import.meta.url),'utf8')).players;
const byName=new Map(gamePlayers.map(p=>[p.name,p]));
const powerNames=['Bowser','Donkey Kong','Funky Kong','Petey Piranha','Wario',
  'Ice Bro','Flower Fields Monty','Boom Boom','Hammer Bro'];
const balancedNames=['Mario','Luigi','Peach','Daisy','Yoshi','Diddy Kong',
  'Birdo','Tropical Wiggler','Orange Pianta'];
const powerIds=powerNames.map(n=>byName.get(n).id);
const balancedIds=balancedNames.map(n=>byName.get(n).id);
for(const names of [powerNames,balancedNames]){
 const ids=names.map(n=>byName.get(n).id);
 const ranked=rosterPowerComponents(ids);
 assert.equal(ranked.rosterSize,9);
 const members=ids.map(id=>{
   const s=stats[id].stats;
   const player=gamePlayers.find(p=>p.id===id);
   const role=pitcherPriorityFor(player,stats[id])?.code||'other';
   return {
     offense:offenseRating(s),
     pitch:.52*Math.max(0,Math.min(100,Number(s['pitching stamina'])||0))+
       .22*Math.max(0,Math.min(100,((Number(s['charge pitch speed'])||90)-90)/80*100))+
       .16*Math.max(0,Math.min(100,((Number(s['curveball speed'])||90)-90)/65*100))+
       .10*Math.max(0,Math.min(100,Number(s.curve)||0)),
     defense:.53*Math.max(0,Math.min(100,Number(s.fielding)||0))+
       .47*Math.max(0,Math.min(100,Number(s['outfield throwing speed'])||0)),
     running:Math.max(0,Math.min(100,Number(s.speed)||0)),
     weight:PITCHING_ROLE_WEIGHTS[role]
   };
 });
 const avg=k=>members.reduce((total,x)=>total+x[k],0)/9;
 const round1=x=>Math.round(x*10)/10;
 assert.equal(ranked.offense,round1(avg('offense')),'every offensive player counts');
 assert.equal(ranked.defense,round1(avg('defense')),'every defender counts');
 assert.equal(ranked.running,round1(avg('running')),'all nine runners count');
 assert.equal(ranked.pitching,round1(members.reduce((sum,p)=>sum+p.pitch*p.weight,0)/
   members.reduce((sum,p)=>sum+p.weight,0)),'every pitcher counts and P1P/P2P have priority');
 assert.equal(ranked.eligiblePitchers.length,names.filter(n=>{
   const p=byName.get(n);return pitcherPriorityFor(p,stats[p.id]);
 }).length,'pitching priorities use actual SSL role labels');
 const withoutNinth=rosterPowerComponents(ids.slice(0,8));
 assert.notEqual(ranked.offense,withoutNinth.offense);
 assert.notEqual(ranked.defense,withoutNinth.defense);
 assert.notEqual(ranked.pitching,withoutNinth.pitching);
 assert.notEqual(ranked.running,withoutNinth.running);
 console.log('Example nine-player power index',names[0],JSON.stringify({
   overall:Math.round(ranked.rosterScore*10)/10,offense:ranked.offense,
   defense:ranked.defense,pitching:ranked.pitching,
   running:ranked.running,chemistry:ranked.chemistry,
   eligiblePitchers:ranked.eligiblePitchers.map(x=>({name:gamePlayers.find(p=>p.id===x.id)?.name,role:x.role}))
 }));
}
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
