import roster from './players.json' with {type:'json'};
import {preseasonGames,preseasonPlayerStatsForGame} from './preseason-game-data.js';
import {gamePointsForReport} from './game-points.js';
import {pitcherShutoutStats} from './pitching-shutout.js';

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
// The database stores valid integer counting totals, not rounded rates.
// Reconstruct batting and pitching rates for private previews and public box
// scores from the same persisted counts so neither needs unsafe rate fields.
export function gameBoxScoreRates(stats={}){
  const s={...stats};
  const n=key=>Number(s[key]||0);
  const rate=(a,b)=>b>0?a/b:null;
  const officialAb=n('battersFaced')-n('pitchWalks')-n('beanBalls');
  s.inningsPitched=n('outs')/3;
  s.battingAverage=rate(n('hits'),n('atBats'));
  s.onBase=rate(n('hits')+n('batWalks')+n('hitByPitch'),n('plateAppearances'));
  s.slug=rate(n('totalBases'),n('atBats'));
  s.onBasePlusSlug=s.onBase==null||s.slug==null?null:s.onBase+s.slug;
  s.starSlug=rate(n('starBases'),n('starSwings'));
  s.era7=rate(n('earnedRuns')*21,n('outs'));
  s.era9=rate(n('earnedRuns')*27,n('outs'));
  s.whip=rate((n('hitsAllowed')+n('pitchWalks'))*3,n('outs'));
  s.baAgainst=rate(n('hitsAllowed'),officialAb);
  s.obAgainst=rate(n('hitsAllowed')+n('pitchWalks')+n('beanBalls'),n('battersFaced'));
  s.slgAgainst=rate(n('singlesAllowed')+2*n('doublesAllowed')+3*n('triplesAllowed')+4*n('hrAllowed'),officialAb);
  s.opsAgainst=s.obAgainst==null||s.slgAgainst==null?null:s.obAgainst+s.slgAgainst;
  return s;
}
export function seasonBoxScore(season,game){
  if(!season||!game||game.stage!=='final'||!game.result?.scores)return null;
  const names=new Map((season.teams||[]).map(t=>[String(t.id),t.name]));
  const resultPlayers=Array.isArray(game.result.players)?game.result.players:[];
  const entries=resultPlayers.map(row=>{
    const shutoutBonus=Number(row.shutoutBonus||0);
    const participatingPitchers=resultPlayers.filter(p=>
      p.team===row.team&&Number(p.shutoutBonus||0)>0).length;
    const stats=gameBoxScoreRates({...row.stats,...pitcherShutoutStats(shutoutBonus,participatingPitchers),shutoutBonus});
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

// Only call this from commissioner-only interfaces. The submitted report is
// transformed into a normal box-score model for inspection, but is never
// written to the public schedule or released by this preview.
export function previewPrivateGameBoxScore(season,game,report){
  if(!season||!game||!Array.isArray(report?.players)||!report.players.length)return null;
  const scores=Object.fromEntries([game.away,game.home].map(tid=>[
    tid,report.players.filter(p=>String(p.team)===String(tid))
      .reduce((sum,p)=>sum+Number(p.stats?.runs||0),0),
  ]));
  const box=seasonBoxScore(season,{
    ...game,stage:'final',result:{...report,scores},
  });
  return box?{...box,stage:'COMMISSIONER ONLY · NOT RELEASED',
    label:game.label||'PRIVATE GAME FILE REVIEW'}:null;
}
// The preseason seeding is generated from the draft. Never connect a report
// to a different opponent or conflicting score simply because its round matches.
export function reportForBracketMatch(match,reports=preseasonGames){
  if(!match?.winner||!match.high||!match.low)return null;
  return reports.find(report=>{
    if(report.round!==match.round)return false;
    if(report.matchKey&&report.matchKey!==match.key)return false;
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
export function unmatchedPreseasonReports(bracket,reports=preseasonGames){
  const attached=new Set(
    (bracket?.rounds||[]).flatMap(round=>round.games||[])
      .map(match=>reportForBracketMatch(match,reports)).filter(Boolean).map(report=>report.gameId),
  );
  return reports.filter(report=>!attached.has(report.gameId));
}

export function bracketScoreOnly(match){
  if(!match?.winner)return null;
  return {
    id:match.key,
    stage:'Preseason',
    label:'ROUND '+match.round,
    teams:[
      {...summarizeTeam(String(match.high.id),match.high.name,match.scoreA,[]),sideLabel:'HIGH SEED'},
      {...summarizeTeam(String(match.low.id),match.low.name,match.scoreB,[]),sideLabel:'LOW SEED'},
    ],
    hasPlayerStats:false,
  };
}
