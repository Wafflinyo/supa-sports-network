import React from 'react';

export {groupScheduleWeeks,firstExpandedWeek} from './schedule-week-grouping.js';

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
  const [open,setOpen]=React.useState(initiallyOpen);
  return <details className="ssl-collapsible-week" data-week-key={group.key} open={open}
    onToggle={event=>setOpen(event.currentTarget.open)}>
    <summary className="schedule-week-heading">
      <span>{group.label}</span>
      <small>· {group.games.length} {group.games.length===1?'MATCHUP':'MATCHUPS'}</small>
    </summary>
    <div className="ssl-week-games">{children}</div>
  </details>;
}
