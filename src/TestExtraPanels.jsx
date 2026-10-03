import React, { useState } from 'react'
import playerPool from './players.json'
import statGroups from './temporary-stat-columns.json'

const ratio = (a,b) => b ? a/b : null
function teamStats(team, results) {
  const s = {}
  for (const id of team.players) for (const [key,value] of Object.entries(results.playerStats[id] || {})) {
    if (typeof value==='number') s[key] = (s[key] || 0) + value
  }
  s.gamesPlayed=results.standings[team.id].played
  s.battingAverage=ratio(s.hits,s.atBats)
  s.onBase=ratio(s.hits+s.batWalks+s.hitByPitch,s.plateAppearances)
  s.slug=ratio(s.totalBases,s.atBats)
  s.onBasePlusSlug=s.onBase==null || s.slug==null ? null : s.onBase+s.slug
  s.starSlug=ratio(s.starBases,s.starSwings)
  s.inningsPitched=s.outs/3
  s.era7=ratio(s.earnedRuns*21,s.outs);s.era9=ratio(s.earnedRuns*27,s.outs)
  s.whip=ratio((s.hitsAllowed+s.pitchWalks)*3,s.outs)
  s.baAgainst=ratio(s.hitsAllowed,s.atBatsAgainst)
  s.obAgainst=ratio(s.hitsAllowed+s.pitchWalks+s.beanBalls,s.battersFaced)
  s.slgAgainst=ratio(s.basesAllowed,s.atBatsAgainst)
  s.opsAgainst=s.obAgainst==null || s.slgAgainst==null ? null : s.obAgainst+s.slgAgainst
  return s
}
const rateKeys = new Set(['battingAverage','onBase','slug','onBasePlusSlug','starSlug','era7','era9','whip','baAgainst','obAgainst','slgAgainst','opsAgainst'])
export default function TestExtraPanels({tab,test,results,week,weeklyResults,schedule,PlayerAvatar,onNavigate,fantasyTeams}) {
  const [group,setGroup]=useState('Offensive Stats')
  const [average,setAverage]=useState(false)
  const [query,setQuery]=useState('')
  const [sort,setSort]=useState({key:'name',direction:1})
  if(tab==='Home')return <div className="testing-home-grid"><section className="panel test-team"><div className="section-title"><h2>WEEK {week.number} AT A GLANCE</h2></div><div className="test-team-body"><p>{weeklyResults.games.length} of {schedule.length} reports received · {week.label}</p><div className="testing-shortcuts">{['Schedule','Teams','Standings','Player Stats','Sluggers Fantasy'].map(name=><button className="outline-btn" key={name} onClick={()=>onNavigate(name)}>{name}</button>)}</div></div></section><section className="panel test-team"><div className="section-title"><h2>RECENT RESULTS</h2></div><div className="test-team-body">{results.games.slice(-5).reverse().map(game=>{const fixture=test.schedule.find(x=>x.id===game.id);return <div className="testing-result" key={game.id}><span>{test.teams.find(t=>t.id===fixture.awayId).name}</span><b>{game.awayRuns}–{game.homeRuns}</b><span>{test.teams.find(t=>t.id===fixture.homeId).name}</span></div>})}</div></section></div>
  if(tab==='Transactions' || tab==='Fantasy transactions')return <section className="panel test-team"><div className="section-title"><h2>{tab==='Transactions'?'LEAGUE':'FANTASY'} TRANSACTIONS</h2></div><div className="test-team-body"><p>No trades or free-agent signings have been recorded in testing.</p><p className="test-note">Draft picks are available in the {tab==='Transactions'?'league':'fantasy'} Draft tab. Uploaded game results update stats and scores automatically.</p></div></section>
  if(tab==='Free Agency' || tab==='Fantasy free agency') {
    const fantasy=tab==='Fantasy free agency'
    const rostered=new Set(test.teams.flatMap(t=>t.players))
    const drafted=new Set(fantasyTeams.flatMap(t=>[...t.starters,...t.bench]))
    const pool=fantasy?Object.values(test.profiles).filter(p=>!drafted.has(p.id)):playerPool.filter(p=>!rostered.has(p.id))
    return <section className="panel test-team"><div className="section-title"><h2>{fantasy?'FANTASY':'LEAGUE'} FREE AGENCY</h2><span>{pool.length} undrafted players</span></div><div className="test-team-body"><p className="test-note">{fantasy?'Only league-rostered characters are eligible. Pickups remain disabled for this test.':'These players are outside the ten temporary league rosters. Signing controls have not been enabled.'}</p><div className="table-tools"><div className="search"><input aria-label="Search undrafted players" placeholder="Search players" value={query} onChange={e=>setQuery(e.target.value)}/></div></div><div className="testing-player-pool">{pool.filter(p=>p.name.toLowerCase().includes(query.toLowerCase())).map(p=><div className="test-player" key={p.id}><PlayerAvatar player={p} size={28}/><div><strong>{p.name}</strong><small>{p.ability || p.class}</small></div></div>)}</div></div></section>
  }
  if(tab!=='Team Stats')return null
  const columns=statGroups[group]
  const value=(stats,key)=>average && !rateKeys.has(key) && key!=='gamesPlayed' ? ratio(stats[key],stats.gamesPlayed):stats[key]
  const rows=test.teams.map(team=>({...team,stats:teamStats(team,results)})).sort((a,b)=>sort.direction*(sort.key==='name'?a.name.localeCompare(b.name):(value(a.stats,sort.key)||0)-(value(b.stats,sort.key)||0)))
  const sortBy=key=>setSort(old=>({key,direction:old.key===key?-old.direction:-1}))
  return <section className="panel test-team test-team-stats"><div className="section-title"><h2>TEST TEAM STATS</h2></div><div className="subnav stat-tabs">{Object.keys(statGroups).map(name=><button key={name} className={group===name?'active':''} onClick={()=>setGroup(name)}>{name}</button>)}</div><div className="stat-view-switch">{[false,true].map(v=><button key={String(v)} className={average===v?'active':''} onClick={()=>setAverage(v)}>{v?'Averages':'Totals'}</button>)}</div><div className="table-scroll"><table className="fantasy-simple-table ssl-stat-table" style={{width:`${230+columns.length*112}px`}}><caption>{group} · {average?'Averages per Game':'Totals'}</caption><colgroup><col style={{width:230}}/>{columns.map(([key])=><col key={key} style={{width:112}}/>)}</colgroup><thead><tr><th><button onClick={()=>sortBy('name')}>Team</button></th>{columns.map(([key,label])=><th key={key} className="numeric-column"><button onClick={()=>sortBy(key)}>{label}{sort.key===key?(sort.direction===1?' ↑':' ↓'):''}</button></th>)}</tr></thead><tbody>{rows.map(team=><tr key={team.id}><td>{team.name}</td>{columns.map(([key])=>{const n=value(team.stats,key);return <td key={key} className="numeric-column">{n==null || !Number.isFinite(n)?'—':rateKeys.has(key)?n.toFixed(3):average && key!=='gamesPlayed' || key==='inningsPitched'?n.toFixed(2):n}</td>})}</tr>)}</tbody></table></div><p className="test-note">Cumulative report counts for each roster. Averages divide by team games played; rates are recalculated from combined counts. Team names remain fixed while scrolling sideways.</p></section>
}
