import React, {useEffect, useRef} from 'react'
import {X} from 'lucide-react'
import archive from './player-careers.json'
import {playerCareer} from './player-career.js'

const groups = [
  ['Batting', [['battingAverage','Batting Average',3],['onBase','On-Base %',3],['slug','Slugging %',3],['onBasePlusSlug','OPS',3],['hits','Hits / Game',2],['homeRuns','Home Runs / Game',2],['rbi','RBIs / Game',2],['runs','Runs / Game',2]]],
  ['Fielding', [['putouts','Putouts / Game',2],['assists','Assists / Game',2]]],
  ['Pitching', [['pitchStrikeouts','Strikeouts / Game',2],['era7','ERA (7 Innings)',2]]],
]
export default function PlayerProfile({player, PlayerAvatar, onClose}) {
  const dialog=useRef(null)
  const career=playerCareer(player.id, archive.seasons)
  useEffect(()=>{
    const previous=document.activeElement
    dialog.current.showModal()
    const overflow=document.body.style.overflow
    document.body.style.overflow='hidden'
    return()=>{document.body.style.overflow=overflow;previous?.focus()}
  },[])
  return <dialog ref={dialog} className="modal player-modal career-profile" aria-labelledby="career-player-name" onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose()}}}>
    <button className="close" onClick={onClose} aria-label="Close player profile"><X/></button>
    <div className="player-modal-heading"><PlayerAvatar player={player} size={76}/><div><span className="eyebrow dark">SSL PLAYER PROFILE · #{player.rosterOrder || player.id}</span><h2 id="career-player-name">{player.name}</h2></div></div>
    <div className="career-bio"><span>{player.class}</span><span>{player.source}</span><span>{player.team || 'Free agent'}</span></div>
    <dl className="career-summary">{[['SEASONS AS A SLUGGER',career.seasons],['CAREER GAMES PLAYED',career.games],['CAREER MVPs',career.mvps]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value ?? '—'}</dd></div>)}</dl>
    <h3 className="career-title">CAREER AVERAGES</h3>
    {groups.map(([title,stats])=><section className="career-category" key={title}><h4>{title}</h4><dl className="career-average-grid">{stats.map(([key,label,precision])=><div key={key}><dt>{label}</dt><dd>{career.averages[key]?.toFixed(precision) ?? '—'}</dd></div>)}</dl></section>)}
    <p className="career-note">{career.games ? 'Official SSL seasons only. Career rates use combined totals; per-game averages use career games played.' : 'No official SSL career stats yet. Seasons, games, and averages will appear once official season data is recorded. Temporary test games do not count.'}</p>
  </dialog>
}
