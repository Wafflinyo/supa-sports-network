import React, {useEffect, useRef, useState} from 'react';
import pool from './players.json';
import {PlayerPortrait} from './PlayerPortrait.jsx';
import {PlayerPriority} from './PlayerPriority.jsx';
import MyDraftTeam from './MyDraftTeam.jsx';
import {DraftPickBadge} from './DraftPickBadge.jsx';
import {PlayerDataDetails} from './PlayerData.jsx';
import data from './player-data.json';
import {pitcherPriorityFor} from './player-roles.js';
import './draft-players.css';
import {Building2,CheckCircle2,Landmark,LockKeyhole} from 'lucide-react';
import {stadiumDraftState} from './draft-stadium-state.js';

export function DraftPlayers({league:l}) {
  const s=l.season, [query,setQuery]=useState(''), [category,setCategory]=useState('All classes'), [selected,setSelected]=useState(null);
  const [tab,setTab]=useState('players'), [selectedStadium,setSelectedStadium]=useState(null);
  const dialog=useRef(null), opener=useRef(null);
  const ownership=new Map();
  for(const t of s.teams) for(const id of s.rosters?.[t.id]||[]) ownership.set(Number(id),t.name);
  for(const pick of s.picks) if(pick.player != null && !ownership.has(Number(pick.player))) ownership.set(Number(pick.player),s.teams.find(t=>t.id===pick.team)?.name||'Drafted');
  const owner=s.nextPick?.team, team=s.teams.find(t=>t.id===owner);
  const canPick=s.status==='drafting'&&!s.paused&&(l.access.role==='commissioner'||(l.access.role==='gm'&&l.myTeam?.id===owner));
  // A GM always sees their own chosen Stadium—even while another team is on
  // the clock. Commissioner draft controls target the current picking team.
  const stadiumTeamId=l.access.role==='commissioner'?owner:l.myTeam?.id;
  const stadiumTeam=s.teams.find(t=>String(t.id)===String(stadiumTeamId));
  const stadiumState=stadiumDraftState(s,stadiumTeamId,canPick);
  const {owned:myStadium,eligible:canDraftStadium,mandatory:mustStage,available:availableStadiums}=stadiumState;
  const filtered=pool.filter(p=>(category==='All classes'||p.class===category)&&p.name.toLowerCase().includes(query.trim().toLowerCase()));
  useEffect(()=>{
    if(selectedStadium&&!availableStadiums.includes(selectedStadium))setSelectedStadium(null);
  },[selectedStadium,availableStadiums.join('|')]);
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
  return <section className="draft-player-browser" aria-label="Draft room player and Stadium selections">
    <div className="draft-pool-header">
      <div><h2>DRAFT SELECTIONS</h2><p>Switch between Players and Stadiums on any draft turn. Every team gets one exclusive Stadium Pick.</p></div>
      <div className="draft-pool-tabs" role="tablist" aria-label="Draft selection type">
        <button type="button" role="tab" id="draft-tab-players" aria-controls="draft-panel-players" aria-selected={tab==='players'} className={tab==='players'?'active':''} onClick={()=>setTab('players')}>PLAYERS</button>
        <button type="button" role="tab" id="draft-tab-stadiums" aria-controls="draft-panel-stadiums" aria-selected={tab==='stadiums'} className={tab==='stadiums'?'active':''} onClick={()=>setTab('stadiums')}>STADIUMS <small>{myStadium?'✓ OWNED':availableStadiums.length+' LEFT'}</small></button>
        {l.access.role==='gm'&&l.myTeam&&<button type="button" role="tab" id="draft-tab-my-team" aria-controls="draft-panel-my-team" aria-selected={tab==='my-team'} className={tab==='my-team'?'active':''} onClick={()=>setTab('my-team')}>MY TEAM <small>{(s.rosters?.[l.myTeam.id]||[]).length} PLAYERS</small></button>}
      </div>
    </div>
    <div id="draft-panel-stadiums" role="tabpanel" aria-labelledby="draft-tab-stadiums" hidden={tab!=='stadiums'} className="draft-stadium-panel">
      <div className="draft-stadium-heading"><h3>{myStadium?'YOUR STADIUM':'AVAILABLE STADIUMS'}</h3><p>{myStadium
        ? 'This Stadium belongs to your franchise this season. Your Stadium Pick is complete.'
        : 'A Stadium disappears from every other GM’s available list as soon as a team drafts or retains it. Stadium Picks cannot be traded.'}</p></div>
      {myStadium?<>
        <div className="draft-stadium-owned" data-testid="draft-stadium-owned">
          <span className="draft-stadium-tile-icon"><Landmark aria-hidden="true" size={38}/></span>
          <div><small>YOUR HOME STADIUM</small><h4>{myStadium.name}</h4><p>{myStadium.source==='retained'?'RETAINED THROUGH CONTRACT EXTENSION':'DRAFTED · YOUR STADIUM PICK IS USED'}</p></div>
          <span className="draft-stadium-lock"><CheckCircle2 size={25}/> OWNED</span>
        </div>
        <p className="draft-stadium-note"><LockKeyhole size={16}/> You cannot draft another Stadium. Other GMs cannot select this one.</p>
      </>:<>
        <p className="draft-stadium-status" role="status">{availableStadiums.length} of 13 Stadiums are still unclaimed.{stadiumTeam?.name?' Viewing for '+stadiumTeam.name+'.':''}</p>
        {mustStage&&<p className="draft-stadium-required" role="alert">This is your team's final available main-draft turn. You must select a Stadium to continue.</p>}
        <div className="draft-stadium-grid" aria-label="Undrafted Stadiums">
          {availableStadiums.map(stage=><button type="button" key={stage}
            className={'draft-stadium-card'+(selectedStadium===stage?' selected':'')}
            onClick={()=>setSelectedStadium(stage)} aria-pressed={selectedStadium===stage}>
              <span className="draft-stadium-tile-icon"><Building2 size={30} aria-hidden="true"/></span>
              <strong>{stage}</strong>
              <small>AVAILABLE</small>
            </button>)}
        </div>
        {!availableStadiums.length&&<p>Every Stadium is currently owned. Ask the commissioner to review the draft status.</p>}
        <div className="draft-stadium-confirm">
          <p>{selectedStadium?<>Selected: <strong>{selectedStadium}</strong></>:
            'Select one of the available Stadiums above.'}</p>
          <button type="button" className="red-btn" disabled={!canDraftStadium||!selectedStadium||l.busy}
            onClick={async()=>{if(!selectedStadium||!availableStadiums.includes(selectedStadium))return;
              if(!window.confirm('Draft '+selectedStadium+' as your exclusive Stadium? This uses your current pick.'))return;
              const success=await l.act('pick_stage',{stage:selectedStadium});
              if(success)setSelectedStadium(null);
            }}>{l.busy?'SUBMITTING…':mustStage?'PICK STADIUM — REQUIRED':'DRAFT SELECTED STADIUM'}</button>
        </div>
        {!canDraftStadium&&<p className="draft-stadium-note">
          {s.status!=='drafting'?'Draft picks become available when the official draft begins.':
            s.paused?'The commissioner has paused the draft.':
            stadiumState.isTurn?'Stadium selection is unavailable on this turn.':
              'You can browse Stadiums now. Draft one when your team is on the clock.'}
        </p>}
      </>}
    </div>
    {l.access.role==='gm'&&l.myTeam&&<div id="draft-panel-my-team" role="tabpanel" aria-labelledby="draft-tab-my-team" hidden={tab!=='my-team'} className="draft-my-team-panel"><MyDraftTeam league={l}/></div>}
    <div id="draft-panel-players" role="tabpanel" aria-labelledby="draft-tab-players" hidden={tab!=='players'} className="draft-players-panel">
      <h3>PLAYER POOL</h3>
      <p>These use the same player portraits and pitching-priority badges as Player Stats. Tap any player for their ratings, named abilities, and chemistry. Drafted players are shaded gray.</p>
    <div className="draft-pool-filters">
      <label>Search players<input aria-label="Search draft players" placeholder="Search players" value={query} onChange={e=>setQuery(e.target.value)}/></label>
      <label>Class<select aria-label="Filter draft class" value={category} onChange={e=>setCategory(e.target.value)}>{['All classes','Balanced','Power','Speed','Technique'].map(c=><option key={c}>{c}</option>)}</select></label>
    </div>
    <p className="draft-pool-count">{pool.length-ownership.size} available · {filtered.length} shown · {ownership.size} on rosters</p>
    <div className="draft-player-grid" tabIndex={0} aria-label="Scrollable draft players">
      {filtered.map(p=><button type="button" key={p.id} className={`draft-player-card draft-player-stats-card${ownership.has(p.id)?' is-drafted':''}`} aria-label={`View ${p.name}${ownership.has(p.id)?' · drafted by '+ownership.get(p.id):' · available'}`} onClick={e=>{opener.current=e.currentTarget;setSelected(p);}}>
        <span className="draft-player-stats-identity player-data-name">
          <PlayerPortrait player={p} size={38}/>
          <span className="draft-player-stats-details"><strong>{p.name}</strong><PlayerPriority player={p}/><span className="draft-player-stats-class">{p.class}</span></span>
        </span>
        <small className="draft-player-stats-status">{ownership.has(p.id)?'DRAFTED · '+ownership.get(p.id):'AVAILABLE'}</small>
        <DraftPickBadge playerId={p.id} seasons={l.seasons} compact/>
      </button>)}
      {!filtered.length&&<p>No players match these filters.</p>}
    </div>
    </div>
    <dialog className="draft-player-dialog" ref={dialog} aria-label={selected?`${selected.name} draft profile`:'Draft player profile'} onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target===dialog.current)close();}}>
      {selected&&<div className="draft-dialog-content">
        <div className="draft-dialog-actions"><button type="button" className="outline-btn" onClick={close} autoFocus>CLOSE PLAYER</button><button type="button" className="red-btn" disabled={!canPick||l.busy||mustStage||ownership.has(selected.id)} onClick={async()=>{
          if(!canPick||l.busy||mustStage||ownership.has(selected.id))return;
          const confirmed=window.confirm('Draft '+selected.name+' for '+(team?.name||'your team')+'? This uses your current draft pick.');
          if(!confirmed)return;
          if(await l.act('pick',{player:selected.id}))close();
        }}>DRAFT {selected.name.toUpperCase()}</button></div>
        <p role="status">{ownership.has(selected.id)?`Already drafted · ${ownership.get(selected.id)}`:s.paused?'Draft paused':mustStage?'Your final remaining turn must be a Stadium Pick.':canPick?`Select for ${team?.name}. This submits the pick.`:s.status==='drafting'?`Waiting for ${team?.name||'the next team'} to pick.`:'Scouting view · drafting is not active.'}</p>
        <DraftPickBadge playerId={selected.id} seasons={l.seasons}/>
        <PlayerDataDetails player={selected} seasons={l.seasons}/>
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
    <div className="season-table draft-picks-scroll" tabIndex={0} aria-label="Scrollable draft pick results"><table><caption>Completed picks · latest first</caption><thead><tr><th>Pick</th><th>Round</th><th>Player / Stadium</th><th>Team</th><th>Pick time</th></tr></thead><tbody>{picks.map(p=><tr key={p.number} className={p.number===latest?.number?'latest-pick':undefined}><td>#{p.number}{p.number===latest?.number?' · LATEST':''}</td><td>{p.round}{p.supplemental?' · Fill':''}</td><td><span className="portrait-label">{p.kind==='stage'?<strong>STADIUM · {p.stage}</strong>:<><PlayerPortrait player={player(p.player)}/>{player(p.player)?.name}{pitcherPriorityFor(player(p.player),data.players[p.player])&&<span className="draft-priority-tag">{pitcherPriorityFor(player(p.player),data.players[p.player]).code}</span>}</>}</span></td><td>{s.teams.find(t=>t.id===p.team)?.name}</td><td>{Math.floor(Number(p.seconds)||0)}s</td></tr>)}</tbody></table></div>
  </section>;
}
