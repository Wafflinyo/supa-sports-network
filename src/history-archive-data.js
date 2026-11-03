import {aggregate,standings} from './season-data.js';
import {gamePointsForReport} from './game-points.js';
import {sslSeasonNumber} from './preseason-season-identity.js';

// History is public and read-only: commissioner-staged uploads are not an
// archive record until the official release action changes stage to final.
export function historyPublicGames(season){
  return (season?.games||[]).filter(g=>g.stage==='final' && g.result?.scores);
}
export function historySeasonGames(season,phase='all'){
  return historyPublicGames(season).filter(g=>phase==='all'||
    (phase==='regular'?g.phase==='regular':['playoffs','postseason'].includes(g.phase)));
}
export function historySeasons(seasons){
  return [...(seasons||[])].sort((a,b)=>{
    const na=sslSeasonNumber(a),nb=sslSeasonNumber(b);
    if(na!==null&&nb!==null&&na!==nb)return nb-na;
    if(na!==null&&nb===null)return -1;
    if(nb!==null&&na===null)return 1;
    const ad=Date.parse(a.createdAt||a.startsAt||'');
    const bd=Date.parse(b.createdAt||b.startsAt||'');
    return (Number.isFinite(bd)?bd:0)-(Number.isFinite(ad)?ad:0);
  });
}
const cleanForAggregation=(season,phase)=>({...season,games:historySeasonGames(season,phase)
  .filter(g=>Array.isArray(g.result?.players))});
export function historyPlayerStats(season,phase='regular'){
  return aggregate(cleanForAggregation(season,phase));
}
export function historyRegularStandings(season){
  return standings({...season,games:historySeasonGames(season,'regular')});
}
const numeric=(n)=>Number.isFinite(Number(n))?Number(n):0;
const rounded=n=>Math.round((n+Number.EPSILON)*100)/100;
export function historyTeamStats(season,phase='regular'){
  const games=historySeasonGames(season,phase);
  const table=new Map(historyRegularStandings(season).map(t=>[String(t.id),t]));
  return (season?.teams||[]).map(team=>{
    const played=games.filter(g=>[g.away,g.home].some(id=>String(id)===String(team.id)));
    const totals={hits:0,homeRuns:0,rbi:0,pitchStrikeouts:0,ogp:0,dgp:0,pgp:0,tgp:0,itemScore:0};
    let wins=0,losses=0,rf=0,ra=0,shutouts=0;
    for(const game of played){
      const our=game.result.scores[team.id];
      const otherId=String(game.away)===String(team.id)?game.home:game.away;
      const other=game.result.scores[otherId];
      rf+=numeric(our);ra+=numeric(other);
      if(numeric(our)>numeric(other))wins++;else if(numeric(our)<numeric(other))losses++;
      if(numeric(our)>numeric(other)&&numeric(other)===0)shutouts++;
      for(const player of game.result.players||[]){
        if(String(player.team)!==String(team.id))continue;
        for(const stat of ['hits','homeRuns','rbi','pitchStrikeouts'])
          totals[stat]+=numeric(player.stats?.[stat]);
        const points=gamePointsForReport(player);
        for(const stat of ['ogp','dgp','pgp','tgp'])totals[stat]+=numeric(points[stat]);
        totals.itemScore+=numeric(player.itemScore??player.stats?.itemScore);
      }
    }
    for(const field of Object.keys(totals))totals[field]=rounded(totals[field]);
    const standingsRecord=table.get(String(team.id));
    return {id:team.id,name:team.name,conference:team.conference,
      gp:played.length,wins,losses,runsFor:rf,runsAgainst:ra,shutouts,
      homeWins:standingsRecord?.homeWins||0,homeLosses:standingsRecord?.homeLosses||0,
      awayWins:standingsRecord?.awayWins||0,awayLosses:standingsRecord?.awayLosses||0,
      totals,agp:played.length?rounded(totals.tgp/played.length):null};
  });
}
export function historyOverview(season){
  const finals=historyPublicGames(season);
  const regular=historySeasonGames(season,'regular');
  const postseason=historySeasonGames(season,'playoffs');
  return {finals:finals.length,regular:regular.length,playoffs:postseason.length,
    teams:(season?.teams||[]).length,draftPicks:(season?.picks||[]).length,
    trades:(season?.transactions||[]).length};
}
export function historyTradeGroups(season,trade,players=[]){
  const byId=new Map(players.map(p=>[String(p.id),p.name]));
  const teamName=id=>season?.teams?.find(t=>String(t.id)===String(id))?.name||'Unknown franchise';
  const byReceiver=new Map();
  for(const move of trade?.body?.moves||[]){
    const id=String(move.to||'');
    if(!id)continue;
    const list=byReceiver.get(id)||[];
    let label='';
    if(move.kind==='player')label=byId.get(String(move.id))||'Player #'+move.id;
    else if(move.kind==='pick'){
      const pick=(season?.pickAssets||[]).find(p=>String(p.id)===String(move.id));
      label='Season '+(season?.tradePickSeason||Number(season?.number||0)+1)+
        ' · Round '+(pick?.round||'?')+' draft pick';
      if(pick?.originalTeam)label+=' (originally '+teamName(pick.originalTeam)+')';
    }else if(move.kind==='coin')label='Legacy coin transfer';
    else label='Transferred asset';
    list.push({kind:move.kind,label,from:teamName(move.from)});
    byReceiver.set(id,list);
  }
  return [...byReceiver].map(([id,assets])=>({teamId:id,teamName:teamName(id),assets}));
}
export function historySchedule(season){
  return [...(season?.games||[])].map(game=>{
    if(game.stage==='final'&&game.result?.scores)return game;
    // Never allow an internal private report to leak through the archive.
    const {result,...rest}=game;
    return rest;
  }).sort((a,b)=>{
    const pa=a.phase==='regular'?0:1,pb=b.phase==='regular'?0:1;
    const wa=Number(a.week||999),wb=Number(b.week||999);
    const ta=Date.parse(a.startsAt||''),tb=Date.parse(b.startsAt||'');
    return pa-pb||wa-wb||(Number.isFinite(ta)?ta:0)-(Number.isFinite(tb)?tb:0)||
      String(a.id).localeCompare(String(b.id));
  });
}
