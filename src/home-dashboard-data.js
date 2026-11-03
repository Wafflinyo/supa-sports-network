// Home scoreboard displays public *released* games only.
// Raw uploaded "recorded" reports remain private and never affect public week progression.
export const HOME_RESULT_WINDOW_MS=24*60*60*1000;
export const releasedAtMs=game=>{
  if(game?.stage!=='final')return null;
  const stamp=Date.parse(game.releasedAt||'');
  return Number.isFinite(stamp)?stamp:null;
};
export const newlyReleased=(game,nowMs=Date.now())=>{
  const ms=releasedAtMs(game);
  return ms!==null&&ms<=nowMs&&nowMs-ms<HOME_RESULT_WINDOW_MS;
};
const isPending=game=>!['final','cancelled'].includes(game.stage);
const weekOf=game=>Number(game.week);
export function homeWeekBoard(season,nowMs=Date.now()){
  const groups=new Map();
  if(season?.schedulePublished===false)return {week:null,games:[],total:0};
  for(const game of season?.games||[]){
    const week=weekOf(game);
    if(game.phase!=='regular'||!Number.isInteger(week)||week<1||game.stage==='cancelled')continue;
    if(!groups.has(week))groups.set(week,[]);
    groups.get(week).push(game);
  }
  const sorted=[...groups].sort((a,b)=>a[0]-b[0]);
  // Hold the current week while games are unplayed, even if their dates are TBD.
  // Once every game is released, keep that week's finals for 24 hours, then
  // automatically advance to the next week's fixtures.
  const chosen=sorted.find(([,games])=>games.some(isPending)||games.some(g=>newlyReleased(g,nowMs)));
  if(!chosen)return {week:null,games:[],total:0};
  const [week,all]=chosen;
  const visible=all.filter(g=>isPending(g)||newlyReleased(g,nowMs));
  // Preserve the schedule's original row order, only bringing dated games into
  // actual chronological order when both dates are known.
  const indexed=new Map(all.map((g,i)=>[g.id,i]));
  visible.sort((a,b)=>{
    const at=Date.parse(a.startsAt||''),bt=Date.parse(b.startsAt||'');
    return Number.isFinite(at)&&Number.isFinite(bt)&&at!==bt?at-bt:indexed.get(a.id)-indexed.get(b.id);
  });
  return {week,games:visible,total:all.length};
}
export function homeRecentResults(season,limit=3){
  return (season?.games||[]).filter(g=>g.stage==='final'&&g.result?.scores)
    .map((g,i)=>({g,i,ts:releasedAtMs(g)??(Date.parse(g.startsAt||'')||0)}))
    .sort((a,b)=>b.ts-a.ts||b.i-a.i)
    .slice(0,limit).map(x=>x.g);
}
