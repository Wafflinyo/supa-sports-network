import React,{useMemo,useState} from 'react';
import {Trophy,CalendarDays,BookOpen,ArrowRight,ChartNoAxesColumn,Shield,Medal} from 'lucide-react';
import playerPool from './players.json' with {type:'json'};
import statColumns from './temporary-stat-columns.json' with {type:'json'};
import {teamLogo} from './TeamIdentity.jsx';
import {ConferenceMark} from './ConferenceMark.jsx';
import {PlayerPortrait} from './PlayerPortrait.jsx';
import {preseasonBracket,preseasonReady,pickTimeLabel} from './preseason.js';
import {seasonPhaseLabel} from './season-phase.js';
import {allPreseasonGames} from './preseason-game-data.js';
import {preseasonChampionshipFeature} from './preseason-champion-feature.js';
import {preseasonBoxScore,reportForBracketMatch,bracketScoreOnly,seasonBoxScore} from './game-box-score-data.js';
import GameBoxScore from './GameBoxScore.jsx';
import PreseasonStats from './PreseasonStats.jsx';
import {leagueNews} from './league-news.js';
import {sortTeamStatRows} from './team-stats-table-sort.js';
import {playerCurrentTeamName} from './player-current-team.js';
import {historySeasons,historyOverview,historyRegularStandings,historyTeamStats,historyPlayerStats,
  historySchedule,historyTradeGroups} from './history-archive-data.js';
import './history-archive.css';

const players=new Map(playerPool.map(p=>[String(p.id),p]));
const archiveTabs=['Overview','Preseason','Standings','Team Stats','Player Stats','Schedule & Results',
  'Playoffs','Trades','Draft','Awards & Records','League News'];
const phaseTabs=[['regular','Regular Season'],['playoffs','Playoffs'],['all','Combined']];
const n=value=>Number.isFinite(Number(value))?Number(value):0;
const fmt=(value,decimal=0)=>Number.isFinite(Number(value))?n(value).toFixed(decimal):'—';
const person=id=>players.get(String(id))?.name||'Player #'+id;
function TeamMark({team,supabase,size=32}){
  const logo=team?.logoPath&&supabase?teamLogo(supabase,team.logoPath):null;
  return logo?<img className="ssl-history-team-mark" src={logo} alt="" style={{width:size,height:size}}/>:
    <ConferenceMark id={team?.conference} size={size}/>;
}
function ArchivePanel({title,detail,children}){
  return <section className="panel ssl-history-panel"><div className="ssl-history-panel-head">
    <h3>{title}</h3>{detail&&<p>{detail}</p>}
  </div><div className="ssl-history-panel-body">{children}</div></section>;
}
function PhaseSwitch({value,onChange}){
  return <div className="ssl-history-switch" role="group" aria-label="Statistics game phase">
    {phaseTabs.map(([id,label])=><button type="button" key={id} aria-pressed={value===id}
      className={value===id?'active':''} onClick={()=>onChange(id)}>{label}</button>)}
  </div>;
}
function Empty({children}){return <p className="ssl-history-empty">{children}</p>}
function ArchiveOverview({season,supabase,onTab}){
  const stats=historyOverview(season),pre=preseasonBracket(season);
  const titleTeam=(season.teams||[]).find(t=>String(t.id)===String(season.champion));
  const preseasonWinner=pre.champion;
  return <div className="ssl-history-content">
    <div className="ssl-history-metrics">
      {[
        ['Teams',stats.teams],['Draft picks',stats.draftPicks],
        ['Regular-season finals',stats.regular],['Playoff games',stats.playoffs],
        ['Preseason finals',pre.completedGames],['Approved trades',stats.trades],
      ].map(([label,value])=><div key={label} className="ssl-history-metric">
        <strong>{value}</strong><span>{label}</span></div>)}
    </div>
    <ArchivePanel title="Season highlights" detail="Official season outcomes, separated from the preseason tournament.">
      <div className="ssl-history-honors-grid">
        <div className="ssl-history-honor"><Trophy size={23}/><small>SSL SEASON CHAMPION</small>
          <strong>{titleTeam?.name||'Not yet decided'}</strong></div>
        <div className="ssl-history-honor"><Medal size={23}/><small>PRESEASON CHAMPION</small>
          <strong>{preseasonWinner?.name||'Not yet decided'}</strong></div>
        {['supa','galaxy'].map(conference=><div className="ssl-history-honor" key={conference}>
          <ConferenceMark id={conference} size={26}/><small>{conference==='supa'?'SUPA':'GALAXY'} CONFERENCE CHAMPION</small>
          <strong>{(season.teams||[]).find(t=>String(t.id)===String(season.conferenceChampions?.[conference]))?.name||'Not yet decided'}</strong>
        </div>)}
      </div>
      {season.awardsAnnouncement&&<p className="ssl-history-announcement">{season.awardsAnnouncement}</p>}
    </ArchivePanel>
    <div className="ssl-history-shortcuts">
      {[
        ['Preseason', 'Bracket & preseason player/team statistics'],
        ['Standings','Overall, Supa and Galaxy conference tables'],
        ['Player Stats','Season batting, defense, pitching and Game Points'],
        ['Schedule & Results','Game scores, matchups and complete box scores'],
        ['Trades','Approved franchise transactions'],
        ['Draft','Original picks and stadium selections'],
      ].map(([target,detail])=><button type="button" key={target} onClick={()=>onTab(target)}>
        <strong>{target}</strong><span>{detail}</span><ArrowRight size={18}/></button>)}
    </div>
  </div>;
}
function ArchivePreseason({season,supabase,onBox}){
  const [view,setView]=useState('Bracket');
  const bracket=useMemo(()=>preseasonBracket(season),[season]);
  const reports=useMemo(()=>allPreseasonGames(season),[season]);
  const verified=useMemo(()=>preseasonChampionshipFeature(season,playerPool),[season]);
  if(!preseasonReady(season))return <ArchivePanel title="Preseason tournament">
    <Empty>Automatic draft-speed seeding and the 12-team bracket will appear when this season's draft is finished.</Empty>
  </ArchivePanel>;
  return <div className="ssl-history-content">
    <ArchivePanel title={season.name+' preseason archive'}
      detail={bracket.completedGames+' of '+bracket.totalGames+' bracket games released'}>
      <div className="ssl-history-switch" role="group" aria-label="Preseason archive view">
        {['Bracket','Player & Team Stats','Seeds'].map(option=><button key={option} type="button"
          className={view===option?'active':''} aria-pressed={view===option}
          onClick={()=>setView(option)}>{option}</button>)}
      </div>
      {bracket.champion&&<div className="ssl-history-pre-champion">
        <Trophy size={28}/><TeamMark team={bracket.champion} supabase={supabase} size={55}/>
        <div><small>PRESEASON CHAMPIONS · {season.name.toUpperCase()}</small>
          <strong>{bracket.champion.name}</strong>
          <span>{verified?'Championship game report officially released':'Bracket result recorded'}</span>
        </div>
      </div>}
      {view==='Bracket'&&<div className="ssl-history-pre-rounds">
        {bracket.rounds.map(round=><section className="ssl-history-pre-round" key={round.number}>
          <header><h4>{round.title}</h4><small>{round.pending?'AWAITING PRIOR ROUND':round.complete?'COMPLETE':'IN PROGRESS'}</small></header>
          {round.bye&&<div className="ssl-history-pre-bye">BYE · #{round.bye.seed} {round.bye.name}</div>}
          {round.pending?<Empty>Pairings available after the preceding round is released.</Empty>:
            round.games.map(game=>{
              const report=reportForBracketMatch(game,reports);
              return <button className="ssl-history-pre-game" type="button" key={game.key}
                disabled={!game.winner} onClick={()=>onBox(report?preseasonBoxScore(report):bracketScoreOnly(game))}
                aria-label={'View '+game.high.name+' versus '+game.low.name+' preseason result'}>
                <small>{game.key}{game.winner?' · FINAL':''}</small>
                {[game.high,game.low].map((team,index)=><div key={team.id}
                  className={'ssl-history-pre-game-side'+(game.winner?.id===team.id?' winner':'')}>
                  <b>#{team.seed}</b><TeamMark team={team} supabase={supabase} size={24}/>
                  <strong>{team.name}</strong><span>{index===0?game.scoreA??'—':game.scoreB??'—'}</span>
                </div>)}
                {game.winner&&<em>VIEW {report?'FULL BOX SCORE':'FINAL RESULT'} ›</em>}
              </button>;
            })}
        </section>)}
      </div>}
      {view==='Seeds'&&<div className="ssl-history-table-wrap"><table>
        <thead><tr><th>Seed</th><th>Team</th><th>Average draft pick time</th><th>Picks</th></tr></thead>
        <tbody>{bracket.seeds.map(team=><tr key={team.id}>
          <td>#{team.seed}</td><td>{team.name}</td><td>{pickTimeLabel(team.avgSeconds)}</td>
          <td>{team.selectedPicks}</td></tr>)}</tbody>
      </table></div>}
      {view==='Player & Team Stats'&&<PreseasonStats key={season.id} season={season}/>}
    </ArchivePanel>
  </div>;
}
function ArchiveStandings({season,supabase}){
  const [conference,setConference]=useState('overall');
  const standings=useMemo(()=>historyRegularStandings(season),[season]);
  const rows=standings.filter(team=>conference==='overall'||team.conference===conference);
  return <ArchivePanel title="Regular-season standings"
    detail="Historical regular-season records only. Preseason results never affect these standings.">
    <div className="ssl-history-switch" role="group" aria-label="Archived standings conference">
      {[['overall','Overall'],['supa','Supa Conference'],['galaxy','Galaxy Conference']].map(([id,label])=>
        <button type="button" key={id} aria-pressed={conference===id}
          className={conference===id?'active':''} onClick={()=>setConference(id)}>{label}</button>)}
    </div>
    <div className="ssl-history-table-wrap"><table>
      <thead><tr><th>Rank</th><th>Franchise</th><th>GP</th><th>W</th><th>L</th>
        <th>Win %</th><th>Home</th><th>Away</th><th>RF</th><th>RA</th><th>DIFF</th></tr></thead>
      <tbody>{rows.map((team,i)=><tr key={team.id}>
        <td>{i+1}</td><td><span className="ssl-history-team">
          <TeamMark team={team} supabase={supabase} size={30}/><strong>{team.name}</strong></span></td>
        <td>{team.wins+team.losses}</td><td>{team.wins}</td><td>{team.losses}</td><td>{fmt(team.pct,3)}</td>
        <td>{team.homeWins}–{team.homeLosses}</td><td>{team.awayWins}–{team.awayLosses}</td>
        <td>{team.runsFor}</td><td>{team.runsAgainst}</td><td>{team.runsFor-team.runsAgainst}</td>
      </tr>)}</tbody>
    </table></div>
  </ArchivePanel>;
}
const teamFields=[['hits','H'],['homeRuns','HR'],['rbi','RBI'],['pitchStrikeouts','K'],
  ['ogp','OGP'],['dgp','DGP'],['pgp','PGP'],['itemScore','Item'],['tgp','TGP']];
function ArchiveTeams({season,supabase}){
  const [phase,setPhase]=useState('regular');
  const [view,setView]=useState('Totals');
  const [sort,setSort]=useState({key:'record',direction:'desc'});
  const rows=useMemo(()=>historyTeamStats(season,phase),[season,phase]);
  const sorted=useMemo(()=>sortTeamStatRows(rows,sort,view==='Totals'?'Totals':'Averages per Game'),[rows,sort,view]);
  const toggleSort=key=>setSort(previous=>previous.key===key
    ?{key,direction:previous.direction==='desc'?'asc':'desc'}
    :{key,direction:key==='name'?'asc':'desc'});
  const heading=(key,label)=><th key={key} scope="col"
    aria-sort={sort.key===key?(sort.direction==='desc'?'descending':'ascending'):'none'}>
    <button type="button" className="ssl-history-col-sort" onClick={()=>toggleSort(key)}
      aria-label={'Sort by '+label}>
      {label}{sort.key===key?(sort.direction==='desc'?' ▼':' ▲'):' ↕'}
    </button>
  </th>;
  return <ArchivePanel title="Season team statistics"
    detail="Regular-season and playoff totals remain separate from preseason statistics. Tap a heading to sort; tap again to reverse.">
    <PhaseSwitch value={phase} onChange={setPhase}/>
    <div className="ssl-history-switch" role="group" aria-label="Team stats totals or averages">
      {['Totals','Per Game'].map(option=><button type="button" key={option}
        className={view===option?'active':''} aria-pressed={view===option}
        onClick={()=>setView(option)}>{option}</button>)}
    </div>
    <div className="ssl-history-table-wrap"><table>
      <thead><tr>{heading('name','Team')}{heading('gp','GP')}
        {heading('record','W–L')}{heading('runsFor','RF')}{heading('runsAgainst','RA')}
        {teamFields.map(([key,label])=>heading(key,label))}{heading('agp','AGP')}</tr></thead>
      <tbody>{sorted.map(team=><tr key={team.id}><td><span className="ssl-history-team">
        <TeamMark team={team} supabase={supabase} size={28}/><strong>{team.name}</strong></span></td>
        <td>{team.gp}</td><td>{team.wins}–{team.losses}</td>
        <td>{view==='Totals'?team.runsFor:team.gp?fmt(team.runsFor/team.gp,2):'—'}</td>
        <td>{view==='Totals'?team.runsAgainst:team.gp?fmt(team.runsAgainst/team.gp,2):'—'}</td>
        {teamFields.map(([key])=><td key={key}>{view==='Totals'
          ?fmt(team.totals[key],['ogp','dgp','pgp','tgp','itemScore'].includes(key)?2:0)
          :team.gp?fmt(team.totals[key]/team.gp,2):'—'}</td>)}
        <td><strong>{team.agp===null?'—':fmt(team.agp,2)}</strong></td>
      </tr>)}</tbody>
    </table></div>
    <p className="ssl-history-note">Default ordering uses win–loss record. AGP is team total Game Points divided by completed team games. W–L always displays total wins and losses.</p>
  </ArchivePanel>;
}
const pointCols=[['gamesPlayed','GP'],['gameScore','Game Score'],['ogp','OGP'],['dgp','DGP'],
  ['pgp','PGP'],['itemScore','Item'],['tgp','TGP'],['agp','AGP']];
const groupCols={'Game Points':pointCols,'Batting':statColumns['Offensive Stats'],
  'Fielding':statColumns['Defensive Stats'],'Pitching':statColumns['Pitching Stats']};
const rates=new Set(['battingAverage','onBase','slug','onBasePlusSlug','starSlug','era7','era9',
  'whip','baAgainst','obAgainst','slgAgainst','opsAgainst']);
function ArchivePlayers({season}){
  const [phase,setPhase]=useState('regular'),[group,setGroup]=useState('Game Points'),
    [search,setSearch]=useState(''),[sort,setSort]=useState('tgp'),[reverse,setReverse]=useState(true);
  const raw=useMemo(()=>historyPlayerStats(season,phase),[season,phase]);
  const rows=useMemo(()=>{
    const q=search.trim().toLowerCase();
    return Object.entries(raw).filter(([id])=>!q||person(id).toLowerCase().includes(q)||
      playerCurrentTeamName(season,id).toLowerCase().includes(q))
      .sort((a,b)=>{
        const av=sort==='name'?person(a[0]):sort==='team'?playerCurrentTeamName(season,a[0]):a[1][sort]??0;
        const bv=sort==='name'?person(b[0]):sort==='team'?playerCurrentTeamName(season,b[0]):b[1][sort]??0;
        const comp=typeof av==='number'&&typeof bv==='number'?av-bv:String(av).localeCompare(String(bv));
        return (reverse?-comp:comp)||person(a[0]).localeCompare(person(b[0]));
      });
  },[raw,search,sort,reverse,season]);
  const fields=(groupCols[group]||[]).filter(([key])=>key!=='positionsPlayed');
  const show=(stats,key)=>{
    const value=stats[key];
    if(value==null)return key==='agp'||rates.has(key)?'—':'0';
    if(key==='gamesPlayed')return value;
    return fmt(value,rates.has(key)?3:['ogp','dgp','pgp','itemScore','tgp','agp','gameScore'].includes(key)?2:0);
  };
  return <ArchivePanel title="Season player statistics"
    detail="Complete season-only game totals. Team reflects the selected season's final roster; preseason player stats are in the Preseason tab.">
    <PhaseSwitch value={phase} onChange={setPhase}/>
    <div className="ssl-history-player-tools">
      <div className="ssl-history-switch" role="group" aria-label="Player statistics category">
        {Object.keys(groupCols).map(name=><button type="button" key={name} className={group===name?'active':''}
          aria-pressed={group===name} onClick={()=>{setGroup(name);setSort(name==='Game Points'?'tgp':(groupCols[name]?.[1]?.[0]||'gamesPlayed'));setReverse(true)}}>{name}</button>)}
      </div>
      <input aria-label="Search archived players" type="search" value={search} onChange={e=>setSearch(e.target.value)}
        placeholder="Search players"/>
    </div>
    <p className="ssl-history-note">{rows.length} participating players · Select a column heading to sort.</p>
    <div className="ssl-history-table-wrap" role="region" aria-label="Historical player statistics" tabIndex={0}>
      <table><thead><tr><th className="ssl-history-sticky">Player
        <button type="button" onClick={()=>{setSort('name');setReverse(v=>sort==='name'?!v:false)}}> SORT</button>
      </th><th><button type="button" className="ssl-history-col-sort"
        onClick={()=>{setReverse(sort==='team'?!reverse:false);setSort('team')}}>
        Team{sort==='team'?(reverse?' ▼':' ▲'):''}</button></th>{fields.map(([key,label])=><th key={key}><button type="button"
        className="ssl-history-col-sort" onClick={()=>{setReverse(sort===key?!reverse:true);setSort(key)}}>{label}{sort===key?(reverse?' ▼':' ▲'):''}</button></th>)}</tr></thead>
      <tbody>{rows.map(([id,stats])=><tr key={id}>
        <td className="ssl-history-sticky"><span className="ssl-history-player-name">
          {players.has(String(id))&&<PlayerPortrait player={players.get(String(id))} size={29}/>}
          <strong>{person(id)}</strong></span></td>
        <td>{playerCurrentTeamName(season,id)}</td>
        {fields.map(([key])=><td key={key}>{show(stats,key)}</td>)}</tr>)}
      </tbody></table>
    </div>
    {!rows.length&&<Empty>No released player box scores are available for this phase of this season.</Empty>}
  </ArchivePanel>;
}
function ArchiveSchedule({season,onBox}){
  const [phase,setPhase]=useState('regular'),[week,setWeek]=useState('all');
  const games=useMemo(()=>historySchedule(season),[season]);
  const visible=games.filter(g=>phase==='all'||(phase==='regular'?g.phase==='regular':
    ['playoffs','postseason'].includes(g.phase))).filter(g=>week==='all'||String(g.week)===week);
  const weeks=[...new Set(games.filter(g=>g.phase==='regular'&&g.week).map(g=>String(g.week)))].sort((a,b)=>Number(a)-Number(b));
  const label=id=>season.teams?.find(t=>String(t.id)===String(id))?.name||'Unknown team';
  return <ArchivePanel title="Season schedule and results"
    detail="Every saved matchup, published final score and available player-by-player box score. Private reports remain hidden.">
    <PhaseSwitch value={phase} onChange={value=>{setPhase(value);setWeek('all')}}/>
    {phase!=='playoffs'&&<label className="ssl-history-week-filter">Week
      <select aria-label="Filter historic schedule by week" value={week} onChange={e=>setWeek(e.target.value)}>
        <option value="all">All weeks</option>{weeks.map(w=><option key={w} value={w}>Week {w}</option>)}
      </select></label>}
    <div className="ssl-history-result-list">
      {visible.map(game=>{
        const final=game.stage==='final'&&game.result?.scores;
        return <div className="ssl-history-result" key={game.id}>
          <div className="ssl-history-result-meta">
            <span>{game.phase==='regular'?'WEEK '+(game.week||'—'):'PLAYOFFS'} · {game.label||'Matchup'}</span></div>
          <div className="ssl-history-result-main">
            <strong>{label(game.away)} <span>@</span> {label(game.home)}</strong>
            <b>{final?game.result.scores[game.away]+' – '+game.result.scores[game.home]:'— – —'}</b>
          </div>
          <div className="ssl-history-result-footer"><span>{game.stadium||'Stadium TBD'}</span>
            {final?<button type="button" onClick={()=>onBox(seasonBoxScore(season,game))}>
              FINAL · VIEW BOX SCORE ›</button>:<small>Not yet released</small>}
          </div>
        </div>})}
      {!visible.length&&<Empty>No games are available for this selection.</Empty>}
    </div>
  </ArchivePanel>;
}
function ArchivePlayoffs({season,onBox}){
  const series=season.playoffSeries||[];
  const team=id=>season.teams?.find(t=>String(t.id)===String(id))?.name||'Unknown team';
  const rounds=[['quarterfinal','QUARTERFINALS'],['semifinal','SEMIFINALS'],['final','CHAMPIONSHIP FINALS']];
  return <div className="ssl-history-content">
    <ArchivePanel title="SSL postseason archive"
      detail="Official series, round advancement and released playoff game box scores.">
      {season.champion&&<div className="ssl-history-pre-champion">
        <Trophy size={28}/><div><small>SSL SEASON CHAMPION</small><strong>{team(season.champion)}</strong></div>
      </div>}
      {series.length?rounds.map(([key,title])=><div className="ssl-history-playoff-round" key={key}>
        <h4>{title}</h4>
        {series.filter(s=>s.round===key).length?series.filter(s=>s.round===key).map(s=>
          <div key={s.id} className="ssl-history-series">
            <div><strong>#{s.highSeed} {team(s.high)} vs #{s.lowSeed} {team(s.low)}</strong>
              <span>Best of {s.bestOf} · Series {s.highWins}–{s.lowWins}</span></div>
            {s.winner&&<b>WINNER · {team(s.winner)}</b>}
          </div>):<Empty>Round results not yet published.</Empty>}
      </div>):<Empty>The postseason bracket and series will appear when the league publishes them.</Empty>}
      {season.games?.some(g=>['playoffs','postseason'].includes(g.phase)&&g.stage==='final')&&
        <div className="ssl-history-playoff-games">
          <h4>PLAYOFF GAME RESULTS</h4>
          {season.games.filter(g=>['playoffs','postseason'].includes(g.phase)&&g.stage==='final'&&g.result?.scores)
            .map(game=><button type="button" key={game.id} onClick={()=>onBox(seasonBoxScore(season,game))}>
              <span>{game.label||'Playoff matchup'} · {team(game.away)} @ {team(game.home)}</span>
              <b>{game.result.scores[game.away]} – {game.result.scores[game.home]} ›</b>
            </button>)}
        </div>}
    </ArchivePanel>
  </div>;
}
function ArchiveTrades({season}){
  const trades=[...(season.transactions||[])].sort((a,b)=>Date.parse(b.createdAt||'')-Date.parse(a.createdAt||''));
  return <ArchivePanel title="Approved season transactions"
    detail="Read-only record of trades confirmed during this season. Unapproved negotiations and private messages are not included.">
    {trades.length?trades.map((trade,index)=>{
      const groups=historyTradeGroups(season,trade,playerPool);
      return <article key={trade.id||index} className="ssl-history-trade">
        <div className="ssl-history-trade-head"><strong>TRADE #{trades.length-index}</strong>
          <small>{trade.createdAt?when(trade.createdAt):'Approved transaction'}</small></div>
        <div className="ssl-history-trade-receivers">
          {groups.map(group=><section key={group.teamId}>
            <small>RECEIVES</small><h4>{group.teamName}</h4>
            <ul>{group.assets.map((asset,i)=><li key={i}>
              <strong>{asset.label}</strong>{groups.length>2&&<span>From {asset.from}</span>}</li>)}</ul>
          </section>)}
        </div>
        {trade.body?.note&&<p className="ssl-history-note">Commissioner note: {trade.body.note}</p>}
      </article>;
    }):<Empty>No approved trades have been recorded for this season.</Empty>}
  </ArchivePanel>;
}
function ArchiveDraft({season,supabase}){
  const picks=[...(season.picks||[])].sort((a,b)=>n(a.number)-n(b.number));
  return <div className="ssl-history-content">
    <ArchivePanel title="Draft lottery order and team identities" detail="Franchises and official lottery order from this season.">
      <div className="ssl-history-draft-teams">
        {(season.order||[]).map((id,i)=>{
          const team=season.teams?.find(t=>String(t.id)===String(id));
          return team?<div key={String(id)}><span>{i+1}.</span><TeamMark team={team} supabase={supabase} size={28}/>
            <strong>{team.name}</strong></div>:null;
        })}
        {!(season.order||[]).length&&<Empty>Official lottery order has not been generated.</Empty>}
      </div>
    </ArchivePanel>
    <ArchivePanel title="Draft results" detail="All selections recorded for this season, including Stadium Picks.">
      {picks.length?<div className="ssl-history-table-wrap"><table>
        <thead><tr><th>Pick</th><th>Round</th><th>Franchise</th><th>Selection</th></tr></thead>
        <tbody>{picks.map((pick,i)=><tr key={String(pick.number??i)+'-'+i}>
          <td>#{pick.number??i+1}</td><td>{pick.round||Math.floor(i/12)+1}</td>
          <td>{season.teams?.find(t=>String(t.id)===String(pick.team))?.name||'Unknown team'}</td>
          <td><strong>{['stage','stadium'].includes(pick.kind)?'STADIUM · '+(pick.stage||pick.stadium||'Unknown stadium'):person(pick.player)}</strong></td>
        </tr>)}</tbody></table></div>:<Empty>Draft selections appear after the draft begins.</Empty>}
    </ArchivePanel>
  </div>;
}
function ArchiveAwards({season}){
  const preseason=preseasonBracket(season);
  const franchise=id=>season.teams?.find(t=>String(t.id)===String(id))?.name||'Not yet decided';
  const honors=[
    ['SSL CHAMPIONSHIP',franchise(season.champion)],
    ['PRESEASON CHAMPIONSHIP',preseason.champion?.name||'Not yet decided'],
    ['SUPA CONFERENCE TITLE',franchise(season.conferenceChampions?.supa)],
    ['GALAXY CONFERENCE TITLE',franchise(season.conferenceChampions?.galaxy)],
  ];
  return <ArchivePanel title="Season honors and awards"
    detail="Official honors recorded for this season. Awards not published by the league are not invented.">
    <div className="ssl-history-honors-grid">{honors.map(([label,winner])=>
      <div className="ssl-history-honor" key={label}><Trophy size={23}/>
        <small>{label}</small><strong>{winner}</strong></div>)}</div>
    {season.awardsAnnouncement?<div className="ssl-history-announcement">
      <h4>OFFICIAL SEASON AWARDS ANNOUNCEMENT</h4>
      <p>{season.awardsAnnouncement}</p></div>:
      <Empty>Additional season awards will appear here when the commissioner publishes them.</Empty>}
  </ArchivePanel>;
}
function ArchiveNews({season}){
  const [page,setPage]=useState(1);
  const items=useMemo(()=>leagueNews([season],playerPool),[season]);
  return <ArchivePanel title="Season news archive"
    detail="Public championship, game-highlight and approved trade headlines from this season.">
    <div className="ssl-history-news">
      {items.slice(0,page*30).map(item=><article key={item.id}>
        <span className="ssl-history-news-icon">{item.category==='preseason-champion'?<Trophy size={22}/>:<BookOpen size={20}/>}</span>
        <div><small>{item.label} {item.at?' · '+when(item.at):''}</small>
          <h4>{item.title}</h4><p>{item.summary}</p></div>
      </article>)}
      {!items.length&&<Empty>There are no publicly released headlines for this season yet.</Empty>}
      {items.length>page*30&&<button type="button" className="outline-btn" onClick={()=>setPage(v=>v+1)}>
        VIEW MORE HISTORIC HEADLINES · {items.length-page*30} REMAINING</button>}
    </div>
  </ArchivePanel>;
}
export default function HistoryArchive({seasons=[],supabase}){
  const ordered=useMemo(()=>historySeasons(seasons),[seasons]);
  const [selected,setSelected]=useState(null);
  const [tab,setTab]=useState('Overview');
  const [box,setBox]=useState(null);
  const season=ordered.find(s=>String(s.id)===String(selected))||ordered[0];
  if(!season)return <ArchivePanel title="SSL season archives">
    <Empty>Season archives will appear when the league creates its first season.</Empty></ArchivePanel>;
  const changeSeason=id=>{setSelected(id);setTab('Overview');setBox(null)};
  const openTab=value=>{setTab(value);setBox(null)};
  const overview=historyOverview(season);
  return <div className="ssl-history-archive" aria-label="Sluggers Supa League historical season archive">
    <div className="ssl-history-intro">
      <div><small>SLUGGERS SUPA LEAGUE · PERMANENT RECORD BOOK</small>
        <h2>SEASON ARCHIVES</h2>
        <p>Every league season in one place: the draft, preseason, standings, player and team statistics,
          game box scores, playoffs, trades, honors and news.</p>
      </div>
      <BookOpen size={48} aria-hidden="true"/>
    </div>
    <div className="ssl-history-season-picker" role="group" aria-label="Choose archived SSL season">
      {ordered.map(s=><button type="button" key={s.id} onClick={()=>changeSeason(s.id)}
        aria-pressed={String(season.id)===String(s.id)} className={String(season.id)===String(s.id)?'active':''}>
        <strong>{s.name}</strong><small>{s.status==='archived'?'Completed archive':seasonPhaseLabel(s.status)}</small>
      </button>)}
    </div>
    <div className="ssl-history-season-heading">
      <div><span>SEASON RECORD BOOK</span><h3>{season.name}</h3>
        <p>{overview.finals} released regular-season/playoff games · {overview.teams} franchises · Read-only</p></div>
      <Shield size={36} aria-hidden="true"/>
    </div>
    <div className="ssl-history-tab-scroll" role="tablist" aria-label={season.name+' historical sections'}>
      {archiveTabs.map(name=><button type="button" role="tab" key={name}
        aria-selected={tab===name} className={tab===name?'active':''} onClick={()=>openTab(name)}>{name}</button>)}
    </div>
    <div className="ssl-history-tab-body" role="tabpanel" aria-label={tab}>
      {tab==='Overview'?<ArchiveOverview season={season} supabase={supabase} onTab={openTab}/>:
        tab==='Preseason'?<ArchivePreseason key={season.id+':preseason'} season={season} supabase={supabase} onBox={setBox}/>:
        tab==='Standings'?<ArchiveStandings key={season.id+':standings'} season={season} supabase={supabase}/>:
        tab==='Team Stats'?<ArchiveTeams key={season.id+':teams'} season={season} supabase={supabase}/>:
        tab==='Player Stats'?<ArchivePlayers key={season.id+':players'} season={season}/>:
        tab==='Schedule & Results'?<ArchiveSchedule key={season.id+':schedule'} season={season} onBox={setBox}/>:
        tab==='Playoffs'?<ArchivePlayoffs season={season} onBox={setBox}/>:
        tab==='Trades'?<ArchiveTrades season={season}/>:
        tab==='Draft'?<ArchiveDraft season={season} supabase={supabase}/>:
        tab==='Awards & Records'?<ArchiveAwards season={season}/>:
        <ArchiveNews key={season.id+':news'} season={season}/>}
    </div>
    {box&&<GameBoxScore key={box.id} game={box} onClose={()=>setBox(null)}/>}
  </div>;
}
