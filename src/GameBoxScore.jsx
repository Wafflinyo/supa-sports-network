import React,{useEffect,useRef,useState} from 'react';
import columns from './temporary-stat-columns.json' with {type:'json'};
import './game-box-score.css';

const categories={
  'Game Points':[
    ['ogp','OGP'],['dgp','DGP'],['pgp','PGP'],['itemScore','Item Score'],
    ['shutoutBonus','Shutout Bonus'],['mvpBonus','MVP Bonus'],['tgp','TGP'],
  ],
  'Batting':[
    ...columns['Offensive Stats'].filter(([k])=>!['gamesPlayed','mvps'].includes(k)),
  ],
  'Fielding':columns['Defensive Stats'].filter(([k])=>!['gamesPlayed','mvps'].includes(k)),
  'Pitching':columns['Pitching Stats'].filter(([k])=>!['gamesPlayed','mvps'].includes(k)),
};
const rateKeys=new Set(['battingAverage','onBase','slug','onBasePlusSlug','starSlug','era7','era9','whip','baAgainst','obAgainst','slgAgainst','opsAgainst']);
const round2=n=>Math.round((Number(n||0)+Number.EPSILON)*100)/100;
const fmt=(value,key)=>{
  if(value==null)return rateKeys.has(key)?'—':'0';
  if(!Number.isFinite(Number(value)))return '—';
  if(rateKeys.has(key))return Number(value).toFixed(3);
  if(key==='inningsPitched'||['ogp','dgp','pgp','tgp','itemScore','mvpBonus','shutoutBonus'].includes(key))
    return Number(value).toFixed(2);
  return String(value);
};
function valueFor(player,key){
  if(key==='mvpBonus')return player.mvp?10:0;
  if(key==='itemScore')return player.itemScore;
  if(['ogp','dgp','pgp','tgp'].includes(key))return player.points?.[key]??0;
  return player.stats?.[key]??(rateKeys.has(key)?null:0);
}
function TeamBoxTable({team,tab}){
  const fields=categories[tab];
  const players=tab==='Pitching'
    ?team.players.filter(p=>Number(p.stats?.battersFaced||0)>0||Number(p.stats?.inningsPitched||0)>0)
    :tab==='Game Points'?[...team.players].sort((a,b)=>(b.points?.tgp||0)-(a.points?.tgp||0)):team.players;
  return <section className="ssl-box-team">
    <div className="ssl-box-team-head">
      <h3>{team.name}</h3><span>{team.score} runs · {team.hits} hits</span>
    </div>
    {players.length?<>
      <div className="ssl-box-table-scroll" role="region" tabIndex={0} aria-label={team.name+' '+tab+' box score'}>
        <table key={tab} className="ssl-box-table">
          <thead><tr><th scope="col" className="ssl-box-player">Player</th>
            {fields.map(([key,label])=><th scope="col" key={key} title={label}>{label}</th>)}
          </tr></thead>
          <tbody>{players.map(p=><tr key={p.playerId}>
            <th scope="row" className="ssl-box-player">
              <span className="ssl-box-name">{p.name}{p.mvp&&<span className="ssl-box-mvp">MVP</span>}</span>
              <small>{p.positions}</small>
            </th>
            {fields.map(([key])=><td key={key} className={key==='tgp'?'ssl-box-highlight':''}>{fmt(valueFor(p,key),key)}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
      {tab==='Game Points'&&<p className="ssl-box-team-total">Team Game Points: <strong>{team.totalGamePoints.toFixed(2)}</strong></p>}
    </>:<p className="ssl-box-empty">No {tab.toLowerCase()} player statistics were supplied for this team.</p>}
  </section>;
}
function InningLineScore({game}){
  const innings=game.innings;
  if(!Array.isArray(innings?.away)||!Array.isArray(innings?.home)||
    !innings.away.length||innings.away.length!==innings.home.length)
    return <section className="ssl-box-innings ssl-box-innings-unavailable" aria-label="Inning-by-inning score unavailable">
      <h3>SCORING BY INNING</h3>
      <p>The original Project Rio Game Info inning scores were not saved with this report.
        {game.stage==='COMMISSIONER ONLY · NOT RELEASED'||String(game.label||'').includes('COMMISSIONER PRIVATE PREVIEW')
          ?' Replace the saved private report with its original Project Rio ODS/XLSX file to restore the inning breakdown before releasing.'
          :' The inning breakdown cannot be reconstructed from the final score alone.'}
      </p>
    </section>;
  const columns=Array.from({length:innings.away.length},(_,i)=>i+1);
  return <section className="ssl-box-innings" aria-label="Runs scored by inning">
    <h3>SCORING BY INNING</h3>
    <div className="ssl-box-innings-scroll" role="region" tabIndex={0}
      aria-label="Inning-by-inning game line score">
      <table className="ssl-box-innings-table">
        <thead><tr><th scope="col">TEAM</th>
          {columns.map(n=><th key={n} scope="col">{n}</th>)}
          <th scope="col" className="ssl-box-innings-total">R</th>
          <th scope="col">H</th>
        </tr></thead>
        <tbody>{game.teams.map((team,index)=>
          <tr key={team.key}>
            <th scope="row">{team.name}</th>
            {innings[index===0?'away':'home'].map((runs,i)=>
              <td key={i}>{runs==null?'X':runs}</td>)}
            <td className="ssl-box-innings-total">{team.score}</td>
            <td>{team.hits}</td>
          </tr>)}
        </tbody>
      </table>
    </div>
    <p>Runs in each inning, directly from the Project Rio Game Info worksheet.</p>
  </section>;
}
export default function GameBoxScore({game,onClose,inline=false}){
  const [tab,setTab]=useState(inline?'Batting':'Game Points');
  const closeRef=useRef(null);
  useEffect(()=>{
    if(!game||inline)return;
    const previous=document.activeElement;
    closeRef.current?.focus();
    const keydown=event=>{if(event.key==='Escape'){event.preventDefault();onClose?.();}};
    document.addEventListener('keydown',keydown);
    return ()=>{document.removeEventListener('keydown',keydown);if(previous?.isConnected)previous.focus();};
  },[game?.id,inline,onClose]);
  useEffect(()=>setTab(inline?'Batting':'Game Points'),[game?.id,inline]);
  if(!game)return null;
  const [away,home]=game.teams;
  const title=away.name+' at '+home.name+' box score';
  const content=<>
    <div className="ssl-box-header">
      <div>
        <small>{inline?'COMMISSIONER-ONLY PRIVATE PREVIEW':game.stage} · {game.label}</small>
        <h2>{inline?'PREVIEW FULL BOX SCORE':'FULL BOX SCORE'}</h2>
      </div>
      {!inline&&<button ref={closeRef} type="button" className="ssl-box-close" onClick={onClose} aria-label="Close box score">×</button>}
    </div>
    <InningLineScore game={game}/>
    <div className="ssl-box-scoreboard">
      <div><span className="ssl-box-away">{away.sideLabel||"AWAY"}</span><strong>{away.name}</strong><b>{away.score}</b></div>
      <div><span className="ssl-box-home">{home.sideLabel||"HOME"}</span><strong>{home.name}</strong><b>{home.score}</b></div>
    </div>
    <div className="ssl-box-score-summary">
      <strong>{inline?'PREVIEW — NOT PUBLISHED':'FINAL'}</strong><span>HITS: {away.hits} – {home.hits}</span>
      {game.hasPlayerStats&&<span>TEAM GAME POINTS: {away.totalGamePoints.toFixed(2)} – {home.totalGamePoints.toFixed(2)}</span>}
    </div>
    {game.hasPlayerStats?<div className="ssl-box-body">
      <div className="ssl-box-tabs" role="tablist" aria-label="Box score statistic categories">
        {Object.keys(categories).map(category=><button key={category} type="button" role="tab"
          aria-selected={tab===category} className={tab===category?'active':''}
          onClick={()=>setTab(category)}>{category}</button>)}
      </div>
      <p className="ssl-box-instructions">Scroll each team's table sideways to view all {tab.toLowerCase()} columns. Tap a category to switch stats.</p>
      {game.teams.map(team=><TeamBoxTable key={team.key} team={team} tab={tab}/>)}
    </div>:<div className="ssl-box-no-report">
      <strong>The final score is recorded.</strong>
      <p>A full player-by-player Project Rio report has not been uploaded for this game yet. Scores shown above are confirmed, but individual statistics aren't available.</p>
    </div>}
  </>;
  if(inline)return <section className="ssl-box-dialog ssl-box-inline" aria-label={title}>{content}</section>;
  return <div className="ssl-box-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose?.()}}>
    <section className="ssl-box-dialog" role="dialog" aria-modal="true" aria-label={title}>
      {content}
    </section>
  </div>;
}
