import {buildReport,automaticReportMvp,readRio} from './season-data.js';
import {gamePointsForReport} from './game-points.js';
import roster from './players.json' with {type:'json'};
const playerNames=new Map(roster.map(p=>[Number(p.id),p.name]));

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
    mvp:Number(mvp),fields,players:compactPlayers,innings:raw.innings,
  };
  return {
    schema:1,seasonId:String(season.id),matchKey:match.key,teamA:ids[0],teamB:ids[1],
    scoreA:scores[ids[0]],scoreB:scores[ids[1]],
    filename:raw.filename,fingerprint:raw.fingerprint,
    players:raw.players,innings:raw.innings,compact,
  };
}
export function preseasonPreviewBox(season,match,report){
  if(!report)return null;
  const players=report.players.map(p=>{
    const stats={...p.stats,shutoutBonus:Number(p.shutoutBonus||0)};
    const points=gamePointsForReport({...p,stats});
    return {
      playerId:Number(p.player),name:playerNames.get(Number(p.player))||String(p.player),
      teamKey:String(p.team),positions:(p.positions||[]).join(', '),
      stats,points,
      itemScore:Number(p.itemScore||0),mvp:Number(stats.mvps||0)>0,
    };
  });
  const teams=[match.high,match.low];
  const scores=[report.scoreA,report.scoreB];
  return {
    id:'private:'+match.key,
    stage:'Preseason · PRIVATE PREVIEW',
    label:'COMMISSIONER ONLY · UNRELEASED',
    teams:teams.map((team,index)=>{
      const people=players.filter(p=>p.teamKey===String(team.id));
      return {
        key:String(team.id),name:team.name,score:scores[index],
        players:people,hits:people.reduce((s,p)=>s+Number(p.stats.hits||0),0),
        totalGamePoints:round2(people.reduce((s,p)=>s+Number(p.points.tgp||0),0)),
      };
    }),
    innings:report.innings||report.compact?.innings||null,
    hasPlayerStats:true,
  };
}
