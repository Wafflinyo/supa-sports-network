import gameData from './player-data.json' with { type: 'json' };
import players from './players.json' with { type: 'json' };
import {pitcherPriorityFor} from './player-roles.js';
import {validLineup} from './season-data.js';

// Transparent roster-only preseason projection. No in-game menu/display bars.
// 60% offense, 15% pitching, 20% defense, 2% running, 3% chemistry.
// Offense: charge power 40%, trajectory 25%, slap power 20%, slap contact 7%, charge contact 8%.
// High trajectory > Medium > Low. The display-stat rating bars are not used.
// Evaluate all nine starters for offense, defense, running and chemistry.
// Pitching uses the default lineup's designated P first, plus the best
// three other eligible starters: P1P first, P2P second, then untagged.
// Strongest pitching ability breaks ties within a tier. Each of the
// four distinct players contributes equally; never count the starter twice.
// Publish a franchise ONLY after its GM submits a valid nine-starter
// default lineup; never rank bench players or invent unsubmitted starters.
// During the regular season, published game form gradually earns up to 60%
// influence after eight games. Preseason matches NEVER count.
const clamp=(x,min=0,max=100)=>Math.max(min,Math.min(max,x));
const average=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
const numeric=(stats,key)=>clamp(Number(stats?.[key])||0);
const pitchVelocity=(value,min,max)=>clamp((Number(value||min)-min)/(max-min)*100);
const round=x=>Math.round(x*10)/10;
const playerById=new Map(players.map(p=>[Number(p.id),p]));
export const PITCHER_PRIORITY_ORDER=Object.freeze({P1P:1,P2P:2,other:3});
export const POWER_PITCHER_COUNT=4;
export const POWER_SUPPORT_PITCHER_COUNT=3;
export const POWER_WEIGHTS=Object.freeze({
  offense:.60,pitching:.15,defense:.20,running:.02,chemistry:.03
});
export const TRAJECTORY_OFFENSE_WEIGHT=.25;
export const TRAJECTORY_SCORES=Object.freeze({High:100,Medium:60,Low:20});
export function offenseRating(stats){
  const trajectory=String(stats?.['hit trajectory']??'Medium').trim();
  const trajectoryPoints=TRAJECTORY_SCORES[trajectory]??TRAJECTORY_SCORES.Medium;
  return .40*numeric(stats,'charge hit power')+
    TRAJECTORY_OFFENSE_WEIGHT*trajectoryPoints+
    .20*numeric(stats,'slap hit power')+
    .07*numeric(stats,'slap contact size')+
    .08*numeric(stats,'charge contact size');
}
function scouting(id){
  const record=gameData.players[id];
  if(!record)return null;
  const s=record.stats;
  return {
    id:Number(id),
    pitcherPriority:pitcherPriorityFor(playerById.get(Number(id)),record)?.code||null,
    offense:offenseRating(s),
    pitching:.60*numeric(s,'pitching stamina')+
      .18*pitchVelocity(s['charge pitch speed'],90,170)+
      .14*pitchVelocity(s['curveball speed'],90,155)+.08*numeric(s,'curve'),
    defense:.60*numeric(s,'fielding')+.40*numeric(s,'outfield throwing speed'),
    running:numeric(s,'speed'),
    good:new Set(record.goodChemistryIds||[]),
    bad:new Set(record.badChemistryIds||[]),
    conditional:new Set(record.conditionalGoodChemistryIds||[]),
  };
}
function topPriorityPitchers(people,startingPitcherId=null){
  // A designated P is always first, even if the GM chose an untagged pitcher.
  const starter=startingPitcherId==null?null:
    people.find(p=>p.id===Number(startingPitcherId))||null;
  const available=people.filter(p=>p.id!==starter?.id);
  const backups=available.sort((a,b)=>
    (PITCHER_PRIORITY_ORDER[a.pitcherPriority||'other']-
      PITCHER_PRIORITY_ORDER[b.pitcherPriority||'other']) ||
    b.pitching-a.pitching || a.id-b.id
  ).slice(0,starter?POWER_SUPPORT_PITCHER_COUNT:POWER_PITCHER_COUNT);
  return starter?[starter,...backups]:backups;
}
export function rosterPowerComponents(roster,startingPitcherId=null){
  const people=[...new Set((roster||[]).map(Number))].map(scouting).filter(Boolean);
  const pitchers=topPriorityPitchers(people,startingPitcherId);
  const scoreChemistry=()=>{
    const pairs=people.reduce((sum,p,i)=>sum+people.slice(i+1).reduce((sub,q)=>{
      const bonus=p.good.has(q.id)||q.good.has(p.id)||
        p.conditional.has(q.id)||q.conditional.has(p.id);
      const penalty=p.bad.has(q.id)||q.bad.has(p.id);
      return sub+(bonus?1:0)-(penalty?1:0);
    },0),0);
    return clamp(50+12*pairs/Math.max(1,people.length),15,85);
  };
  const offense=average(people.map(p=>p.offense));
  const pitching=average(pitchers.map(p=>p.pitching));
  const defense=average(people.map(p=>p.defense));
  const running=average(people.map(p=>p.running));
  const chemistry=scoreChemistry();
  const rosterScore=POWER_WEIGHTS.offense*offense+POWER_WEIGHTS.pitching*pitching+
    POWER_WEIGHTS.defense*defense+POWER_WEIGHTS.running*running+
    POWER_WEIGHTS.chemistry*chemistry;
  return {offense:round(offense),pitching:round(pitching),defense:round(defense),
    running:round(running),chemistry:round(chemistry),rosterScore,
    rosterSize:people.length,selectedPitchers:pitchers
      .map(p=>({id:p.id,role:p.pitcherPriority||'other',pitching:round(p.pitching)}))};
}
export function rankingParticipants(season,teamId){
  const roster=season.rosters?.[teamId]||[];
  const submitted=season.defaults?.[teamId];
  if(!validLineup(season,teamId,submitted))return [];
  return submitted.starters.map(p=>Number(p.player));
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
  return season.teams.filter(team=>
    rankingParticipants(season,team.id).length===9).map(team=>{
    const participants=rankingParticipants(season,team.id);
    const starter=season.defaults?.[team.id]?.starters.find(p=>p.position==='P');
    const c=rosterPowerComponents(participants,starter?.player);
    const record=playedRecord(season,team.id);
    const formWeight=record.games?Math.min(.60,record.games*.075):0;
    const score=(1-formWeight)*c.rosterScore+formWeight*(record.form??c.rosterScore);
    return {...team,...c,...record,score:round(score),formWeight:round(formWeight*100)};
  }).sort((a,b)=>b.score-a.score||b.rosterScore-a.rosterScore||
    String(a.name).localeCompare(String(b.name))).map((t,i)=>({...t,rank:i+1}));
}
