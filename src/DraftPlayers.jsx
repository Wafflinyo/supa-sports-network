import React, {useEffect, useRef, useState} from 'react';
import pool from './players.json';
import {PlayerPortrait} from './PlayerPortrait.jsx';
import {PlayerDataDetails} from './PlayerData.jsx';
import data from './player-data.json';
import {pitcherPriorityFor} from './player-roles.js';
import './draft-players.css';
import {DRAFT_STAGES} from './draft-stages.js';

export function DraftPlayers({league:l}) {
  const s=l.season, [query,setQuery]=useState(''), [category,setCategory]=useState('All classes'), [selected,setSelected]=useState(null), [stageChoice,setStageChoice]=useState('Mario Stadium');
  const dialog=useRef(null), opener=useRef(null);
  const ownership=new Map();
  for(const t of s.teams) for(const id of s.rosters?.[t.id]||[]) ownership.set(Number(id),t.name);
  for(const pick of s.picks) if(pick.player != null && !ownership.has(Number(pick.player))) ownership.set(Number(pick.player),s.teams.find(t=>t.id===pick.team)?.name||'Drafted');
  const owner=s.nextPick?.team, team=s.teams.find(t=>t.id===owner);
  const canPick=s.status==='drafting'&&!s.paused&&(l.access.role==='commissioner'||(l.access.role==='gm'&&l.myTeam?.id===owner));
  const stageAvailable = s.status==='drafting' && !s.nextPick?.supplemental && !s.nextPick?.stageAlreadyChosen;
  const mustStage = Boolean(s.nextPick?.mustStage);
  const filtered=pool.filter(p=>(category==='All classes'||p.class===category)&&p.name.toLowerCase().includes(query.trim().toLowerCase()));
  useEffect(()=>{
    if(selected&&!dialog.current.open) dialog.current.showModal();
    if(!selected&&dialog.current.open) dialog.current.close();
  },[selected]);
  useEffect(()=>{
    if(!selected)return;
    const previous=document.body.style.overflow;
    document.body.style.overflow='hidden';
    return()=>{document.body.style.overflow=previous;};
  },[selected]);
  function close(){setSelected(null);opener.current?.focus();}
  return <section className="draft-player-browser" aria-label="Draft player pool">
    <h2>PLAYER POOL</h2>
    <p>Tap a player for ratings, named abilities, and chemistry. P1P captains have first pitcher-change priority; P2P (7+ pitching) are next. Gray cards are already on a roster.</p>
    <div className="draft-stage-picker" aria-label="Stage pick selection"><h3>STADIUM PICK · ONE PER TEAM</h3><p>Your Stadium Pick cannot be traded. Select a Stadium on any main-draft turn; if you leave it until your final turn, the Stadium selection becomes mandatory.</p><label>Choose your Stadium <select value={stageChoice} onChange={e=>setStageChoice(e.target.value)}>{DRAFT_STAGES.map(stage=><option key={stage} value={stage}>{stage}</option>)}</select></label><button type="button" className="red-btn" disabled={!canPick||l.busy||!stageAvailable} onClick={()=>l.act('pick_stage',{stage:stageChoice})}>{mustStage?'PICK STADIUM NOW — REQUIRED':'USE CURRENT TURN FOR STADIUM'}</button>{s.nextPick?.stageAlreadyChosen&&<p>Stadium already selected for the team on the clock.</p>}{mustStage&&<p role="alert">This team must select its Stadium before the draft can advance.</p>}</div>
    <div className="draft-pool-filters">
      <label>Search players<input aria-label="Search draft players" placeholder="Search players" value={query} onChange={e=>setQuery(e.target.value)}/></label>
      <label>Class<select aria-label="Filter draft class" value={category} onChange={e=>setCategory(e.target.value)}>{['All classes','Balanced','Power','Speed','Technique'].map(c=><option key={c}>{c}</option>)}</select></label>
    </div>
    <p className="draft-pool-count">{pool.length-ownership.size} available · {filtered.length} shown · {ownership.size} on rosters</p>
    <div className="draft-player-grid" tabIndex={0} aria-label="Scrollable draft players">
      {filtered.map(p=><button type="button" key={p.id} className={`draft-player-card${ownership.has(p.id)?' is-drafted':''}`} aria-label={`View ${p.name}${ownership.has(p.id)?' · drafted by '+ownership.get(p.id):' · available'}`} onClick={e=>{opener.current=e.currentTarget;setSelected(p);}}>
        <PlayerPortrait player={p} size={56}/><strong>{p.name}</strong><span>{p.class}</span>{pitcherPriorityFor(p,data.players[p.id]) && <span className="draft-priority-tag" title={pitcherPriorityFor(p,data.players[p.id]).label}>{pitcherPriorityFor(p,data.players[p.id]).code} · {pitcherPriorityFor(p,data.players[p.id]).label}</span>}<small>{ownership.has(p.id)?'DRAFTED · '+ownership.get(p.id):'AVAILABLE'}</small>
      </button>)}
      {!filtered.length&&<p>No players match these filters.</p>}
    </div>
    <dialog className="draft-player-dialog" ref={dialog} aria-label={selected?`${selected.name} draft profile`:'Draft player profile'} onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target===dialog.current)close();}}>
      {selected&&<div className="draft-dialog-content">
        <div className="draft-dialog-actions"><button type="button" className="outline-btn" onClick={close} autoFocus>CLOSE PLAYER</button><button type="button" className="red-btn" disabled={!canPick||l.busy||mustStage||ownership.has(selected.id)} onClick={async()=>{if(canPick&&!ownership.has(selected.id)&&await l.act('pick',{player:selected.id}))close();}}>DRAFT {selected.name.toUpperCase()}</button></div>
        <p role="status">{ownership.has(selected.id)?`Already drafted · ${ownership.get(selected.id)}`:s.paused?'Draft paused':mustStage?'Your final remaining turn must be a Stadium Pick.':canPick?`Select for ${team?.name}. This submits the pick.`:s.status==='drafting'?`Waiting for ${team?.name||'the next team'} to pick.`:'Scouting view · drafting is not active.'}</p>
        <PlayerDataDetails player={selected}/>
      </div>}
    </dialog>
  </section>;
}

export function DraftPickBoard({season:s}) {
  const [round,setRound]=useState('all');
  const picks=[...s.picks].filter(p=>round==='all'||Number(p.round)===Number(round)).reverse();
  const latest=s.picks.at(-1), rounds=[...new Set(s.picks.map(p=>p.round))].sort((a,b)=>a-b);
  const pickName=p=>p.kind==='stage'?`STADIUM · ${p.stage}`:(player(p.player)?.name||'Player');
  const player=id=>pool.find(p=>p.id===Number(id));
  return <section className="panel season-box draft-pick-board" aria-label="Draft picks by round">
    <h2>ROUNDS & PICKS</h2>
    <p role="status">{latest?`Latest pick: #${latest.number} · ${pickName(latest)} → ${s.teams.find(t=>t.id===latest.team)?.name}`:'No picks yet. Selections will appear here as they happen.'}</p>
    <label>Show round <select aria-label="Filter draft round" value={round} onChange={e=>setRound(e.target.value)}><option value="all">All rounds · latest first</option>{rounds.map(r=><option key={r} value={r}>Round {r}</option>)}</select></label>
    <div className="season-table draft-picks-scroll" tabIndex={0} aria-label="Scrollable draft pick results"><table><caption>Completed picks · latest first</caption><thead><tr><th>Pick</th><th>Round</th><th>Player</th><th>Team</th><th>Pick time</th></tr></thead><tbody>{picks.map(p=><tr key={p.number} className={p.number===latest?.number?'latest-pick':undefined}><td>#{p.number}{p.number===latest?.number?' · LATEST':''}</td><td>{p.round}{p.supplemental?' · Fill':''}</td><td><span className="portrait-label">{p.kind==='stage'?<strong>STADIUM · {p.stage}</strong>:<><PlayerPortrait player={player(p.player)}/>{player(p.player)?.name}{pitcherPriorityFor(player(p.player),data.players[p.player])&&<span className="draft-priority-tag">{pitcherPriorityFor(player(p.player),data.players[p.player]).code}</span>}</>}</span></td><td>{s.teams.find(t=>t.id===p.team)?.name}</td><td>{Math.floor(Number(p.seconds)||0)}s</td></tr>)}</tbody></table></div>
  </section>;
}
