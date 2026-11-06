import React from 'react';

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
      group={key,label:week?'WEEK '+week:phase==='playoffs'?'PLAYOFF GAMES':'OTHER MATCHUPS',games:[]};
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

export function ScheduleWeekControls({containerRef}) {
  const toggleAll=(open)=>{
    containerRef.current?.querySelectorAll('details.ssl-collapsible-week').forEach(week=>{week.open=open});
  };
  return <div className="ssl-week-actions" role="group" aria-label="Schedule week display">
    <button type="button" className="outline-btn" onClick={()=>toggleAll(true)}>EXPAND ALL WEEKS</button>
    <button type="button" className="outline-btn" onClick={()=>toggleAll(false)}>COLLAPSE ALL WEEKS</button>
  </div>;
}

export function ScheduleWeekGroup({group,initiallyOpen=false,children}) {
  return <details className="ssl-collapsible-week" data-week-key={group.key} defaultOpen={initiallyOpen}>
    <summary className="schedule-week-heading">
      <span>{group.label}</span>
      <small>· {group.games.length} {group.games.length===1?'MATCHUP':'MATCHUPS'}</small>
    </summary>
    <div className="ssl-week-games">{children}</div>
  </details>;
}
