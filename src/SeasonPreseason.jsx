import React,{useEffect,useMemo,useState} from 'react';
import {Trophy,Clock,Medal} from 'lucide-react';
import {teamLogo} from './TeamIdentity.jsx';
import {powerRankings} from './power-rankings.js';
import {preseasonBracket,preseasonReady,pickTimeLabel} from './preseason.js';
import './preseason.css';

function Identity({team,supabase}){
  if(!team)return <span>To be determined</span>;
  return <span className="ssl-pre-team">
    {team.logoPath&&supabase&&<img src={teamLogo(supabase,team.logoPath)} alt=""/>}
    <span>{team.name}</span>
  </span>;
}

// Display-only presentation: numeric power index and three category placements.
// The ranking model remains in power-rankings.js; no draft, roster or season state is modified.
export function PowerRankings({season,supabase,compact=false}){
  const rankings=useMemo(()=>powerRankings(season),[season]);
  const eligible=Array.isArray(season?.teams)&&season.teams.length===12;
  const pending=eligible?(season.teams||[]).filter(team=>!rankings.some(t=>t.id===team.id)):[];
  const categoryPlaces=useMemo(()=>{
    const result={};
    for(const field of ['offense','pitching','defense']){
      [...rankings].sort((a,b)=>b[field]-a[field]||a.rank-b.rank).forEach((team,index)=>{
        (result[team.id]??={})[field]=index+1;
      });
    }
    return result;
  },[rankings]);
  if(!rankings.length)return <section className="panel ssl-pre-panel">
    <h2>POWER RANKINGS</h2>
    <p>Rankings open after the draft as teams submit their default lineups.</p>
    {eligible&&<p><strong>0 / {season.teams.length} teams ranked.</strong> Awaiting lineup submissions.</p>}
  </section>;
  return <section className="panel ssl-pre-panel ssl-power-panel" aria-label="SSL power rankings">
    <div className="ssl-pre-head ssl-power-head">
      <div><small>SLUGGERS SUPA LEAGUE · POWER RANKINGS</small>
        <h2>{rankings.some(t=>t.games>0)?'LIVE POWER RANKINGS':'POST-DRAFT POWER RANKINGS'}</h2>
      </div>
      <Medal size={34} aria-hidden="true"/>
    </div>
    <div className="ssl-power-status">
      <strong>{rankings.length} / {season.teams.length}</strong> teams ranked
      {pending.length>0&&<span> · Awaiting {pending.length} {pending.length===1?'lineup':'lineups'}</span>}
    </div>
    <ol className="ssl-power-board">
      {(compact?rankings.slice(0,5):rankings).map(t=>
        <li key={t.id} className={'ssl-power-entry'+(t.rank<=3?' ssl-power-podium':'')}
            style={{'--ssl-power-accent':t.rank===1?'#dfab45':t.rank===2?'#99aec9':t.rank===3?'#c58a71':'#2789d2'}}>
          <div className="ssl-power-team">
            <span className="ssl-power-position" aria-label={'Overall rank '+t.rank}>{String(t.rank).padStart(2,'0')}</span>
            <div className="ssl-power-identity"><Identity team={t} supabase={supabase}/></div>
          </div>
          <div className="ssl-power-main-score">
            <div className="ssl-power-scoreline"><span>POWER RANKING SCORE</span>
              <strong>{t.score.toFixed(1)}<small> / 100</small></strong></div>
            <div className="ssl-power-meter" role="progressbar" aria-label={t.name+' power ranking score'}
                aria-valuemin={0} aria-valuemax={100} aria-valuenow={t.score}>
              <span className="ssl-power-meter-fill" style={{width:Math.max(0,Math.min(100,t.score))+'%'}}/>
            </div>
          </div>
          <div className="ssl-power-subranks" aria-label={t.name+' category rankings and scores'}>
            <span>Offensive Ranking: <b>#{categoryPlaces[t.id].offense}</b>
              <small>Score: <strong>{t.offense.toFixed(1)}</strong></small></span>
            <span>Pitching Ranking: <b>#{categoryPlaces[t.id].pitching}</b>
              <small>Score: <strong>{t.pitching.toFixed(1)}</strong></small></span>
            <span>Defensive Ranking: <b>#{categoryPlaces[t.id].defense}</b>
              <small>Score: <strong>{t.defense.toFixed(1)}</strong></small></span>
          </div>
        </li>)}
    </ol>
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
  if(compact)return <section className="panel ssl-pre-panel ssl-pre-home-bracket" aria-label="Pre-season tournament bracket">
    <div className="ssl-pre-head">
      <div><small>SSL PRE-SEASON · SINGLE ELIMINATION</small>
        <h2>PRE-SEASON BRACKET</h2>
        <p><strong>{bracket.completedGames} of {bracket.totalGames} matches completed</strong>
          {' '}· Round-by-round results update as the tournament progresses.</p>
      </div>
      <Trophy size={32} aria-hidden="true"/>
    </div>
    {bracket.champion&&<div className="ssl-pre-champion" role="status">
      <Trophy size={26}/><div><small>PRE-SEASON CHAMPION</small>
        <strong>{bracket.champion.name}</strong></div></div>}
    <div className="ssl-pre-home-rounds">
      {bracket.rounds.map(round=><section className="ssl-pre-home-round" key={round.number}
        aria-label={round.title}>
        <div className="ssl-pre-round-title">
          <h3>{round.title}</h3><small>{round.complete?'COMPLETE':round.pending?'UPCOMING':'IN PROGRESS'}</small>
        </div>
        {round.pending?<p className="ssl-pre-home-pending">Awaiting the previous round</p>:<>
          {round.bye&&<div className="ssl-pre-bye"><b>BYE</b> · #{round.bye.seed} {round.bye.name}</div>}
          <div className="ssl-pre-games">
            {round.games.map(game=><article className="ssl-pre-game" key={game.key}>
              <small>{game.key}</small>
              <div className={'ssl-pre-side'+(game.winner?.id===game.high.id?' winner':'')}>
                <span className="ssl-pre-seed">#{game.high.seed}</span>
                <Identity team={game.high} supabase={league.supabase}/>
                <b>{game.scoreA??'—'}</b></div>
              <div className={'ssl-pre-side'+(game.winner?.id===game.low.id?' winner':'')}>
                <span className="ssl-pre-seed">#{game.low.seed}</span>
                <Identity team={game.low} supabase={league.supabase}/>
                <b>{game.scoreB??'—'}</b></div>
            </article>)}
          </div>
        </>}
      </section>)}
    </div>
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
