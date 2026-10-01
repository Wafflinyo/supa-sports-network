import React from 'react'
import {scoringWeights,playerBreakdown,starterStats,roundPoints} from './temporary-matchup-stats.js'

export default function TestMatchupBreakdown({teams,test,results,columns,PlayerAvatar}) {
  const scoringColumns=columns.slice(2)
  const counts=teams.map(team=>starterStats(team,results))
  const fmt=value=>(roundPoints(value)||0).toLocaleString('en-US',{maximumFractionDigits:2})
  const signed=value=>`${value>0?'+':''}${fmt(value)}`
  const owner=id=>test.teams.find(team=>team.players.includes(id))
  const positions=id=>results.playerStats[id]?.positionsPlayed?.join(', ')||'—'
  const playerTable=(team,ids,bench=false)=>{
    const parts=ids.map(id=>playerBreakdown(id,results))
    return <div className="table-scroll"><table className={`fantasy-simple-table matchup-player-table ${bench?'matchup-bench-table':''}`}><thead><tr><th>Player / game details</th>{!bench && <th>Positions</th>}<th>GP</th><th>{bench?'Bat':'Batting pts'}</th><th>{bench?'Field':'Fielding pts'}</th><th>{bench?'Pitch':'Pitching pts'}</th><th>{bench?'Bonus':'Team bonus pts'}</th><th>{bench?'Total':'Total pts'}</th></tr></thead><tbody>{ids.map((id,index)=>{
      const p=test.profiles[id],score=parts[index]
      return <tr key={id}><td><details className="matchup-player-details"><summary><PlayerAvatar player={p} size={28}/><span><strong>{p.name}</strong><small>{owner(id).name} · {score.gamesPlayed?'Reported':'Awaiting game report'}</small></span></summary><div className="matchup-player-expanded">{score.games.length?score.games.map(game=><p key={game.id}><strong>{test.teams.find(t=>t.id===test.schedule.find(s=>s.id===game.id).awayId).name} {game.awayRuns}–{game.homeRuns} {test.teams.find(t=>t.id===test.schedule.find(s=>s.id===game.id).homeId).name}</strong><br/>{fmt(game.playerScores[id].batting)} batting + {fmt(game.playerScores[id].fielding)} fielding + {fmt(game.playerScores[id].pitching)} pitching + {fmt(game.playerScores[id].teamBonus)} team bonus = <b>{fmt(game.playerScores[id].total)} pts</b></p>):<p>No game stats yet.</p>}{!!score.gamesPlayed && <dl>{scoringColumns.map(([key,label])=><div key={key}><dt>{label}</dt><dd>{fmt(results.playerStats[id]?.[key]||0)} × {signed(scoringWeights[key])} = <b>{signed((results.playerStats[id]?.[key]||0)*scoringWeights[key])} pts</b></dd></div>)}</dl>}</div></details></td>{!bench && <td>{positions(id)}</td>}<td>{score.gamesPlayed}</td>{['batting','fielding','pitching','teamBonus','total'].map(key=><td key={key}>{fmt(score[key])}</td>)}</tr>
    })}</tbody><tfoot><tr><th colSpan={bench?1:2}>{bench?'Bench total · excluded':'Counted starter total'}</th><td>{parts.reduce((sum,p)=>sum+p.gamesPlayed,0)}</td>{['batting','fielding','pitching','teamBonus','total'].map(key=><td key={key}>{fmt(parts.reduce((sum,p)=>sum+p[key],0))}</td>)}</tr></tfoot></table></div>
  }
  return <div className="test-matchup-breakdown">
    <p className="test-note">Only the seven starters count toward the matchup. Open Starter comparisons to inspect counted points. Bench points below are excluded; open a player’s name for their full scoring details.</p>
    <div className="matchup-breakdown-teams matchup-visible-benches">{teams.map(team=><section key={team.id} className="matchup-team-breakdown"><h3>{team.name} · Bench ({team.bench.length})</h3><p className="test-note">{fmt(team.bench.reduce((sum,id)=>sum+playerBreakdown(id,results).total,0))} bench pts · excluded from matchup</p>{playerTable(team,team.bench,true)}</section>)}</div>
    <details className="matchup-starter-comparisons"><summary>Starter comparisons & scoring stats <span>Open / close</span></summary><div className="matchup-breakdown-teams">{teams.map((team,index)=><section key={team.id} className="matchup-team-breakdown"><h3>{team.name} · Starters</h3><p className="test-note">{counts[index].gamesPlayed} starter appearances reported · {team.starters.filter(id=>!results.playerStats[id]).length} starters awaiting their game</p>{playerTable(team,team.starters)}</section>)}</div>
    <h3>STARTER STAT COMPARISON</h3>
    <p className="test-note">Counts and their awarded points for each team. Pitching bonuses count qualifying games; points apply the current rule weights.</p>
    <div className="table-scroll"><table className="fantasy-simple-table matchup-stat-comparison"><thead><tr><th>Scoring stat</th><th>Points each</th>{teams.map(team=><th key={team.id} colSpan="2">{team.name}</th>)}</tr><tr><th/><th/>{teams.map(team=><React.Fragment key={team.id}><th>Count</th><th>Points</th></React.Fragment>)}</tr></thead><tbody>{scoringColumns.map(([key,label])=><tr key={key}><td>{label}</td><td>{signed(scoringWeights[key])}</td>{counts.map((stats,index)=><React.Fragment key={teams[index].id}><td>{fmt(stats[key])}</td><td>{signed(stats[key]*scoringWeights[key])}</td></React.Fragment>)}</tr>)}</tbody><tfoot><tr><th colSpan="2">MATCHUP TOTAL</th>{counts.map((stats,index)=><td colSpan="2" key={teams[index].id}>{fmt(Object.entries(scoringWeights).reduce((sum,[key,weight])=>sum+stats[key]*weight,0))} pts</td>)}</tr></tfoot></table></div>
    </details>
  </div>
}
