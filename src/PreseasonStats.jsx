import React,{useMemo,useState} from 'react'
import playerPool from './players.json'
import preseasonRecords from './preseason-stats.json'
import {PlayerPortrait} from './PlayerPortrait.jsx'

// Preseason records are isolated from official regular-season statistics.
// Importers should add only participants from uploaded preseason sheets.
// Each row: {seasonId,playerId,teamId,stats:{...},perGame:{...}}.
const statGroups = {
  'Game Score': [
    ['gamesPlayed','Games Played'],['gameScore','Game Score'],
    ['ogp','OGP'],['dgp','DGP'],['pgp','PGP'],['tgp','TGP'],['agp','AGP'],['itemScore','Item Score'],
    ['heatingUpCount','Hot Games'],['longestHotStreak','Longest Hot Streak'],
  ],
  'Offensive Stats': [
    ['ogp','Offensive Game Points (OGP)'],
    ['positionsPlayed', 'Position(s) Played'], ['gamesPlayed', 'Games Played'], ['mvps', 'MVPs'], ['atBats', 'At-Bats'], ['plateAppearances', 'Plate Appearances'], ['runs', 'Runs'],
    ['hits', 'Hits'], ['rbi', 'RBI'], ['homeRuns', 'Home Runs'], ['batStrikeouts', 'Strikeouts'], ['batWalks', 'Walks'],
    ['hitByPitch', 'Hit By Pitch'], ['singles', 'Singles'], ['doubles', 'Doubles'],
    ['triples', 'Triples'], ['oneHr', '1HR'], ['twoHr', '2HR'],
    ['threeHr', '3HR'], ['grandSlams', 'Grand Slams'], ['itpHomeRuns', 'ITP Home Runs'],
    ['totalBases', 'Total Bases'], ['sacFlys', 'Sac Flys'],
    ['doublePlaysHitInto', 'Double Plays Hit Into'], ['triplePlaysHitInto', 'Triple Plays Hit Into'],
    ['buddyJumpsHitInto', 'Buddy Jumps Hit Into'], ['starSwings', 'Star Swings'],
    ['starHits', 'Star Hits'], ['batStarsUsed', 'Stars Used'],
    ['battingAverage', 'Batting Average'], ['onBase', 'On Base %'], ['slug', 'Slug %'],
    ['onBasePlusSlug', 'On Base + Slug'], ['starSlug', 'Star Slug %'],
    ['stolenBases', 'Stolen Bases'], ['caughtStealing', 'Caught Stealing'],
    ['stealAttempts', 'Steal Attempts'],
  ],
  'Defensive Stats': [
    ['dgp','Defensive Game Points (DGP)'],
    ['positionsPlayed', 'Position(s) Played'], ['gamesPlayed', 'Games Played'], ['mvps', 'MVPs'], ['putouts', 'Putouts'], ['assists', 'Assists'], ['buddyJumpPutouts', 'Buddy Jump Putouts'],
    ['buddyJumpAttempts', 'Buddy Jump Attempts'], ['doublePlays', 'Double Plays'],
    ['triplePlays', 'Triple Plays'], ['bobbles', 'Bobbles'],
  ],
  'Pitching Stats': [
    ['pgp','Pitching Game Points (PGP)'],
    ['positionsPlayed', 'Position(s) Played'], ['gamesPlayed', 'Games Played'], ['mvps', 'MVPs'], ['battersFaced', 'Batters Faced'], ['inningsPitched', 'Innings Pitched'],
    ['pitches', 'Pitches'], ['strikes', 'Strikes'], ['balls', 'Balls'],
    ['pitchStrikeouts', 'Strikeouts'], ['pitchWalks', 'Walks'], ['beanBalls', 'Bean Balls'],
    ['hitsAllowed', 'Hits Allowed'], ['runsAllowed', 'Runs Allowed'],
    ['singlesAllowed', 'Singles Allowed'], ['doublesAllowed', 'Doubles Allowed'],
    ['triplesAllowed', 'Triples Allowed'], ['hrAllowed', 'HR Allowed'],
    ['earnedRuns', 'Earned Runs'], ['inheritedRuns', 'Inherited Runs'],
    ['starPitches', 'Star Pitches'], ['pitchStarsUsed', 'Stars Used'],
    ['pickoffs', 'Pickoffs'], ['pickoffAttempts', 'Pickoff Attempts'],
    ['era7', 'ERA-7'], ['era9', 'ERA-9'], ['whip', 'WHIP'],
    ['baAgainst', 'BA Against'], ['obAgainst', 'OB% Against'],
    ['slgAgainst', 'SLG Against'], ['opsAgainst', 'OPS Against'],
  ],
}

const rateKeys=new Set(['battingAverage','onBase','slug','onBasePlusSlug','starSlug','inningsPitched','agp','era7','era9','whip','baAgainst','obAgainst','slgAgainst','opsAgainst'])
const ratePrecision=new Set(['battingAverage','onBase','slug','onBasePlusSlug','starSlug','era7','era9','whip','baAgainst','obAgainst','slgAgainst','opsAgainst'])
function renderValue(row,key,view){
  const value=row.stats?.[key]
  if(value==null)return '—'
  if(key==='positionsPlayed')return Array.isArray(value)?value.join(', '):value
  if(view==='Averages per Game'&&key!=='gamesPlayed'){
    const avg=row.perGame?.[key]??(!rateKeys.has(key)&&Number(row.stats?.gamesPlayed)>0&&typeof value==='number'?value/row.stats.gamesPlayed:null)
    return typeof avg==='number'&&Number.isFinite(avg)?avg.toFixed(ratePrecision.has(key)?3:2):'—'
  }
  return typeof value==='number'&&ratePrecision.has(key)?value.toFixed(3):value
}
export default function PreseasonStats({season}){
  const [category,setCategory]=useState('Game Score')
  const [view,setView]=useState('Totals')
  const [query,setQuery]=useState('')
  const [sort,setSort]=useState(null)
  const records=useMemo(()=>Array.isArray(preseasonRecords)?preseasonRecords:[],[])
  const rows=useMemo(()=>{
    if(!season?.id)return []
    const byId=new Map(playerPool.map(player=>[String(player.id),player]))
    return records.filter(row=>String(row.seasonId)===String(season.id)&&byId.has(String(row.playerId))&&Number(row.stats?.gamesPlayed)>0)
      .map(row=>({...row,player:byId.get(String(row.playerId))}))
  },[season?.id,records])
  const visible=useMemo(()=>{
    const q=query.trim().toLowerCase()
    const selected=rows.filter(row=>!q||row.player.name.toLowerCase().includes(q)||String(season?.teams?.find(t=>String(t.id)===String(row.teamId))?.name||'').toLowerCase().includes(q))
    if(sort)selected.sort((a,b)=>{
      const va=sort.key==='name'?a.player.name:sort.key==='team'?season?.teams?.find(t=>String(t.id)===String(a.teamId))?.name:renderValue(a,sort.key,view)
      const vb=sort.key==='name'?b.player.name:sort.key==='team'?season?.teams?.find(t=>String(t.id)===String(b.teamId))?.name:renderValue(b,sort.key,view)
      const na=Number(va),nb=Number(vb)
      const result=va!=='—'&&vb!=='—'&&Number.isFinite(na)&&Number.isFinite(nb)?na-nb:String(va??'').localeCompare(String(vb??''))
      return result*(sort.desc?-1:1)
    })
    return selected
  },[rows,query,sort,view,season?.teams])
  const columns=statGroups[category]
  const toggleSort=key=>setSort(prev=>({key,desc:prev?.key===key?!prev.desc:true}))
  return <section aria-label="Preseason player statistics">
    <h3>Preseason Stats</h3>
    <p>Only players who appear in uploaded preseason game reports are included. Preseason totals are separate from regular-season and career statistics.</p>
    <div className="subnav" role="tablist" aria-label="Preseason stat categories">
      {Object.keys(statGroups).map(name=><button key={name} type="button" role="tab" aria-selected={category===name} className={category===name?'active':''} onClick={()=>{setCategory(name);setSort(null)}}>{name}</button>)}
    </div>
    <div className="subnav" role="tablist" aria-label="Preseason stat view">
      {['Totals','Averages per Game'].map(name=><button key={name} type="button" role="tab" aria-selected={view===name} className={view===name?'active':''} onClick={()=>setView(name)}>{name}</button>)}
    </div>
    {rows.length===0?<div className="empty"><h3>No preseason statistics yet</h3><p>Player statistics will appear here after preseason Project Rio sheets are uploaded and imported.</p></div>:<>
      <input aria-label="Search preseason players or teams" type="search" placeholder="Search preseason players or teams" value={query} onChange={e=>setQuery(e.target.value)}/>
      <div style={{overflowX:'auto',marginTop:12}}>
        <table className="stats-table"><thead><tr>
          <th><button type="button" onClick={()=>toggleSort('name')}>Player</button></th>
          <th><button type="button" onClick={()=>toggleSort('team')}>Team</button></th>
          {columns.map(([key,label])=><th key={key}><button type="button" onClick={()=>toggleSort(key)}>{label}</button></th>)}
        </tr></thead><tbody>{visible.map(row=><tr key={row.playerId}>
          <td><span style={{display:'inline-flex',alignItems:'center',gap:8}}><PlayerPortrait player={row.player} size={32}/>{row.player.name}</span></td>
          <td>{season?.teams?.find(t=>String(t.id)===String(row.teamId))?.name||'—'}</td>
          {columns.map(([key])=><td key={key}>{renderValue(row,key,view)}</td>)}
        </tr>)}</tbody></table>
      </div>
      {visible.length===0&&<p>No matching preseason players.</p>}
    </>}
  </section>
}
