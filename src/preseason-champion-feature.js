import {preseasonBracket} from './preseason.js';
import {allPreseasonGames,preseasonPlayerStats} from './preseason-game-data.js';

// This feature is derived ONLY from publicly released preseason data.
// Private staged uploads never appear in preseasonReports or preseasonResults.
// Neither a completed bracket without a published final game sheet nor a
// published sheet without the official final result unlocks the feature.
export function preseasonChampionshipFeature(season,players=[]){
  if(!season)return null;
  const bracket=preseasonBracket(season);
  const final=bracket.rounds.find(round=>round.number===4)?.games?.[0];
  if(!final?.winner||!bracket.champion)return null;

  const approvedResult=(season.preseasonResults||[]).some(row=>
    String(row.match_key)===String(final.key) &&
    String(row.team_a)===String(final.high.id) &&
    String(row.team_b)===String(final.low.id) &&
    Number(row.score_a)===final.scoreA &&
    Number(row.score_b)===final.scoreB
  );
  const published=(season.preseasonReports||[]).find(report=>
    report.matchKey===final.key && report.gameId &&
    Array.isArray(report.players) && report.players.length>0 &&
    String(report.away)===String(final.high.name) &&
    String(report.home)===String(final.low.name) &&
    Number(report.awayScore)===final.scoreA &&
    Number(report.homeScore)===final.scoreB
  );
  if(!approvedResult||!published)return null;

  const names=new Map(players.map(p=>[String(p.id),p.name]));
  const champion=bracket.champion;
  const games=allPreseasonGames(season);
  const leaders=preseasonPlayerStats(games)
    .filter(row=>row.teamName===champion.name &&
      Number(row.stats?.gamesPlayed)>0 && Number.isFinite(Number(row.stats?.agp)))
    .map(row=>({
      playerId:Number(row.playerId),
      name:names.get(String(row.playerId))||row.playerName||'Player '+row.playerId,
      agp:Number(row.stats.agp),
      gamesPlayed:Number(row.stats.gamesPlayed),
      totalGamePoints:Number(row.stats.tgp||0),
    }))
    .sort((a,b)=>b.agp-a.agp||b.totalGamePoints-a.totalGamePoints||
      b.gamesPlayed-a.gamesPlayed||a.name.localeCompare(b.name))
    .slice(0,3);
  const releasedResult=(season.preseasonResults||[]).find(row=>
    String(row.match_key)===String(final.key));
  return {
    seasonId:season.id,seasonName:season.name||'Season 1',
    champion,final,topPlayers:leaders,
    at:releasedResult?.recorded_at||null,
  };
}

// The owner has designated this S1 championship as a permanent homepage
// feature. Future tournament winners will not automatically replace it.
export function seasonOneChampionship(seasons,players=[]){
  const season=(seasons||[]).find(s=>Number(s?.number)===1||
    /^season\s*1(?:\b|$)/i.test(String(s?.name||'')));
  return preseasonChampionshipFeature(season,players);
}
