// The public homepage uses only fully released game results (stage 'final').
// Uploaded-but-unreleased ('recorded') reports never advance weeks or appear as results.
export const releasedAtMs=game=>{
  if(game?.stage!=='final')return null;
  const timestamp=Date.parse(game.releasedAt||'');
  return Number.isFinite(timestamp)?timestamp:null;
};
const isPending=game=>!['final','cancelled'].includes(game.stage);
const weekOf=game=>Number(game.week);
export function homeWeekBoard(season){
  const groups=new Map();
  if(season?.schedulePublished===false)return {week:null,games:[],total:0};
  for(const game of season?.games||[]){
    const week=weekOf(game);
    if(game.phase!=='regular'||!Number.isInteger(week)||week<1||game.stage==='cancelled')continue;
    if(!groups.has(week))groups.set(week,[]);
    groups.get(week).push(game);
  }
  const ordered=[...groups].sort((a,b)=>a[0]-b[0]);
  // The current week is the first with any game not yet publicly released.
  // A private upload is still pending. Once the last game is released,
  // the next week's fixtures appear immediately, with no 24-hour delay.
  const chosen=ordered.find(([,games])=>games.some(isPending));
  if(!chosen)return {week:null,games:[],total:0};
  const [week,all]=chosen;
  const games=all.filter(isPending);
  const indexed=new Map(all.map((game,index)=>[game.id,index]));
  games.sort((a,b)=>{
    const at=Date.parse(a.startsAt||''),bt=Date.parse(b.startsAt||'');
    return Number.isFinite(at)&&Number.isFinite(bt)&&at!==bt
      ?at-bt:indexed.get(a.id)-indexed.get(b.id);
  });
  return {week,games,total:all.length};
}
export function homeRecentResults(season,limit=6){
  const released=(season?.games||[]).map((game,index)=>({game,index}))
    .filter(({game})=>['regular','postseason','playoffs'].includes(game.phase) &&
      game.stage==='final'&&game.result?.scores);
  if(!released.length)return [];

  // Preseason exhibitions never enter this box: their results live in the
  // Pre-season Bracket / Preseason Stats area, and the champion feature.
  // While the regular season is active, show the latest week with released
  // scores; its scores stay in Recent Results until the first result from a
  // newer week is released. No timer, and never show private uploads.
  const postseason=released.filter(({game})=>game.phase!=='regular');
  let group=postseason.length?postseason:released;
  if(!postseason.length){
    const validWeeks=group.map(({game})=>weekOf(game))
      .filter(week=>Number.isInteger(week)&&week>=1);
    if(validWeeks.length){
      const latestWeek=Math.max(...validWeeks);
      group=group.filter(({game})=>weekOf(game)===latestWeek);
    }
  }
  return group.sort((a,b)=>{
    const date=game=>releasedAtMs(game)??Date.parse(game.startsAt||'')??0;
    const at=date(a.game),bt=date(b.game);
    return (Number.isFinite(bt)?bt:0)-(Number.isFinite(at)?at:0)||b.index-a.index;
  }).slice(0,limit).map(({game})=>game);
}
