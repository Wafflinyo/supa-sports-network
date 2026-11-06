// Preserve the schedule's existing chronological order while presenting each
// week as one independently collapsible section across the league site.
export function groupScheduleWeeks(games=[]) {
  const groups=[];
  const byKey=new Map();
  for(const game of games) {
    const validWeek=Number.isInteger(Number(game.week))&&Number(game.week)>0;
    const phase=String(game.phase||'regular');
    const week=validWeek?String(game.week):null;
    const key=phase+':'+(week||'other');
    let group=byKey.get(key);
    if(!group) {
      group={key,label:week?'WEEK '+week:['playoffs','postseason'].includes(phase)?'POSTSEASON GAMES':'OTHER MATCHUPS',games:[]};
      byKey.set(key,group);
      groups.push(group);
    }
    group.games.push(game);
  }
  return groups;
}

export function firstExpandedWeek(groups,isActive=game=>!['final','cancelled'].includes(game.stage)) {
  return groups.find(group=>group.games.some(isActive))?.key||groups[0]?.key||null;
}

