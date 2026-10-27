/**
 * The pick-times summary follows the lottery's official Round 1 order ONLY
 * after the live show is fully revealed. The server saves the entire draw
 * before the first ball animation, so never sort prematurely and spoil it.
 *
 * During personal replay, keep the board in the already-revealed official
 * order; replay never changes the original saved picks or lottery results.
 */
export function orderedDraftPickTeams(season,lotteryFullyRevealed=false) {
  const teams=season?.teams||[];
  const registration=teams.map(team=>({team,lotteryPosition:null}));
  const order=season?.order;
  if(!lotteryFullyRevealed||!Array.isArray(order)||order.length!==12||
    teams.length!==12)return registration;
  const byId=new Map(teams.map(team=>[String(team.id),team]));
  const uniqueIds=new Set(order.map(String));
  if(uniqueIds.size!==12||order.some(id=>!byId.has(String(id))))return registration;
  return order.map((id,index)=>({team:byId.get(String(id)),lotteryPosition:index+1}));
}
