// Match stories use official result totals. Inning-by-inning drama is described
// only when the commissioner explicitly records it; Rio has no play-by-play.
const n=value=>Number.isFinite(Number(value))&&Number(value)>0?Number(value):0;
const ip=outs=>Math.floor(outs/3)+'.'+(outs%3);
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
  else if(n(s.hits)>=4)add('batting',75+n(s.hits),name+' collected '+n(s.hits)+' hits');
  const defense=['putouts','assists','doublePlays','triplePlays','buddyJumpPutouts'].reduce((sum,k)=>sum+n(s[k]),0);
  if(defense>=8)add('fielding',70+Math.min(defense,20),name+' recorded '+defense+' defensive contributions');
  else if(n(s.buddyJumpPutouts)>=2)add('fielding',71,name+' made '+n(s.buddyJumpPutouts)+' Buddy Jump putouts');
  const outs=n(s.outs),ks=n(s.pitchStrikeouts),allowed=n(s.runsAllowed);
  if(outs>=15&&allowed===0)add('pitching',96+Math.min(ks,8),name+' pitched '+ip(outs)+' scoreless innings'+(ks?' with '+ks+' strikeouts':''));
  else if(outs>=15&&allowed<=2)add('pitching',76+ks,name+' went '+ip(outs)+' IP with '+allowed+' runs allowed');
  else if(ks>=4)add('pitching',73+ks,name+' struck out '+ks);
 }
 candidate.sort((a,b)=>b.rank-a.rank||Number(b.teamId===winner)-Number(a.teamId===winner)||a.playerId-b.playerId);
 const output=[],seen=new Set();
 for(const event of candidate){
  if(seen.has(event.kind))continue;
  seen.add(event.kind);output.push(event);
  if(output.length===3)break;
 }
 return output;
}
export function matchHeadline(season,game,players=[]){
 if(game?.stage!=='final'||!game.result?.scores)return null;
 const a=Number(game.result.scores[game.away]),h=Number(game.result.scores[game.home]);
 if(!Number.isFinite(a)||!Number.isFinite(h)||a<0||h<0||a===h)return null;
 const winnerId=String(a>h?game.away:game.home),loserId=String(a>h?game.home:game.away);
 const names=new Map((season.teams||[]).map(t=>[String(t.id),t.name]));
 const winner=names.get(winnerId)||'Winning team',loser=names.get(loserId)||'Opponents';
 const big=Math.max(a,h),small=Math.min(a,h),margin=big-small;
 const story=game.story||{};
 const leadChanges=Number.isInteger(story.leadChanges)&&story.leadChanges>=0?Math.min(20,story.leadChanges):0;
 const lateFinish=['walkoff','late-comeback'].includes(story.lateFinish)?story.lateFinish:'none';
 const note=typeof story.note==='string'?story.note.trim().slice(0,240):'';
 const kind=lateFinish==='walkoff'&&margin<=2?'walkoff':
  lateFinish==='late-comeback'&&margin<=2?'comeback':
  small===0?'shutout':margin>=8?'blowout':margin<=2?'close':'result';
 const highlights=matchPerformanceHighlights(game,players),best=highlights.find(x=>x.kind==='batting'&&x.teamId===winnerId&&/home runs|grand slam/.test(x.text));
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
 const details=[];
 if(leadChanges>=2)details.push(leadChanges+' confirmed lead changes');
 if(kind==='walkoff')details.push('Confirmed walk-off finish');
 if(kind==='comeback')details.push('Confirmed late-inning comeback');
 if(highlights.length)details.push(highlights.map(e=>e.text).join(' · '));
 if(note)details.push(note);
 return {id:'match:'+game.id,category:'match',tier:kind,label:labels[kind],
   title,summary:details.join('. ')||winner+' beat '+loser+' '+score+'.',
   season:season.name,seasonId:season.id,gameId:game.id,
   winnerId,loserId,winner,loser,winnerRuns:big,loserRuns:small,
   awayRuns:a,homeRuns:h,awayId:String(game.away),homeId:String(game.home),
   week:game.week||null,leadChanges,lateFinish,highlights,
   importance:kind==='walkoff'?100:kind==='comeback'?96:
    kind==='shutout'?91:kind==='blowout'?86:kind==='close'?82:58,
   at:game.releasedAt||game.result.postedAt||null,private:false};
}
export function homepageHeadlineSlides(championship,items,seasonId,maximum=5){
 const limit=Math.min(Math.max(Number(maximum)||5,1),5);
 const slides=championship?[{id:'champion:'+championship.seasonId,kind:'champion',feature:championship}]:[];
 const news=(items||[]).filter(i=>i.category==='match'&&!i.private&&i.gameId);
 const timestamp=i=>{const t=Date.parse(i.at||'');return Number.isFinite(t)?t:0;};
 const ordered=[...news].sort((a,b)=>
   Number(String(b.seasonId)===String(seasonId))-Number(String(a.seasonId)===String(seasonId))||
   timestamp(b)-timestamp(a)||(b.importance||0)-(a.importance||0)||a.id.localeCompare(b.id));
 const seen=new Set();
 for(const item of ordered){
  if(slides.length>=limit)break;
  if(seen.has(item.gameId))continue;
  seen.add(item.gameId);slides.push({id:item.id,kind:'match',story:item});
 }
 return slides;
}
