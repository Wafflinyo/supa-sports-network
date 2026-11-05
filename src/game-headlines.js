import {gamePointsForReport} from './game-points.js';
import {HEATING_UP_THRESHOLD} from './heating-up.js';
import {inningScoringDrama} from './rio-inning-scores.js';
// Match stories use official result totals. Inning-by-inning drama is described
// only when the commissioner explicitly records it; Rio has no play-by-play.
const n=value=>Number.isFinite(Number(value))&&Number(value)>0?Number(value):0;
const ip=outs=>Math.floor(outs/3)+'.'+(outs%3);
// One factual context line for any game/team performance post. It never
// guesses at an inning or comeback from the score alone.
export function gameOutcomeContext(season,game,teamId){
 const teams=new Map((season?.teams||[]).map(t=>[String(t.id),t.name]));
 const opponentId=String(game.away)===String(teamId)?String(game.home):String(game.away);
 const opponent=teams.get(opponentId)||'the opposing team';
 const teamRuns=Number(game.result?.scores?.[teamId]);
 const opponentRuns=Number(game.result?.scores?.[opponentId]);
 const result=Number.isFinite(teamRuns)&&Number.isFinite(opponentRuns)
   ?teamRuns>opponentRuns?'win':teamRuns<opponentRuns?'loss':'tie':'game';
 const week=Number(game.week);
 const where=Number.isInteger(week)&&week>0?'Week '+week+"'s":'the';
 return 'in '+where+' '+result+' against the '+opponent+'.';
}
// Report PGP is calculated with the SAME official SSL scoring weights used
// by the box score. Never confuse an individual pitcher's PGP with TGP.
export function pitchingNewsPerformance(row,game){
 const stats=row?.stats||{};
 const outs=Number(stats.outs||0),ks=Number(stats.pitchStrikeouts||0);
 const runs=stats.runsAllowed==null?null:Number(stats.runsAllowed);
 const earned=stats.earnedRuns==null?null:Number(stats.earnedRuns);
 if(!Number.isFinite(outs)||outs<=0)return null;
 const points=gamePointsForReport(row).pgp;
 const opponent=String(row.team)===String(game.away)?game.home:game.away;
 const opponentScore=Number(game?.result?.scores?.[opponent]);
 const ownScore=Number(game?.result?.scores?.[row.team]);
 // Any participating pitcher in an official TEAM shutout qualifies,
 // including relievers in a combined shutout.
 const shutout=Number.isFinite(opponentScore)&&opponentScore===0&&
   Number.isFinite(ownScore)&&ownScore>0;
 const pointsEligible=outs>=15&&points>=20;
 const lowRuns=outs>=12&&(
   (runs!=null&&Number.isFinite(runs)&&runs<=2)||
   (earned!=null&&Number.isFinite(earned)&&earned<=2)
 );
 if(!shutout&&!pointsEligible&&!lowRuns)return null;
 const tier=pointsEligible
   ?points>=40?'great':points>=30?'solid':'good'
   :shutout?'shutout':'efficient';
 const score=Number.isFinite(points)?points.toFixed(2).replace(/\.00$/,''):'0';
 const level=tier==='great'?'great pitching outing':
   tier==='solid'?'solid pitching outing':
   tier==='good'?'good pitching outing':
   tier==='shutout'?'shutout performance':'strong run prevention';
 const detail=[ip(outs)+' IP'];
 // News reports show earned runs only; the full box score retains runs allowed.
 if(earned!=null&&Number.isFinite(earned))
   detail.push(earned===0?'no earned runs':earned+' earned '+(earned===1?'run':'runs'));
 if(ks>0)detail.push(ks+' '+(ks===1?'strikeout':'strikeouts'));
 detail.push(score+' PGP');
 return {shutout,pointsEligible,lowRuns,tier,level,outs,ks,runs,earned,pgp:points,
   detail:detail.join(', ')};
}
export function matchPerformanceHighlights(game,players=[]){
 const names=new Map(players.map(p=>[Number(p.id),p.name]));
 const scores=game?.result?.scores||{},a=Number(scores[game.away]),h=Number(scores[game.home]);
 if(!Number.isFinite(a)||!Number.isFinite(h)||a===h)return [];
 const winner=String(a>h?game.away:game.home),candidate=[];
 for(const row of game.result.players||[]){
  const s=row.stats||{},name=names.get(Number(row.player))||'A player';
  const add=(kind,rank,text)=>candidate.push({kind,rank,text,playerId:Number(row.player),teamId:String(row.team)});
  const hrs=Math.max(n(s.homeRuns),n(s.oneHr)+n(s.twoHr)+n(s.threeHr)+n(s.grandSlams));
  if(hrs>=2)add('batting',100+Math.min(hrs,5)*5,name+' blasted '+hrs+' home runs');
  else if(n(s.grandSlams))add('batting',95,name+' hit a grand slam');
  else if(n(s.rbi)>=4)add('batting',80+n(s.rbi),name+' drove in '+n(s.rbi)+' runs');
  else if(n(s.hits)>=4){
    const hits=n(s.hits),atBats=Number(s.atBats);
    // Use the actual at-bats denominator, not plate appearances or a guess.
    const hasValidAtBats=s.atBats!=null&&Number.isInteger(atBats)&&atBats>=hits;
    add('batting',75+hits,hasValidAtBats
      ?name+' went '+hits+'-for-'+atBats+' at the plate'
      :name+' racked up '+hits+' hits');
  }
  const defense=['putouts','assists','doublePlays','triplePlays','buddyJumpPutouts'].reduce((sum,k)=>sum+n(s[k]),0);
  if(defense>=8)add('fielding',70+Math.min(defense,20),name+' recorded '+defense+' defensive contributions');
  else if(n(s.buddyJumpPutouts)>=2)add('fielding',71,name+' made '+n(s.buddyJumpPutouts)+' Buddy Jump putouts');
  const pitch=pitchingNewsPerformance(row,game);
  if(pitch)add('pitching',
    (pitch.shutout?104:0)+(pitch.tier==='great'?40:pitch.tier==='solid'?30:20)+
    Math.min(pitch.ks,12),
    name+' delivered '+pitch.level+' ('+pitch.detail+')');
 }
 candidate.sort((a,b)=>b.rank-a.rank||
   Number(b.teamId===winner)-Number(a.teamId===winner)||
   a.playerId-b.playerId);
 // Preserve EVERY qualifying teammate, including several players with the
 // same type of highlight. Presentation groups them by team instead of
 // limiting the entire matchup to one batter/one pitcher/one fielder.
 return candidate;
}
// Recap prose groups a player's batting, fielding and pitching highlights
// into one mention. Preserve the rank of their top achievement and retain
// every underlying highlight for other site features.
function playerGroupedHighlights(highlights,players=[]){
 const names=new Map(players.map(p=>[Number(p.id),p.name]));
 const grouped=new Map();
 for(const highlight of highlights){
   const playerId=Number(highlight.playerId);
   if(!grouped.has(playerId))grouped.set(playerId,[]);
   grouped.get(playerId).push(highlight);
 }
 return [...grouped].map(([playerId,entries])=>{
   const name=names.get(playerId)||'A player';
   const achievements=entries.map(entry=>
     entry.text.startsWith(name+' ')?entry.text.slice(name.length+1):entry.text);
   const joined=achievements.length===1?achievements[0]:
     achievements.length===2?achievements.join(' and '):
     achievements.slice(0,-1).join(', ')+', and '+achievements.at(-1);
   return name+' '+joined;
 });
}
export function matchHeadline(season,game,players=[],{includeRecorded=false}={}){
 if(!(game?.stage==='final'||(includeRecorded&&game?.stage==='recorded'))||!game.result?.scores)return null;
 const a=Number(game.result.scores[game.away]),h=Number(game.result.scores[game.home]);
 if(!Number.isFinite(a)||!Number.isFinite(h)||a<0||h<0||a===h)return null;
 const winnerId=String(a>h?game.away:game.home),loserId=String(a>h?game.home:game.away);
 const names=new Map((season.teams||[]).map(t=>[String(t.id),t.name]));
 const winner=names.get(winnerId)||'Winning team',loser=names.get(loserId)||'Opponents';
 const big=Math.max(a,h),small=Math.min(a,h),margin=big-small;
 const story=game.story||{};
 // The uploaded Game Info line score is authoritative for inning-end lead
 // changes, late comebacks and home walk-offs. Commissioner annotations are
 // only a fallback for older reports that lack an inning breakdown.
 const calculated=inningScoringDrama(game.result?.innings);
 const leadChanges=calculated?calculated.leadChanges:
   Number.isInteger(story.leadChanges)&&story.leadChanges>=0?Math.min(20,story.leadChanges):0;
 const lateFinish=calculated?calculated.lateFinish:
   ['walkoff','late-comeback'].includes(story.lateFinish)?story.lateFinish:'none';
 const note=typeof story.note==='string'?story.note.trim().slice(0,240):'';
 const kind=lateFinish==='walkoff'&&margin<=2?'walkoff':
  lateFinish==='late-comeback'&&margin<=2?'comeback':
  small===0?'shutout':margin>=8?'blowout':margin<=2?'close':'result';
 const highlights=matchPerformanceHighlights(game,players),best=highlights.find(x=>x.kind==='batting'&&x.teamId===winnerId&&/home runs|grand slam/.test(x.text));
 // Dominant team headlines spotlight the winner. Competitive games recognize
 // the top performers on both sides, including players on the losing club.
 const teamSpotlight=['blowout','shutout'].includes(kind)?'winner':'both';
 const topPlayers=(game.result?.players||[])
   .filter(row=>teamSpotlight==='both'||String(row.team)===winnerId)
   .map(row=>{
     const score=gamePointsForReport(row).tgp;
     const id=Number(row.player);
     const hasOfficialScore=typeof row.gameScore==='number'&&Number.isFinite(row.gameScore);
     const hasStats=Object.values(row.stats||{}).some(value=>Number.isFinite(Number(value))&&Number(value)!==0);
     return {playerId:id,name:players.find(p=>Number(p.id)===id)?.name||'Player '+id,
       teamId:String(row.team),gamePoints:score,heatingUp:score>=HEATING_UP_THRESHOLD,
       meaningful:hasOfficialScore||hasStats};
   })
   .filter(row=>row.meaningful&&Number.isFinite(row.gamePoints))
   .sort((a,b)=>b.gamePoints-a.gamePoints||a.playerId-b.playerId)
   .slice(0,3)
   .map(({meaningful,...row})=>row);
 const score=big+'–'+small;
 let title=kind==='walkoff'?winner+' steal a walk-off thriller, '+score+'!':
  kind==='comeback'?winner+' complete a late comeback, '+score+'!':
  kind==='shutout'?winner+' shut out '+loser+', '+big+'–0!':
  kind==='blowout'?winner+' dominate '+loser+', '+score+'!':
  kind==='close'?winner+' edge '+loser+' in a '+score+' thriller!':
  winner+' defeat '+loser+', '+score+'!';
 if(best&&['blowout','shutout','close'].includes(kind)){
  const player=players.find(p=>Number(p.id)===best.playerId)?.name||'A player';
  const stat=best.text.startsWith(player)?best.text.slice(player.length).trim():best.text;
  title=player+' '+stat+' as '+winner+' '+(kind==='shutout'?'blank':kind==='close'?'edge':'rout')+' '+loser+', '+score+'!';
 }
 const labels={walkoff:'WALK-OFF THRILLER',comeback:'LATE COMEBACK',shutout:'SHUTOUT VICTORY',blowout:'DOMINANT BLOWOUT',close:margin===1?'ONE-RUN THRILLER':'CLOSE FINISH',result:'FINAL SCORE'};
 // Keep each team's accomplishments and its outcome commentary together.
 // In particular, the winning-team conclusion must never follow statistics
 // from the losing team (including in commissioner-only previews).
 const details=[];
 const winnerHighlights=highlights.filter(e=>e.teamId===winnerId);
 const loserHighlights=highlights.filter(e=>e.teamId===loserId);
 if(winnerHighlights.length){
   details.push(winner+': '+playerGroupedHighlights(winnerHighlights,players).join('; '));
   // Include a walk-off directly in the victory recap instead of adding
   // an awkward "Confirmed walk-off finish" disclaimer at the bottom.
   const context=gameOutcomeContext(season,game,winnerId).replace(/[.]$/,'');
   details.push('These standout performances came '+
     (kind==='walkoff'?context.replace(' win against ',' walk-off win against '):context));
 }
 if(loserHighlights.length){
   details.push(loser+': '+playerGroupedHighlights(loserHighlights,players).join('; '));
   const week=Number(game.week);
   const weekLabel=Number.isInteger(week)&&week>0?'Week '+week+' ':'';
   details.push('Despite the '+weekLabel+'loss to the '+winner+
     ', these players left it all out on the diamond');
 }
 if(leadChanges>=2)details.push(leadChanges+' confirmed lead changes');
 if(kind==='comeback')details.push('Confirmed late-inning comeback');
 if(note)details.push(note.replace(/[.!?]+$/,''));
 return {id:'match:'+game.id,category:'match',tier:kind,label:labels[kind],
   title,summary:details.length?details.join('. ')+'.':winner+' beat '+loser+' '+score+'.',
   season:season.name,seasonId:season.id,gameId:game.id,
   winnerId,loserId,winner,loser,winnerRuns:big,loserRuns:small,
   awayRuns:a,homeRuns:h,awayId:String(game.away),homeId:String(game.home),
   week:game.week||null,leadChanges,lateFinish,highlights,topPlayers,teamSpotlight,
   importance:kind==='walkoff'?100:kind==='comeback'?96:
    kind==='shutout'?91:kind==='blowout'?86:kind==='close'?82:58,
   at:game.releasedAt||game.result.postedAt||null,private:game.stage==='recorded'};
}
// At most five slides. The season's active Upcoming Matches week determines
// when the preseason champion must disappear, even before Week 2 has a final.
// Earlier official game stories backfill unused slots as the new week arrives.
export function homepageHeadlineSlides(championship,items,seasonId,maximum=5,season=null,allowPrivate=false){
 const limit=Math.min(Math.max(Number(maximum)||5,1),5);
 const news=(items||[]).filter(i=>i.category==='match'&&(!i.private||allowPrivate)&&i.gameId&&
   String(i.seasonId)===String(seasonId));
 const weekOf=i=>{const n=Number(i.week);return Number.isInteger(n)&&n>0?n:null;};
 const regular=(season?.games||[]).filter(g=>g.phase==='regular'&&Number.isInteger(Number(g.week)));
 const pending=regular.filter(g=>!['final','cancelled'].includes(g.stage));
 const boardWeek=pending.length
   ?Math.min(...pending.map(g=>Number(g.week)))
   :regular.length?Math.max(...regular.map(g=>Number(g.week))):null;
 const releasedWeeks=news.map(weekOf).filter(n=>n!=null);
 const releasedWeek=releasedWeeks.length?Math.max(...releasedWeeks):null;
 const displayWeek=boardWeek??releasedWeek;
 const startedFirstWeek=releasedWeeks.some(n=>n===1);
 // Champion appears first before any regular-season final, or LAST while
 // Week 1 has fewer than five released game headlines. Never after Week 2.
 const championAllowed=!!championship&&displayWeek!==null?displayWeek<=1:!!championship;
 const current=news.filter(i=>weekOf(i)!==null);
 const timestamp=i=>{const n=Date.parse(i.at||'');return Number.isFinite(n)?n:0;};
 current.sort((a,b)=>(weekOf(b)||0)-(weekOf(a)||0)||
   (allowPrivate?Number(!!b.private)-Number(!!a.private):0)||
   (b.importance||0)-(a.importance||0)||
   timestamp(b)-timestamp(a)||a.id.localeCompare(b.id));
 const slides=[],used=new Set();
 for(const item of current){
  if(slides.length>=limit)break;
  if(displayWeek!=null&&weekOf(item)>displayWeek)continue;
  if(used.has(item.gameId))continue;
  used.add(item.gameId);
  slides.push({id:item.id,kind:'match',story:item});
 }
 // Postseason match headlines can also lead the carousel; keep game-specific
 // releases ahead of old regular-season headlines once playoffs begin.
 const playoffs=news.filter(i=>weekOf(i)===null);
 playoffs.sort((a,b)=>timestamp(b)-timestamp(a)||a.id.localeCompare(b.id));
 if(playoffs.length){
   const playSlides=playoffs.slice(0,limit).map(item=>({id:item.id,kind:'match',story:item}));
   for(const item of slides){
     if(playSlides.length>=limit)break;
     playSlides.push(item);
   }
   return playSlides;
 }
 if(championAllowed&&slides.length<limit)slides.push({
   id:'champion:'+championship.seasonId,kind:'champion',feature:championship,
 });
 return slides;
}
