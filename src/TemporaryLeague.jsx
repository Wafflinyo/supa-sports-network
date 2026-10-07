import playerPool from './players.json'
import React, { useState, useRef, useEffect } from 'react'
import test from './temporary-league.json'
import results from './temporary-results.json'
import statGroups from './temporary-stat-columns.json'
import { leagueTabs } from './navigation.js'
import { FantasyRules } from './FantasyHub.jsx'
import TestExtraPanels from './TestExtraPanels.jsx'
import TestMatchupBreakdown from './TestMatchupBreakdown.jsx'
import { ClosedSeasonRoom } from './SeasonRooms.jsx'
import LeagueHistory from './LeagueHistory.jsx'
import { weekResults, fantasyStandings } from './temporary-weeks.js'
import { sumScores, matchupScore, weekKey } from './fantasy-scoring.js'

const profiles = test.profiles
const leagueTeam = id => test.teams.find(t => t.id === id)
const fantasyTeam = id => test.fantasyTeams.find(t => t.id === id)
const owner = pid => test.teams.find(t => t.players.includes(pid))
const date = value => new Intl.DateTimeFormat('en-US', {timeZone:'America/New_York',weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(value))
const names = ids => ids.map(id => profiles[id].name).join(' + ')
const completed = id => results.games.find(game=>game.id===id)
const reportedTeam = team => {
  const lineup = results.lineups?.[team.id]
  if (!lineup) return team
  const outfield = ['LF','CF','RF'].map(pos=>lineup.defense[pos])
  return {...team,...lineup,reported:true,buddyPairs:team.goodChemistryPairs.filter(pair=>pair.every(id=>outfield.includes(id)))}
}
const rateKeys = new Set(['battingAverage','onBase','slug','onBasePlusSlug','starSlug','era7','era9','whip','baAgainst','obAgainst','slgAgainst','opsAgainst'])
const fantasyColumns = [
  ['gamesPlayed','Games Played'],['fantasyPoints','Fantasy Points'],
  ['singles','Singles'],['doubles','Doubles'],['triples','Triples'],['homeRuns','Home Runs'],
  ['runs','Runs'],['rbi','RBI'],['batWalks','Batting Walks'],['hitByPitch','Hit By Pitch'],
  ['stolenBases','Stolen Bases'],['caughtStealing','Caught Stealing'],['batStrikeouts','Batting Strikeouts'],
  ['doublePlaysHitInto','Double Plays Hit Into'],['grandSlams','Grand Slams'],
  ['putouts','Putouts'],['assists','Assists'],['buddyJumpPutouts','Buddy Jump Putouts'],
  ['doublePlays','Double Plays'],['triplePlays','Triple Plays'],['bobbles','Bobbles'],
  ['outs','Pitching Outs'],['pitchStrikeouts','Pitching Strikeouts'],['hitsAllowed','Hits Allowed'],
  ['earnedRuns','Earned Runs'],['hrAllowed','Home Runs Allowed'],['pitchWalks','Pitching Walks'],
  ['beanBalls','Bean Balls'],['pickoffs','Pickoffs'],['threeInningGames','3-Inning Bonuses'],
  ['completeGames','Complete-Game Bonuses'],['teamShutouts','Team Shutout Bonuses'],
]
const statValue = (id,key,view) => key==='gamesPlayed' || view==='Totals' ? results.playerStats[id]?.[key] : results.perGame?.[id]?.[key]
const display = (value,key,view) => value == null ? '—' : rateKeys.has(key) ? value.toFixed(3) : key==='inningsPitched' || view!=='Totals' && key!=='gamesPlayed' ? value.toFixed(2) : value

function PopulatedTestingLeague({ PlayerAvatar }) {
  const [weekNumber,setWeekNumber] = useState(2)
  const week = test.weeks.find(w=>w.number===weekNumber)
  const schedule = test.schedule.filter(game=>weekKey(new Date(game.startsAt))===week.start)
  const weeklyResults = weekResults(results,week.start)
  const weekFinal = schedule.every(game=>completed(game.id))
  const points = id => sumScores(results.games,id,week.start)
  const teamPoints = team => matchupScore(team.starters.map(player_id=>({player_id,slot:'starter'})),results.games,week.start)
  const fantasyTeam = id => week.fantasyTeams.find(t=>t.id===id)
  const standings = fantasyStandings(test,results)
  const [section,setSection] = useState('Home')
  const [fantasyTab,setFantasyTab] = useState('Matchups')
  const fantasyTabs = ['Matchups','Schedule','Standings','Teams','Fantasy Stats','Transactions','Free Agency','Draft','Rules & Point System']
  const fantasyMap = {Matchups:'Fantasy teams',Schedule:'Fantasy schedule',Standings:'Fantasy standings',Teams:'Fantasy teams','Fantasy Stats':'Fantasy Stats',Transactions:'Fantasy transactions','Free Agency':'Fantasy free agency',Draft:'Draft boards','Rules & Point System':'Fantasy rules'}
  const tab = section==='Sluggers Fantasy' ? fantasyMap[fantasyTab] : ({Teams:'League teams',Schedule:'Week schedule',Draft:'Draft boards','SSL Draft Room':'Draft boards'}[section] || section)
  const setTab = name => { if(name==='Fantasy standings'){setSection('Sluggers Fantasy');setFantasyTab('Standings')}else setSection(name) }
  const [draft,setDraft] = useState('League')
  const [round,setRound] = useState(1)
  const [activeMatchup,setActiveMatchup] = useState(null)
  const matchupDialog = useRef(null)
  useEffect(()=>{
    if(activeMatchup===null)return
    matchupDialog.current?.showModal()
    const previous=document.body.style.overflow
    document.body.style.overflow='hidden'
    return ()=>{document.body.style.overflow=previous}
  },[activeMatchup])
  const [selected,setSelected] = useState(test.fantasyTeams[0].id)
  const [statGroup,setStatGroup] = useState('Offensive Stats')
  const [statView,setStatView] = useState('Totals')
  const [query,setQuery] = useState('')
  const [sort,setSort] = useState({key:'fantasyPoints',direction:'desc'})
  const tabs = leagueTabs
  const isFantasyStats = tab==='Fantasy Stats'
  const columns = isFantasyStats ? fantasyColumns : [...statGroups[statGroup],['fantasyPoints','Fantasy points']]
  const shownStat = (id,key) => statValue(id,key,statView) ?? (isFantasyStats && results.playerStats[id] ? 0 : null)
  const statPlayers = Object.values(profiles).filter(p=>p.name.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>{
    const av=sort.key==='name'?a.name:shownStat(a.id,sort.key)
    const bv=sort.key==='name'?b.name:shownStat(b.id,sort.key)
    if(av==null && bv!=null)return 1
    if(bv==null && av!=null)return -1
    const comparison=typeof av==='number' && typeof bv==='number'?av-bv:String(av??'').localeCompare(String(bv??''))
    return comparison ? (sort.direction==='asc'?comparison:-comparison) : (playerPool.find(p=>p.id===a.id)?.rosterOrder ?? a.id)-(playerPool.find(p=>p.id===b.id)?.rosterOrder ?? b.id)
  })
  const sortBy = key => setSort(previous=>({key,direction:previous.key===key && previous.direction==='desc'?'asc':'desc'}))
  const roster = fantasyTeam(selected)
  const player = (id,detail) => <div className="test-player" key={id}><PlayerAvatar player={profiles[id]} size={30}/><div><strong>{profiles[id].name}</strong><small>{detail || profiles[id].ability}</small></div></div>
  return <>
    <div className="page-heading"><span className="eyebrow dark">TEMPORARY EXHIBITION SETUP</span><h1>LEAGUE TESTING</h1><p>{week.label} · Eastern Time. {weeklyResults.games.length} of 5 game reports received. Putouts earn 1 point; assists earn 0.75. Results and fantasy points come from uploaded Project Rio reports.</p></div>
    <div className="test-summary panel testing-summary"><div><strong>10</strong><span>league teams</span></div><div><strong>90</strong><span>rostered players</span></div><div><strong>5</strong><span>scheduled games</span></div><div><strong>8</strong><span>fantasy teams</span></div></div>
    <div className="stat-view-switch" aria-label="Test week selector">{test.weeks.map(w=><button key={w.number} className={weekNumber===w.number?'active':''} onClick={()=>{setActiveMatchup(null);setWeekNumber(w.number)}}>Week {w.number} · {w.label}</button>)}</div>
    <div className="subnav test-tabs">{tabs.map(t => <button key={t} className={section===t?'active':''} onClick={()=>{setActiveMatchup(null);setSection(t);setDraft(t==='Sluggers Fantasy'?'Fantasy':'League');setRound(1)}}>{t}</button>)}</div>
    {section==='Sluggers Fantasy' && <div className="subnav test-fantasy-tabs" aria-label="Testing fantasy navigation">{fantasyTabs.map(name=><button key={name} className={fantasyTab===name?'active':''} onClick={()=>{setActiveMatchup(null);setFantasyTab(name);setDraft('Fantasy');setRound(1)}}>{name}</button>)}</div>}
    <TestExtraPanels tab={tab} test={test} results={results} week={week} weeklyResults={weeklyResults} schedule={schedule} PlayerAvatar={PlayerAvatar} onNavigate={setSection} fantasyTeams={week.fantasyTeams}/>
    {tab==='SSL History' && <LeagueHistory/>}
    {['SSL Playoffs','Voting'].includes(tab) && <ClosedSeasonRoom kind={tab}/>}
    {tab==='Fantasy rules' && <FantasyRules/>}
    {tab==='Fantasy schedule' && <section className="panel test-team"><div className="section-title"><h2>WEEK {week.number} FANTASY SCHEDULE</h2></div><div className="test-team-body"><p className="test-note">{week.label} · Sunday 12:00 a.m.–Saturday 11:59:59 p.m. ET</p>{week.fantasyMatchups.map(([a,b])=><article key={a} className="test-game"><strong>{fantasyTeam(a).name} <span>vs</span> {fantasyTeam(b).name}</strong><b>{weekFinal?'Final':'Upcoming'}</b></article>)}</div></section>}
    {tab==='League teams' && <>
      <p className="test-note">Nine rounds in snake order after captain anchors. Lineups emphasize contact at the top, power in the middle, pitching options, and chemistry in the outfield. Named Miis use Mii stats and color chemistry.</p>
      <div className="test-grid test-roster-columns">{[0,1].map(column=><div className="test-roster-column" key={column}>{test.teams.filter((_,index)=>index%2===column).map(reportedTeam).map(team => <details className="panel test-team test-team-disclosure" key={team.id} style={{order:test.teams.findIndex(t=>t.id===team.id)}}>
        <summary className="section-title"><div><small>{team.players.length} PLAYERS · ANCHOR {profiles[team.anchor].name}</small><h2>{team.name}</h2></div><span className="disclosure-label">Lineup <span aria-hidden="true">⌄</span></span></summary>
        <div className="test-team-body"><p>{team.reported?'Actual report lineup · leftmost position is the starting position':team.identity}</p>
          <div className="test-lineup-head"><span>BAT</span><span>PLAYER / ABILITY</span><span>POS</span></div>
          {team.battingOrder.map((id,i) => <div className="test-lineup-row" key={id}><b>{i+1}</b>{player(id)}<b>{Object.entries(team.defense).find(([,pid])=>pid===id)?.[0]}</b></div>)}
          <dl className="test-details"><div><dt>Opening pitcher</dt><dd>{profiles[team.defense.P].name}</dd></div><div><dt>Pitching options</dt><dd>{team.pitchingDepth.map(id=>profiles[id].name).join(', ')}</dd></div><div><dt>Outfield buddy pairs</dt><dd>{team.buddyPairs.map(pair=>names(pair)).join('; ') || 'No positive pair'}</dd></div><div><dt>Positive chemistry</dt><dd>{team.goodChemistryPairs.length} pairs</dd></div>
            {!!team.badChemistryPairs.length && <div><dt>Watch chemistry</dt><dd>{team.badChemistryPairs.map(pair=>names(pair)).join('; ')}. Keep these pairs apart in fielding and batting order.</dd></div>}
          </dl>
          {team.players.filter(id=>!team.battingOrder.includes(id)).length>0 && <section className="test-league-bench"><h3>Bench</h3>{team.players.filter(id=>!team.battingOrder.includes(id)).map(id=>player(id))}</section>}
        </div></details>)}</div>)}</div>
      <p className="test-note">Teams awaiting reports show suggested lineups. After a report arrives, batting order and starting positions come from that report. Buddy jumps depend on in-game positioning.</p>
    </>}
    {tab==='Week schedule' && <section className="panel test-team"><div className="section-title"><div><small>ONE GAME PER TEAM · SEVEN INNINGS</small><h2>WEEK {week.number} SCHEDULE</h2></div></div><div className="test-team-body">
      {schedule.map(game=><article className="test-game" key={game.id}><div><small>{date(game.startsAt)} ET</small><strong>{leagueTeam(game.awayId).name}<span> at </span>{leagueTeam(game.homeId).name}</strong><p>{game.stadium} · {completed(game.id)?'Final':'Awaiting game report'}</p></div><b>{completed(game.id)?`${completed(game.id).awayRuns}–${completed(game.id).homeRuns}`:'VS'}</b></article>)}
      <p className="test-note">All ten teams appear exactly once. Fantasy matchups run Sunday at 12:00 a.m. through Saturday at 11:59:59 p.m. These scheduled times are exhibition fixtures, not live database lineup locks.</p>
    </div></section>}
    {tab==='Standings' && <>
      <section className="panel test-team"><div className="section-title"><h2>LEAGUE STANDINGS</h2></div><div className="table-scroll"><table className="fantasy-simple-table"><thead><tr><th>Team</th><th>GP</th><th>W</th><th>L</th><th>T</th><th>Runs for</th><th>Runs against</th></tr></thead><tbody>{[...test.teams].sort((a,b)=>results.standings[b.id].wins-results.standings[a.id].wins || (results.standings[b.id].runsFor-results.standings[b.id].runsAgainst)-(results.standings[a.id].runsFor-results.standings[a.id].runsAgainst)).map(team=><tr key={team.id}><td>{team.name}</td>{['played','wins','losses','ties','runsFor','runsAgainst'].map(key=><td key={key}>{results.standings[team.id][key]}</td>)}</tr>)}</tbody></table></div></section>
    </>}
    {(tab==='Player Stats' || isFantasyStats) && <section className="panel test-team test-stats"><div className="section-title"><h2>{isFantasyStats?'FANTASY STATS':'TEST PLAYER STATS'}</h2></div>
      {!isFantasyStats && <div className="subnav stat-tabs">{Object.keys(statGroups).map(group=><button key={group} className={group===statGroup?'active':''} onClick={()=>setStatGroup(group)}>{group}</button>)}</div>}
      <div className="stat-view-switch">{['Totals','Averages per Game'].map(view=><button key={view} className={statView===view?'active':''} onClick={()=>setStatView(view)}>{view==='Totals'?'Totals':'Averages'}</button>)}</div>
      <div className="table-tools"><div className="search"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search test players" aria-label="Search test players"/></div><span>{statPlayers.length} PLAYERS</span></div>
      <div className="table-scroll"><table className="fantasy-simple-table ssl-stat-table" style={{width:`${580+columns.length*112}px`}}><caption>{isFantasyStats?'Fantasy Stats':statGroup} · {statView}</caption><colgroup><col style={{width:210}}/><col style={{width:210}}/><col style={{width:160}}/>{columns.map(([key])=><col key={key} style={{width:112}}/>)}</colgroup><thead><tr><th><button onClick={()=>sortBy('name')}>Player</button></th><th>Team</th><th>Position(s) Played</th>{columns.map(([key,label])=><th key={key} className="numeric-column"><button onClick={()=>sortBy(key)}>{label}{sort.key===key?(sort.direction==='asc'?' ↑':' ↓'):''}</button></th>)}</tr></thead><tbody>{statPlayers.map(p=><tr key={p.id}><td>{p.name}</td><td>{owner(p.id).name}</td><td>{results.playerStats[p.id]?.positionsPlayed?.join(', ')||'—'}</td>{columns.map(([key])=><td key={key} className="numeric-column">{display(shownStat(p.id,key),key,statView)}</td>)}</tr>)}</tbody></table></div>
      <p className="test-note">{isFantasyStats?'Only stats that affect fantasy scoring are included. Bonus columns count qualifying games; Fantasy Points includes their awarded points. All players show their earned points, while only fantasy starters contribute to head-to-head scores.':'All columns match the regular Player Stats categories. Totals use cumulative counts and recalculated rates; averages use counts per appearance and mean reported game rates. Pitching innings are decimal innings, as in Rio (1.33 means four outs).'} Positions include every reported position across uploaded games. A dash means no reported value yet. Averages divide fantasy points and scoring counts by games played. Player names remain fixed while you scroll sideways. Click headings to sort.</p>
    </section>}
    {tab==='Fantasy standings' && <section className="panel test-team"><div className="section-title"><h2>FANTASY LEAGUE STANDINGS</h2></div><div className="table-scroll"><table className="fantasy-simple-table"><thead><tr><th>Rank</th><th>Team</th><th>Played</th><th>W</th><th>L</th><th>T</th><th>Win %</th><th>Points for</th><th>Points against</th></tr></thead><tbody>{standings.map((row,i)=><tr key={row.id}><td>{i+1}</td><td>{row.name}</td>{['played','wins','losses','ties'].map(key=><td key={key}>{row[key]}</td>)}<td>{row.played?((row.wins+row.ties/2)/row.played).toFixed(3):'—'}</td><td>{row.pointsFor}</td><td>{row.pointsAgainst}</td></tr>)}</tbody></table></div><p className="test-note">Completed weeks only. Ranked by win percentage, then points for. Bench points are excluded. Week 1 results are preserved; Week 2 counts after all five reports arrive.</p></section>}
    {tab==='Fantasy teams' && <>
      <p className="test-note">The temporary fantasy league uses a ten-round snake draft from the 90 league-rostered characters. Eight rosters have seven open starters and three bench players. Free-agent pickups are disabled.</p>
      {fantasyTab==='Matchups' && <div className="test-matchups">{week.fantasyMatchups.map(([a,b],index)=><button type="button" className="panel test-matchup test-matchup-button" key={a} onClick={()=>setActiveMatchup(index)}><strong>{fantasyTeam(a).name} · {teamPoints(fantasyTeam(a))}</strong><span>VS</span><strong>{fantasyTeam(b).name} · {teamPoints(fantasyTeam(b))}</strong><small>{weekFinal?'Final':`${weeklyResults.games.length}/5 reports received · provisional scores`} · <b>Open matchup →</b></small></button>)}</div>}
      {activeMatchup!==null && <dialog ref={matchupDialog} className="matchup-dialog" aria-labelledby="matchup-dialog-title" onCancel={()=>setActiveMatchup(null)} onClick={e=>{if(e.target===e.currentTarget)setActiveMatchup(null)}}><div className="matchup-dialog-content"><header className="matchup-dialog-header"><button type="button" onClick={()=>setActiveMatchup(null)}>← Back to matchups</button><h2 id="matchup-dialog-title">{week.fantasyMatchups[activeMatchup].map(id=>fantasyTeam(id).name).join(' vs ')}</h2><button type="button" aria-label="Close matchup" onClick={()=>setActiveMatchup(null)}>✕</button></header><div className="test-matchup matchup-scoreboard">{week.fantasyMatchups[activeMatchup].map((id,index)=><React.Fragment key={id}>{index===1 && <span>VS</span>}<strong>{fantasyTeam(id).name} · {teamPoints(fantasyTeam(id))}</strong></React.Fragment>)}<small>{weeklyResults.games.length}/5 reports received · {weekFinal?'Final scores':'Provisional scores'}</small></div><TestMatchupBreakdown teams={week.fantasyMatchups[activeMatchup].map(fantasyTeam)} test={test} results={weeklyResults} columns={fantasyColumns} PlayerAvatar={PlayerAvatar}/></div></dialog>}

      {fantasyTab==='Teams' && <div className="test-fantasy-layout"><aside className="panel test-fantasy-list">{test.fantasyTeams.map(team=><button className={team.id===selected?'selected':''} key={team.id} onClick={()=>setSelected(team.id)}>{team.name}<small>7 starters · 3 bench</small></button>)}</aside>
        <section className="panel test-team"><div className="section-title"><div><small>TEMPORARY FANTASY ROSTER</small><h2>{roster.name}</h2></div></div><div className="test-team-body">
          <div className="test-fantasy-roster">{[['Starters',roster.starters],['Bench',roster.bench]].map(([title,ids])=><section key={title}><h3>{title} ({ids.length})</h3>{ids.map(id=>player(id,`${owner(id).name} · ${points(id)} pts${title==='Bench'?' · excluded from matchup':''}`))}</section>)}</div>
          {week.lineupReview && <p className="test-note"><strong>Week 2 changes:</strong> {week.lineupReview.changes.find(change=>change.teamId===roster.id)?.promoted.map(id=>profiles[id].name).join(', ')} into the starting seven; {week.lineupReview.changes.find(change=>change.teamId===roster.id)?.benched.map(id=>profiles[id].name).join(', ')} to the bench.</p>}
          <p className="test-note">{week.lineupReview?'Week 2 starters were selected after reviewing Week 1 batting, fielding, and pitching points. Ties retain the previous starter.':'Saved lineup for this completed week.'} Only starters contribute to the weekly matchup.</p>
        </div></section></div>}
      <details className="panel test-undrafted"><summary>10 league-rostered players not drafted in fantasy</summary><p>{names(test.eligibleUndrafted)}</p><p>They remain unavailable for pickups during this test.</p></details>
      <p className="test-note">These saved exhibition lineups score automatically when reports are added and the site rebuilds. Only seven starters contribute; all batting, fielding, pitching, and team bonuses count for each starter. Registered accounts, live drafts, and editable lineups with game-time locks still require Supabase setup.</p>
    </>}
    {tab==='Draft boards' && <section className="panel test-team"><div className="section-title"><div><small>COMPLETE PICK HISTORY</small><h2>{draft.toUpperCase()} DRAFT</h2></div></div><div className="test-team-body">
      <div className="test-draft-controls"><strong>{draft} draft · completed</strong><label>Round <select value={round} onChange={e=>setRound(Number(e.target.value))}>{Array.from({length:draft==='League'?9:10},(_,i)=><option key={i+1}>{i+1}</option>)}</select></label></div>
      <div className="table-scroll"><table className="fantasy-simple-table test-draft-table"><thead><tr><th>Pick</th><th>Team</th><th>Player</th><th>Ability</th></tr></thead><tbody>{(draft==='League'?test.leagueDraft:test.fantasyDraft).filter(p=>p.round===round).map(p=><tr key={p.pick}><td>{p.pick}</td><td>{(draft==='League'?leagueTeam(p.teamId):fantasyTeam(p.teamId)).name}</td><td>{profiles[p.playerId].name}</td><td>{profiles[p.playerId].ability}</td></tr>)}</tbody></table></div>
    </div></section>}
  </>
}


function EmptyTestingLeague() {
  const [section,setSection] = useState('Home')
  const [fantasyTab,setFantasyTab] = useState('Matchups')
  const fantasyTabs = ['Matchups','Schedule','Standings','Teams','Fantasy Stats','Transactions','Free Agency','Draft','Rules & Point System']
  const fantasy = section === 'Sluggers Fantasy'
  const current = fantasy ? fantasyTab : section
  return <>
    <div className="page-heading"><span className="eyebrow dark">TEMPORARY EXHIBITION SETUP</span><h1>LEAGUE TESTING</h1><p>Testing has been reset. Start a new test setup to add league teams, fantasy teams, schedules, and game reports.</p></div>
    <div className="test-summary panel testing-summary">{['league teams','rostered players','scheduled games','fantasy teams'].map(label=><div key={label}><strong>0</strong><span>{label}</span></div>)}</div>
    <div className="subnav test-tabs">{leagueTabs.map(name=><button key={name} className={section===name?'active':''} onClick={()=>setSection(name)}>{name}</button>)}</div>
    {fantasy && <div className="subnav test-fantasy-tabs" aria-label="Testing fantasy navigation">{fantasyTabs.map(name=><button key={name} className={fantasyTab===name?'active':''} onClick={()=>setFantasyTab(name)}>{name}</button>)}</div>}
    {fantasy && current==='Rules & Point System' ? <FantasyRules/> : ['SSL Playoffs','Voting'].includes(current) ? <ClosedSeasonRoom kind={current}/> : <section className="panel basic-panel"><div className="empty"><h3>{fantasy?'Fantasy ':''}{current} — no test data</h3><p>There are no test teams, drafts, games, results, or fantasy scores. This tab is ready for a new testing setup.</p></div></section>}
  </>
}

export default function TemporaryLeague(props) {
  return test.weeks.length && test.teams.length ? <PopulatedTestingLeague {...props}/> : <EmptyTestingLeague/>
}
