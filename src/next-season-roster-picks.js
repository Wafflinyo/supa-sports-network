// Pick ownership is already maintained by the league server and changed by
// approved trades. This view MUST not reconstruct holdings from draft rounds
// or imply an unissued Stadium Pick exists.
const same=(a,b)=>String(a)===String(b);
const roundNumber=value=>{
  const number=Number(value);
  return Number.isInteger(number)&&number>0?number:null;
};
export function nextSeasonPickSummary(season,teamId){
  const picks=Array.isArray(season?.pickAssets)?season.pickAssets:[];
  const teams=season?.teams||[];
  const teamName=id=>teams.find(t=>same(t.id,id))?.name||'Unknown team';
  const owned=picks.filter(p=>same(p.owner,teamId)&&p.owner!=null).sort((a,b)=>
    (roundNumber(a.round)??999)-(roundNumber(b.round)??999) ||
    teamName(a.originalTeam).localeCompare(teamName(b.originalTeam)) ||
    String(a.id).localeCompare(String(b.id)));
  const tradedAway=picks.filter(p=>
    p.originalTeam!=null&&same(p.originalTeam,teamId)&&!same(p.owner,teamId)
  ).sort((a,b)=>(roundNumber(a.round)??999)-(roundNumber(b.round)??999)||
    teamName(a.owner).localeCompare(teamName(b.owner)));
  return {
    nextSeason:Number.isInteger(Number(season?.tradePickSeason))&&Number(season.tradePickSeason)>0
      ?Number(season.tradePickSeason):Number(season?.number||0)+1,
    available:Array.isArray(season?.pickAssets),
    owned:owned.map(p=>({...p,originName:teamName(p.originalTeam),
      acquired:p.originalTeam!=null&&!same(p.originalTeam,teamId),
      displayRound:roundNumber(p.round)??'?'})),
    tradedAway:tradedAway.map(p=>({...p,currentOwnerName:teamName(p.owner),
      displayRound:roundNumber(p.round)??'?'})),
  };
}
