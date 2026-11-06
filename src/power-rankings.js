import gameData from './player-data.json' with { type: 'json' };
import players from './players.json' with { type: 'json' };
import {pitcherPriorityFor} from './player-roles.js';
import {validLineup} from './season-data.js';
import {gamePointsForReport} from './game-points.js';

// Transparent roster-only preseason projection. No in-game menu/display bars.
// Overall: 60% offense, 20% defense, 20% pitching.
// Offense: 95% of hitter skills (charge power 40%, trajectory 25%, slap power
// 25%, slap contact 5%, charge contact 5%) plus 5% speed.
// Defense: 55% fielding, 30% throwing speed, 15% running speed.
// Pitching: stamina 55%, charge pitch speed 10%, curveball speed 15%, curve 20%.
// High trajectory > Medium > Low. The display-stat rating bars are not used.
// Evaluate all nine starters for offense and defense; speed enters both.
// Chemistry applies through the saved batting order and defensive positions,
// not as a separate overall score.
// Special baserunning abilities enhance offense; fielding abilities use each saved defensive position.
// Active catches earn +12 at either 2B or SS, without a paired-position bonus.
// Saved batting order and defensive positions supply situational chemistry bonuses.
// Neutral LF/RF-to-CF incurs -6 because buddy jump requires a chemistry link.
// Pitching uses the default lineup's designated P first, plus the best
// three other eligible starters: P1P first, P2P second, then untagged.
// Strongest pitching ability breaks ties within a tier. Each of the
// four distinct players contributes equally; never count the starter twice.
// Publish a franchise ONLY after its GM submits a valid nine-starter
// default lineup; never rank bench players or invent unsubmitted starters.
// Each reported regular-season game contributes 5% of the actual league-
// relative OGP/DGP/PGP impact to its respective category, capped at 60%
// after twelve reported games. A team performing at the league's true
// reported per-team-game average retains its original roster category score.
// No arbitrary 50/70 average rating and no extra win/loss modifier.
// Preseason and postseason games NEVER affect live Power Rankings.
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
  offense:.60,pitching:.20,defense:.20
});
// Apply speed within the respective skill ratings, then add situational
// chemistry and special-ability bonuses to each starting player.
export const OFFENSE_SPEED_WEIGHT=.05;
export const DEFENSE_STAT_WEIGHTS=Object.freeze({
  fielding:.55,throwingSpeed:.30,runningSpeed:.15
});
export const DEFENSE_SPEED_WEIGHT=DEFENSE_STAT_WEIGHTS.runningSpeed;
// League-average production is the neutral point for every category.
// The spread controls sensitivity to meaningful over/underperformance,
// not a target or assumed league average. The tanh cap prevents runaway
// ratings while allowing negative and positive Pitching Game Points.
export const GAME_POINT_RELATIVE_CONFIG=Object.freeze({
  maxAdjustment:20,
  scales:Object.freeze({ogp:100,dgp:90,pgp:15})
});
export const GAME_POINT_BLEND_PER_REPORTED_GAME=.05;
export const GAME_POINT_BLEND_MAX=.60;
export function gamePointPerformanceAdjustment(teamAverage,leagueAverage,category){
  const spread=GAME_POINT_RELATIVE_CONFIG.scales[category];
  if(!spread||teamAverage==null||leagueAverage==null||
    !Number.isFinite(Number(teamAverage))||!Number.isFinite(Number(leagueAverage)))return 0;
  return GAME_POINT_RELATIVE_CONFIG.maxAdjustment*
    Math.tanh((Number(teamAverage)-Number(leagueAverage))/spread);
}
export function defenseRating(stats){
  return DEFENSE_STAT_WEIGHTS.fielding*numeric(stats,'fielding')+
    DEFENSE_STAT_WEIGHTS.throwingSpeed*numeric(stats,'outfield throwing speed')+
    DEFENSE_STAT_WEIGHTS.runningSpeed*numeric(stats,'speed');
}
// Each pitcher's skill score uses the raw 0–100 stamina and curve ratings,
// and speed values normalized into 0–100. These weights apply immediately to
// all recalculated Power Rankings, not just rankings for newly drafted teams.
export const PITCHING_STAT_WEIGHTS=Object.freeze({
  stamina:.55,chargePitchSpeed:.10,curveballSpeed:.15,curve:.20
});
export function pitchingRating(stats){
  return PITCHING_STAT_WEIGHTS.stamina*numeric(stats,'pitching stamina')+
    PITCHING_STAT_WEIGHTS.chargePitchSpeed*pitchVelocity(stats?.['charge pitch speed'],90,170)+
    PITCHING_STAT_WEIGHTS.curveballSpeed*pitchVelocity(stats?.['curveball speed'],90,155)+
    PITCHING_STAT_WEIGHTS.curve*numeric(stats,'curve');
}

// Maximum skill tiers for the standard fielding abilities.
// Special catches and Super Jump are position-dependent (see below).
// Clamber remains ineffective in CPU-vs-CPU play and ALWAYS scores zero.
export const FIELDING_ABILITY_BONUSES=Object.freeze({
  0:0,1:12,2:9,3:12,4:12,5:12,6:12,7:12,8:12,9:0,
  10:3,11:5,12:7
});
export const SPECIAL_CATCH_ABILITY_IDS=Object.freeze([1,3,4,5,6,7,8]);
const specialCatchIds=new Set(SPECIAL_CATCH_ABILITY_IDS);
const defensivePositions=new Set(['P','C','1B','2B','3B','SS','LF','CF','RF']);
export const POSITIONAL_FIELDING_ABILITY_BONUSES=Object.freeze({
  superJump:Object.freeze({CF:9,LF:6,RF:6,other:2}),
  specialCatch:Object.freeze({middleInfield:12,outfield:5,other:2})
});
// A 2B or SS without Super Dive / another active special catch loses twelve
// defensive rating points, independently of any other ability bonus.
// Clamber remains worth zero ability points and does NOT count as a catch.
export const MISSING_MIDDLE_INFIELD_CATCH_PENALTY=12;
export function fieldingAbilityBonus(abilityId,position=null){
  const id=Number(abilityId);
  let bonus=0;
  if(id===9){
    bonus=0; // Clamber provides no CPU-versus-CPU fielding benefit.
  }else if(id===2){
    bonus=POSITIONAL_FIELDING_ABILITY_BONUSES.superJump[position]??
      (defensivePositions.has(position)?POSITIONAL_FIELDING_ABILITY_BONUSES.superJump.other:0);
  }else if(specialCatchIds.has(id)){
    const catchBonus=POSITIONAL_FIELDING_ABILITY_BONUSES.specialCatch;
    if(position==='2B'||position==='SS')bonus=catchBonus.middleInfield;
    else if(['LF','CF','RF'].includes(position))bonus=catchBonus.outfield;
    else bonus=defensivePositions.has(position)?catchBonus.other:0;
  }else{
    bonus=FIELDING_ABILITY_BONUSES[id]??0;
  }
  return (position==='2B'||position==='SS')&&!specialCatchIds.has(id)
    ? bonus-MISSING_MIDDLE_INFIELD_CATCH_PENALTY
    : bonus;
}
// Use the GM's saved fielding positions. Do not infer positions from
// batting order when there is no valid full starting nine.
export function lineupFieldingAbilityBonuses(people,starters){
  const bonuses=new Map(people.map(p=>[p.id,fieldingAbilityBonus(p.fieldingAbilityId)]));
  if(!Array.isArray(starters)||starters.length!==9||people.length!==9)return bonuses;
  const byId=new Map(people.map(p=>[p.id,p]));
  const fielded=starters.map(s=>({player:byId.get(Number(s?.player)),position:s?.position}));
  if(fielded.some(x=>!x.player||!defensivePositions.has(x.position))||
    new Set(fielded.map(x=>x.player.id)).size!==9||
    new Set(fielded.map(x=>x.position)).size!==9)return bonuses;
  for(const {player,position} of fielded){
    bonuses.set(player.id,fieldingAbilityBonus(player.fieldingAbilityId,position));
  }
  return bonuses;
}
export const BASERUNNING_ABILITY_BONUS=4;
export const BATTING_CHEMISTRY_BONUSES=Object.freeze({one:3,both:6});
export const MAX_POSITIONAL_CHEMISTRY_ADJUSTMENT=20;
export const UNLISTED_FIELDING_CHEMISTRY_BONUS=1;
// Good and anti-chemistry both affect BOTH defenders in the pair.
// Neutral LF/RF-to-CF is penalized because the buddy jump needs chemistry.
// Unlisted positive links give +1 to each player; neutral and anti give zero.
// Each pair scores exactly once: priority links never also gain the generic +1.
export const DEFENSIVE_CHEMISTRY_LINKS=Object.freeze([
  {a:'LF',b:'CF',good:10,bad:-6,neutral:-6},
  {a:'RF',b:'CF',good:10,bad:-6,neutral:-6},
  {a:'SS',b:'1B',good:7,bad:-4,neutral:0},
  {a:'2B',b:'3B',good:6,bad:-4,neutral:0},
  // First and third base form ONE symmetric link: +5 per defender.
  {a:'1B',b:'3B',good:5,bad:0,neutral:0},
  ...['LF','CF','RF'].map(a=>({a,b:'1B',good:2,bad:-3,neutral:0})),
  ...['LF','CF','RF'].map(a=>({a,b:'3B',good:2,bad:-3,neutral:0})),
  ...['LF','CF','RF'].map(a=>({a,b:'C',good:4,bad:-1,neutral:0}))
]);
function chemistryRelation(a,b){
  // An anti-chemistry link wins when data lists conflicting relationships.
  if(a.bad.has(b.id)||b.bad.has(a.id))return 'bad';
  if(a.good.has(b.id)||b.good.has(a.id)||
    a.conditional.has(b.id)||b.conditional.has(a.id))return 'good';
  return 'neutral';
}
// Apply only to a valid nine-slot saved batting order and defensive lineup.
// This pure function is also used by tests with synthetic chemistry networks.
export function lineupChemistryAdjustments(people,starters){
  const bonuses=new Map(people.map(p=>[p.id,{offense:0,defense:0}]));
  if(!Array.isArray(starters)||starters.length!==9||people.length!==9)return bonuses;
  const byId=new Map(people.map(p=>[p.id,p]));
  const ordered=starters.map(s=>byId.get(Number(s?.player)));
  const byPosition=new Map(starters.map((s,i)=>[s.position,ordered[i]]));
  if(ordered.some(p=>!p)||new Set(ordered.map(p=>p.id)).size!==9||
    byPosition.size!==9)return bonuses;

  // First and ninth also touch because the batting order wraps around.
  for(let i=0;i<ordered.length;i++){
    const batter=ordered[i];
    const before=ordered[(i+8)%9],after=ordered[(i+1)%9];
    const good=Number(chemistryRelation(batter,before)==='good')+
      Number(chemistryRelation(batter,after)==='good');
    bonuses.get(batter.id).offense=good===2?BATTING_CHEMISTRY_BONUSES.both:
      good===1?BATTING_CHEMISTRY_BONUSES.one:0;
  }
  for(const link of DEFENSIVE_CHEMISTRY_LINKS){
    const a=byPosition.get(link.a),b=byPosition.get(link.b);
    if(!a||!b)continue;
    const value=link[chemistryRelation(a,b)];
    bonuses.get(a.id).defense+=value;
    bonuses.get(b.id).defense+=value;
  }
  // Any other good chemistry link between two fielders still contributes to
  // defense, but priority links above replace (never stack with) this bonus.
  const priorityPairs=new Set(DEFENSIVE_CHEMISTRY_LINKS.map(link=>
    [link.a,link.b].sort().join('|')));
  const fielders=[...byPosition.entries()];
  for(let i=0;i<fielders.length;i++){
    const [aPosition,a]=fielders[i];
    for(let j=i+1;j<fielders.length;j++){
      const [bPosition,b]=fielders[j];
      if(priorityPairs.has([aPosition,bPosition].sort().join('|')))continue;
      if(chemistryRelation(a,b)!=='good')continue;
      bonuses.get(a.id).defense+=UNLISTED_FIELDING_CHEMISTRY_BONUS;
      bonuses.get(b.id).defense+=UNLISTED_FIELDING_CHEMISTRY_BONUS;
    }
  }
  for(const p of people){
    const b=bonuses.get(p.id);
    b.defense=clamp(b.defense,-MAX_POSITIONAL_CHEMISTRY_ADJUSTMENT,
      MAX_POSITIONAL_CHEMISTRY_ADJUSTMENT);
  }
  return bonuses;
}
export const TRAJECTORY_OFFENSE_WEIGHT=.25;
export const TRAJECTORY_SCORES=Object.freeze({High:100,Medium:60,Low:20});
export function offenseRating(stats){
  const trajectory=String(stats?.['hit trajectory']??'Medium').trim();
  const trajectoryPoints=TRAJECTORY_SCORES[trajectory]??TRAJECTORY_SCORES.Medium;
  return .40*numeric(stats,'charge hit power')+
    TRAJECTORY_OFFENSE_WEIGHT*trajectoryPoints+
    .25*numeric(stats,'slap hit power')+
    .05*numeric(stats,'slap contact size')+
    .05*numeric(stats,'charge contact size');
}
function scouting(id){
  const record=gameData.players[id];
  if(!record)return null;
  const s=record.stats;
  return {
    id:Number(id),
    pitcherPriority:pitcherPriorityFor(playerById.get(Number(id)),record)?.code||null,
    offense:offenseRating(s),
    offenseAbilityBonus:Number(s['baserunning ability'])>0?BASERUNNING_ABILITY_BONUS:0,
    fieldingAbilityId:Number(s['fielding ability']),
    pitching:pitchingRating(s),
    defense:defenseRating(s),
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
export function rosterPowerComponents(roster,startingPitcherId=null,starters=null){
  const people=[...new Set((roster||[]).map(Number))].map(scouting).filter(Boolean);
  const pitchers=topPriorityPitchers(people,startingPitcherId);
  const linked=lineupChemistryAdjustments(people,starters);
  const abilityBonuses=lineupFieldingAbilityBonuses(people,starters);
  const offense=average(people.map(p=>clamp(
    (1-OFFENSE_SPEED_WEIGHT)*p.offense+OFFENSE_SPEED_WEIGHT*p.running+
    p.offenseAbilityBonus+(linked.get(p.id)?.offense||0))));
  const pitching=average(pitchers.map(p=>p.pitching));
  const defense=average(people.map(p=>clamp(
    p.defense+(abilityBonuses.get(p.id)||0)+(linked.get(p.id)?.defense||0))));
  const rosterScore=POWER_WEIGHTS.offense*offense+
    POWER_WEIGHTS.pitching*pitching+POWER_WEIGHTS.defense*defense;
  return {offense:round(offense),pitching:round(pitching),defense:round(defense),
    rosterScore,
    rosterSize:people.length,selectedPitchers:pitchers
      .map(p=>({id:p.id,role:p.pitcherPriority||'other',pitching:round(p.pitching)}))};
}
export function rankingParticipants(season,teamId){
  const roster=season.rosters?.[teamId]||[];
  const submitted=season.defaults?.[teamId];
  if(!validLineup(season,teamId,submitted))return [];
  return submitted.starters.map(p=>Number(p.player));
}
// Score-only games must not pretend a team scored zero Game Points.
// Compute genuine per-game averages from the games with player reports;
// those reported games also determine how much actual performance counts.
export function teamRegularGamePointAverages(season,teamId){
  const games=(season?.games||[]).filter(g=>g.phase==='regular'&&g.stage==='final'&&
    [g.home,g.away].some(id=>String(id)===String(teamId))&&g.result?.scores);
  const totals={ogp:0,dgp:0,pgp:0};
  let gamesWithReports=0;
  for(const game of games){
    const people=(Array.isArray(game.result?.players)?game.result.players:[])
      .filter(p=>String(p.team)===String(teamId));
    if(people.length)gamesWithReports++;
    for(const player of people){
      const parts=gamePointsForReport(player);
      for(const key of ['ogp','dgp','pgp'])totals[key]+=parts[key];
    }
  }
  return {games:games.length,gamesWithReports,
    ...Object.fromEntries(['ogp','dgp','pgp'].map(key=>[
      key,gamesWithReports?totals[key]/gamesWithReports:null
    ]))};
}
// Average the reported team-game production of ALL franchises. Weight by
// report count, so a club with 12 games contributes 12 team-game samples,
// not one equally weighted sample against a club with a single game.
// Games without Project Rio player stats are excluded from the denominator.
export function leagueRegularGamePointAverages(season){
  const sums={ogp:0,dgp:0,pgp:0};
  let teamGamesWithReports=0;
  for(const team of season?.teams||[]){
    const perTeam=teamRegularGamePointAverages(season,team.id);
    const count=perTeam.gamesWithReports;
    if(!count)continue;
    teamGamesWithReports+=count;
    for(const category of ['ogp','dgp','pgp'])
      sums[category]+=perTeam[category]*count;
  }
  return {teamGamesWithReports,
    ...Object.fromEntries(['ogp','dgp','pgp'].map(key=>[
      key,teamGamesWithReports?sums[key]/teamGamesWithReports:null
    ]))};
}
function playedRecord(season,teamId){
  const played=(season?.games||[]).filter(g=>g.phase==='regular'&&g.stage==='final'&&
    [g.home,g.away].map(String).includes(String(teamId))&&g.result?.scores);
  let wins=0,losses=0;
  for(const g of played){
    const our=Number(g.result.scores[teamId]);
    const other=Number(g.result.scores[String(g.home)===String(teamId)?g.away:g.home]);
    if(!Number.isFinite(our)||!Number.isFinite(other))continue;
    if(our>other)wins++;else if(other>our)losses++;
  }
  return {wins,losses,games:wins+losses};
}
export function powerRankings(season){
  if(!season || !['preseason','regular','postseason','retention','archived'].includes(season.status) ||
    season.teams?.length!==12)return [];
  const leagueGamePointAverages=leagueRegularGamePointAverages(season);
  return season.teams.filter(team=>
    rankingParticipants(season,team.id).length===9).map(team=>{
    const participants=rankingParticipants(season,team.id);
    const starter=season.defaults?.[team.id]?.starters.find(p=>p.position==='P');
    const c=rosterPowerComponents(participants,starter?.player,season.defaults?.[team.id]?.starters);
    const gamePointAverages=teamRegularGamePointAverages(season,team.id);
    const performanceWeight=Math.min(GAME_POINT_BLEND_MAX,
      gamePointAverages.gamesWithReports*GAME_POINT_BLEND_PER_REPORTED_GAME);
    const gamePointAdjustments={
      offense:gamePointPerformanceAdjustment(gamePointAverages.ogp,
        leagueGamePointAverages.ogp,'ogp'),
      defense:gamePointPerformanceAdjustment(gamePointAverages.dgp,
        leagueGamePointAverages.dgp,'dgp'),
      pitching:gamePointPerformanceAdjustment(gamePointAverages.pgp,
        leagueGamePointAverages.pgp,'pgp')
    };
    // League-average production means zero adjustment, retaining the
    // preseason score. Strong/weak OGP changes only offense; likewise
    // DGP/defense and PGP/pitching. The 5% x game-count weight is applied
    // only once to those relative changes, not to any win/loss component.
    const blended={
      offense:clamp(c.offense+performanceWeight*gamePointAdjustments.offense),
      defense:clamp(c.defense+performanceWeight*gamePointAdjustments.defense),
      pitching:clamp(c.pitching+performanceWeight*gamePointAdjustments.pitching)
    };
    // Use actual (clamped) category changes when computing the 60/20/20
    // overall score. Original roster score retains full precision.
    const score=c.rosterScore+
      POWER_WEIGHTS.offense*(blended.offense-c.offense)+
      POWER_WEIGHTS.defense*(blended.defense-c.defense)+
      POWER_WEIGHTS.pitching*(blended.pitching-c.pitching);
    const record=playedRecord(season,team.id);
    return {...team,...c,
      offense:round(blended.offense),defense:round(blended.defense),
      pitching:round(blended.pitching),
      gamePointAverages,leagueGamePointAverages,
      gamePointAdjustments,performanceWeight:round(performanceWeight*100),
      ...record,score:round(clamp(score))};
  }).sort((a,b)=>b.score-a.score||b.rosterScore-a.rosterScore||
    String(a.name).localeCompare(String(b.name))).map((t,i)=>({...t,rank:i+1}));
}
