import React,{useMemo,useState} from 'react'
import playerPool from './players.json'
import {preseasonGames,preseasonPlayerStats,preseasonTeamStats} from './preseason-game-data.js'
import {PlayerPortrait} from './PlayerPortrait.jsx'
import {visibleGamePointFields} from './game-point-columns.js'
import './preseason-stats.css'

// Preseason records are isolated from official regular-season statistics.
// Importers should add only participants from uploaded preseason sheets.
// Each row: {seasonId,playerId,teamId,stats:{...},perGame:{...}}.
const statGroups = {
  'Game Score': [
    ['gamesPlayed','Games Played'],['gameScore','Game Score'],
    ['ogp','OGP'],['dgp','DGP'],['pgp','PGP'],['tgp','TGP'],['agp','AGP'],['itemScore','Item Score'],
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
  if(value==null)return rateKeys.has(key)?'—':0
  if(key==='positionsPlayed')return Array.isArray(value)?value.join(', '):value
  if(view==='Averages per Game'&&key!=='gamesPlayed'){
    const avg=row.perGame?.[key]??(!rateKeys.has(key)&&Number(row.stats?.gamesPlayed)>0&&typeof value==='number'?value/row.stats.gamesPlayed:null)
    return typeof avg==='number'&&Number.isFinite(avg)?avg.toFixed(ratePrecision.has(key)?3:2):'—'
  }
  return typeof value==='number'&&ratePrecision.has(key)?value.toFixed(3):value
}
export default function PreseasonStats({season}){
  const [scope,setScope]=useState('Players')
  const [category,setCategory]=useState('Game Score')
  const [view,setView]=useState('Totals')
  const [query,setQuery]=useState('')
  const [sort,setSort]=useState(null)
  const playerRows=useMemo(()=>preseasonPlayerStats(),[])
  const teamRows=useMemo(()=>preseasonTeamStats(),[])
  const rows=scope==='Teams'?teamRows:playerRows
  const byId=useMemo(()=>new Map(playerPool.map(p=>[String(p.id),p])),[])
  const visible=useMemo(()=>{
    const q=query.trim().toLowerCase()
    const filtered=rows.filter(row=>(!q||row.teamName.toLowerCase().includes(q)||
      (row.playerId&&(row.playerName||byId.get(String(row.playerId))?.name||'').toLowerCase().includes(q))))
    const cell=(row,key)=>key==='name'?row.playerName||byId.get(String(row.playerId))?.name||'':key==='team'?row.teamName:row.stats[key]??0
    if(sort)filtered.sort((a,b)=>{
      const aa=view==='Averages per Game'&&sort.key!=='name'&&sort.key!=='team'?a.perGame?.[sort.key]??0:cell(a,sort.key)
      const bb=view==='Averages per Game'&&sort.key!=='name'&&sort.key!=='team'?b.perGame?.[sort.key]??0:cell(b,sort.key)
      const result=typeof aa==='number'&&typeof bb==='number'?aa-bb:String(aa).localeCompare(String(bb))
      return sort.desc?-result:result
    })
    return filtered
  },[rows,query,sort,view,byId])
  const columns=visibleGamePointFields(statGroups[category],view)
  const toggleSort=key=>setSort(prev=>({key,desc:prev?.key===key?!prev.desc:true}))
  return <section className="panel" aria-label="Preseason statistics">
    <h3>Preseason Stats</h3>
    <p>Separate preseason-only statistics, calculated from imported Project Rio reports. Only players who took part appear here; these stats do not affect regular-season or career totals.</p>
    <p><strong>{preseasonGames.length} game{preseasonGames.length===1?'':'s'} recorded · {playerRows.length} players</strong></p>
    <div className="subnav" role="tablist" aria-label="Preseason stats scope">
      {['Players','Teams'].map(name=><button key={name} type="button" role="tab" aria-selected={scope===name} className={scope===name?'active':''} onClick={()=>{setScope(name);setSort(null);setQuery('')}}>{name}</button>)}
    </div>
    <div className="subnav" role="tablist" aria-label="Preseason statistical categories">
      {Object.keys(statGroups).map(name=><button key={name} type="button" role="tab" aria-selected={category===name} className={category===name?'active':''} onClick={()=>{setCategory(name);setSort(null)}}>{name}</button>)}
    </div>
    <div className="subnav" role="tablist" aria-label="Preseason stats view">
      {['Totals','Averages per Game'].map(name=><button key={name} type="button" role="tab" aria-selected={view===name} className={view===name?'active':''} onClick={()=>{setView(name);setSort(null)}}>{name}</button>)}
    </div>
    {rows.length===0?<div className="empty"><h3>No preseason statistics yet</h3><p>Stats appear after Project Rio preseason game reports are imported.</p></div>:<>
      <input aria-label="Search preseason players or teams" type="search" placeholder="Search players or teams" value={query} onChange={e=>setQuery(e.target.value)}/>
      <div className="ssl-pre-stats-scroll" role="region" aria-label="Preseason statistics table" tabIndex={0}>
        <table className="ssl-pre-stats-table">
          <thead><tr>
            {scope==='Players'&&<th scope="col" className="ssl-pre-stats-text" aria-sort={sort?.key==='name'?(sort.desc?'descending':'ascending'):'none'}>
              <button type="button" onClick={()=>toggleSort('name')}>Player</button>
            </th>}
            <th scope="col" className="ssl-pre-stats-text" aria-sort={sort?.key==='team'?(sort.desc?'descending':'ascending'):'none'}>
              <button type="button" onClick={()=>toggleSort('team')}>Team</button>
            </th>
            {scope==='Teams'&&<>
              <th scope="col" className="ssl-pre-stats-number">Runs For</th>
              <th scope="col" className="ssl-pre-stats-number">Runs Against</th>
            </>}
            {columns.map(([key,label])=><th key={key} scope="col"
              className={key==='positionsPlayed'?'ssl-pre-stats-text ssl-pre-stats-position':'ssl-pre-stats-number'}
              aria-sort={sort?.key===key?(sort.desc?'descending':'ascending'):'none'}>
              <button type="button" onClick={()=>toggleSort(key)}>{label}</button>
            </th>)}
          </tr></thead>
          <tbody>{visible.map(row=><tr key={String(row.playerId||'team')+'-'+row.teamName}>
            {scope==='Players'&&<td className="ssl-pre-stats-text"><span className="ssl-pre-stats-player">
              {byId.has(String(row.playerId))&&<PlayerPortrait player={byId.get(String(row.playerId))} size={32}/>}
              {row.playerName||byId.get(String(row.playerId))?.name||'Unknown player'}</span></td>}
            <td className="ssl-pre-stats-text">{row.teamName}</td>
            {scope==='Teams'&&<>
              <td className="ssl-pre-stats-number">{view==='Totals'?row.stats.runsScored:row.perGame.runsScored.toFixed(2)}</td>
              <td className="ssl-pre-stats-number">{view==='Totals'?row.stats.runsAllowed:row.perGame.runsAllowed.toFixed(2)}</td>
            </>}
            {columns.map(([key])=><td className={key==='positionsPlayed'?'ssl-pre-stats-text ssl-pre-stats-position':'ssl-pre-stats-number'} key={key}>{renderValue(row,key,view)}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
      {visible.length===0&&<p>No matching preseason players or teams.</p>}
    </>}
  </section>
}
