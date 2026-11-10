import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Award,CheckCircle2,LockKeyhole,Search,Trophy,X} from 'lucide-react';
import {PlayerPortrait} from './PlayerPortrait.jsx';
import {trophiesForTeam,trophyCabinetTeams} from './trophy-cabinets.js';
import {ConferenceMark} from './ConferenceMark.jsx';
import {
  potwTrophyUrl,potwPlayer,potwWeekLabel,potwDate,potwRounds,potwLeaderboard,
  potwExtraFields,potwSort,potwStatName,potwStatValue,
  potwConferenceName,potwConferenceLabel
} from './player-of-the-week.js';
import './potw.css';
import './conference-potw.css';

const conferences=['supa','galaxy'];
const rounded=n=>Math.round((Number(n)||0)*100)/100;
const score=(n,key)=>!Number.isFinite(Number(n))?'—':
  ['battingAverage','onBase','slug','onBasePlusSlug','era7','era9','whip','baAgainst','obAgainst']
   .includes(key)?Number(n).toFixed(3):Number(n).toFixed(2);
export function ConferenceTrophy({conference='supa',className=''}) {
 return <img className={'potw-trophy '+className} src={potwTrophyUrl(conference)}
   alt={potwConferenceName(conference)+' trophy'} loading="lazy"/>;
}
function PlayerName({id,team,small=false}){
 const player=potwPlayer(id);
 return <span className={'potw-person'+(small?' potw-person-small':'')}>
   <PlayerPortrait player={player} size={small?34:45}/>
   <span><strong>{player?.name||'Player '+id}</strong><small>{team||'SSL Team'}</small></span>
 </span>;
}
export function PotwCommissioner({league:l}){
 const s=l.season;
 const periods=useMemo(()=>potwRounds(s),[s]);
 const [roundNo,setRoundNo]=useState(1),[conference,setConference]=useState('supa');
 const [chosen,setChosen]=useState({supa:null,galaxy:null});
 const [view,setView]=useState('Averages per Game');
 const [sort,setSort]=useState({key:'agp',dir:'desc'});
 const [search,setSearch]=useState('');
 const [message,setMessage]=useState('');
 const [working,setWorking]=useState(false);
 const [detailsOpen,setDetailsOpen]=useState(true);
 const current=periods.find(x=>x.roundNo===roundNo)||periods[0];
 const actual=current?.roundNo||1;
 const oldAwards=(l.potw?.conferenceAwards||[]).filter(a=>a.roundNo===actual);
 const issued=oldAwards.length>0;
 const rows=useMemo(()=>potwLeaderboard(s,actual),[s,actual]);
 const conferenceRows=useMemo(()=>rows.filter(r=>r.conference===conference),[rows,conference]);
 const extras=useMemo(()=>potwExtraFields(conferenceRows),[conferenceRows]);
 const columns=useMemo(()=>[
  [view==='Totals'?'tgp':'agp',view==='Totals'?'TGP':'AGP'],
  ['ogp',view==='Totals'?'OGP':'OGP / G'],
  ['dgp',view==='Totals'?'DGP':'DGP / G'],
  ['pgp',view==='Totals'?'PGP':'PGP / G'],
  ['gamesPlayed','GP'],
  ...extras.map(key=>[key,potwStatName(key)])
 ],[view,extras]);
 const shown=useMemo(()=>potwSort(conferenceRows,sort.key,view,sort.dir).filter(
    row=>!search.trim()||(row.name+' '+row.teamName).toLowerCase().includes(search.trim().toLowerCase())),
  [conferenceRows,sort,view,search]);
 const picks=conferences.map(conf=>rows.find(p=>p.id===chosen[conf]&&p.conference===conf));
 const eligible=current?.complete&&!issued&&picks.every(Boolean);
 useEffect(()=>{setChosen({supa:null,galaxy:null});setMessage('');setConference('supa');},
   [s?.id,actual]);
 async function issueAwards(){
  if(working||!eligible||!l.supabase||!s)return;
  setWorking(true);setMessage('');
  try{
   const choices=Object.fromEntries(conferences.map((conf,i)=>{
    const row=picks[i],gp=row.gamesPlayed;
    return [conf,{player:row.id,metrics:{
      gamesPlayed:gp,agp:rounded(row.stats.tgp/gp),
      ogp:rounded(row.stats.ogp/gp),dgp:rounded(row.stats.dgp/gp),
      pgp:rounded(row.stats.pgp/gp)
    }}];
   }));
   const {error}=await l.supabase.rpc('ssl_conference_potw_award',{
     target_season:s.id,target_round:actual,choices
   });
   if(error)throw error;
   await l.refresh();
   setMessage('Both conference awards are official. Trophies were assigned to each winner’s team, and the two-player conference headline is published.');
  }catch(e){setMessage(e.message||String(e));}finally{setWorking(false);}
 }
 if(l.access.role!=='commissioner')return null;
 return <section className="potw-admin">
   <div className="potw-feature-heading">
     <div className="potw-dual-trophies">
       <ConferenceTrophy conference="supa"/><ConferenceTrophy conference="galaxy"/>
     </div>
     <div><span className="eyebrow dark">SSL OFFICIAL CONFERENCE HONORS</span>
       <h2>CONFERENCE PLAYERS OF THE WEEK</h2>
       <p>Every two completed weeks, select one winner from the Supa Mario Conference and one from Mario Galaxy. No voting. Both awards and the headline publish together.</p>
     </div>
   </div>
   {!s?<p className="panel potw-message">Create an SSL season before issuing awards.</p>:
   !periods.length?<p className="panel potw-message">Generate the regular-season schedule before issuing awards.</p>:<>
   <section className="panel potw-config">
     <div className="potw-config-row">
       <label>AWARD PERIOD
         <select value={actual} onChange={e=>{setRoundNo(Number(e.target.value));setSort({key:'agp',dir:'desc'});}}>
           {periods.map(p=><option key={p.roundNo} value={p.roundNo}>{potwWeekLabel(p.roundNo)} · {p.finished}/{p.total} games released</option>)}
         </select>
       </label>
       <div className="potw-round-status">
         <strong>{issued?'BOTH AWARDS ISSUED':current.complete?'READY TO AWARD':(current.total-current.finished)+' GAMES REMAIN'}</strong>
         <span>{current.finished} / {current.total} completed games · {potwWeekLabel(actual)}</span>
       </div>
     </div>
     {!current.complete&&<p className="potw-quiet-note"><LockKeyhole size={16}/>
       The commissioner can review the leaderboard now, but the awards cannot be issued until both weeks have fully released results.</p>}
     {issued?<div className="potw-award-selection">
       {conferences.map(conf=>{
         const a=oldAwards.find(x=>x.conference===conf);
         return <div key={conf} className={'potw-choice-card potw-choice-'+conf}>
           <ConferenceTrophy conference={conf}/>
           <strong>{potwConferenceName(conf)}</strong>
           {a&&<><PlayerName id={a.player} team={a.teamName}/><small>Received {potwDate(a.awardedAt)}</small></>}
         </div>;
       })}
     </div>:<>
       <div className="potw-award-selection">
         {conferences.map(conf=>{
           const row=rows.find(x=>x.conference===conf&&x.id===chosen[conf]);
           return <button key={conf} type="button"
             className={'potw-choice-card potw-choice-'+conf+(conference===conf?' is-active':'')}
             onClick={()=>{setConference(conf);setSearch('');setSort({key:view==='Totals'?'tgp':'agp',dir:'desc'});}}>
             <ConferenceTrophy conference={conf}/>
             <strong>{potwConferenceName(conf)}</strong>
             {row?<PlayerName id={row.id} team={row.teamName}/>:<span>SELECT A PLAYER</span>}
             <small>{conference===conf?'Currently viewing this conference':'Show this conference’s players'}</small>
           </button>;
         })}
       </div>
       <div className="potw-admin-actions">
         <p>Choose exactly one winner in each conference and submit both together. The issued date is the day the award is actually submitted.</p>
         <button type="button" className="red-btn" disabled={!eligible||working} onClick={issueAwards}>
           {working?'ISSUING AWARDS…':'ISSUE BOTH CONFERENCE AWARDS & PUBLISH HEADLINE'}
         </button>
       </div>
     </>}
     {message&&<p role="status" className="potw-message">{message}</p>}
   </section>
   <section className="panel potw-leaderboard">
     <button className="potw-leaderboard-toggle" type="button" onClick={()=>setDetailsOpen(x=>!x)} aria-expanded={detailsOpen}>
       <span>{potwConferenceLabel(conference).toUpperCase()} · PLAYER LEADERBOARD</span>
       <small>{detailsOpen?'HIDE':'SHOW'} STATS</small>
     </button>
     {detailsOpen&&<>
       <div className="potw-leaderboard-controls">
         <div className="stat-view-switch" role="group" aria-label="Award statistical view">
           {['Totals','Averages per Game'].map(v=><button key={v} type="button" className={v===view?'active':''}
             aria-pressed={v===view} onClick={()=>{setView(v);setSort({key:v==='Totals'?'tgp':'agp',dir:'desc'});}}>
             {v}
           </button>)}
         </div>
         <label className="potw-search"><Search size={17}/><input value={search}
           onChange={e=>setSearch(e.target.value)} placeholder="Search this conference"
           aria-label="Search conference players"/></label>
       </div>
       <p className="potw-quiet-note">Only {potwConferenceLabel(conference)} players are shown. The default rank is highest AGP. Click any stat to rank by that column. Only released games from {potwWeekLabel(actual)} count.</p>
       <div className="potw-table-wrap"><table className="potw-table">
         <thead><tr>
           <th>SELECT</th><th>PLAYER / TEAM</th>
           {columns.map(([key,label])=><th key={key} aria-sort={sort.key===key?(sort.dir==='asc'?'ascending':'descending'):'none'}>
             <button type="button" onClick={()=>setSort(old=>({key,dir:old.key===key&&old.dir==='desc'?'asc':'desc'}))}>
               {label}<span aria-hidden="true">{sort.key===key?(sort.dir==='asc'?' ▲':' ▼'):' ↕'}</span>
             </button>
           </th>)}
         </tr></thead>
         <tbody>{shown.map((row,index)=><tr key={row.id} className={chosen[conference]===row.id?'potw-row-selected':''}>
           <td><label className="potw-select">
             <input type="radio" name={'potw-winner-'+actual+'-'+conference}
               checked={chosen[conference]===row.id} disabled={issued||!current.complete}
               onChange={()=>setChosen(prev=>({...prev,[conference]:row.id}))}/>
             <span>{index+1}</span>
           </label></td>
           <td><PlayerName id={row.id} team={row.teamName} small/></td>
           {columns.map(([key])=><td key={key} className="potw-num">{score(potwStatValue(row,key,view),key)}</td>)}
         </tr>)}
         {!shown.length&&<tr><td colSpan={columns.length+2} className="potw-message">No released players in this conference for this period.</td></tr>}
         </tbody>
       </table></div>
     </>}
   </section>
   </>}
 </section>;
}
export function PotwTrophyCabinet({league:l}){
 const commissioner=l.access?.role==='commissioner';
 const mine=l.myTeam;
 const [selectedTeam,setSelectedTeam]=useState('all');
 const [opened,setOpened]=useState(null);
 const triggerRef=useRef(null);
 const cabinet=l.potw?.cabinet||[];
 const allTeams=useMemo(()=>trophyCabinetTeams(l.season?.teams||[],cabinet),
   [l.season?.teams,l.potw?.cabinet]);
 const chosenTeam=commissioner
   ?allTeams.find(team=>String(team.id)===String(selectedTeam))
   :mine;
 const awards=trophiesForTeam(cabinet,chosenTeam?.id);
 const totalAwards=allTeams.reduce((sum,team)=>sum+team.awards,0);
 useEffect(()=>{
   setSelectedTeam('all');
   setOpened(null);
 },[l.season?.id,commissioner]);
 useEffect(()=>{
  if(!opened)return;
  const onKey=e=>{if(e.key==='Escape')setOpened(null);};
  window.addEventListener('keydown',onKey);
  return ()=>window.removeEventListener('keydown',onKey);
 },[opened]);
 useEffect(()=>{
  if(!opened&&triggerRef.current){triggerRef.current.focus();triggerRef.current=null;}
 },[opened]);
 const viewTeam=id=>{
   triggerRef.current=null;
   setOpened(null);
   setSelectedTeam(String(id));
 };
 return <section className="potw-cabinet panel">
   <div className="potw-cabinet-heading"><Trophy size={30}/><div>
     <span className="eyebrow dark">OFFICIAL SSL FRANCHISE HONORS</span>
     <h2>{commissioner?'ALL TEAM TROPHY CABINETS':'TROPHY CABINET'}</h2>
     <p>{commissioner&&selectedTeam==='all'
        ?allTeams.length+' franchises · '+totalAwards+' official conference awards across seasons'
        :(chosenTeam?.name||'Your franchise')+' · '+awards.length+
          ' conference award'+(awards.length===1?'':'s')}</p>
   </div></div>
   {commissioner&&<div className="potw-cabinet-commissioner-nav">
     <label htmlFor="commissioner-trophy-team">VIEW FRANCHISE CABINET
       <select id="commissioner-trophy-team" value={selectedTeam}
         onChange={e=>viewTeam(e.target.value)}>
         <option value="all">All teams ({allTeams.length})</option>
         {allTeams.map(team=><option key={team.id} value={String(team.id)}>
           {team.name} ({team.awards})
         </option>)}
       </select>
     </label>
     {selectedTeam!=='all'&&<button type="button" className="outline-btn"
       onClick={()=>viewTeam('all')}>BACK TO ALL TEAMS</button>}
   </div>}
   {commissioner&&selectedTeam==='all'&&(
     allTeams.length?<div className="potw-cabinet-team-overview" aria-label="All team trophy cabinets">
       {allTeams.map(team=><button type="button" key={team.id}
         className="potw-cabinet-team-button" onClick={()=>viewTeam(team.id)}
         aria-label={'View '+team.name+' trophy cabinet, '+team.awards+' awards'}>
         <span className="potw-cabinet-team-name">{team.name}</span>
         <span className="potw-cabinet-team-awards">
           <Trophy size={19} aria-hidden="true"/>
           <strong>{team.awards}</strong>
           <small>{team.awards===1?'TROPHY':'TROPHIES'}</small>
         </span>
         {!team.current&&<small className="potw-cabinet-archived">ARCHIVED FRANCHISE</small>}
         <span className="potw-cabinet-team-open">VIEW CABINET ›</span>
       </button>)}
     </div>:<p className="potw-cabinet-empty">No league franchises are available yet.</p>
   )}
   {(!commissioner||selectedTeam!=='all')&&<>
     {awards.length?<div className="potw-cabinet-grid">
       {awards.map(a=><button type="button" key={a.id} className="potw-trophy-button"
         aria-label={'View '+(a.awardTitle||potwConferenceName(a.conference))+' for '+potwPlayer(a.player)?.name}
         onClick={e=>{triggerRef.current=e.currentTarget;setOpened(a);}}>
         <ConferenceTrophy conference={a.conference}/>
         <strong>{a.awardTitle||potwConferenceName(a.conference)}</strong>
         <span>{potwWeekLabel(a.roundNo)} · {a.seasonName}</span>
       </button>)}
     </div>:<div className="potw-cabinet-empty">
       <div className="potw-dual-trophies"><ConferenceTrophy conference="supa"/><ConferenceTrophy conference="galaxy"/></div>
       <h3>{commissioner?'NO TROPHIES YET':'YOUR CABINET IS READY'}</h3>
       <p>Conference Players of the Week will appear after the commissioner issues both awards. Each trophy stays with the franchise that owned its player on the award date.</p>
     </div>}
   </>}
   {opened&&<div className="potw-dialog-scrim" onMouseDown={e=>{if(e.target===e.currentTarget)setOpened(null);}}>
      <section className="potw-award-dialog" role="dialog" aria-modal="true" aria-labelledby="potw-award-detail-title">
        <button className="potw-dialog-close" type="button" aria-label="Close award details" onClick={()=>setOpened(null)}><X size={21}/></button>
        <ConferenceTrophy conference={opened.conference}/>
        <div className="potw-award-inscription">
          <p className="potw-inscription-league">— SSL —</p>
          <h2 id="potw-award-detail-title">{opened.awardTitle||potwConferenceName(opened.conference)}</h2>
          <p className="potw-inscription-period">— {potwDate(opened.awardedAt)} · {potwWeekLabel(opened.roundNo)} —</p>
          <strong className="potw-inscription-player">{potwPlayer(opened.player)?.name||'SSL Player'}</strong>
          <p className="potw-inscription-team">— {opened.teamName} —</p>
          <small>{opened.seasonName} · Trophy received on the date shown, owned permanently by this franchise</small>
        </div>
      </section>
    </div>}
 </section>;
}
