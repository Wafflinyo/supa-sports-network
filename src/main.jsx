import PwaInstall from './PwaInstall.jsx'
import {fantasySeasonReady} from './fantasy-scoring.js'
import {useSeasonLeague,SeasonWorkspace,SeasonPage,SeasonPrompts,SeasonTeamTools,SeasonHome,SeasonSelector,seasonPages} from './SeasonLeague.jsx'
import {aggregate,fantasyGames} from './season-data.js'
import PlayerData from './PlayerData.jsx'
import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createClient } from '@supabase/supabase-js'
import { ArrowDown, ArrowUp, CalendarDays, Menu, Search, Shield, Trophy, X } from 'lucide-react'
import playerPool from './players.json'
import gamesPlayed from './games-played.json'
import { playerPortraitStyle } from './player-portraits.js'
import { FantasyLeague, FantasyRules } from './FantasyHub.jsx'
import { visibleLeagueTabs, canViewLeaguePage } from './navigation.js'
import LeagueRules from './LeagueRules.jsx'
import { AccountDialog } from './LeagueAccount.jsx'
import PlayerProfile from './PlayerProfile.jsx'
import {OfficialTeams,TeamSetup,CommissionerWorkspace,teamLogo} from './TeamIdentity.jsx'
import connection from './supabase-config.json'
import './styles.css'
import './mobile.css'

const url = import.meta.env.VITE_SUPABASE_URL || connection.url
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || connection.publishableKey
const supabase = url && key ? createClient(url, key) : null
const basePlayers = playerPool.map(player => ({ ...player, gamesPlayed: gamesPlayed[player.id] ?? null }))
function PlayerAvatar({ player, size = 38 }) {
  const portrait = playerPortraitStyle(player, size)
  return <span className={`player-avatar${portrait ? ' has-portrait' : ''}`} style={{ width: size, height: size, flex: `0 0 ${size}px`, ...portrait }} aria-hidden="true">{portrait ? null : player.name.slice(0, 1)}</span>
}
// Project Rio's export headings, grouped for browsing. Helper columns are export internals.
const statGroups = {
  'Offensive Stats': [
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
    ['positionsPlayed', 'Position(s) Played'], ['gamesPlayed', 'Games Played'], ['mvps', 'MVPs'], ['putouts', 'Putouts'], ['assists', 'Assists'], ['buddyJumpPutouts', 'Buddy Jump Putouts'],
    ['buddyJumpAttempts', 'Buddy Jump Attempts'], ['doublePlays', 'Double Plays'],
    ['triplePlays', 'Triple Plays'], ['bobbles', 'Bobbles'],
  ],
  'Pitching Stats': [
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
  if(key==='positionsPlayed')return Array.isArray(value)?value.join(', '):value
  if(view==='Totals'&&perGameOnly.has(key)&&typeof value==='number')return value.toFixed(key==='inningsPitched'?2:3)
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
  const [page, setPage] = useState('Home')
  const [rulesOpen, setRulesOpen] = useState(false)
  const [menu, setMenu] = useState(false)
  useEffect(()=>{if(!menu)return;const close=e=>{if(e.key==='Escape')setMenu(false)};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close)},[menu])
  const [session, setSession] = useState(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [access, setAccess] = useState({role:'viewer'})
  const [teamSetupExpanded,setTeamSetupExpanded] = useState(false)
  const [teamWelcomeSeen,setTeamWelcomeSeen] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [leagues, setLeagues] = useState([])
  const [selectedLeague, setSelectedLeague] = useState(null)
  const [leagueName, setLeagueName] = useState('')
  const [leagueSize, setLeagueSize] = useState(8)
  const [joinCode, setJoinCode] = useState('')
  const [query, setQuery] = useState('')
  const [statTab, setStatTab] = useState('Offensive Stats')
  const [statView, setStatView] = useState('Totals')
  const [sort, setSort] = useState({ key: 'default', direction: 'desc' })
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [officialTeams,setOfficialTeams]=useState([])
  const [teamsLoading,setTeamsLoading]=useState(true)
  const [teamsMessage,setTeamsMessage]=useState('')
  async function loadOfficialTeams(){
    if(!supabase){setTeamsLoading(false);return}
    const r=await supabase.from('ssl_teams').select('*,ssl_locations(name)').order('slot')
    if(r.error)setTeamsMessage(r.error.message);else{setOfficialTeams(r.data||[]);setTeamsMessage('')}
    setTeamsLoading(false)
  }
  useEffect(()=>{loadOfficialTeams();const timer=setInterval(loadOfficialTeams,15000);return()=>clearInterval(timer)},[])
  const seasonLeague=useSeasonLeague(supabase,{...access,signedIn:!!session})
  const seasonStats=useMemo(()=>aggregate(seasonLeague.season),[seasonLeague.season])
  const players=useMemo(()=>basePlayers.map(p=>{const stats=seasonStats[p.id];return {...p,...stats,stats,team:seasonLeague.season?.teams.find(t=>seasonLeague.season.rosters[t.id]?.includes(p.id))?.name,perGame:stats?Object.fromEntries(Object.entries(stats).filter(([,v])=>typeof v==='number').map(([k,v])=>[k,perGameOnly.has(k)&&k!=='inningsPitched'?v:v/stats.gamesPlayed])):null}}),[seasonStats,seasonLeague.season])
  const careerSeasons=useMemo(()=>seasonLeague.seasons.map(s=>({id:s.id,playerStats:aggregate(s)})),[seasonLeague.seasons])
  const liveGames=useMemo(()=>fantasyGames(seasonLeague.seasons),[seasonLeague.seasons])
  const fantasyEligible=new Set(Object.values(seasonLeague.seasons.find(s=>s.status!=='archived')?.rosters||{}).flat())
  const [commissionerTab,setCommissionerTab]=useState('Season Management')
  const isCommissioner = Boolean(session && access.role === 'commissioner')
  const isGM=Boolean(session && access.role==='gm')
  const gmTeamRegistered = officialTeams.some(t => t.slot === Number(access.slot))
  const gmNeedsTeam = isGM && !teamsLoading && !teamsMessage && !gmTeamRegistered
  const visibleNav = visibleLeagueTabs(!!session, access.role)

  useEffect(() => {
    if (!session || access.role !== 'gm') {
      setTeamWelcomeSeen(false)
      setTeamSetupExpanded(false)
    }
  }, [session?.user?.id,access.role])
  useEffect(() => {
    if (!gmNeedsTeam || teamWelcomeSeen) return
    setTeamWelcomeSeen(true)
    setTeamSetupExpanded(true)
    setPage('GM Tools')
    setMenu(false)
  }, [gmNeedsTeam,teamWelcomeSeen])
  useEffect(() => {
    if (!canViewLeaguePage(page, !!session, access.role)) {
      setPage('Home')
      setMenu(false)
    }
  }, [page, isCommissioner,isGM])

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
    const { data, error } = await supabase.rpc('create_fantasy_league', { league_name: leagueName.trim(), league_size: leagueSize })
    setBusy(false); if (error) { setMessage(error.message); return }
    setLeagueName(''); await loadLeagues(); setSelectedLeague(data)
  }
  async function joinLeague(e) {
    e.preventDefault(); setBusy(true); setMessage('')
    const { error } = await supabase.rpc('join_fantasy_league', { code: joinCode.trim().toUpperCase() })
    setBusy(false); if (error) { setMessage(error.message); return }
    setJoinCode(''); setMessage('You joined the league.'); await loadLeagues()
  }
  const hasOfficialStats = players.some(player => (player.gamesPlayed ?? 0) > 0)
  const categorySort = statTab === 'Pitching Stats' ? {key:'era7',direction:'asc'} : statTab === 'Defensive Stats' ? {key:'putouts',direction:'desc'} : {key:'battingAverage',direction:'desc'}
  const activeSort = sort.key === 'default' ? (hasOfficialStats ? categorySort : {key:'id',direction:'asc'}) : sort
  const filtered = useMemo(() => players.filter(p => `${p.name} ${p.class}`.toLowerCase().includes(query.toLowerCase())).sort((a,b) => {
    const av = statGroups[statTab].some(([key]) => key === activeSort.key) ? statValue(a, activeSort.key, statView) : a[activeSort.key === 'id' ? 'rosterOrder' : activeSort.key]
    const bv = statGroups[statTab].some(([key]) => key === activeSort.key) ? statValue(b, activeSort.key, statView) : b[activeSort.key === 'id' ? 'rosterOrder' : activeSort.key]
    if (av == null && bv != null) return 1
    if (bv == null && av != null) return -1
    const comparison = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''))
    return comparison ? (activeSort.direction === 'asc' ? comparison : -comparison) : a.rosterOrder - b.rosterOrder
  }), [query, sort, statTab, statView,players])
  function sortBy(key) { setSort(s => ({ key, direction: s.key === key && s.direction === 'desc' ? 'asc' : 'desc' })) }
  function go(next) { if (!canViewLeaguePage(next, !!session, access.role)) return; window.history.replaceState(null, '', window.location.pathname); setPage(next); setMenu(false); setMessage(''); window.scrollTo({top: 0, behavior: 'smooth'}) }
  const logo = `${import.meta.env.BASE_URL}sluggers-supa-league-logo.svg`
  return <>
    <div className="topline"><div className="container topline-inner"><span><i className="live-dot"/> SLUGGERS SUPA LEAGUE</span><span>THE LEAGUE STARTS HERE <b>★</b></span><button onClick={() => setAuthOpen(true)}>{session ? session.user.email?.split('@')[0] : 'SIGN IN / JOIN'}</button></div></div>
    <header className="masthead"><div className="container masthead-inner"><button className="brand" onClick={() => go('Home')}><img src={logo} alt="Sluggers Supa League logo"/><span><strong>SLUGGERS <em>SUPA</em> LEAGUE</strong><small>THE OFFICIAL LEAGUE HUB</small></span></button><button className="mobile-menu" aria-label={menu ? "Close menu" : "Open menu"} aria-expanded={menu} aria-controls="league-main-navigation" onClick={() => setMenu(!menu)}>{menu ? <X/> : <Menu/>}<span>MENU</span></button><div className="masthead-right"><span className="league-tag">MARIO SUPER SLUGGERS</span><span className="badge-star">★</span></div></div></header>
    <nav id="league-main-navigation" className={`nav ${menu ? 'open' : ''}`} aria-label="Main navigation"><div className="container nav-inner">{visibleNav.map(n => <button key={n} className={page === n ? 'active' : ''} aria-current={page === n ? 'page' : undefined} onClick={() => go(n)}>{n}</button>)}</div></nav>
    <main className="container page-content"><SeasonPrompts league={seasonLeague} go={go}/>
      {gmNeedsTeam && page !== 'GM Tools' && <aside className="season-prompt" aria-label="Team registration reminder"><strong>YOUR TEAM STILL NEEDS TO BE CREATED</strong><p>You can explore the site, but all 12 teams need a name, home location, logo and conference before the league can schedule its draft. Go to <strong>GM Tools → Team Name, Home Location & Logo</strong> whenever you're ready.</p><button className="red-btn" onClick={()=>{setTeamSetupExpanded(true);go('GM Tools')}}>FINISH TEAM SETUP</button></aside>}{seasonPages.includes(page)&&canViewLeaguePage(page, !!session, access.role)&&(page==='Teams'&&!seasonLeague.season?<OfficialTeams teams={officialTeams} loading={teamsLoading} message={teamsMessage} supabase={supabase}/>:<SeasonPage page={page} league={seasonLeague}/>)}
      {page === 'Commissioner Tools' && isCommissioner && <><div className="page-heading"><span className="eyebrow dark">LEAGUE ADMINISTRATION</span><h1>COMMISSIONER TOOLS</h1></div><div className="subnav">{['Season Management','Teams, Locations & Access'].map(t=><button key={t} className={commissionerTab===t?'active':''} onClick={()=>setCommissionerTab(t)}>{t}</button>)}</div>{commissionerTab==='Season Management'?<SeasonWorkspace league={seasonLeague} registeredTeams={officialTeams}/>:<CommissionerWorkspace supabase={supabase} access={access} teams={officialTeams} onChange={loadOfficialTeams} onAccess={setAccess}/>}</>}
      {page==='GM Tools' && isGM && <><div className="page-heading"><span className="eyebrow dark">YOUR CLUB</span><h1>GM TOOLS</h1></div>
        {gmNeedsTeam && <section className="panel gm-welcome-card" aria-label="Create your SSL team">
          <span className="eyebrow dark">FIRST STEP · TEAM IDENTITY</span>
          <h2>CREATE YOUR TEAM WHEN YOU'RE READY</h2>
          <p>Pick a Mario-universe home location, choose a conference, name your team, and upload your logo below. You don't have to finish right now! Come back at any time through <strong>GM Tools → Team Name, Home Location & Logo</strong>.</p>
          <p><strong>Before we can set a draft day:</strong> all 12 GMs must have registered teams, including their names, home locations, conferences and logos. The commissioner can't open the draft-date poll until everyone is finished.</p>
          <div className="gm-welcome-actions">
            <button className="red-btn" onClick={()=>{setTeamSetupExpanded(true);document.getElementById('gm-team-identity')?.scrollIntoView({behavior:'smooth',block:'start'})}}>CREATE MY TEAM</button>
            <button className="outline-btn" onClick={()=>{setTeamSetupExpanded(false);go('Home')}}>SET UP LATER</button>
          </div>
        </section>}
        <details id="gm-team-identity" className="panel season-box" open={teamSetupExpanded} onToggle={e=>setTeamSetupExpanded(e.currentTarget.open)}><summary>TEAM NAME, HOME LOCATION & LOGO</summary><TeamSetup key={access.slot} supabase={supabase} access={access} teams={officialTeams} onChange={loadOfficialTeams} onAccess={setAccess}/></details>
        <SeasonTeamTools league={seasonLeague}/></>}
      {page === 'Home' && <><SeasonHome league={seasonLeague} go={go}/>
        <div className="home-grid"><div className="hero"><div className="hero-content"><span className="eyebrow">WELCOME TO THE LEAGUE</span><h1>THE GAME<br/><span>STARTS HERE.</span></h1><p>Follow every game, explore the player pool, and manage your fantasy league in one place.</p><button className="yellow-btn" onClick={() => go('Player Stats')}>EXPLORE PLAYERS <span>›</span></button></div><div className="hero-number">01</div></div>
          <div className="side-stack"><div className="panel compact"><SectionTitle kicker="ON DECK" right={<CalendarDays size={19}/>}>UPCOMING MATCHES</SectionTitle>{seasonLeague.season?<p className="season-box">{seasonLeague.season.games.filter(g=>g.stage!=='final').length} upcoming games · <button className="text-link" onClick={()=>go('Schedule')}>VIEW SCHEDULE ›</button></p>:<Empty title="Schedule coming soon">Matchups will appear when the season schedule is set.</Empty>}</div><div className="panel compact"><SectionTitle kicker="FINAL SCORES" right={<Trophy size={19}/>}>RECENT RESULTS</SectionTitle>{seasonLeague.season?<p className="season-box">{seasonLeague.season.games.filter(g=>g.stage==='final').length} completed games · <button className="text-link" onClick={()=>go('Schedule')}>VIEW RESULTS ›</button></p>:<Empty icon={Trophy} title="No games yet">Results will appear after the first game is uploaded.</Empty>}</div></div></div>
        <div className="home-bottom"><div className="panel news-panel"><SectionTitle kicker="FROM AROUND THE LEAGUE">LATEST NEWS</SectionTitle><div className="news-item"><span className="news-mark">★</span><div><small>LEAGUE UPDATE</small><h3>The player pool is ready</h3><p>Browse all {players.length} players before teams and the season schedule are announced.</p></div><button aria-label="Browse players" onClick={() => go('Player Stats')}>›</button></div></div><div className="panel standings-panel"><SectionTitle kicker="THE RACE" right={<button className="text-link" onClick={() => go('Standings')}>FULL STANDINGS ›</button>}>STANDINGS</SectionTitle>{seasonLeague.season?<p className="season-box">{seasonLeague.season.teams.length} season teams · <button className="text-link" onClick={()=>go('Standings')}>VIEW TABLE ›</button></p>:<Empty icon={Shield} title="Teams coming soon">Standings begin when teams and results are added.</Empty>}</div></div>
      </>}
      {page === 'League Rules' && <LeagueRules/>}
      {page === 'Player Data' && <><button className="outline-btn" onClick={()=>go('Player Stats')}>BACK TO PLAYER STATS</button><PlayerData/></>}
      {page === 'Player Stats' && <>
        <div className="page-heading"><span className="eyebrow dark">THE PLAYER POOL</span><h1>PLAYER STATS</h1><p>{players.length} players from the supplied master sheet. Game statistics will appear after verified results are uploaded.</p></div>
        <div className="subnav"><button className="active">Season Stats</button><button onClick={()=>go('Player Data')}>Player Data</button></div><SeasonSelector league={seasonLeague}/><div className="subnav stat-tabs" role="tablist" aria-label="Player stat categories">{Object.keys(statGroups).map(category => <button key={category} role="tab" aria-selected={statTab === category} className={statTab === category ? 'active' : ''} onClick={() => { setStatTab(category); setSort({ key: 'default', direction: 'desc' }) }}>{category}</button>)}</div>
        <div className="panel data-panel">
          <div className="stat-view-switch" role="group" aria-label="Stat display">{['Totals', 'Averages per Game'].map(view => <button key={view} type="button" aria-pressed={statView === view} className={statView === view ? 'active' : ''} onClick={() => setStatView(view)}>{view}</button>)}</div>
          <div className="table-tools"><div className="search"><Search size={19}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search players" aria-label="Search players"/></div><span>{filtered.length} PLAYERS</span></div>
          <div className="table-scroll" role="tabpanel" aria-label={`${statTab} — ${statView}`}><table className="ssl-stat-table regular-player-stats" style={{width: `${414+statGroups[statTab].length*112}px`}}><caption>{statTab} · {statView}</caption><colgroup><col style={{width:64}}/><col style={{width:230}}/><col style={{width:120}}/>{statGroups[statTab].map(([key])=><col key={key} style={{width:112}}/>)}</colgroup><thead><tr>{[['id','#'],['name','PLAYER'],['class','CLASS'],...statGroups[statTab]].map(([key,label]) => <th key={key} className={key==='name'?'sticky-player':!['id','class'].includes(key)?'numeric-column':undefined}><button onClick={() => sortBy(key)} aria-label={`Sort by ${label}`}>{label}{activeSort.key === key ? (activeSort.direction === 'asc' ? <ArrowUp size={13}/> : <ArrowDown size={13}/>) : null}</button></th>)}</tr></thead><tbody>{filtered.map(p => <tr key={p.id} onClick={() => setSelectedPlayer(p)} tabIndex={0} onKeyDown={e => e.key === 'Enter' && setSelectedPlayer(p)}><td className="roster-number">{p.rosterOrder}</td><td className="player-cell"><PlayerAvatar player={p}/><strong>{p.name}</strong></td><td>{p.class}</td>{statGroups[statTab].map(([key]) => <td key={key} className="numeric-column">{displayStat(statValue(p, key, statView), statView, key)}</td>)}</tr>)}</tbody></table></div>
          <p className="table-footnote">{statView === 'Totals' ? 'Season totals and season rates.' : 'Games Played remains a total. Other counting stats are divided by games played; rates and innings use their per-game values.'} Tap a heading to sort. A dash means no verified game stat is available yet. Scroll sideways to see more columns.</p>
        </div>
      </>}
      {page === 'Sluggers Fantasy' && <>
        <div className="page-heading fantasy-heading"><span className="eyebrow dark">PLAY WITH FRIENDS</span><h1>SLUGGERS FANTASY</h1><p>Draft your team, set your weekly lineup, and follow head-to-head matchups.</p><button className="outline-btn rules-toggle" onClick={() => setRulesOpen(!rulesOpen)} aria-expanded={rulesOpen} aria-controls="fantasy-rules">{rulesOpen ? 'HIDE' : 'FANTASY'} RULES & POINT SYSTEM</button></div>
        {rulesOpen && <FantasyRules/>}
        {!session ? <div className="panel gateway"><div className="gateway-icon">★</div><h2>YOUR LEAGUE IS WAITING</h2><p>Sign in with your username to create a fantasy league or join one with an invite code.</p><button className="red-btn" onClick={() => setAuthOpen(true)}>SIGN IN TO FANTASY</button>{!supabase && <p className="setup-note">Account setup is pending for this site.</p>}</div> :
          <div className="fantasy-layout"><aside className="panel league-sidebar"><SectionTitle kicker="YOUR FANTASY">LEAGUES</SectionTitle>{leagues.map(l => <button key={l.id} className={`league-choice ${selectedLeague?.id === l.id ? 'selected' : ''}`} onClick={() => setSelectedLeague(l)}><span>★</span>{l.name}</button>)}{!leagues.length && <p className="muted">No leagues yet. Create one or enter an invite code.</p>}<form onSubmit={createLeague}><label htmlFor="league-name">CREATE A LEAGUE</label><input id="league-name" required maxLength={60} value={leagueName} onChange={e => setLeagueName(e.target.value)} placeholder="League name"/><label htmlFor="league-size">NUMBER OF TEAMS</label><select id="league-size" value={leagueSize} onChange={e=>setLeagueSize(Number(e.target.value))}>{[6,8,10].map(n=><option key={n} value={n}>{n} teams</option>)}</select><button disabled={busy || !fantasySeasonReady(seasonLeague.seasons[0])} className="red-btn">CREATE LEAGUE</button>{!fantasySeasonReady(seasonLeague.seasons[0])&&<p className="muted">Fantasy creation opens after the SSL draft and all twelve rosters are complete, and closes when the regular season ends.</p>}</form><form onSubmit={joinLeague}><label htmlFor="invite-code">JOIN WITH A CODE</label><input id="invite-code" required value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="Invite code"/><button disabled={busy} className="outline-btn">JOIN LEAGUE</button></form></aside><div className="panel fantasy-main">{selectedLeague ? <FantasyLeague key={selectedLeague.id} initialLeague={selectedLeague} user={session.user} supabase={supabase} players={players} liveGames={liveGames} eligibleIds={fantasyEligible} sslSeasons={seasonLeague.seasons} onLeagueRefresh={loadLeagues}/> : <Empty icon={Trophy} title="Create or join a league">Your fantasy league will appear here.</Empty>}</div></div>}{message && <p className="inline-message" role="status">{message}</p>}
      </>}

    </main>
    <PwaInstall/>
    <footer><div className="container footer-inner"><span>SLUGGERS <b>SUPA</b> LEAGUE</span><small>LEAGUE DATA AND FANTASY HUB</small></div></footer>
    {selectedPlayer && <PlayerProfile careerSeasons={careerSeasons} player={players.find(p=>p.id===selectedPlayer.id)||selectedPlayer} PlayerAvatar={PlayerAvatar} onClose={() => setSelectedPlayer(null)}/>}
    {authOpen && <AccountDialog supabase={supabase} session={session} onClose={() => setAuthOpen(false)} onAccess={next=>{setAccess(next);if(next.role==='gm')setTeamWelcomeSeen(false)}}/>}
  </>
}
function BasicPage({ kicker, title, icon, empty, detail }) { return <><div className="page-heading"><span className="eyebrow dark">{kicker}</span><h1>{title}</h1></div><div className="panel basic-panel"><Empty icon={icon} title={empty}>{detail}</Empty></div></> }

createRoot(document.getElementById('root')).render(<App/>)
