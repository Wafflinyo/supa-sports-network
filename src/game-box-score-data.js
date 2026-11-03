import roster from './players.json' with {type:'json'};
import {preseasonGames,preseasonPlayerStatsForGame} from './preseason-game-data.js';
import {gamePointsForReport} from './game-points.js';

const playerNames=new Map(roster.map(player=>[Number(player.id),player.name]));
const round2=n=>Math.round((Number(n||0)+Number.EPSILON)*100)/100;
const sameName=(a,b)=>String(a||'').trim().toLowerCase()===String(b||'').trim().toLowerCase();

function summarizeTeam(key,name,score,players){
  return {
    key,name,score,
    players,
    hits:players.reduce((n,p)=>n+Number(p.stats?.hits||0),0),
    totalGamePoints:round2(players.reduce((n,p)=>n+Number(p.points?.tgp||0),0)),
  };
}
export function preseasonBoxScore(report){
  if(!report)return null;
  const rows=preseasonPlayerStatsForGame(report);
  const entries=rows.map(row=>{
    const source=report.players.find(([id])=>id===row.playerId);
    return {
      playerId:row.playerId,
      name:playerNames.get(Number(row.playerId))||row.playerName||String(row.playerId),
      teamKey:row.teamName,
      positions:source?.[2]||'',
      stats:row.stats,
      points:{ogp:row.stats.ogp,dgp:row.stats.dgp,pgp:row.stats.pgp,tgp:row.stats.tgp},
      itemScore:Number(row.stats.itemScore||0),
      mvp:report.mvp===row.playerId,
    };
  });
  return {
    id:report.gameId,
    stage:'Preseason',
    label:'ROUND '+report.round,
    teams:[
      summarizeTeam(report.away,report.away,report.awayScore,entries.filter(p=>p.teamKey===report.away)),
      summarizeTeam(report.home,report.home,report.homeScore,entries.filter(p=>p.teamKey===report.home)),
    ],
    hasPlayerStats:entries.length>0,
  };
}
export function seasonBoxScore(season,game){
  if(!season||!game||game.stage!=='final'||!game.result?.scores)return null;
  const names=new Map((season.teams||[]).map(t=>[String(t.id),t.name]));
  const resultPlayers=Array.isArray(game.result.players)?game.result.players:[];
  const entries=resultPlayers.map(row=>{
    const stats=row.stats||{};
    const points=gamePointsForReport(row);
    return {
      playerId:Number(row.player),
      name:playerNames.get(Number(row.player))||'Unknown player',
      teamKey:String(row.team),
      positions:Array.isArray(row.positions)?row.positions.join(', '):String(row.positions||''),
      stats,
      points,
      itemScore:Number(row.itemScore??stats.itemScore??0),
      mvp:Number(stats.mvps||0)>0,
    };
  });
  return {
    id:game.id,
    stage:game.phase==='playoffs'?'Playoffs':'Regular Season',
    label:game.label||(game.week?'WEEK '+game.week:'FINAL'),
    teams:[game.away,game.home].map(team=>
      summarizeTeam(String(team),names.get(String(team))||'Team',Number(game.result.scores[team]??0),
        entries.filter(p=>p.teamKey===String(team)))),
    hasPlayerStats:entries.length>0,
  };
}

// The preseason seeding is generated from the draft. Never connect a report
// to a different opponent or conflicting score simply because its round matches.
export function reportForBracketMatch(match){
  if(!match?.winner||!match.high||!match.low)return null;
  return preseasonGames.find(report=>{
    if(report.round!==match.round)return false;
    const highAway=sameName(match.high.name,report.away);
    const highHome=sameName(match.high.name,report.home);
    const lowAway=sameName(match.low.name,report.away);
    const lowHome=sameName(match.low.name,report.home);
    if(!((highAway&&lowHome)||(highHome&&lowAway)))return false;
    const scoreA=highAway?report.awayScore:report.homeScore;
    const scoreB=lowAway?report.awayScore:report.homeScore;
    return Number(match.scoreA)===scoreA&&Number(match.scoreB)===scoreB;
  })||null;
}
export function unmatchedPreseasonReports(bracket){
  const attached=new Set(
    (bracket?.rounds||[]).flatMap(round=>round.games||[])
      .map(reportForBracketMatch).filter(Boolean).map(report=>report.gameId),
  );
  return preseasonGames.filter(report=>!attached.has(report.gameId));
}
