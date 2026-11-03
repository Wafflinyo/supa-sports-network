import gameRecords from './preseason-game-records.json' with {type:'json'};
import {gamePointsForReport} from './game-points.js';
import {pitchingShutoutBonuses,pitcherShutoutStats} from './pitching-shutout.js';

// Preserves the exact game-sheet event counts and game-specific scoring.
// One report contributes one GP per participating player, even with no at-bats.
// Preseason never modifies the official season statistics or standings.
export const preseasonGames=gameRecords;
const rates=new Set(['battingAverage','onBase','slug','onBasePlusSlug','starSlug','era7','era9','whip','baAgainst','obAgainst','slgAgainst','opsAgainst']);
const round2=n=>Math.round((n+Number.EPSILON)*100)/100;
export function preseasonShutoutBonuses(game){
  const ipIndex=game.fields.indexOf('inningsPitched');
  if(ipIndex<0)return new Map();
  return pitchingShutoutBonuses({
    away:game.away,home:game.home,
    awayScore:game.awayScore,homeScore:game.homeScore,
    pitchers:game.players.map(([id,home,,values])=>({
      player:id,team:home?game.home:game.away,
      outs:Math.round(Number(values[ipIndex]||0)*3),
    })),
  });
}

const add=(dest,src)=>{for(const [key,value] of Object.entries(src)){
  if(key==='positionsPlayed'||key==='agp'||key==='gamesPlayed')continue;
  if(typeof value==='number'&&Number.isFinite(value)){
    if(!rates.has(key))dest[key]=(dest[key]||0)+value;
  }
}};
function setRates(record,rows){
  for(const field of rates){
    const values=rows.map(r=>r.stats[field]).filter(v=>typeof v==='number'&&Number.isFinite(v));
    if(values.length)record.stats[field]=values.reduce((a,b)=>a+b,0)/values.length;
  }
}
export function preseasonPlayerStats(){
  const byPlayer=new Map();
  for(const game of gameRecords){
    const bonusMap=preseasonShutoutBonuses(game);
    for(const [playerId,homeFlag,positions,values] of game.players){
      const teamName=homeFlag?game.home:game.away;
      const stats={};
      for(const [key,value] of Object.entries(values)){
        const field=game.fields[Number(key)];
        if(field && typeof value==='number')stats[field]=value;
      }
      stats.positionsPlayed=positions.split(',').map(x=>x.trim());
      stats.mvps=Number(game.mvp===playerId);
      stats.gamesPlayed=1;
      if(typeof stats.inningsPitched==='number')stats.outs=Math.round(stats.inningsPitched*3);
      stats.shutoutBonus=bonusMap.get(String(playerId))||0;
      Object.assign(stats,pitcherShutoutStats(stats.shutoutBonus,bonusMap.size));
      const parts=gamePointsForReport({stats,itemScore:stats.itemScore||0});
      Object.assign(stats,parts,{gameScore:parts.tgp,agp:parts.tgp});
      const key=String(playerId)+'|'+teamName;
      let row=byPlayer.get(key);
      if(!row){row={playerId,playerName:game.playerNames?.[String(playerId)]||null,teamName,stats:{gamesPlayed:0,positionsPlayed:[]},_games:[]};byPlayer.set(key,row)}
      add(row.stats,stats);
      row.stats.gamesPlayed+=1;
      row.stats.positionsPlayed=[...new Set([...row.stats.positionsPlayed,...stats.positionsPlayed])];
      row._games.push({gameId:game.gameId,stats});
    }
  }
  return [...byPlayer.values()].map(row=>{
    setRates(row,row._games);
    row.stats.agp=round2(row.stats.tgp/row.stats.gamesPlayed);
    row.perGame=Object.fromEntries(Object.entries(row.stats).filter(([k,v])=>typeof v==='number').map(([k,v])=>[k,rates.has(k)||k==='agp'?v:k==='gamesPlayed'?v:v/row.stats.gamesPlayed]));
    delete row._games;return row;
  });
}
export function preseasonTeamStats(){
  const teams=new Map();
  for(const game of gameRecords)for(const side of ['away','home']){
    const name=game[side], score=game[side+'Score'];
    let row=teams.get(name);
    if(!row){row={teamName:name,stats:{gamesPlayed:0,runsScored:0,runsAllowed:0},_games:[]};teams.set(name,row)}
    const gamePlayers=preseasonPlayerStatsForGame(game).filter(p=>p.teamName===name);
    const summed={};
    for(const player of gamePlayers)add(summed,player.stats);
    const shutout=score>0&&Number(game[side==='away'?'homeScore':'awayScore'])===0;
    const combined=shutout&&preseasonShutoutBonuses(game).size>1;
    add(row.stats,{...summed,shutouts:Number(shutout),combinedShutouts:Number(combined)});
    row.stats.gamesPlayed++;
    row.stats.runsScored+=score;
    row.stats.runsAllowed+=game[side==='away'?'homeScore':'awayScore'];
    row._games.push({stats:summed});
  }
  return [...teams.values()].map(row=>{
    setRates(row,row._games);
    row.stats.agp=round2(row.stats.tgp/row.stats.gamesPlayed);
    row.perGame=Object.fromEntries(Object.entries(row.stats).filter(([k,v])=>typeof v==='number').map(([k,v])=>[k,rates.has(k)||k==='agp'?v:k==='gamesPlayed'?v:v/row.stats.gamesPlayed]));
    delete row._games;return row;
  });
}
export function preseasonPlayerStatsForGame(game){
  // The source format allows subsequent game imports without duplicating players.
  const bonusMap=preseasonShutoutBonuses(game);
  return game.players.map(([playerId,homeFlag,positions,values])=>{
    const stats={};
    for(const [k,v] of Object.entries(values))stats[game.fields[Number(k)]]=v;
    stats.mvps=Number(game.mvp===playerId);
    if(typeof stats.inningsPitched==='number')stats.outs=Math.round(stats.inningsPitched*3);
    stats.shutoutBonus=bonusMap.get(String(playerId))||0;
    Object.assign(stats,pitcherShutoutStats(stats.shutoutBonus,bonusMap.size));
    const points=gamePointsForReport({stats,itemScore:stats.itemScore||0});
    return {playerId,playerName:game.playerNames?.[String(playerId)]||null,teamName:homeFlag?game.home:game.away,stats:{...stats,...points,gameScore:points.tgp}};
  });
}
