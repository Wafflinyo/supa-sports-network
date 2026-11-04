import React,{useState} from 'react';
import {homeWeekBoard} from './home-dashboard-data.js';
function Box({title,children}){return <section className="panel season-box"><h2>{title}</h2>{children}</section>}
export function SeasonCalendar({league:l}){
  const s=l.season;
  if(!s)return null;
  const board=homeWeekBoard(s);
  return <Box title="SEASON WEEKLY SCHEDULE">
    <p><strong>22 weeks · 22 games per team · 132 regular-season games</strong></p>
    <p>Every team plays each opponent home and away. All six games in a week are released individually after the commissioner reviews their reports. When the final result is public, Upcoming Matches automatically shows the next week.</p>
    <p><strong>{board.week!=null?'CURRENT UPCOMING WEEK: '+board.week:'No pending regular-season weeks'}</strong> · Game dates and times are not used.</p>
    <p>All-Star break: after Week 11. Regular-season trades close after Week 12. Championship extensions have their own one-month contract window.</p>
    <p><strong>Trades: {s.tradingOpen?'OPEN':'CLOSED'}</strong> · <strong>Extensions: {s.extensionsOpen?'OPEN':'CLOSED'}</strong></p>
  </Box>;
}
export function NextSeason({league:l}){
  const [value,setValue]=useState('');
  if(l.access.role!=='commissioner')return null;
  if((l.seasons||[]).length){
    const s=l.seasons[0];
    return <Box title="SEASON TRANSITIONS">
      <p>{s.status==='offseason'
        ?s.name+' is in OFFSEASON. The previous season is archived in SSL History. Prepare teams, transactions, the lottery and the new draft here.'
        :'SSL automatically moves from the draft into Preseason, from the released preseason championship into Regular Season, and from the last regular-season result into Postseason. Once the championship extension period ends, the completed season is archived and the next season begins in Offseason.'}</p>
    </Box>;
  }
  return <Box title="SET UP FIRST SEASON">
    <form className="season-form" onSubmit={async e=>{e.preventDefault();if(await l.act('create',{name:value||'Season 1'}))setValue('')}}>
      <label>Season name<input value={value} maxLength={60} placeholder="Season 1" onChange={e=>setValue(e.target.value)}/></label>
      <button className="red-btn" disabled={l.busy}>SET UP SEASON</button>
    </form>
  </Box>;
}
export function ScheduleGenerator({league:l}){
  const s=l.season;
  if(!s||s.status!=='preseason'||l.access.role!=='commissioner')return null;
  const regular=(s.games||[]).filter(g=>g.phase==='regular');
  return <Box title="GENERATE 22-WEEK REGULAR-SEASON MATCHUPS">
    <p>Generate all <strong>132 matchups, six per week</strong>, with each franchise playing all 11 opponents twice (home and away). No game dates or times are used.</p>
    <button type="button" className="red-btn" disabled={l.busy} onClick={()=>{
      if(!regular.length||confirm('Replace the unplayed 22-week schedule? Existing submitted game lineups will be lost.'))l.act('generate_schedule',{});
    }}>{regular.length?'REGENERATE 22-WEEK MATCHUPS':'GENERATE 22-WEEK MATCHUPS'}</button>
    {regular.length>0&&<p role="status"><strong>{regular.length} matchups generated.</strong> Publish them publicly whenever ready. Private uploads and results stay hidden until official release.</p>}
  </Box>;
}
