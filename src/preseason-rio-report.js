import {buildReport,automaticReportMvp,readRio} from './season-data.js';
import {gamePointComponents} from './game-points.js';

// Draft selections preserve the preseason roster even after later trades.
// Fall back to current rosters if a historical season lacks saved draft picks.
export function preseasonDraftRosters(season,match){
  const ids=[String(match.high.id),String(match.low.id)];
  const byTeam={};
  for(const id of ids){
    const drafted=(season?.picks||[])
      .filter(p=>p.kind==='player'&&String(p.team)===id)
      .map(p=>Number(p.player)).filter(Number.isInteger);
    const current=(season?.rosters||{})[id]||[];
    byTeam[id]=drafted.length>=9?[...new Set(drafted)]:current;
  }
  return byTeam;
}
export function preseasonFakeGame(season,match){
  const roster=preseasonDraftRosters(season,match);
  return {away:match.high.id,home:match.low.id,
    frozenRosters:roster,stage:'scheduled',id:'preseason:'+match.key};
}
export async function readPreseasonRio(file,season,match,players){
  const fake=preseasonFakeGame(season,match);
  return readRio(file,{...season,rosters:fake.frozenRosters},fake,players);
}
const round2=x=>Math.round((Number(x||0)+Number.EPSILON)*100)/100;
export function makePreseasonReport(preview,season,match,players){
  if(!preview||preview.rows.some(r=>!r.chosen)||preview.pitch.some(r=>!r.chosen))
    throw Error('Match every batter and pitcher to an SSL player before saving.');
  const mvp=automaticReportMvp(preview,match.high.name);
  if(!mvp)throw Error('The game must have a winning team and an identified MVP.');
  const fake=preseasonFakeGame(season,match);
  const raw=buildReport(preview,match.high.name,
    {...season,rosters:fake.frozenRosters},fake,players,mvp);
  const ids=[String(match.high.id),String(match.low.id)];
  const scores=Object.fromEntries(ids.map(id=>[id,raw.players
    .filter(p=>String(p.team)===id).reduce((n,p)=>n+Number(p.stats?.runs||0),0)]));
  if(!Number.isInteger(scores[ids[0]])||!Number.isInteger(scores[ids[1]])||
    scores[ids[0]]===scores[ids[1]])throw Error('Confirm the final runs; preseason cannot end in a tie.');
  const fields=[...new Set(raw.players.flatMap(p=>Object.keys(p.stats||{})).concat(['itemScore']))];
  const compactPlayers=raw.players.map(p=>{
    const values={...p.stats,itemScore:Number(p.itemScore||0)};
    return [Number(p.player),String(p.team)===ids[1],
      (p.positions||[]).join(', '),Object.fromEntries(
        Object.entries(values).filter(([,v])=>typeof v==='number'&&Number.isFinite(v))
          .map(([key,v])=>[fields.indexOf(key),v]))];
  });
  const compact={
    gameId:'rio:'+String(season.id)+':'+match.key,
    round:match.round,matchKey:match.key,
    away:match.high.name,home:match.low.name,
    awayScore:scores[ids[0]],homeScore:scores[ids[1]],
    mvp:Number(mvp),fields,players:compactPlayers,
  };
  return {
    schema:1,matchKey:match.key,teamA:ids[0],teamB:ids[1],
    scoreA:scores[ids[0]],scoreB:scores[ids[1]],
    filename:raw.filename,fingerprint:raw.fingerprint,
    players:raw.players,compact,
  };
}
export function preseasonPreviewBox(season,match,report){
  if(!report)return null;
  // Use the same official player-by-player box score renderer as regular games.
  const players=report.players.map(p=>({...p,
    gameScore:round2(p.gameScore),
    points:gamePointComponents(p.stats,p.shutoutBonus)}));
  return {id:'private:'+match.key,stage:'Preseason · UNRELEASED',label:'COMMISSIONER-ONLY PREVIEW',
    teams:[{
      key:String(match.high.id),name:match.high.name,score:report.scoreA,
      players:players.filter(p=>String(p.team)===String(match.high.id))
        .map(p=>({playerId:p.player,name:p.playerName||String(p.player),positions:p.positions,
          stats:p.stats,points:{...p.points,tgp:p.gameScore}})),
      totalGamePoints:round2(players.filter(p=>String(p.team)===String(match.high.id))
        .reduce((s,p)=>s+Number(p.gameScore||0),0)),
    },{
      key:String(match.low.id),name:match.low.name,score:report.scoreB,
      players:players.filter(p=>String(p.team)===String(match.low.id))
        .map(p=>({playerId:p.player,name:p.playerName||String(p.player),positions:p.positions,
          stats:p.stats,points:{...p.points,tgp:p.gameScore}})),
      totalGamePoints:round2(players.filter(p=>String(p.team)===String(match.low.id))
        .reduce((s,p)=>s+Number(p.gameScore||0),0)),
    }],
    hasPlayerStats:true,
  };
}
