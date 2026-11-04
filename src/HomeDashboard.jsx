import React,{useMemo,useState} from 'react';
import {CalendarDays,Trophy,Shield,BarChart3,List,ArrowRight,Megaphone,Newspaper} from 'lucide-react';
import {powerRankings} from './power-rankings.js';
import {standings} from './season-data.js';
import {ConferenceMark} from './ConferenceMark.jsx';
import {matchupDisplay} from './matchup-display.js';
import {homeWeekBoard,homeRecentResults} from './home-dashboard-data.js';
import {HeatFlame} from './HeatingUpBadge.jsx';
import {teamLogo} from './TeamIdentity.jsx';
import {PlayerPortrait} from './PlayerPortrait.jsx';
import {latestPreseasonChampionship} from './preseason-champion-feature.js';
import {homepageHeadlineSlides} from './game-headlines.js';
import HomeHeadliners from './HomeHeadliners.jsx';
import HeadlineReadMore from './HeadlineReadMore.jsx';
import './home-dashboard.css';

function CardTitle({kicker,children,action}){
  return <div className="ssl-home-card-title"><div><small>{kicker}</small><h2>{children}</h2></div>{action}</div>;
}
function Matchup({season,game,onClick}){
  const {awayName,homeName,stadium}=matchupDisplay(season,game);
  return <button type="button" className="ssl-home-match" onClick={onClick}
    aria-label={awayName+' at '+homeName}>
    <span className="ssl-home-match-line">
      <strong>{awayName}</strong><span className="ssl-home-at">@</span><strong>{homeName}</strong>
    </span>
    <span className="ssl-home-match-detail">
      <span>{game.week?'WEEK '+game.week:''}{stadium?' · '+stadium:''}</span>
    </span>
  </button>;
}
function ScoreLine({season,game,onClick}){
  const {awayName,homeName}=matchupDisplay(season,game);
  return <button type="button" className="ssl-home-result" onClick={onClick}>
    <span><strong>{awayName}</strong> <span className="ssl-home-at">@</span> <strong>{homeName}</strong></span>
    <b>{game.result.scores[game.away]} – {game.result.scores[game.home]}</b>
  </button>;
}
function TradeNewsBreakdown({groups}){
  return <div className="ssl-trade-breakdown" role="group" aria-label="Approved trade assets received by team">
    {groups.map(group=><section key={group.teamId} className="ssl-trade-side">
      <div className="ssl-trade-side-heading">
        <small>RECEIVES</small><strong>{group.teamName}</strong>
      </div>
      <ul className="ssl-trade-assets">
        {group.assets.map((asset,index)=><li key={group.teamId+':'+index}>
          <span className="ssl-trade-asset-name">{asset.label}</span>
          {groups.length>2&&<small>From {asset.from}</small>}
        </li>)}
      </ul>
    </section>)}
  </div>;
}
function ChampionshipHero({feature,supabase,players,onResults}){
  const {champion,topPlayers,seasonName}=feature;
  const logo=champion.logoPath&&supabase?teamLogo(supabase,champion.logoPath):null;
  const roster=new Map(players.map(player=>[String(player.id),player]));
  return <section className="hero ssl-home-hero ssl-home-champion" aria-label={seasonName+' preseason champions: '+champion.name}>
    <div className="ssl-champion-copy">
      <span className="eyebrow">{seasonName.toUpperCase()} · PRESEASON CHAMPIONS</span>
      <h1>{champion.name}</h1>
      <div className="ssl-champion-title"><Trophy size={25} aria-hidden="true"/> PRESEASON CHAMPIONS</div>
      <p>Crowned champions of the {seasonName} preseason tournament.</p>
      <button type="button" className="yellow-btn ssl-champion-action" onClick={onResults}>
        VIEW PRESEASON RESULTS <span>›</span>
      </button>
    </div>
    <div className="ssl-champion-crest">
      {logo?<img src={logo} alt={champion.name+' official team logo'}/>:
        <div className="ssl-champion-crest-fallback"><Trophy size={68} aria-hidden="true"/>
          <span>{champion.name}</span></div>}
    </div>
    <div className="ssl-champion-leaders">
      <div className="ssl-champion-leaders-heading"><Trophy size={17} aria-hidden="true"/>
        <strong>TOP 3 PLAYERS</strong><small>AVERAGE PRESEASON GAME POINTS</small></div>
      {topPlayers.length?<ol className="ssl-champion-leaderboard">
        {topPlayers.map((player,index)=><li key={player.playerId}>
          <span className="ssl-champion-leader-rank">{index+1}</span>
          <PlayerPortrait player={roster.get(String(player.playerId))||{id:player.playerId,name:player.name}} size={38}/>
          <span className="ssl-champion-leader-name">{player.name}
            <small>{player.gamesPlayed} {player.gamesPlayed===1?'game':'games'}</small></span>
          <span className="ssl-champion-leader-agp"><strong>{player.agp.toFixed(2)}</strong><small>AGP</small></span>
        </li>)}
      </ol>:<p className="ssl-champion-leaders-empty">Player averages will appear when released game reports contain player statistics.</p>}
    </div>
  </section>;
}
export default function HomeDashboard({league,go,newsItems=[],players=[],onPlayerSelect}){
  const season=league?.season;
  const [showAllNews,setShowAllNews]=useState(false);
  const board=useMemo(()=>homeWeekBoard(season),[season]);
  const finals=useMemo(()=>homeRecentResults(season,6),[season]);
  const ranks=useMemo(()=>powerRankings(season),[season]);
  const table=useMemo(()=>standings(season),[season]);
  const championship=useMemo(()=>latestPreseasonChampionship(league?.seasons||[],players),[league?.seasons,players]);
  const headlines=useMemo(()=>homepageHeadlineSlides(championship,newsItems,season?.id),[championship,newsItems,season?.id]);
  const openGame=game=>go('Schedule',null,{focus:'game',gameId:game.id});
  const openStory=story=>{
    if(story.seasonId!=null&&String(story.seasonId)!==String(league?.season?.id))
      league?.setSelected?.(story.seasonId);
    go('Schedule',null,{focus:'game',gameId:story.gameId});
  };
  const openPreseason=seasonId=>{
    if(seasonId!=null && String(seasonId)!==String(league?.season?.id))
      league?.setSelected?.(seasonId);
    go('Playoff Bracket','Pre-season');
  };
  return <div className="ssl-home-layout">
    <div className="ssl-home-main">
      {headlines.length?<HomeHeadliners slides={headlines} seasons={league?.seasons||[]}
        supabase={league?.supabase} players={players} onOpenGame={openStory}
        championContent={championship?<ChampionshipHero feature={championship} supabase={league?.supabase}
          players={players} onResults={()=>openPreseason(championship.seasonId)}/>:null}/>:
      <section className="hero ssl-home-hero" aria-label="Sluggers Supa League">
        <div className="hero-content">
          <span className="eyebrow">WELCOME TO THE LEAGUE</span>
          <h1>THE GAME<span className="ssl-home-line-break"> </span><span>STARTS HERE.</span></h1>
          <p>Follow every game, explore the player pool, and manage your fantasy league in one place.</p>
          <button type="button" className="yellow-btn" onClick={()=>go('Player Stats')}>EXPLORE PLAYERS <span>›</span></button>
        </div>
        <div className="hero-number" aria-hidden="true">SSL</div>
      </section>}
      <section className="panel ssl-home-news" id="ssl-league-news" style={{scrollMarginTop:125}}>
        <CardTitle kicker="FROM AROUND THE LEAGUE">LEAGUE NEWS FEED</CardTitle>
        {newsItems.length?<div className="league-news-scroll" aria-label="Official league news">
          {(showAllNews?newsItems:newsItems.slice(0,8)).map(item=><article key={item.id} className={`news-item news-item-live news-${item.category}`}>
            <span className="news-mark" aria-hidden="true">{item.category==='heating'?<HeatFlame/>:item.category==='trade'?<Shield size={27}/>:item.category==='match'?<Newspaper size={27}/>:item.category==='preseason-champion'?<Trophy size={27}/>:item.category==='pitching'?<Trophy size={27}/>:<Megaphone size={27}/>}</span>
            <div className="news-copy">
              <small>{item.label}{item.private?' · PRIVATE PREVIEW':''}{item.at?' · '+new Date(item.at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):''}</small>
              <h3>{item.title}</h3>{item.category==='trade'&&item.tradeGroups?.length
                ?<TradeNewsBreakdown groups={item.tradeGroups}/>
                :<HeadlineReadMore id={item.id} text={item.summary} limit={195}/>}
            </div>
            <button type="button" aria-label={item.category==='preseason-champion'?'View preseason results':['match','team-game'].includes(item.category)?'View match and box score':item.playerId?'View player profile':'View transactions'}
              onClick={()=>{if(item.category==='preseason-champion'){openPreseason(item.seasonId);}else if(['match','team-game'].includes(item.category)){openStory(item);}else if(item.playerId){const p=players.find(x=>x.id===item.playerId);if(p)onPlayerSelect(p);}else go('Transactions');}}>›</button>
          </article>)}
        </div>:<div className="news-item"><span className="news-mark"><Trophy size={26}/></span>
          <div><small>LEAGUE UPDATE</small><h3>Latest league news will appear here</h3><p>Official game highlights, transactions and Heating Up notices appear as they happen.</p></div>
        </div>}
        {newsItems.length>8&&<button type="button" className="outline-btn news-more"
          onClick={()=>setShowAllNews(v=>!v)}>{showAllNews?'SHOW RECENT NEWS':`VIEW ALL ${newsItems.length} HEADLINES`}</button>}
      </section>
    </div>
    <aside className="ssl-home-sidebar" aria-label="League scoreboard and rankings">
      <section className="panel ssl-home-card ssl-home-upcoming">
        <CardTitle kicker="ON DECK" action={<button type="button" className="ssl-home-card-link" onClick={()=>go('Schedule')}>
          <span>{board.week!=null?`WEEK ${board.week}`:'FULL SCHEDULE'}</span><CalendarDays size={18}/></button>}>UPCOMING MATCHES</CardTitle>
        {board.games.length?<div className="ssl-home-matchups">
          {board.games.map(game=><Matchup key={game.id} season={season} game={game} onClick={()=>openGame(game)}/>)}
        </div>:<p className="ssl-home-quiet">{season?.schedulePublished?'No upcoming regular-season matchups.':'Matchups appear here when the schedule is published.'}</p>}
      </section>
      <section className="panel ssl-home-card">
        <CardTitle kicker="FINAL SCORES" action={<button type="button" className="ssl-home-card-link" onClick={()=>go('Schedule')}>VIEW RESULTS <Trophy size={18}/></button>}>RECENT RESULTS</CardTitle>
        {finals.length?<div className="ssl-home-results-wrap">
          <div className="ssl-home-results-label">{finals[0].phase==='regular'&&Number(finals[0].week)>0
            ?`WEEK ${finals[0].week} RESULTS`:'LATEST RELEASED RESULTS'}</div>
          <div className="ssl-home-results">{finals.map(game=><ScoreLine key={game.id} season={season} game={game} onClick={()=>openGame(game)}/>)}</div>
        </div>:<p className="ssl-home-quiet">0 completed games</p>}
      </section>
      <section className="panel ssl-home-card ssl-home-power">
        <CardTitle kicker="LEAGUE OUTLOOK" action={<button type="button" className="ssl-home-card-link" onClick={()=>go('Teams',null,{section:'Power Rankings'})}>
          FULL RANKINGS <BarChart3 size={18}/></button>}>POWER RANKINGS</CardTitle>
        {ranks.length?<ol className="ssl-home-ranks">
          {ranks.slice(0,3).map(team=><li key={team.id}>
            <span className="ssl-home-rank-name"><b>{team.rank}.</b><strong>{team.name}</strong></span>
            <span className="ssl-home-rank-score" title="Overall Power Rating">{Number(team.score).toFixed(1)}</span>
          </li>)}
        </ol>:<p className="ssl-home-quiet">Rankings appear when teams submit their default lineups.</p>}
      </section>
      <section className="panel ssl-home-card ssl-home-standings">
        <CardTitle kicker="THE RACE" action={<button type="button" className="ssl-home-card-link" onClick={()=>go('Standings')}>
          VIEW TABLE <List size={18}/></button>}>STANDINGS</CardTitle>
        {table.length?<div className="ssl-home-overall" aria-label="Overall regular-season standings, all teams">
          <div className="ssl-home-overall-head"><span>ALL {table.length} TEAMS · OVERALL</span><span>W–L</span></div>
          <ol className="ssl-home-overall-list">
            {table.map((team,index)=><li key={team.id} className="ssl-home-overall-team">
              <span className="ssl-home-overall-rank">{index+1}.</span>
              <ConferenceMark id={team.conference} size={26}/>
              <span className="ssl-home-overall-info">
                <strong>{team.name}</strong>
                <small>GP {team.wins+team.losses} · PCT {team.pct.toFixed(3)} · RF {team.runsFor} · RA {team.runsAgainst} · DIFF {team.runsFor-team.runsAgainst}</small>
              </span>
              <b className="ssl-home-overall-record">{team.wins}–{team.losses}</b>
            </li>)}
          </ol>
        </div>:<p className="ssl-home-quiet">Teams will appear when the league season is set up.</p>}
      </section>
    </aside>
  </div>;
}
