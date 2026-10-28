import React,{useEffect,useMemo,useState} from 'react';
import {Trophy,Clock,Medal} from 'lucide-react';
import {teamLogo} from './TeamIdentity.jsx';
import {powerRankings,POWER_WEIGHTS,TRAJECTORY_OFFENSE_WEIGHT,TRAJECTORY_SCORES,POWER_PITCHER_COUNT} from './power-rankings.js';
import {preseasonBracket,preseasonReady,pickTimeLabel} from './preseason.js';
import './preseason.css';

function Identity({team,supabase}){
  if(!team)return <span>To be determined</span>;
  return <span className="ssl-pre-team">
    {team.logoPath&&supabase&&<img src={teamLogo(supabase,team.logoPath)} alt=""/>}
    <span>{team.name}</span>
  </span>;
}

export function PowerRankings({season,supabase,compact=false}){
  const rankings=useMemo(()=>powerRankings(season),[season]);
  if(!rankings.length)return <section className="panel ssl-pre-panel">
    <h2>POWER RANKINGS</h2><p>Official rankings are released automatically when all twelve teams complete the draft.</p>
  </section>;
  return <section className="panel ssl-pre-panel" aria-label="SSL power rankings">
    <div className="ssl-pre-head"><div><small>SSL POWER INDEX · 0–100</small>
      <h2>{rankings.some(t=>t.games>0)?'LIVE POWER RANKINGS':'POST-DRAFT POWER RANKINGS'}</h2>
      <p>Calculated from each team's roster: <b>{Math.round(100*POWER_WEIGHTS.offense)}% offense · {Math.round(100*POWER_WEIGHTS.pitching)}% pitching · {Math.round(100*POWER_WEIGHTS.defense)}% defense · {Math.round(100*POWER_WEIGHTS.running)}% running · {Math.round(100*POWER_WEIGHTS.chemistry)}% chemistry.</b>
        {' '}The offensive rating includes <b>{Math.round(100*TRAJECTORY_OFFENSE_WEIGHT)}% hit trajectory</b>: High ({TRAJECTORY_SCORES.High}) &gt; Medium ({TRAJECTORY_SCORES.Medium}) &gt; Low ({TRAJECTORY_SCORES.Low}).
        {' '}Offense, defense, running and chemistry evaluate all nine starters. <b>Pitching uses only the top {POWER_PITCHER_COUNT} priority pitchers</b>: P1P first, P2P next, then untagged players if fewer than three are available. Within each priority tier, stronger pitchers come first; the selected three count equally. Before a default lineup is submitted, all drafted players count.
        {rankings.some(t=>t.games>0)?' Published regular-season performances gradually count for up to 60% of the index after eight team games.':''}
      </p></div><Medal size={32} aria-hidden="true"/></div>
    <div className="ssl-pre-scroll"><table className="ssl-pre-table">
      <thead><tr><th>Rank</th><th>Franchise</th><th>Score</th>{!compact&&<>
        <th>Off.</th><th>Pitch.</th><th>Def.</th><th>Run</th><th>Chem.</th><th>Regular W–L</th>
      </>}</tr></thead>
      <tbody>{(compact?rankings.slice(0,5):rankings).map(t=>
        <tr key={t.id}><td className="ssl-pre-rank">#{t.rank}</td>
          <td><Identity team={t} supabase={supabase}/></td>
          <td className="ssl-pre-score">{t.score.toFixed(1)}</td>
          {!compact&&<><td>{t.offense.toFixed(1)}</td><td>{t.pitching.toFixed(1)}</td>
            <td>{t.defense.toFixed(1)}</td><td>{t.running.toFixed(1)}</td>
            <td>{t.chemistry.toFixed(1)}</td><td>{t.wins}–{t.losses}</td></>}
        </tr>)}</tbody>
    </table></div>
    <p className="ssl-pre-help">Power rankings are projections, not the league standings. Preseason tournament results never affect this index or regular-season records.</p>
  </section>;
}

function ScoreEntry({game,league}){
  const [a,setA]=useState(game.scoreA!=null?String(game.scoreA):'');
  const [b,setB]=useState(game.scoreB!=null?String(game.scoreB):'');
  useEffect(()=>{setA(game.scoreA==null?'':String(game.scoreA));setB(game.scoreB==null?'':String(game.scoreB));},
    [game.key,game.scoreA,game.scoreB]);
  const canSubmit=a!==''&&b!==''&&Number.isInteger(Number(a))&&Number.isInteger(Number(b))&&
    Number(a)>=0&&Number(b)>=0&&Number(a)<=999&&Number(b)<=999&&Number(a)!==Number(b);
  if(league.access.role!=='commissioner')return null;
  return <form className="ssl-pre-score-form" onSubmit={async e=>{
    e.preventDefault();
    if(!canSubmit||league.busy)return;
    await league.recordPreseasonResult(game.key,Number(a),Number(b));
  }}>
    <label>High seed<input type="number" min="0" max="999" step="1" aria-label={game.key+' higher-seed score'} value={a} onChange={e=>setA(e.target.value)}/></label>
    <label>Low seed<input type="number" min="0" max="999" step="1" aria-label={game.key+' lower-seed score'} value={b} onChange={e=>setB(e.target.value)}/></label>
    <button className="red-btn" type="submit" disabled={!canSubmit||league.busy}>
      {game.winner?'CORRECT RESULT':'RECORD FINAL'}</button>
    {game.winner&&<button className="outline-btn" type="button" disabled={league.busy}
      onClick={async()=>{
        if(window.confirm('Clear this preseason result? Later rounds must be cleared first.'))
          await league.clearPreseasonResult(game.key);
      }}>CLEAR</button>}
  </form>;
}
export function PreseasonTournament({league,compact=false}){
  const season=league.season;
  const bracket=useMemo(()=>preseasonBracket(season),[season]);
  const ready=preseasonReady(season);
  if(!ready)return <section className="panel ssl-pre-panel">
    <h2>PRESEASON TOURNAMENT</h2>
    <p>The automatic 12-team bracket and draft-speed seeds appear once the official draft is finished. No seed is assigned while picks are still in progress.</p>
  </section>;
  return <div className="ssl-pre-tournament">
    <section className="panel ssl-pre-panel">
      <div className="ssl-pre-head"><div><small>SSL PRESEASON · SINGLE ELIMINATION</small>
        <h2>PRESEASON TOURNAMENT</h2>
        <p><b>Fastest average draft pick = #1 seed; slowest = #12 seed.</b>
          Every round reseeds the remaining teams: highest against lowest.
          With three teams left, the highest surviving seed receives a semifinal bye.
        </p></div><Trophy size={34} aria-hidden="true"/></div>
      {bracket.champion&&<div className="ssl-pre-champion" role="status">
        <Trophy size={29}/><div><small>PRESEASON TOURNAMENT CHAMPION</small>
          <strong>{bracket.champion.name}</strong>
          <p>Championship badge unlocked for this franchise's GM.</p></div></div>}
      <p className="ssl-pre-help"><b>{bracket.completedGames} of 11 games final.</b> Tournament scores are independent from regular-season standings, career stats, Heating Up, and fantasy.</p>
      {league.error&&<p className="ssl-pre-error" role="alert">{league.error}</p>}
    </section>
    <section className="panel ssl-pre-panel">
      <h3><Clock size={18} aria-hidden="true"/> DRAFT SPEED SEEDING</h3>
      <div className="ssl-pre-scroll"><table className="ssl-pre-table">
        <thead><tr><th>Seed</th><th>Team</th><th>Average pick time</th><th>Picks</th></tr></thead>
        <tbody>{bracket.seeds.map(t=><tr key={t.id}>
          <td className="ssl-pre-rank">#{t.seed}</td><td><Identity team={t} supabase={league.supabase}/></td>
          <td>{pickTimeLabel(t.avgSeconds)}</td><td>{t.selectedPicks}</td>
        </tr>)}</tbody>
      </table></div>
      <p className="ssl-pre-help">Includes each franchise's drafted player and Stadium selections, plus supplemental picks, where applicable. Ties are broken by official lottery-order position. Paused clock intervals are excluded from saved pick times.</p>
    </section>
    <div className="ssl-pre-rounds">
      {bracket.rounds.map(round=><section className="panel ssl-pre-panel ssl-pre-round" key={round.number}>
        <div className="ssl-pre-round-title"><h3>{round.title}</h3><small>{round.pending?'AWAITING PRIOR ROUND':round.complete?'ROUND COMPLETE':'SINGLE ELIMINATION'}</small></div>
        {round.pending?<p>Matchups will be reseeded automatically after all games in the previous round are entered.</p>:<>
          {round.bye&&<div className="ssl-pre-bye"><strong>ADVANCES BYE</strong> · #{round.bye.seed} {round.bye.name}</div>}
          <div className="ssl-pre-games">{round.games.map(game=><article className="ssl-pre-game" key={game.key}>
            <small>{game.key} · HIGH SEED VS LOW SEED</small>
            <div className={'ssl-pre-side'+(game.winner?.id===game.high.id?' winner':'')}>
              <span className="ssl-pre-seed">#{game.high.seed}</span>
              <Identity team={game.high} supabase={league.supabase}/>
              <b>{game.scoreA==null?'—':game.scoreA}</b></div>
            <div className={'ssl-pre-side'+(game.winner?.id===game.low.id?' winner':'')}>
              <span className="ssl-pre-seed">#{game.low.seed}</span>
              <Identity team={game.low} supabase={league.supabase}/>
              <b>{game.scoreB==null?'—':game.scoreB}</b></div>
            {game.winner&&<p className="ssl-pre-winner">ADVANCES · {game.winner.name}</p>}
            <ScoreEntry game={game} league={league}/>
          </article>)}</div>
        </>}
      </section>)}
    </div>
  </div>;
}
