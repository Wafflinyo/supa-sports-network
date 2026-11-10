// Trophy awards are permanently owned by the franchise that received them.
// The commissioner can review every team's cabinet; GMs use only their own team.
export function trophiesForTeam(cabinet=[],teamId){
 if(teamId==null)return [];
 return (cabinet||[]).filter(award=>String(award.team)===String(teamId));
}

export function trophyCabinetTeams(currentTeams=[],cabinet=[]){
 const teamMap=new Map();
 for(const team of currentTeams||[]){
  if(team?.id==null)continue;
  teamMap.set(String(team.id),{
   id:team.id,name:team.name||'Unnamed franchise',conference:team.conference,
   current:true
  });
 }
 // An award survives a new season even if its original franchise is no
 // longer in the active team list. Include archived franchises for inspection.
 for(const award of cabinet||[]){
  if(award?.team==null)continue;
  const key=String(award.team);
  if(teamMap.has(key))continue;
  teamMap.set(key,{
   id:award.team,name:award.teamName||'Former franchise',conference:award.conference,
   current:false
  });
 }
 return [...teamMap.values()].map(team=>({
  ...team,awards:trophiesForTeam(cabinet,team.id).length
 })).sort((a,b)=>a.name.localeCompare(b.name));
}
