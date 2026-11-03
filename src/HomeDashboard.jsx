import React,{useMemo,useState} from 'react';
import {CalendarDays,Trophy,Shield,BarChart3,List,ArrowRight,Megaphone} from 'lucide-react';
import {powerRankings} from './power-rankings.js';
import {standings} from './season-data.js';
import {matchupDisplay} from './matchup-display.js';
import {homeWeekBoard,homeRecentResults} from './home-dashboard-data.js';
import {HeatFlame} from './HeatingUpBadge.jsx';
import './home-dashboard.css';

function CardTitle({kicker,children,action}){
  return <div className="ssl-home-card-title"><div><small>{kicker}</small><h2>{children}</h2></div>{action}</div>;
}
function Matchup({season,game,onClick}){
  const {awayName,homeName}=matchupDisplay(season,game);
  const start=Date.parse(game.startsAt||'');
  const date=Number.isFinite(start)
    ?new Date(start).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' ET'
    :'Date TBD';
  return <button type="button" className="ssl-home-match" onClick={onClick}
    aria-label={awayName+' at '+homeName}>
    <span className="ssl-home-match-line">
      <strong>{awayName}</strong><span className="ssl-home-at">@</span><strong>{homeName}</strong>
    </span>
    <span className="ssl-home-match-detail">
      <span>{date}</span>
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
export default function HomeDashboard({league,go,newsItems=[],players=[],onPlayerSelect}){
  const season=league?.season;
  const [showAllNews,setShowAllNews]=useState(false);
  const board=useMemo(()=>homeWeekBoard(season),[season]);
  const finals=useMemo(()=>homeRecentResults(season,6),[season]);
  const ranks=useMemo(()=>powerRankings(season),[season]);
  const table=useMemo(()=>standings(season),[season]);
  const hasFinal=Boolean((season?.games||[]).some(game=>game.stage==='final'&&game.phase==='regular'));
  const openGame=game=>go('Schedule',null,{focus:'game',gameId:game.id});
  return <div className="ssl-home-layout">
    <div className="ssl-home-main">
      <section className="hero ssl-home-hero" aria-label="Sluggers Supa League">
        <div className="hero-content">
          <span className="eyebrow">WELCOME TO THE LEAGUE</span>
          <h1>THE GAME<span className="ssl-home-line-break"> </span><span>STARTS HERE.</span></h1>
          <p>Follow every game, explore the player pool, and manage your fantasy league in one place.</p>
          <button type="button" className="yellow-btn" onClick={()=>go('Player Stats')}>EXPLORE PLAYERS <span>›</span></button>
        </div>
        <div className="hero-number" aria-hidden="true">SSL</div>
      </section>
      <section className="panel ssl-home-news" id="ssl-league-news" style={{scrollMarginTop:125}}>
        <CardTitle kicker="FROM AROUND THE LEAGUE">LEAGUE NEWS FEED</CardTitle>
        {newsItems.length?<div className="league-news-scroll" aria-label="Official league news">
          {(showAllNews?newsItems:newsItems.slice(0,8)).map(item=><article key={item.id} className={`news-item news-item-live news-${item.category}`}>
            <span className="news-mark" aria-hidden="true">{item.category==='heating'?<HeatFlame/>:item.category==='trade'?<Shield size={27}/>:item.category==='pitching'?<Trophy size={27}/>:<Megaphone size={27}/>}</span>
            <div className="news-copy">
              <small>{item.label}{item.private?' · PRIVATE PREVIEW':''}{item.at?' · '+new Date(item.at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):''}</small>
              <h3>{item.title}</h3>{item.category==='trade'&&item.tradeGroups?.length
                ?<TradeNewsBreakdown groups={item.tradeGroups}/>
                :<p>{item.summary}</p>}
            </div>
            <button type="button" aria-label={item.playerId?'View player profile':'View transactions'}
              onClick={()=>{if(item.playerId){const p=players.find(x=>x.id===item.playerId);if(p)onPlayerSelect(p);}else go('Transactions');}}>›</button>
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
        {hasFinal?<ol className="ssl-home-ranks">
          {table.slice(0,3).map((team,index)=><li key={team.id}>
            <span className="ssl-home-rank-name"><b>{index+1}.</b><strong>{team.name}</strong></span>
            <span className="ssl-home-rank-score">{team.wins}–{team.losses}</span>
          </li>)}
        </ol>:<p className="ssl-home-quiet">{season?.teams?.length||0} season teams · Standings start when regular-season results are released.</p>}
      </section>
    </aside>
  </div>;
}
