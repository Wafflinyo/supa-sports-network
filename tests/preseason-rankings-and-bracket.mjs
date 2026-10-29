import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {preseasonReady,preseasonSeeds,preseasonBracket,preseasonHasLeagueOpener} from '../src/preseason.js';
import {powerRankings,POWER_WEIGHTS,TRAJECTORY_OFFENSE_WEIGHT,TRAJECTORY_SCORES,offenseRating,rosterPowerComponents,rankingParticipants,PITCHER_PRIORITY_ORDER,POWER_PITCHER_COUNT,POWER_SUPPORT_PITCHER_COUNT,FIELDING_ABILITY_BONUSES,BASERUNNING_ABILITY_BONUS,BATTING_CHEMISTRY_BONUSES,DEFENSIVE_CHEMISTRY_LINKS,MAX_POSITIONAL_CHEMISTRY_ADJUSTMENT,UNLISTED_FIELDING_CHEMISTRY_BONUS,lineupChemistryAdjustments,fieldingAbilityBonus,lineupFieldingAbilityBonuses,POSITIONAL_FIELDING_ABILITY_BONUSES,SPECIAL_CATCH_ABILITY_IDS,MISSING_MIDDLE_INFIELD_CATCH_PENALTY} from '../src/power-rankings.js';
import {pitcherPriorityFor} from '../src/player-roles.js';
import {earnedAchievements,GM_ACHIEVEMENTS} from '../src/gm-achievements.js';

// Explicit scoring contract: offense dominates (60%), defense outranks
// pitching, and otherwise-identical batters rank High > Medium > Low.
assert.deepEqual(POWER_WEIGHTS,{offense:.60,pitching:.15,defense:.20,running:.02,chemistry:.03});
assert(POWER_WEIGHTS.offense>POWER_WEIGHTS.defense+POWER_WEIGHTS.pitching,
  'offense must outweigh defense and pitching combined');
assert.equal(Object.values(POWER_WEIGHTS).reduce((sum,n)=>sum+n,0),1);
assert.equal(TRAJECTORY_OFFENSE_WEIGHT,.25);
assert.deepEqual(TRAJECTORY_SCORES,{High:100,Medium:60,Low:20});
const hitter={ 'slap hit power':50,'charge hit power':50,
  'slap contact size':50,'charge contact size':50,
  'displayed batting':1, 'displayed pitching':1 };
assert.equal(offenseRating({...hitter,'hit trajectory':'High'}),62.5);
assert.equal(offenseRating({...hitter,'hit trajectory':'Medium'}),52.5);
assert.equal(offenseRating({...hitter,'hit trajectory':'Low'}),42.5);
assert.equal(offenseRating({...hitter,'hit trajectory':'High',
  'displayed batting':10,'displayed pitching':10}),62.5,
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
// The selected P counts first; three other starters follow P1P, P2P,
// untagged, with pitching skill breaking same-tier ties. The remaining
// categories still use all nine starters; bench players are excluded.
assert.deepEqual(PITCHER_PRIORITY_ORDER,{P1P:1,P2P:2,other:3});
assert.equal(POWER_PITCHER_COUNT,4);
assert.equal(POWER_SUPPORT_PITCHER_COUNT,3);
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

const positions=['P','C','1B','2B','3B','SS','LF','CF','RF'];
assert.equal(BASERUNNING_ABILITY_BONUS,2);
assert.deepEqual(BATTING_CHEMISTRY_BONUSES,{one:3,both:6});
assert.equal(MAX_POSITIONAL_CHEMISTRY_ADJUSTMENT,20);
assert.equal(UNLISTED_FIELDING_CHEMISTRY_BONUS,1);
assert.equal(MISSING_MIDDLE_INFIELD_CATCH_PENALTY,6);
assert.deepEqual(FIELDING_ABILITY_BONUSES,{
  0:0,1:12,2:9,3:12,4:12,5:12,6:12,7:12,8:12,9:0,10:3,11:5,12:7
});
// Positional ability values are separate from the existing chemistry links.
assert.deepEqual(POSITIONAL_FIELDING_ABILITY_BONUSES,{
 superJump:{CF:9,LF:6,RF:6,other:2},
 specialCatch:{middleInfield:12,outfield:5,other:2}
});
for(const ability of SPECIAL_CATCH_ABILITY_IDS){
 assert.equal(fieldingAbilityBonus(ability,'2B'),12);
 assert.equal(fieldingAbilityBonus(ability,'SS'),12);
 assert.equal(fieldingAbilityBonus(ability,'2B',1),12,
   '2B remains +12 even with a catching partner at SS');
 assert.equal(fieldingAbilityBonus(ability,'SS',3),12,
   'SS remains +12 even with a catching partner at 2B');
 assert.equal(fieldingAbilityBonus(ability,'2B',9),12,
   'Clamber at SS has no effect on the 2B catch bonus');
 for(const pos of ['LF','CF','RF'])assert.equal(fieldingAbilityBonus(ability,pos),5);
 for(const pos of ['P','C','1B','3B'])assert.equal(fieldingAbilityBonus(ability,pos),2);
 assert.equal(fieldingAbilityBonus(ability),0,'no position is not a free special-catch bonus');
}
for(const pos of ['P','C','1B','2B','3B','SS']){
 const expected=['2B','SS'].includes(pos)?-4:2;
 assert.equal(fieldingAbilityBonus(2,pos),expected,
   'Super Jump keeps +2 everywhere else but non-catch middle infielders lose 6');
}
assert.equal(fieldingAbilityBonus(2,'CF'),9);
assert.equal(fieldingAbilityBonus(2,'LF'),6);
assert.equal(fieldingAbilityBonus(2,'RF'),6);
assert.equal(fieldingAbilityBonus(2),0,'Super Jump needs a saved defensive position');
for(const pos of [...positions,null]){
 const expected=['2B','SS'].includes(pos)?-6:0;
 assert.equal(fieldingAbilityBonus(9,pos),expected,
   'Clamber gives zero ability bonus and never avoids a missing-catcher penalty');
}
for(const [id,base] of [[10,3],[11,5],[12,7]]){
 for(const pos of [...positions,null]){
   const expected=['2B','SS'].includes(pos)?base-6:base;
   assert.equal(fieldingAbilityBonus(id,pos),expected,
     'a different fielding ability keeps its own bonus but must not avoid the catch penalty');
 }
}
for(const pos of ['2B','SS']){
 assert.equal(fieldingAbilityBonus(0,pos),-6,
   'no active fielding ability at middle infield applies minus six');
 assert.equal(fieldingAbilityBonus(undefined,pos),-6,
   'missing ability record cannot avoid minus six');
}
const positionalPeople=positions.map((p,i)=>({id:i+1,fieldingAbilityId:0}));
const byPos=position=>positionalPeople[positions.indexOf(position)];
const positionalLineup=positions.map((position,i)=>({position,player:i+1}));
byPos('2B').fieldingAbilityId=1; // Super Dive
byPos('SS').fieldingAbilityId=3; // Tongue Catch
byPos('CF').fieldingAbilityId=2; // Super Jump
let positionBonuses=lineupFieldingAbilityBonuses(positionalPeople,positionalLineup);
assert.equal(positionBonuses.get(byPos('2B').id),12);
assert.equal(positionBonuses.get(byPos('SS').id),12);
assert.equal(positionBonuses.get(byPos('CF').id),9);
assert.equal(positionBonuses.get(byPos('2B').id)+positionBonuses.get(byPos('SS').id),24,
  'two middle-infield catches grant +12 each without an added synergy');
byPos('SS').fieldingAbilityId=9; // Clamber receives no bonus
positionBonuses=lineupFieldingAbilityBonuses(positionalPeople,positionalLineup);
assert.equal(positionBonuses.get(byPos('2B').id),12);
assert.equal(positionBonuses.get(byPos('SS').id),-6,
  'SS with Clamber receives minus six even if 2B has Super Dive');
const swapCF=positionalLineup.map(s=>({...s}));
const center=swapCF.find(s=>s.position==='CF'),first=swapCF.find(s=>s.position==='1B');
center.position='1B';first.position='CF';
positionBonuses=lineupFieldingAbilityBonuses(positionalPeople,swapCF);
assert.equal(positionBonuses.get(byPos('CF').id),2,
  'moving a Super Jumper from CF to first base reduces its bonus to +2');
assert.equal(lineupFieldingAbilityBonuses(positionalPeople,null)
 .get(byPos('2B').id),0,'missing field positions must not imply a middle-infield bonus');
const missingBoth=positions.map((position,i)=>({id:i+1,fieldingAbilityId:0}));
const missingBothBonuses=lineupFieldingAbilityBonuses(missingBoth,positionalLineup);
assert.equal(missingBothBonuses.get(missingBoth[positions.indexOf('2B')].id),-6,
  '2B without a special catch loses six defensive points');
assert.equal(missingBothBonuses.get(missingBoth[positions.indexOf('SS')].id),-6,
  'SS without a special catch loses six defensive points');
assert.equal(missingBothBonuses.get(missingBoth[positions.indexOf('1B')].id),0,
  'other field positions must not receive a missing-catch penalty');
assert.equal([...missingBothBonuses.values()].reduce((sum,x)=>sum+x,0),-12,
  'both missing special catches combine to minus twelve total rating points');
assert.equal(DEFENSIVE_CHEMISTRY_LINKS.length,13);
const expectedDefensiveLinks={
 'LF-CF':[8,-6,-6],'RF-CF':[8,-6,-6],
 'SS-1B':[6,-4,0],'2B-3B':[5,-4,0],
 'LF-1B':[3,-3,0],'CF-1B':[3,-3,0],'RF-1B':[3,-3,0],
 'LF-3B':[2,-3,0],'CF-3B':[2,-3,0],'RF-3B':[2,-3,0],
 'LF-C':[2,-1,0],'CF-C':[2,-1,0],'RF-C':[2,-1,0]
};
assert.deepEqual(Object.fromEntries(DEFENSIVE_CHEMISTRY_LINKS.map(x=>[
  x.a+'-'+x.b,[x.good,x.bad,x.neutral]])),expectedDefensiveLinks,
  'field chemistry preserves the ordered boosts and reduced anti-chem penalties');
const fakePeople=()=>positions.map((position,i)=>({
  id:i+1,good:new Set(),bad:new Set(),conditional:new Set()
}));
const fakeStarters=positions.map((position,i)=>({player:i+1,position}));
const at=(people,position)=>people[positions.indexOf(position)];
const bonus=(people,position)=>lineupChemistryAdjustments(people,fakeStarters)
  .get(at(people,position).id);
const neutralNine=fakePeople();
assert.equal(bonus(neutralNine,'LF').defense,-6,'neutral LF-CF prevents buddy jump');
assert.equal(bonus(neutralNine,'RF').defense,-6,'neutral RF-CF prevents buddy jump');
assert.equal(bonus(neutralNine,'CF').defense,-12,'CF has two separate neutral buddy-jump links');
assert.equal(bonus(neutralNine,'SS').defense,0,'all other neutral links are harmless');
assert.equal(bonus(neutralNine,'1B').defense,0,'neutral 1B connection must not subtract');
assert.equal(bonus(neutralNine,'C').defense,0,'neutral home connection must not subtract');
const joined=fakePeople();
at(joined,'LF').good.add(at(joined,'CF').id);
at(joined,'CF').conditional.add(at(joined,'RF').id);
assert.equal(bonus(joined,'LF').defense,8);
assert.equal(bonus(joined,'RF').defense,8);
assert.equal(bonus(joined,'CF').defense,16,'two buddy jump links benefit the center fielder');
assert.equal(bonus(joined,'CF').offense,6,'batting neighbors on both sides add six offense');
const antiBuddy=fakePeople();
at(antiBuddy,'LF').bad.add(at(antiBuddy,'CF').id);
assert.equal(bonus(antiBuddy,'LF').defense,-6,'anti LF-to-CF is minus six');
assert.equal(bonus(antiBuddy,'CF').defense,-12,'bad LF + neutral RF are each minus six');
for(const link of DEFENSIVE_CHEMISTRY_LINKS.filter(x=>x.neutral===0)){
 const bad=fakePeople();
 at(bad,link.a).bad.add(at(bad,link.b).id);
 const aDelta=bonus(bad,link.a).defense-bonus(neutralNine,link.a).defense;
 const bDelta=bonus(bad,link.b).defense-bonus(neutralNine,link.b).defense;
 assert.equal(aDelta,link.bad,'anti link penalty on '+link.a+' to '+link.b);
 assert.equal(bDelta,link.bad,'anti link penalty on '+link.b+' to '+link.a);
}
const batting=fakePeople();
at(batting,'P').good.add(at(batting,'RF').id); // Ninth hitter wraps to first
at(batting,'C').good.add(at(batting,'P').id);
assert.equal(bonus(batting,'P').offense,6,'two good neighboring batters');
assert.equal(bonus(batting,'RF').offense,3,'ninth is adjacent to first');
assert.equal(bonus(batting,'C').offense,3,'one good neighboring batter');
at(batting,'P').bad.add(at(batting,'RF').id);
assert.equal(bonus(batting,'P').offense,3,'anti batting chemistry gives no extra penalty');
assert.equal(bonus(batting,'RF').offense,0,'anti batting chemistry must not subtract offense');
assert.equal(lineupChemistryAdjustments(neutralNine,null).get(7).defense,0,
 'no saved defensive positions means no arbitrary chemistry penalties');
// Any other good fielding connection contributes +1 to each of its partners.
const unrelated=fakePeople();
at(unrelated,'LF').good.add(at(unrelated,'RF').id);
assert.equal(bonus(unrelated,'LF').defense,-5,
  'LF gains +1 for an unlisted LF-RF link, while neutral LF-CF stays -6');
assert.equal(bonus(unrelated,'RF').defense,-5,
  'RF gains +1 for an unlisted LF-RF link');
const generic=fakePeople();
at(generic,'P').good.add(at(generic,'SS').id);
at(generic,'P').conditional.add(at(generic,'2B').id);
assert.equal(bonus(generic,'P').defense,2,'two unlisted good links grant +1 each');
assert.equal(bonus(generic,'SS').defense,1,'unlisted chemistry helps both partners');
assert.equal(bonus(generic,'2B').defense,1,'conditional good contributes +1');
const antiGeneric=fakePeople();
at(antiGeneric,'P').bad.add(at(antiGeneric,'SS').id);
assert.equal(bonus(antiGeneric,'P').defense,0,'unlisted anti gives no penalty');
assert.equal(bonus(antiGeneric,'SS').defense,0,'unlisted anti gives no penalty to partner');
const conflictGeneric=fakePeople();
at(conflictGeneric,'P').good.add(at(conflictGeneric,'SS').id);
at(conflictGeneric,'SS').bad.add(at(conflictGeneric,'P').id);
assert.equal(bonus(conflictGeneric,'P').defense,0,'anti overrides conflicting good');
for(const link of DEFENSIVE_CHEMISTRY_LINKS){
 const preferred=fakePeople();
 at(preferred,link.a).good.add(at(preferred,link.b).id);
 const baselineA=bonus(neutralNine,link.a).defense;
 const baselineB=bonus(neutralNine,link.b).defense;
 assert.equal(bonus(preferred,link.a).defense-baselineA,
   link.good-link.neutral,'priority pair cannot also get generic +1: '+link.a);
 assert.equal(bonus(preferred,link.b).defense-baselineB,
   link.good-link.neutral,'priority pair cannot also get generic +1: '+link.b);
}
const catcherPair=fakePeople();
at(catcherPair,'CF').good.add(at(catcherPair,'C').id);
assert.equal(bonus(catcherPair,'C').defense,2,'outfielder-to-catcher good gives +2');
assert.equal(bonus(catcherPair,'CF').defense,-10,
  'CF gains exactly +2 for catcher; two neutral buddy-jump penalties remain');
const allGood=fakePeople();
for(let i=0;i<allGood.length;i++)
 for(let j=i+1;j<allGood.length;j++)allGood[i].good.add(allGood[j].id);
for(const person of allGood)
 assert(bonus(allGood,positions[person.id-1]).defense<=20,
   'existing +20 positional chemistry cap still applies');

const pitchRaw=(s)=>{
 const clamp100=x=>Math.max(0,Math.min(100,x));
 return .60*clamp100(Number(s['pitching stamina'])||0)+
   .18*clamp100(((Number(s['charge pitch speed'])||90)-90)/80*100)+
   .14*clamp100(((Number(s['curveball speed'])||90)-90)/65*100)+
   .08*clamp100(Number(s.curve)||0);
};
for(const names of [powerNames,balancedNames]){
 const ids=names.map(n=>byName.get(n).id);
 const designatedStarter=ids[0];
 const ranked=rosterPowerComponents(ids,designatedStarter);
 assert.equal(ranked.rosterSize,9);
 const members=ids.map(id=>{
   const s=stats[id].stats,player=gamePlayers.find(p=>p.id===id);
   return {
     id,offense:Math.min(100,offenseRating(s)+
       (Number(s['baserunning ability'])>0?BASERUNNING_ABILITY_BONUS:0)),pitch:pitchRaw(s),
     defense:Math.min(100,.60*Math.max(0,Math.min(100,Number(s.fielding)||0))+
       .40*Math.max(0,Math.min(100,Number(s['outfield throwing speed'])||0))+
       fieldingAbilityBonus(Number(s['fielding ability']))),
     running:Math.max(0,Math.min(100,Number(s.speed)||0)),
     role:pitcherPriorityFor(player,stats[id])?.code||'other'
   };
 });
 const avg=k=>members.reduce((total,x)=>total+x[k],0)/9;
 const selected=[members[0],...[...members.slice(1)].sort((a,b)=>
   PITCHER_PRIORITY_ORDER[a.role]-PITCHER_PRIORITY_ORDER[b.role]||
   b.pitch-a.pitch||a.id-b.id).slice(0,3)];
 assert.equal(ranked.offense,round1(avg('offense')),'every offensive player counts');
 assert.equal(ranked.defense,round1(avg('defense')),'every defender counts');
 assert.equal(ranked.running,round1(avg('running')),'all nine runners count');
 // The composite must use exactly the requested coefficients, without
 // changing underlying player ratings or the selected starting pitcher.
 const expectedScore=.60*ranked.offense+.20*ranked.defense+
   .15*ranked.pitching+.02*ranked.running+.03*ranked.chemistry;
 assert(Math.abs(ranked.rosterScore-expectedScore)<.051,
   'rankings must weight offense 60%, defense 20%, pitching 15%, running 2%, chemistry 3%');
 assert.equal(ranked.pitching,round1(selected.reduce((sum,p)=>sum+p.pitch,0)/4),
   'GM-selected starter and three backups determine pitching rating equally');
 assert.deepEqual(ranked.selectedPitchers.map(p=>p.id),selected.map(p=>p.id),
   'must count starting P first and three unique priority-ranked backups');
 assert.equal(new Set(ranked.selectedPitchers.map(p=>p.id)).size,4,
   'must never double-count the starting pitcher');
 const outsideStarter=ids.find(id=>!ranked.selectedPitchers.some(p=>p.id===id));
 assert(outsideStarter!=null);
 const changedStarter=rosterPowerComponents(ids,outsideStarter);
 assert.equal(changedStarter.selectedPitchers[0].id,outsideStarter,
   'the GM can start a less-skilled player who then counts toward pitching');
 assert.notEqual(changedStarter.pitching,ranked.pitching,
   'choosing a previously excluded starter changes the index');
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
// A GM's chosen starter takes the first slot, irrespective of its priority;
// the other three still obey P1P before P2P before untagged.
const warioId=byName.get('Wario').id;
const tropicalId=byName.get('Tropical Wiggler').id;
const peteyId=byName.get('Petey Piranha').id;
const priorityTestIds=[
  warioId,tropicalId,peteyId,byName.get('Funky Kong').id,
  byName.get('Ice Bro').id,byName.get('Flower Fields Monty').id
];
const prioritized=rosterPowerComponents(priorityTestIds,peteyId);
assert.equal(prioritized.selectedPitchers.length,4);
assert.equal(prioritized.selectedPitchers[0].id,peteyId,
  'GM-selected untagged starter still comes first');
assert.equal(prioritized.selectedPitchers[1].id,warioId,
  'P1P reserve must rank before P2P');
assert.equal(prioritized.selectedPitchers[2].id,tropicalId,
  'P2P reserve must rank before untagged');
assert.equal(new Set(prioritized.selectedPitchers.map(p=>p.id)).size,4);
const p1pStarter=rosterPowerComponents(priorityTestIds,warioId);
assert.equal(p1pStarter.selectedPitchers[0].id,warioId);
assert(!p1pStarter.selectedPitchers.slice(1).some(p=>p.id===warioId),
  'P1P starter must not appear twice in selected four');
assert.equal(rosterPowerComponents([warioId],warioId).selectedPitchers.length,1,
  'short rosters do not invent backups');

const lineupSeason={rosters:{test:powerIds.concat([balancedIds[0],balancedIds[1]])},defaults:{}};
assert.deepEqual(rankingParticipants(lineupSeason,'test'),[],
  'NO DEFAULT LINEUP means no Power Index score, even with eleven drafted players');
lineupSeason.defaults.test={starters:powerIds.map((id,i)=>({player:id,position:positions[i]})),
  bench:[balancedIds[0],balancedIds[1]]};
assert.deepEqual(rankingParticipants(lineupSeason,'test'),powerIds,
  'only the nine GM-submitted starters determine Power Rankings');
lineupSeason.defaults.test.starters[1].position='P';
assert.deepEqual(rankingParticipants(lineupSeason,'test'),[],
  'reject incomplete/invalid default lineups instead of publishing arbitrary scores');
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
assert.equal(powerRankings(season).length,0,'no submitted defaults means no published Power Rankings');
season.defaults={};
const newDefault=teamId=>{
  const roster=season.rosters[teamId];
  return {starters:roster.slice(0,9).map((id,i)=>({player:id,position:positions[i]})),
    bench:roster.slice(9)};
};
season.defaults.t1=newDefault('t1');
assert.equal(powerRankings(season).length,1,'first GM submission publishes just that franchise');
assert.equal(powerRankings(season)[0].id,'t1');
const originalPitch=powerRankings(season)[0];
const starterRow=season.defaults.t1.starters.find(p=>p.position==='P');
assert.equal(originalPitch.selectedPitchers[0].id,starterRow.player,
  'Power Rankings must honor the saved P position');
const newStartingRow=season.defaults.t1.starters.find(p=>
  p.player!==starterRow.player&&!originalPitch.selectedPitchers.some(q=>q.id===p.player));
assert(newStartingRow,'nine-player lineup must have a fifth pitcher candidate');
const alternatePosition=newStartingRow.position;
starterRow.position=alternatePosition;
newStartingRow.position='P';
const reassignedPitch=powerRankings(season)[0];
assert.equal(reassignedPitch.selectedPitchers[0].id,newStartingRow.player,
  'changing only the P position must change the selected starter');
assert.notEqual(reassignedPitch.pitching,originalPitch.pitching,
  'changing the GM-selected P must recalculate pitching score');
assert.notEqual(reassignedPitch.rosterScore,originalPitch.rosterScore,
  'GM starting pitcher selection must feed overall power score');
newStartingRow.position=alternatePosition;
starterRow.position='P';
season.defaults.t2=newDefault('t2');
assert.equal(powerRankings(season).length,2,'second GM submission adds one more team');
const scoreBefore=powerRankings(season).find(x=>x.id==='t1').rosterScore;
const swap=season.defaults.t1.starters[0].player;
season.defaults.t1.starters[0].player=season.defaults.t1.bench[0];
season.defaults.t1.bench[0]=swap;
assert.notEqual(powerRankings(season).find(x=>x.id==='t1').rosterScore,scoreBefore,
 'editing submitted starters recalculates rankings automatically');
for(const t of season.teams)season.defaults[t.id]??=newDefault(t.id);
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
const powerView=powerUi.slice(powerUi.indexOf('export function PowerRankings('),powerUi.indexOf('function ScoreEntry('));
assert(powerView.includes('ssl-power-board')&&powerView.includes('ssl-power-entry')&&
  powerView.includes('ssl-power-meter')&&powerView.includes('t.score.toFixed(1)'),
  'Power Rankings must show a branded list with one overall numeric score and progress bar');
assert(powerView.includes('Offensive Ranking:')&&powerView.includes('Pitching Ranking:')&&
  powerView.includes('Defensive Ranking:')&&powerView.includes('categoryPlaces[t.id].offense')&&
  powerView.includes('categoryPlaces[t.id].pitching')&&powerView.includes('categoryPlaces[t.id].defense')&&
  powerView.includes('t.offense.toFixed(1)')&&powerView.includes('t.pitching.toFixed(1)')&&
  powerView.includes('t.defense.toFixed(1)')&&powerView.includes('Score:'),
  'Power Rankings must show numeric category scores and league placements without additional bars');
assert.equal((powerView.match(/role="progressbar"/g)||[]).length,1,
  'Only the overall score may use a bar; category rankings must not use bars');
assert(!powerView.includes('POWER_WEIGHTS')&&!powerView.includes('TRAJECTORY_SCORES')&&
  !powerView.includes('top {POWER_PITCHER_COUNT}')&&!powerView.includes('60% stamina'),
  'Do not publish internal Power Rankings scoring formulas or calculation explanations');
assert(!powerView.includes('t.running.toFixed')&&!powerView.includes('t.chemistry.toFixed')&&
  !powerView.includes('Regular W–L'),
  'Hide running, chemistry, and extra columns from the streamlined leaderboard');
const powerStyles=readFileSync(new URL('../src/preseason.css',import.meta.url),'utf8');
assert(powerStyles.includes('.ssl-power-subranks')&&powerStyles.includes('.ssl-power-head'),
  'The Power Rankings redesign must retain its responsive card styling');
const s=readFileSync(new URL('../src/SeasonLeague.jsx',import.meta.url),'utf8');
assert(s.includes('ssl_preseason_results')&&s.includes("rpc('ssl_preseason_record'"));
const home=s.slice(s.indexOf('export function SeasonHome('));
const teamsView=s.slice(s.indexOf('function Teams('),s.indexOf('function ScheduleMatchupHeading('));
const bracketTabs=s.slice(s.indexOf('function PlayoffBracketSections('),s.indexOf('export const seasonPages'));
assert(home.includes('preseasonReady(s)&&<>')&&
  home.includes('<PowerRankings season={s} supabase={l.supabase}/>')&&
  home.includes('<PreseasonTournament league={l} compact/>'),
  'Home must display Power Rankings and live pre-season bracket when the draft finishes');
assert(!home.includes('!preseasonHasLeagueOpener(s)'),
  'Power Rankings must remain on Home even after the regular-season opener');
assert(teamsView.includes('const rankingsVisible=preseasonReady(s);')&&
  teamsView.includes("['Franchises','Power Rankings']"),
  'Teams must have Power Rankings sub-tab as soon as the post-draft rankings open');
assert(bracketTabs.includes("['Playoffs','Pre-season']")&&
  bracketTabs.includes("<PreseasonTournament league={l}/>")&&
  bracketTabs.includes('<PlayoffPanel league={l}/>'),
  'Playoff Bracket must include the Pre-season and official Playoffs sub-tabs');
assert(s.includes("page === \"Playoff Bracket\" ? (")&&
  s.includes('<PlayoffBracketSections league={l}/>'),
  'Playoff Bracket page must render the accessible dual-tab view');
assert(home.includes("onClick={()=>go('Playoff Bracket')}"),
  'Home bracket link must open the Playoff Bracket section');
const compactBracket=powerUi.slice(powerUi.indexOf('if(compact)return'),powerUi.indexOf('return <div className="ssl-pre-tournament">'));
assert(compactBracket.includes('bracket.rounds.map')&&compactBracket.includes('game.winner')&&
  compactBracket.includes('game.scoreA')&&compactBracket.includes('game.scoreB'),
  'Home bracket preview must show live real matchups, scores and advancement');
assert(!compactBracket.includes('<ScoreEntry'),
  'Home preview is read-only: result editing must stay in the full bracket tab');
const nav=readFileSync(new URL('../src/navigation.js',import.meta.url),'utf8');
assert(nav.includes("'Playoff Bracket'")&&!nav.includes("'Draft Room', 'Preseason Tournament'"),
  'Pre-season belongs under Playoff Bracket, not a redundant main navigation entry');
const schema=readFileSync(new URL('../supabase/migrations/20261028162000_ssl_preseason_tournament.sql',import.meta.url),'utf8');
assert(schema.includes("access->>'role'<>'commissioner'"));
assert(schema.includes("public.ssl_preseason_results"));
assert(schema.includes("league_private.ssl_preseason_pair"));
assert(!schema.includes('update league_private.ssl_season_states'),
  'preseason must NEVER mutate the live official draft');
console.log('PASS: 12 seeds, 11 knockouts, re-seeding, 3-team bye, 93rd badge, power rankings and protected separate result storage');
