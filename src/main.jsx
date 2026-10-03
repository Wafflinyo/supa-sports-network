import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createClient } from '@supabase/supabase-js'
import { ArrowDown, ArrowUp, CalendarDays, Menu, Search, Shield, Trophy, X } from 'lucide-react'
import playerPool from './players.json'
import gamesPlayed from './games-played.json'
import { playerPortraitStyle } from './player-portraits.js'
import { FantasyLeague, FantasyRules } from './FantasyHub.jsx'
import TemporaryLeague from './TemporaryLeague.jsx'
import { leagueTabs } from './navigation.js'
import { AccountDialog, CommissionerCodes } from './LeagueAccount.jsx'
import { ClosedSeasonRoom, SSLDraftRoom } from './SeasonRooms.jsx'
import LeagueHistory from './LeagueHistory.jsx'
import connection from './supabase-config.json'
import './styles.css'

const url = import.meta.env.VITE_SUPABASE_URL || connection.url
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || connection.publishableKey
const supabase = url && key ? createClient(url, key) : null
const players = playerPool.map(player => ({ ...player, gamesPlayed: gamesPlayed[player.id] ?? null }))
function PlayerAvatar({ player, size = 38 }) {
  const portrait = playerPortraitStyle(player.name, size)
  return <span className={`player-avatar${portrait ? ' has-portrait' : ''}`} style={{ width: size, height: size, flex: `0 0 ${size}px`, ...portrait }} aria-hidden="true">{portrait ? null : player.name.slice(0, 1)}</span>
}
const nav = [...leagueTabs, 'Test Week']
// Project Rio's export headings, grouped for browsing. Helper columns are export internals.
const statGroups = {
  'Offensive Stats': [
    ['gamesPlayed', 'Games Played'], ['atBats', 'At-Bats'], ['plateAppearances', 'Plate Appearances'], ['runs', 'Runs'],
    ['hits', 'Hits'], ['rbi', 'RBI'], ['batStrikeouts', 'Strikeouts'], ['batWalks', 'Walks'],
    ['hitByPitch', 'Hit By Pitch'], ['singles', 'Singles'], ['doubles', 'Doubles'],
    ['triples', 'Triples'], ['homeRuns', 'Home Runs'], ['oneHr', '1HR'], ['twoHr', '2HR'],
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
    ['gamesPlayed', 'Games Played'], ['putouts', 'Putouts'], ['assists', 'Assists'], ['buddyJumpPutouts', 'Buddy Jump Putouts'],
    ['buddyJumpAttempts', 'Buddy Jump Attempts'], ['doublePlays', 'Double Plays'],
    ['triplePlays', 'Triple Plays'], ['bobbles', 'Bobbles'],
  ],
  'Pitching Stats': [
    ['gamesPlayed', 'Games Played'], ['battersFaced', 'Batters Faced'], ['inningsPitched', 'Innings Pitched'],
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
// Rates and baseball innings need per-game export values; dividing season rates or 3.1 IP is misleading.
const perGameOnly = new Set(['battingAverage', 'onBase', 'slug', 'onBasePlusSlug', 'starSlug',
  'inningsPitched', 'era7', 'era9', 'whip', 'baAgainst', 'obAgainst', 'slgAgainst', 'opsAgainst'])

function statValue(player, key, view) {
  const total = player.stats?.[key] ?? player[key]
  if (key === 'gamesPlayed') return total ?? null
  if (view === 'Totals') return total ?? null
  const perGame = player.perGame?.[key]
  if (perGame != null) return perGame
  if (perGameOnly.has(key)) return null
  const games = player.gamesPlayed
  return typeof total === 'number' && Number.isFinite(total) && Number.isInteger(games) && games > 0
    ? total / games : null
}

function displayStat(value, view, key) {
  if (value == null) return '—'
  if (key === 'gamesPlayed') return value
  return view === 'Averages per Game' && typeof value === 'number'
    ? value.toFixed(perGameOnly.has(key) && key !== 'inningsPitched' ? 3 : 2) : value
}

function Empty({ icon: Icon = CalendarDays, title, children }) {
  return <div className="empty"><span className="empty-icon"><Icon size={28} strokeWidth={1.8}/></span><h3>{title}</h3><p>{children}</p></div>
}
function SectionTitle({ kicker, children, right }) {
  return <div className="section-title"><div><small>{kicker}</small><h2>{children}</h2></div>{right}</div>
}
function App() {
  const [page, setPage] = useState(window.location.hash === '#test-week' ? 'Test Week' : 'Home')
  const [rulesOpen, setRulesOpen] = useState(false)
  const [menu, setMenu] = useState(false)
  const [session, setSession] = useState(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [access, setAccess] = useState({role:'viewer'})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [leagues, setLeagues] = useState([])
  const [selectedLeague, setSelectedLeague] = useState(null)
  const [leagueName, setLeagueName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [query, setQuery] = useState('')
  const [statTab, setStatTab] = useState('Offensive Stats')
  const [statView, setStatView] = useState('Totals')
  const [sort, setSort] = useState({ key: 'id', direction: 'asc' })
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const isCommissioner = Boolean(session && access.role === 'commissioner')
  const visibleNav = isCommissioner ? [...nav, 'Commissioner Tools'] : nav

  useEffect(() => {
    if (page === 'Commissioner Tools' && !isCommissioner) {
      setPage('Home')
      setMenu(false)
    }
  }, [page, isCommissioner])

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!supabase || !session) { setLeagues([]); setSelectedLeague(null); return }
    loadLeagues()
  }, [session?.user?.id])
  useEffect(() => {
    if (!session || !supabase) { setAccess({role:'viewer'}); return }
    let live=true
    const refresh=async()=>{const r=await supabase.rpc('league_session_access');if(live) setAccess(r.error?{role:'participant'}:r.data)}
    refresh(); const timer=setInterval(refresh,15000)
    return()=>{live=false;clearInterval(timer)}
  }, [session?.user?.id])
  async function loadLeagues() {
    const { data, error } = await supabase.from('fantasy_memberships').select('league_id, fantasy_leagues(id, name, invite_code, created_at)').eq('user_id', session.user.id).order('joined_at', { ascending: false })
    if (error) { setMessage(error.message); return }
    const items = (data || []).map(x => x.fantasy_leagues).filter(Boolean)
    setLeagues(items)
    setSelectedLeague(current => items.find(x => x.id === current?.id) || items[0] || null)
  }
  async function createLeague(e) {
    e.preventDefault(); setBusy(true); setMessage('')
    const { data, error } = await supabase.rpc('create_fantasy_league', { league_name: leagueName.trim() })
    setBusy(false); if (error) { setMessage(error.message); return }
    setLeagueName(''); await loadLeagues(); setSelectedLeague(data)
  }
  async function joinLeague(e) {
    e.preventDefault(); setBusy(true); setMessage('')
    const { error } = await supabase.rpc('join_fantasy_league', { code: joinCode.trim().toUpperCase() })
    setBusy(false); if (error) { setMessage(error.message); return }
    setJoinCode(''); setMessage('You joined the league.'); await loadLeagues()
  }
  const filtered = useMemo(() => players.filter(p => `${p.name} ${p.class} ${p.source}`.toLowerCase().includes(query.toLowerCase())).sort((a,b) => {
    const av = statGroups[statTab].some(([key]) => key === sort.key) ? statValue(a, sort.key, statView) : a[sort.key]
    const bv = statGroups[statTab].some(([key]) => key === sort.key) ? statValue(b, sort.key, statView) : b[sort.key]
    if (av == null && bv != null) return 1
    if (bv == null && av != null) return -1
    const comparison = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''))
    return sort.direction === 'asc' ? comparison : -comparison
  }), [query, sort, statTab, statView])
  function sortBy(key) { setSort(s => ({ key, direction: s.key === key && s.direction === 'desc' ? 'asc' : 'desc' })) }
  function go(next) { if (next === 'Commissioner Tools' && !isCommissioner) return; window.history.replaceState(null, '', next === 'Test Week' ? '#test-week' : window.location.pathname); setPage(next); setMenu(false); setMessage(''); window.scrollTo({top: 0, behavior: 'smooth'}) }
  const logo = `${import.meta.env.BASE_URL}sluggers-supa-league-logo.svg`
  return <>
    <div className="topline"><div className="container topline-inner"><span><i className="live-dot"/> SLUGGERS SUPA LEAGUE</span><span>THE LEAGUE STARTS HERE <b>★</b></span><button onClick={() => setAuthOpen(true)}>{session ? session.user.email?.split('@')[0] : 'SIGN IN / JOIN'}</button></div></div>
    <header className="masthead"><div className="container masthead-inner"><button className="brand" onClick={() => go('Home')}><img src={logo} alt="Sluggers Supa League logo"/><span><strong>SLUGGERS <em>SUPA</em> LEAGUE</strong><small>THE OFFICIAL LEAGUE HUB</small></span></button><button className="mobile-menu" aria-label="Open menu" onClick={() => setMenu(!menu)}>{menu ? <X/> : <Menu/>}</button><div className="masthead-right"><span className="league-tag">MARIO SUPER SLUGGERS</span><span className="badge-star">★</span></div></div></header>
    <nav className={`nav ${menu ? 'open' : ''}`} aria-label="Main navigation"><div className="container nav-inner">{visibleNav.map(n => <button key={n} className={page === n ? 'active' : ''} onClick={() => go(n)}>{n}</button>)}</div></nav>
    <main className="container page-content">
      {page === 'Commissioner Tools' && isCommissioner && <><div className="page-heading"><span className="eyebrow dark">LEAGUE ADMINISTRATION</span><h1>COMMISSIONER TOOLS</h1></div><CommissionerCodes supabase={supabase} onAccess={setAccess}/></>}
      {access.role === 'gm' && <p className="inline-message">GM access enabled for {access.team}.</p>}
      {page === 'Test Week' && <TemporaryLeague PlayerAvatar={PlayerAvatar}/>}
      {page === 'Home' && <>
        <div className="home-grid"><div className="hero"><div className="hero-content"><span className="eyebrow">WELCOME TO THE LEAGUE</span><h1>THE GAME<br/><span>STARTS HERE.</span></h1><p>Follow every game, explore the player pool, and manage your fantasy league in one place.</p><button className="yellow-btn" onClick={() => go('Player Stats')}>EXPLORE PLAYERS <span>›</span></button></div><div className="hero-number">01</div></div>
          <div className="side-stack"><div className="panel compact"><SectionTitle kicker="ON DECK" right={<CalendarDays size={19}/>}>UPCOMING MATCHES</SectionTitle><Empty title="Schedule coming soon">Matchups will appear when the season schedule is set.</Empty></div><div className="panel compact"><SectionTitle kicker="FINAL SCORES" right={<Trophy size={19}/>}>RECENT RESULTS</SectionTitle><Empty icon={Trophy} title="No games yet">Results will appear after the first game is uploaded.</Empty></div></div></div>
        <div className="home-bottom"><div className="panel news-panel"><SectionTitle kicker="FROM AROUND THE LEAGUE">LATEST NEWS</SectionTitle><div className="news-item"><span className="news-mark">★</span><div><small>LEAGUE UPDATE</small><h3>The player pool is ready</h3><p>Browse all {players.length} players before teams and the season schedule are announced.</p></div><button aria-label="Browse players" onClick={() => go('Player Stats')}>›</button></div></div><div className="panel standings-panel"><SectionTitle kicker="THE RACE" right={<button className="text-link" onClick={() => go('Standings')}>FULL STANDINGS ›</button>}>STANDINGS</SectionTitle><Empty icon={Shield} title="Teams coming soon">Standings begin when teams and results are added.</Empty></div></div>
      </>}
      {page === 'Player Stats' && <>
        <div className="page-heading"><span className="eyebrow dark">THE PLAYER POOL</span><h1>PLAYER STATS</h1><p>{players.length} players from the supplied master sheet. Game statistics will appear after verified results are uploaded.</p></div>
        <div className="subnav stat-tabs" role="tablist" aria-label="Player stat categories">{Object.keys(statGroups).map(category => <button key={category} role="tab" aria-selected={statTab === category} className={statTab === category ? 'active' : ''} onClick={() => { setStatTab(category); setSort({ key: 'id', direction: 'asc' }) }}>{category}</button>)}</div>
        <div className="panel data-panel">
          <div className="stat-view-switch" role="group" aria-label="Stat display">{['Totals', 'Averages per Game'].map(view => <button key={view} type="button" aria-pressed={statView === view} className={statView === view ? 'active' : ''} onClick={() => setStatView(view)}>{view}</button>)}</div>
          <div className="table-tools"><div className="search"><Search size={19}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search players" aria-label="Search players"/></div><span>{filtered.length} PLAYERS</span></div>
          <div className="table-scroll" role="tabpanel" aria-label={`${statTab} — ${statView}`}><table className="ssl-stat-table regular-player-stats" style={{width: `${514+statGroups[statTab].length*112}px`}}><caption>{statTab} · {statView}</caption><colgroup><col style={{width:44}}/><col style={{width:230}}/><col style={{width:120}}/><col style={{width:120}}/>{statGroups[statTab].map(([key])=><col key={key} style={{width:112}}/>)}</colgroup><thead><tr>{[['id','#'],['name','PLAYER'],['class','CLASS'],['source','SOURCE'],...statGroups[statTab]].map(([key,label]) => <th key={key} className={key==='name'?'sticky-player':!['id','class','source'].includes(key)?'numeric-column':undefined}><button onClick={() => sortBy(key)} aria-label={`Sort by ${label}`}>{label}{sort.key === key ? (sort.direction === 'asc' ? <ArrowUp size={13}/> : <ArrowDown size={13}/>) : null}</button></th>)}</tr></thead><tbody>{filtered.map(p => <tr key={p.id} onClick={() => setSelectedPlayer(p)} tabIndex={0} onKeyDown={e => e.key === 'Enter' && setSelectedPlayer(p)}><td>{p.id}</td><td className="player-cell"><PlayerAvatar player={p}/><strong>{p.name}</strong></td><td>{p.class}</td><td>{p.source}</td>{statGroups[statTab].map(([key]) => <td key={key} className="numeric-column">{displayStat(statValue(p, key, statView), statView, key)}</td>)}</tr>)}</tbody></table></div>
          <p className="table-footnote">{statView === 'Totals' ? 'Season totals and season rates.' : 'Games Played remains a total. Other counting stats are divided by games played; rates and innings use their per-game values.'} Tap a heading to sort. A dash means no verified game stat is available yet. Scroll sideways to see more columns.</p>
        </div>
      </>}
      {page === 'Sluggers Fantasy' && <>
        <div className="page-heading fantasy-heading"><span className="eyebrow dark">PLAY WITH FRIENDS</span><h1>SLUGGERS FANTASY</h1><p>Draft your team, set your weekly lineup, and follow head-to-head matchups.</p><button className="outline-btn rules-toggle" onClick={() => setRulesOpen(!rulesOpen)} aria-expanded={rulesOpen} aria-controls="fantasy-rules">{rulesOpen ? 'HIDE' : 'FANTASY'} RULES & POINT SYSTEM</button></div>
        {rulesOpen && <FantasyRules/>}
        <div className="panel test-undrafted"><h2>TEMPORARY FANTASY TEST</h2><p>View the eight drafted teams, weekly head-to-head scores, and league game reports.</p><button className="outline-btn" onClick={() => go('Test Week')}>OPEN TEST WEEK</button></div>
        {!session ? <div className="panel gateway"><div className="gateway-icon">★</div><h2>YOUR LEAGUE IS WAITING</h2><p>Sign in with your username to create a fantasy league or join one with an invite code.</p><button className="red-btn" onClick={() => setAuthOpen(true)}>SIGN IN TO FANTASY</button>{!supabase && <p className="setup-note">Account setup is pending for this site.</p>}</div> :
          <div className="fantasy-layout"><aside className="panel league-sidebar"><SectionTitle kicker="YOUR FANTASY">LEAGUES</SectionTitle>{leagues.map(l => <button key={l.id} className={`league-choice ${selectedLeague?.id === l.id ? 'selected' : ''}`} onClick={() => setSelectedLeague(l)}><span>★</span>{l.name}</button>)}{!leagues.length && <p className="muted">No leagues yet. Create one or enter an invite code.</p>}<form onSubmit={createLeague}><label htmlFor="league-name">CREATE A LEAGUE</label><input id="league-name" required maxLength={60} value={leagueName} onChange={e => setLeagueName(e.target.value)} placeholder="League name"/><button disabled={busy} className="red-btn">CREATE LEAGUE</button></form><form onSubmit={joinLeague}><label htmlFor="invite-code">JOIN WITH A CODE</label><input id="invite-code" required value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="Invite code"/><button disabled={busy} className="outline-btn">JOIN LEAGUE</button></form></aside><div className="panel fantasy-main">{selectedLeague ? <FantasyLeague key={selectedLeague.id} initialLeague={selectedLeague} user={session.user} supabase={supabase} players={players} onLeagueRefresh={loadLeagues}/> : <Empty icon={Trophy} title="Create or join a league">Your fantasy league will appear here.</Empty>}</div></div>}{message && <p className="inline-message" role="status">{message}</p>}
      </>}
      {page === 'Schedule' && <BasicPage kicker="GAME DAYS" title="SEASON SCHEDULE" icon={CalendarDays} empty="No games scheduled yet" detail="The season schedule will appear here once it is announced."/>}
      {page === 'Standings' && <BasicPage kicker="THE RACE" title="STANDINGS" icon={Trophy} empty="Standings begin on opening day" detail="Teams and game results will determine the standings."/>}
      {page === 'Teams' && <BasicPage kicker="THE CLUBS" title="TEAMS" icon={Shield} empty="No teams created yet" detail="Team pages and rosters will appear after the league draft."/>}
      {page === 'Team Stats' && <BasicPage kicker="BY THE NUMBERS" title="TEAM STATS" icon={Trophy} empty="No team stats yet" detail="Team stats will populate from uploaded game results."/>}
      {page === 'Transactions' && <BasicPage kicker="LEAGUE MOVES" title="TRANSACTIONS" icon={Shield} empty="No transactions yet" detail="Trade submissions will open when teams and rosters are set."/>}
      {['SSL Playoffs', 'Voting'].includes(page) && <ClosedSeasonRoom kind={page}/>}
      {page === 'SSL History' && <LeagueHistory/>}
      {page === 'SSL Draft Room' && <SSLDraftRoom supabase={supabase} isCommissioner={isCommissioner} players={players}/>}
      {page === 'Free Agency' && <><div className="page-heading"><span className="eyebrow dark">AVAILABLE PLAYERS</span><h1>FREE AGENCY</h1><p>No rosters have been set. All {players.length} players are currently unassigned.</p></div><div className="panel"><div className="free-list">{players.map(p => <button key={p.id} onClick={() => setSelectedPlayer(p)}><span>{p.name}</span><small>{p.class}</small></button>)}</div></div></>}
    </main>
    <footer><div className="container footer-inner"><span>SLUGGERS <b>SUPA</b> LEAGUE</span><small>LEAGUE DATA AND FANTASY HUB</small></div></footer>
    {selectedPlayer && <div className="modal-backdrop" onClick={() => setSelectedPlayer(null)}><div className="modal player-modal" role="dialog" aria-modal="true" aria-label={selectedPlayer.name} onClick={e => e.stopPropagation()}><button className="close" onClick={() => setSelectedPlayer(null)} aria-label="Close"><X/></button><div className="player-modal-heading"><PlayerAvatar player={selectedPlayer} size={76}/><div><span className="eyebrow dark">PLAYER #{selectedPlayer.id}</span><h2>{selectedPlayer.name}</h2></div></div><dl><div><dt>CLASS</dt><dd>{selectedPlayer.class}</dd></div><div><dt>SOURCE</dt><dd>{selectedPlayer.source}</dd></div><div><dt>TEAM</dt><dd>Free agent</dd></div></dl><p>Game stats will be added when results are uploaded.</p></div></div>}
    {authOpen && <AccountDialog supabase={supabase} session={session} onClose={() => setAuthOpen(false)} onAccess={setAccess}/>}
  </>
}
function BasicPage({ kicker, title, icon, empty, detail }) { return <><div className="page-heading"><span className="eyebrow dark">{kicker}</span><h1>{title}</h1></div><div className="panel basic-panel"><Empty icon={icon} title={empty}>{detail}</Empty></div></> }

createRoot(document.getElementById('root')).render(<App/>)
