import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Award,CheckCircle2,Clock3,LockKeyhole,Search,Trophy,Vote,X} from 'lucide-react';
import {PlayerPortrait} from './PlayerPortrait.jsx';
import {
  potwTrophyUrl,potwPlayer,potwWeekLabel,potwDate,potwDeadline,potwRounds,
  potwLeaderboard,potwExtraFields,potwSort,potwStatName,potwStatValue
} from './player-of-the-week.js';
import './potw.css';

function formatScore(value,key){
 if(!Number.isFinite(Number(value)))return '—';
 const n=Number(value);
 return ['battingAverage','onBase','slug','onBasePlusSlug','starSlug',
 'era7','era9','whip','baAgainst','obAgainst'].includes(key)?n.toFixed(3):
 Number.isInteger(n)?String(n):n.toFixed(2);
}
function Nominee({id,team,small=false}){
 const player=potwPlayer(id);
 return <span className={'potw-person'+(small?' potw-person-small':'')}>
   <PlayerPortrait player={player} size={small?34:43}/>
   <span><strong>{player?.name||'Player '+id}</strong><small>{team||'SSL Team'}</small></span>
 </span>;
}
function TrophyImage({className=''}) {
 return <img className={'potw-trophy '+className} src={potwTrophyUrl()}
  alt="Gold SSL Player of the Week trophy with crossed baseball bats" loading="lazy"/>;
}
export function PotwCommissioner({league:l}){
 const s=l.season;
 const periods=useMemo(()=>potwRounds(s),[s]);
 const [roundNo,setRoundNo]=useState(1);
 const current=periods.find(x=>x.roundNo===roundNo)||periods[0];
 const actual=current?.roundNo||1;
 const persisted=(l.potw?.rounds||[]).find(r=>r.roundNo===actual);
 const [chosen,setChosen]=useState([]);
 const [view,setView]=useState('Averages per Game');
 const [sort,setSort]=useState({key:'agp',dir:'desc'});
 const [search,setSearch]=useState('');
 const [closeAt,setCloseAt]=useState('');
 const [tieWinner,setTieWinner]=useState('');
 const [message,setMessage]=useState('');
 const [working,setWorking]=useState(false);
 const [detailsOpen,setDetailsOpen]=useState(true);
 useEffect(()=>{setChosen((persisted?.nominees||[]).map(n=>Number(n.player)));setMessage('');setTieWinner('');},
  [s?.id,actual,JSON.stringify(persisted?.nominees||[])]);
 const rows=useMemo(()=>potwLeaderboard(s,actual),[s,actual]);
 const extras=useMemo(()=>potwExtraFields(rows),[rows]);
 const columns=useMemo(()=>[
  [view==='Totals'?'tgp':'agp',view==='Totals'?'TGP':'AGP'],
  ['ogp',view==='Totals'?'OGP':'OGP / G'],['dgp',view==='Totals'?'DGP':'DGP / G'],
  ['pgp',view==='Totals'?'PGP':'PGP / G'],['gamesPlayed','GP'],
  ...extras.map(key=>[key,potwStatName(key)])
 ],[view,extras]);
 const shown=useMemo(()=>{
  const words=search.trim().toLowerCase();
  return potwSort(rows,sort.key,view,sort.dir)
   .filter(row=>!words || (row.name+' '+row.teamName).toLowerCase().includes(words));
 },[rows,sort,view,search]);
 const closed=persisted?.status==='open' && Date.now()>=Date.parse(persisted.closesAt||'');
 const totals=persisted?.totals||{};
 const maxVotes=Math.max(0,...Object.values(totals).map(Number));
 const leaders=(persisted?.nominees||[]).filter(n=>Number(totals[n.player]||0)===maxVotes&&maxVotes>0);
 const canManage=l.access.role==='commissioner'&&current?.complete&&persisted?.status!=='final'&&persisted?.status!=='open';
 async function manage(operation,tie=null){
  if(working||!s)return;
  setWorking(true);setMessage('');
  try{
   const deadline=operation==='publish'?(closeAt?new Date(closeAt).toISOString():null):null;
   const {error}=await l.supabase.rpc('ssl_potw_manage',{
     target_season:s.id,target_round:actual,operation,
     selected_players:chosen,close_at:deadline,tie_player:tie
   });
   if(error)throw error;
   await l.refresh();
   setMessage(operation==='publish'?'POTW voting is now public in the Voting tab.':
    operation==='finalize'?'Award finalized. The trophy is now permanently assigned to the winning player’s current team.':
    'Nominees saved privately. Only the commissioner can see this shortlist.');
  }catch(e){setMessage(e.message||String(e));}finally{setWorking(false);}
 }
 if(l.access.role!=='commissioner')return null;
 return <section className="potw-admin">
  <div className="potw-feature-heading">
    <TrophyImage/>
    <div><span className="eyebrow dark">OFFICIAL SSL AWARDS</span>
      <h2>PLAYER OF THE WEEK</h2>
      <p>Every two completed regular-season weeks form one award period. Choose the nominees privately, then publish the ballot for league members.</p></div>
  </div>
  {!s?<p className="panel potw-message">Create a season before managing awards.</p>:
  !periods.length?<p className="panel potw-message">The regular-season schedule has not been generated yet.</p>:<>
  <div className="panel potw-config">
    <div className="potw-config-row">
      <label>AWARD PERIOD
        <select value={actual} onChange={e=>{setRoundNo(Number(e.target.value));setSort({key:'agp',dir:'desc'});}}>
          {periods.map(p=><option value={p.roundNo} key={p.roundNo}>
            {potwWeekLabel(p.roundNo)} · {p.finished}/{p.total} games completed
          </option>)}
        </select>
      </label>
      <div className="potw-round-status">
        <strong>{current.complete?'ALL GAMES RELEASED':(current.total-current.finished)+' GAMES REMAIN'}</strong>
        <span>{current.finished} of {current.total} official games completed · {persisted?.status==='final'?'Award issued':persisted?.status==='open'?'Voting published':persisted?.status==='draft'?'Private shortlist saved':'Private nomination preview'}</span>
      </div>
    </div>
    {current.complete?<p>All results for {potwWeekLabel(actual)} are public. You can select nominees below.</p>
      :<p className="potw-quiet-note"><LockKeyhole size={16}/> This list is commissioner-only. Nomination publishing remains locked until every game in both weeks is released.</p>}
    {persisted?.status==='open'?<div className="potw-admin-actions">
      <p><strong>Voting is published</strong> · Closes {potwDeadline(persisted.closesAt)} · {persisted.ballots||0} ballots submitted.</p>
      {closed&&<><p>Voting has ended. {leaders.length>1?'A tie requires your selection among the tied leaders.':'Finalize the award to add the trophy to the team cabinet.'}</p>
        {leaders.length>1&&<label>TIE-BREAK WINNER
          <select value={tieWinner} onChange={e=>setTieWinner(e.target.value)}>
            <option value="">Select tied leader</option>
            {leaders.map(n=><option key={n.player} value={n.player}>{potwPlayer(n.player)?.name||n.player} ({maxVotes} votes)</option>)}
          </select>
        </label>}
        <button className="red-btn" disabled={working||!maxVotes||(leaders.length>1&&!tieWinner)}
          onClick={()=>manage('finalize',tieWinner?Number(tieWinner):null)}>FINALIZE PLAYER OF THE WEEK</button>
        {maxVotes===0&&<p>No votes yet. The award cannot be finalized without a winner.</p>}
      </>}
    </div>:persisted?.status==='final'?<div className="potw-admin-actions"><CheckCircle2 size={22}/>
      <strong>Award finalized: {potwPlayer(persisted.winnerPlayer)?.name} · {persisted.winnerTeamName}</strong>
      <span>{potwDate(persisted.finalizedAt)}</span>
    </div>:<div className="potw-admin-actions">
      <strong>{chosen.length} player{chosen.length===1?'':'s'} shortlisted</strong>
      <button type="button" className="outline-btn" disabled={!canManage||working||chosen.length<1}
        onClick={()=>manage('save')}>SAVE PRIVATE NOMINEES</button>
      <label>VOTING DEADLINE
        <input type="datetime-local" value={closeAt} onChange={e=>setCloseAt(e.target.value)}/>
      </label>
      <button className="red-btn" disabled={!canManage||working||chosen.length<2||!closeAt}
        onClick={()=>manage('publish')}>PUBLISH NOMINEES TO VOTING</button>
    </div>}
    {message&&<p role="status" className="potw-message">{message}</p>}
  </div>
  <section className="panel potw-leaderboard">
    <button type="button" className="potw-leaderboard-toggle" aria-expanded={detailsOpen} onClick={()=>setDetailsOpen(x=>!x)}>
      <span>PLAYER LEADERBOARD · {potwWeekLabel(actual)}</span>
      <small>{detailsOpen?'HIDE':'SHOW'} CANDIDATES</small>
    </button>
    {detailsOpen&&<>
    <div className="potw-leaderboard-controls">
      <div className="stat-view-switch" role="group" aria-label="Player of the Week stat view">
        {['Totals','Averages per Game'].map(v=><button key={v} type="button"
         className={v===view?'active':''} aria-pressed={v===view}
         onClick={()=>{setView(v);setSort({key:v==='Totals'?'tgp':'agp',dir:'desc'});}}>{v}</button>)}
      </div>
      <label className="potw-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search players or teams" aria-label="Search POTW leaderboard"/></label>
    </div>
    <p className="potw-quiet-note">Default: highest Average Game Points per game first. Select any column heading to rank by a different statistic. Statistics include only released games from these two weeks.</p>
    <div className="potw-table-wrap"><table className="potw-table">
      <thead><tr><th scope="col">NOMINATE</th><th scope="col">PLAYER / TEAM</th>
        {columns.map(([key,label])=><th scope="col" key={key} aria-sort={sort.key===key?(sort.dir==='asc'?'ascending':'descending'):'none'}>
          <button type="button" onClick={()=>setSort(old=>({key,dir:old.key===key&&old.dir==='desc'?'asc':'desc'}))}>
            {label}<span aria-hidden="true">{sort.key===key?(sort.dir==='asc'?' ▲':' ▼'):' ↕'}</span>
          </button></th>)}
      </tr></thead>
      <tbody>{shown.map((row,i)=><tr key={row.id} className={chosen.includes(row.id)?'potw-row-selected':''}>
        <td><label className="potw-select">
          <input type="checkbox" disabled={!canManage||(!chosen.includes(row.id)&&chosen.length>=12)}
           checked={chosen.includes(row.id)}
           onChange={()=>setChosen(old=>old.includes(row.id)?old.filter(x=>x!==row.id):[...old,row.id])}/>
          <span>{i+1}</span>
        </label></td>
        <td><Nominee id={row.id} team={row.teamName} small/></td>
        {columns.map(([key])=><td key={key} className="potw-num">
          {formatScore(potwStatValue(row,key,view),key)}
        </td>)}
      </tr>)}
      {!shown.length&&<tr><td colSpan={columns.length+2} className="potw-message">No released player stats for this period yet.</td></tr>}
      </tbody>
    </table></div>
    </>}
  </section>
  </>}
 </section>;
}

export function PotwPublicBallots({league:l}){
 const s=l.season;
 const rounds=(l.potw?.rounds||[]).filter(r=>r.status==='open'||r.status==='final');
 if(!s || !rounds.length)return null;
 return <section className="potw-voting">
  {rounds.map(r=><PotwVotingRound key={s.id+'-'+r.roundNo} league={l} round={r}/>)}
 </section>;
}
function PotwVotingRound({league:l,round:r}){
 const [chosen,setChosen]=useState(r.myVote?Number(r.myVote):null);
 const [sending,setSending]=useState(false);
 const [notice,setNotice]=useState('');
 const active=r.status==='open'&&Date.now()<Date.parse(r.closesAt||'');
 useEffect(()=>setChosen(r.myVote?Number(r.myVote):null),[r.myVote,r.roundNo]);
 const cast=async()=>{
  if(sending||!chosen)return;
  setSending(true);setNotice('');
  try{
   const {error}=await l.supabase.rpc('ssl_potw_vote',{
    target_season:l.season.id,target_round:r.roundNo,chosen_player:chosen});
   if(error)throw error;
   await l.refresh();setNotice('Your Player of the Week vote has been saved.');
  }catch(e){setNotice(e.message||String(e));}finally{setSending(false);}
 };
 return <section className="panel potw-ballot" id={'ssl-potw-'+r.roundNo}>
  <div className="potw-ballot-head"><TrophyImage/><div>
   <span className="eyebrow dark">SSL OFFICIAL PLAYER OF THE WEEK</span>
   <h2>{potwWeekLabel(r.roundNo)}</h2>
   <p>{r.status==='final'?'Award complete':active?'One vote per signed-in account. You can change your vote until the deadline.':'Voting closed'}</p>
  </div></div>
  <div className="potw-ballot-meta"><Clock3 size={16}/>
   <span>{r.status==='final'?'Awarded '+potwDate(r.finalizedAt):'Voting closes '+potwDeadline(r.closesAt)}</span>
   <span>· {r.ballots||0} ballots</span>
  </div>
  <div className="potw-voting-nominees">
    {(r.nominees||[]).map(n=><label key={n.player} className={'potw-vote-option '+(Number(chosen)===Number(n.player)?'selected':'')}>
      <input type="radio" name={'potw-'+r.roundNo} checked={Number(chosen)===Number(n.player)}
       onChange={()=>setChosen(Number(n.player))} disabled={!active||!l.access.signedIn}/>
      <Nominee id={n.player} team={n.teamName}/>
      {(r.status==='final'||!active)&&<small>{r.totals?.[n.player]||0} votes</small>}
      {r.winnerPlayer===Number(n.player)&&<span className="potw-winner-tag">WINNER</span>}
    </label>)}
  </div>
  {active?(l.access.signedIn?<button type="button" className="red-btn"
    disabled={sending||!chosen} onClick={cast}>
    {sending?'SAVING VOTE…':r.myVote?'UPDATE MY VOTE':'SUBMIT MY VOTE'}</button>:
    <p className="potw-message">Sign in to participate in this SSL award vote.</p>):null}
  {notice&&<p role="status" className="potw-message">{notice}</p>}
  {r.status==='final'&&<p className="potw-vote-winner"><Award size={18}/>
    <strong>{potwPlayer(r.winnerPlayer)?.name}</strong> · {r.winnerTeamName} · trophy awarded {potwDate(r.finalizedAt)}</p>}
 </section>;
}

export function PotwTrophyCabinet({league:l}){
 const team=l.myTeam;
 const [opened,setOpened]=useState(null);
 const triggerRef=useRef(null);
 const awards=(l.potw?.cabinet||[]).filter(t=>team && String(t.team)===String(team.id));
 useEffect(()=>{
  if(!opened)return;
  const escape=e=>{if(e.key==='Escape')setOpened(null);};
  window.addEventListener('keydown',escape);
  return ()=>window.removeEventListener('keydown',escape);
 },[opened]);
 useEffect(()=>{
  if(!opened && triggerRef.current){triggerRef.current.focus();triggerRef.current=null;}
 },[opened]);
 return <section className="potw-cabinet panel">
   <div className="potw-cabinet-heading"><Trophy size={30}/><div>
    <span className="eyebrow dark">OFFICIAL SSL FRANCHISE HONORS</span>
    <h2>TROPHY CABINET</h2>
    <p>{team?.name||'Your franchise'} · {awards.length} award{awards.length===1?'':'s'} earned</p>
   </div></div>
   {awards.length?<div className="potw-cabinet-grid">
     {awards.map(t=><button type="button" key={t.id} className="potw-trophy-button"
      aria-label={'View Player of the Week for '+potwPlayer(t.player)?.name+', '+potwWeekLabel(t.roundNo)}
      onClick={e=>{triggerRef.current=e.currentTarget;setOpened(t);}}>
      <TrophyImage/><strong>PLAYER OF THE WEEK</strong>
      <span>{potwWeekLabel(t.roundNo)} · {t.seasonName}</span>
     </button>)}
   </div>:<div className="potw-cabinet-empty"><TrophyImage/>
    <h3>YOUR CABINET IS READY</h3>
    <p>When a player on your team receives Player of the Week or a future postseason award, their trophy will appear here and remain with your franchise even if the player is traded.</p>
   </div>}
   {opened&&<div className="potw-dialog-scrim"
      onMouseDown={e=>{if(e.target===e.currentTarget)setOpened(null);}}>
      <section className="potw-award-dialog" role="dialog" aria-modal="true"
       aria-labelledby="potw-award-detail-title">
       <button type="button" className="potw-dialog-close" aria-label="Close award details"
        onClick={()=>setOpened(null)}><X size={21}/></button>
       <TrophyImage/>
       <div className="potw-award-inscription">
        <p className="potw-inscription-league">— SSL —</p>
        <h2 id="potw-award-detail-title">Player of the Week Award</h2>
        <p className="potw-inscription-period">— {potwDate(opened.awardedAt)} · {potwWeekLabel(opened.roundNo)} —</p>
        <strong className="potw-inscription-player">{potwPlayer(opened.player)?.name||'SSL Player'}</strong>
        <p className="potw-inscription-team">— {opened.teamName} —</p>
        <small>{opened.seasonName} · Franchise ownership recorded when the award was issued</small>
       </div>
      </section>
     </div>}
  </section>;
}
