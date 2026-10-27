import React, {useMemo, useState} from 'react'
import {Search, ArrowUp, ArrowDown, X} from 'lucide-react'
import players from './players.json'
import data from './player-data.json'
import {PlayerPortrait} from './PlayerPortrait.jsx'
import {abilityLabel, pitcherPriorityFor, pitcherPriorityText} from './player-roles.js'
import {DraftPickBadge} from './DraftPickBadge.jsx'
import {chemistryDisplayName, chemistryDisplayNames} from './chemistry-names.js'

const byId = new Map(players.map(p=>[p.id,p]))
const categories = {
  'Overview': ['displayed batting','displayed pitching','displayed fielding','displayed speed','hit trajectory'],
  'Batting': ['slap contact size','charge contact size','slap hit power','charge hit power','hit trajectory','bunting'],
  'Pitching': ['displayed pitching','pitching stamina','curveball speed','charge pitch speed','curve'],
  'Fielding & Running': ['speed','outfield throwing speed','fielding','weight','fielding ability','baserunning ability'],
  'Abilities': ['fielding ability','baserunning ability'],
  'Chemistry': [],
}
const labels = {'displayed batting':'Batting rating','displayed pitching':'Pitching rating','displayed fielding':'Fielding rating','displayed speed':'Speed rating','charge pitch speed':'Fastball speed','curve':'Pitch curve','outfield throwing speed':'Throwing arm','fielding ability':'Fielding ability code','baserunning ability':'Baserunning ability','weight':'Weight code','pitcher priority':'Pitcher priority'}
const label = key=>labels[key] || key.replace(/^./,s=>s.toUpperCase())
function formatStatValue(key,value) {
  return key === 'fielding ability' || key === 'baserunning ability' ? abilityLabel(key,value) : value
}
function sortStatValue(player,key) {
  const record=data.players[player.id]
  if (key === 'pitcher priority') return pitcherPriorityFor(player,record)?.order || 3
  return player[key] ?? record.stats[key]
}
export function PitcherPriorityBadge({player,record}) {
  const priority=pitcherPriorityFor(player,record)
  return priority ? <span className={`pitcher-priority-badge ${priority.code.toLowerCase()}`} title={priority.label} aria-label={priority.label}>{priority.code}</span> : null
}
function Names({ids}) {
  const groupedNames = chemistryDisplayNames(ids, byId)
  return groupedNames.length ? <span className="chem-names">{groupedNames.map(label=><span key={label}>{label}</span>)}</span> : <span className="muted">None</span>
}
export function PlayerDataDetails({player,seasons=[]}) {
  const record=data.players[player.id]
  if(!record) return null
  const priority=pitcherPriorityFor(player,record)
  return <div className="player-data-details">
    <div className="player-data-bio"><PlayerPortrait player={player} size={68}/><div><h3>{player.name} <PitcherPriorityBadge player={player} record={record}/></h3><p>{record.stats['player class']} · {player.color}{record.miiColorProfile?' · Mii color profile':''}</p><div className="priority-profile-row">{priority?<span>{priority.label} · pitcher-substitution priority</span>:<span>Standard pitcher fallback</span>}</div><DraftPickBadge playerId={player.id} seasons={seasons}/></div></div>
    <div className="player-data-groups">{Object.entries(categories).filter(([name])=>name!=='Chemistry').map(([name,fields])=><section key={name}><h4>{name}</h4><dl>{fields.map(key=><div key={key}><dt>{label(key)}</dt><dd>{key==='pitcher priority'?<PitcherPriorityBadge player={player} record={record}/>:formatStatValue(key,record.stats[key])}</dd></div>)}</dl></section>)}</div>
    <section className="chem-section"><h4>Good chemistry</h4><Names ids={record.goodChemistryIds}/></section>
    <section className="chem-section"><h4>Bad chemistry</h4><Names ids={record.badChemistryIds}/></section>
    {!!record.conditionalGoodChemistryIds.length && <section className="chem-section"><h4>Same-color Miis — opposite gender only</h4><Names ids={record.conditionalGoodChemistryIds}/></section>}
  </div>
}
export default function PlayerData({seasons=[]}) {
  const [category,setCategory]=useState('Overview')
  const [query,setQuery]=useState('')
  const [classFilter,setClassFilter]=useState('All classes')
  const [priorityFilter,setPriorityFilter]=useState('All pitcher priorities')
  const [sort,setSort]=useState({key:'rosterOrder',direction:1})
  const [selected,setSelected]=useState(null)
  const filtered=useMemo(()=>players.filter(p=>{
    const record=data.players[p.id]
    const chemistryIds=[...record.goodChemistryIds,...record.badChemistryIds,...record.conditionalGoodChemistryIds]
    const searchNames=category==='Chemistry'?[p.name,...chemistryIds.flatMap(id=>{const chemPlayer=byId.get(id);return chemPlayer?[chemPlayer.name,chemistryDisplayName(chemPlayer)]:[]})]:[p.name]
    return (classFilter==='All classes'||p.class===classFilter)&&(priorityFilter==='All pitcher priorities'||pitcherPriorityText(p,record)===priorityFilter)&&searchNames.some(name=>name.toLowerCase().includes(query.toLowerCase().trim()))
  }).sort((a,b)=>{
    const av=sortStatValue(a,sort.key), bv=sortStatValue(b,sort.key)
    return (typeof av==='number'?av-bv:String(av).localeCompare(String(bv)))*sort.direction || a.rosterOrder-b.rosterOrder
  }),[query,classFilter,priorityFilter,sort,category])
  const columns=[['rosterOrder','#'],['name','Player'],['class','Class'],...categories[category].map(key=>[key,label(key)])]
  function sortBy(key){setSort(s=>({key,direction:s.key===key?-s.direction:1}))}
  return <>
    <div className="page-heading"><span className="eyebrow dark">THE SCOUTING ROOM</span><h1>PLAYER DATA</h1><p>Updated game ratings, named abilities, chemistry, and pitcher priorities for all {players.length} players. Select a player to see their complete data.</p></div>
    <div className="subnav stat-tabs" role="tablist" aria-label="Player data categories">{Object.keys(categories).map(name=><button key={name} role="tab" aria-selected={category===name} className={category===name?'active':''} onClick={()=>setCategory(name)}>{name}</button>)}</div>
    <div className="panel data-panel player-data-panel">
      <div className="table-tools"><div className="search"><Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={category==='Chemistry'?'Search player or chemistry name':'Search players'} aria-label="Search player data"/></div><select value={classFilter} onChange={e=>setClassFilter(e.target.value)} aria-label="Filter player class">{['All classes','Balanced','Power','Speed','Technique'].map(name=><option key={name}>{name}</option>)}</select><select value={priorityFilter} onChange={e=>setPriorityFilter(e.target.value)} aria-label="Filter pitcher priority">{['All pitcher priorities','P1P','P2P'].map(name=><option key={name}>{name}</option>)}</select><span>{filtered.length} PLAYERS</span></div>
      {selected && <section className="player-data-expanded" aria-label={`${selected.name} complete player data`}><button className="outline-btn" onClick={()=>setSelected(null)}><X size={16}/> CLOSE PLAYER DATA</button><PlayerDataDetails player={selected} seasons={seasons}/></section>}
      <div className="table-scroll" role="tabpanel" aria-label={`${category} player data`}><table className={`ssl-stat-table player-data-table ${category==='Chemistry'?'chemistry-table':''}`}><caption>{category} · Current SSL game data</caption><thead><tr>{columns.map(([key,name])=><th key={key} className={key==='name'?'sticky-player':undefined}><button onClick={()=>sortBy(key)}>{name}{sort.key===key?(sort.direction===1?<ArrowUp size={13}/>:<ArrowDown size={13}/>):null}</button></th>)}{category==='Chemistry'&&<><th>Good chemistry</th><th>Bad chemistry</th><th>Conditional Mii chemistry</th></>}</tr></thead><tbody>{filtered.map(p=>{
        const record=data.players[p.id]
        return <tr key={p.id}>{columns.map(([key])=><td key={key} className={key==='name'?'player-cell':key==='rosterOrder'?'roster-number':undefined}>{key==='name'?<button className="player-data-name" aria-expanded={selected?.id===p.id} onClick={()=>setSelected(selected?.id===p.id?null:p)}><PlayerPortrait player={p} size={32}/><strong>{p.name}</strong><PitcherPriorityBadge player={p} record={record}/><DraftPickBadge playerId={p.id} seasons={seasons} compact/></button>:key==='pitcher priority'?<PitcherPriorityBadge player={p} record={record}/>:formatStatValue(key,p[key]??record.stats[key])}</td>)}{category==='Chemistry'&&<><td><Names ids={record.goodChemistryIds}/></td><td><Names ids={record.badChemistryIds}/></td><td>{record.conditionalGoodChemistryIds.length?<><small>Same color, opposite gender only</small><Names ids={record.conditionalGoodChemistryIds}/></>:<span className="muted">None</span>}</td></>}</tr>
      })}</tbody></table></div>
      <p className="pitcher-priority-explainer"><strong>Pitching change guide:</strong> <b>P1P</b> (Priority 1 Pitcher) = one of the 12 captains, considered first when a pitcher tires. <b>P2P</b> (Priority 2 Pitcher) = non-captain with a displayed pitching rating of 7 or higher, considered after captains. If neither group is available, the next option is random. These are SSL lineup-planning labels, not a Dolphin AI change made by this website.</p>
      <p className="table-footnote">Ratings and hidden stats reflect the current SSL game setup. Click a heading to sort; player names stay fixed while scrolling. Fielding and baserunning abilities show their names and game IDs.</p>
      <p className="table-footnote">{data.source.miiNote} Unlisted chemistry pairs are neutral.</p>
    </div>
  </>
}
