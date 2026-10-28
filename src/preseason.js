// Deterministic, read-only preseason tournament structure.
// Times are already ACTIVE elapsed seconds from the SSL draft server; periods
// when the commissioner paused the pick timer are excluded by that server.
const roundNames=['ROUND OF 12','ROUND OF 6','SEMIFINAL','CHAMPIONSHIP'];
const finishedStates=new Set(['postdraft','regular','postseason','retention','offseason','archived']);

export function preseasonReady(season){
  return !!season && finishedStates.has(season.status) && season.teams?.length===12 &&
    Array.isArray(season.picks) && season.picks.length>=12;
}
export function preseasonSeeds(season){
  if(!preseasonReady(season))return [];
  const draws=(season.teams||[]).map((team,i)=>{
    const picks=(season.picks||[]).filter(p=>String(p.team)===String(team.id)&&
      Number.isFinite(Number(p.seconds))&&Number(p.seconds)>=0);
    return {...team,lotteryPosition:i,selectedPicks:picks.length,
      avgSeconds:picks.length?picks.reduce((n,p)=>n+Number(p.seconds),0)/picks.length:Infinity};
  }).sort((a,b)=>a.avgSeconds-b.avgSeconds || a.lotteryPosition-b.lotteryPosition);
  return draws.map((t,i)=>({...t,seed:i+1}));
}
export const pickTimeLabel=seconds=>Number.isFinite(seconds)
  ?`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`:'—';
export function preseasonBracket(season){
  const seeds=preseasonSeeds(season);
  const rows=Array.isArray(season?.preseasonResults)?season.preseasonResults:[];
  const results=new Map(rows.map(x=>[String(x.match_key),x]));
  const rounds=[];
  let entrants=seeds;
  let champion=null;
  for(let r=1;r<=4;r++){
    if(!entrants || entrants.length<2){
      rounds.push({number:r,title:roundNames[r-1],games:[],bye:null,pending:true});
      continue;
    }
    const paired=Math.floor(entrants.length/2),bye=entrants.length%2?entrants[0]:null;
    const games=[],advancing=bye?[bye]:[];
    let complete=true;
    for(let i=0;i<paired;i++){
      const high=entrants[i],low=entrants[entrants.length-1-i];
      const key=`R${r}-${i+1}`,row=results.get(key);
      const valid=!!row && String(row.team_a)===String(high.id)&&
        String(row.team_b)===String(low.id)&&
        Number.isInteger(Number(row.score_a))&&Number.isInteger(Number(row.score_b))&&
        Number(row.score_a)>=0&&Number(row.score_b)>=0&&Number(row.score_a)!==Number(row.score_b);
      const winner=valid?(Number(row.score_a)>Number(row.score_b)?high:low):null;
      if(winner)advancing.push(winner);else complete=false;
      games.push({key,round:r,high,low,scoreA:valid?Number(row.score_a):null,
        scoreB:valid?Number(row.score_b):null,winner,recordedAt:valid?row.recorded_at:null});
    }
    rounds.push({number:r,title:roundNames[r-1],games,bye,pending:false,complete});
    if(r===4 && complete)champion=advancing[0];
    entrants=complete?advancing.sort((a,b)=>a.seed-b.seed):null;
  }
  return {seeds,rounds,champion,totalGames:11,completedGames:rounds.reduce((n,r)=>n+r.games.filter(g=>g.winner).length,0)};
}
export function preseasonHasLeagueOpener(season){
  return !!(season?.games||[]).find(g=>g.phase==='regular'&&g.stage==='final');
}
