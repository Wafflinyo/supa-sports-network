import gameData from './player-data.json' with { type: 'json' };

// Transparent roster-only preseason projection. No in-game menu/display bars.
// 40% hitting, 20% pitching, 25% defense, 10% running, 5% chemistry.
// Offense is 80% original hit-power/contact calculation, 20% trajectory.
// High trajectory > Medium > Low. The display-stat rating bars are not used.
// During the regular season, published game form gradually earns up to 60%
// influence after eight games. Preseason matches NEVER count.
const clamp=(x,min=0,max=100)=>Math.max(min,Math.min(max,x));
const average=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
const numeric=(stats,key)=>clamp(Number(stats?.[key])||0);
const pitchVelocity=(value,min,max)=>clamp((Number(value||min)-min)/(max-min)*100);
const round=x=>Math.round(x*10)/10;
export const POWER_WEIGHTS=Object.freeze({
  offense:.40,pitching:.20,defense:.25,running:.10,chemistry:.05
});
export const TRAJECTORY_OFFENSE_WEIGHT=.20;
export const TRAJECTORY_SCORES=Object.freeze({High:100,Medium:60,Low:20});
export function offenseRating(stats){
  const trajectory=String(stats?.['hit trajectory']??'Medium').trim();
  const trajectoryPoints=TRAJECTORY_SCORES[trajectory]??TRAJECTORY_SCORES.Medium;
  const original=.32*numeric(stats,'slap hit power')+.43*numeric(stats,'charge hit power')+
    .15*numeric(stats,'slap contact size')+.10*numeric(stats,'charge contact size');
  return (1-TRAJECTORY_OFFENSE_WEIGHT)*original+
    TRAJECTORY_OFFENSE_WEIGHT*trajectoryPoints;
}
function scouting(id){
  const record=gameData.players[id];
  if(!record)return null;
  const s=record.stats;
  return {
    id:Number(id),
    offense:offenseRating(s),
    pitching:.52*numeric(s,'pitching stamina')+
      .22*pitchVelocity(s['charge pitch speed'],90,170)+
      .16*pitchVelocity(s['curveball speed'],90,155)+.10*numeric(s,'curve'),
    defense:.53*numeric(s,'fielding')+.47*numeric(s,'outfield throwing speed'),
    running:numeric(s,'speed'),
    good:new Set(record.goodChemistryIds||[]),
    bad:new Set(record.badChemistryIds||[]),
    conditional:new Set(record.conditionalGoodChemistryIds||[]),
  };
}
function components(roster){
  const people=(roster||[]).map(scouting).filter(Boolean);
  const overall=person=>POWER_WEIGHTS.offense*person.offense+
    POWER_WEIGHTS.pitching*person.pitching+POWER_WEIGHTS.defense*person.defense+
    POWER_WEIGHTS.running*person.running;
  const starters=[...people].sort((a,b)=>overall(b)-overall(a)).slice(0,9);
  const pitchers=[...people].sort((a,b)=>b.pitching-a.pitching).slice(0,3);
  const scoreChemistry=()=>{
    const pairs=people.reduce((sum,p,i)=>sum+people.slice(i+1).reduce((sub,q)=>{
      const bonus=p.good.has(q.id)||q.good.has(p.id)||
        p.conditional.has(q.id)||q.conditional.has(p.id);
      const penalty=p.bad.has(q.id)||q.bad.has(p.id);
      return sub+(bonus?1:0)-(penalty?1:0);
    },0),0);
    return clamp(50+12*pairs/Math.max(1,people.length),15,85);
  };
  const offense=average(starters.map(p=>p.offense));
  const pitching=pitchers.length?(pitchers[0].pitching*.6+average(pitchers)*.4):0;
  const defense=average(starters.map(p=>p.defense));
  const running=average(starters.map(p=>p.running));
  const chemistry=scoreChemistry();
  const rosterScore=POWER_WEIGHTS.offense*offense+POWER_WEIGHTS.pitching*pitching+
    POWER_WEIGHTS.defense*defense+POWER_WEIGHTS.running*running+
    POWER_WEIGHTS.chemistry*chemistry;
  return {offense:round(offense),pitching:round(pitching),defense:round(defense),
    running:round(running),chemistry:round(chemistry),rosterScore,rosterSize:people.length};
}
function playedRecord(season,teamId){
  const played=(season?.games||[]).filter(g=>g.phase==='regular'&&g.stage==='final'&&
    [g.home,g.away].map(String).includes(String(teamId))&&g.result?.scores);
  let wins=0,losses=0,runsFor=0,runsAgainst=0;
  for(const g of played){
    const our=Number(g.result.scores[teamId]);
    const other=Number(g.result.scores[String(g.home)===String(teamId)?g.away:g.home]);
    if(!Number.isFinite(our)||!Number.isFinite(other))continue;
    runsFor+=our;runsAgainst+=other;
    if(our>other)wins++;else if(other>our)losses++;
  }
  const games=wins+losses;
  const runDifferential=games?(runsFor-runsAgainst)/games:0;
  const form=games?clamp(50+45*(wins-losses)/games+runDifferential*2.5):null;
  return {wins,losses,games,form};
}
export function powerRankings(season){
  if(!season || !['postdraft','regular','postseason','retention','offseason','archived'].includes(season.status) ||
    season.teams?.length!==12)return [];
  return season.teams.map(team=>{
    const c=components(season.rosters?.[team.id]||[]);
    const record=playedRecord(season,team.id);
    const formWeight=record.games?Math.min(.60,record.games*.075):0;
    const score=(1-formWeight)*c.rosterScore+formWeight*(record.form??c.rosterScore);
    return {...team,...c,...record,score:round(score),formWeight:round(formWeight*100)};
  }).sort((a,b)=>b.score-a.score||b.rosterScore-a.rosterScore||
    String(a.name).localeCompare(String(b.name))).map((t,i)=>({...t,rank:i+1}));
}
