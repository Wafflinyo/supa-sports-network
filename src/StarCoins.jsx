import React from 'react'
import pool from './players.json'
import {PlayerPortrait} from './PlayerPortrait.jsx'
import {starTier,starPrice} from './star-tiers.js'
import {PlayerPriority} from './PlayerPriority.jsx'

const byId=new Map(pool.map(p=>[p.id,p]))
export function StarBalance({season,team}) {
  const b=season?.starCoins?.balances?.[team]
  if(!b) return null
  return <div className="star-balance" aria-label="Star Coin balance"><strong>★ STAR COINS · {b.allocation??60} PER SEASON</strong><span>{b.available} available</span><span>{b.reserved} reserved</span><span>{b.spent} spent</span>{b.transfers!==0&&<span>{b.transfers>0?'+':''}{b.transfers} traded</span>}{b.expired&&<b>Season coins expired</b>}</div>
}
export function StarSelections({season,team,game,selected,onChange,disabled}) {
  const info=season.starCoins?.games?.[game.id]?.[team]||{}
  const remaining=info.remainingByPlayer||{}
  const balance=season.starCoins?.balances?.[team]
  const cost=selected.reduce((n,id)=>n+starPrice(byId.get(id),remaining[id]),0)
  const budget=(balance?.available||0)+(info.cost||0)
  return <section className="star-selections">
    <h4>STAR PLAYERS · {selected.length}/3</h4>
    <StarBalance season={season} team={team}/>
    <p>Choose up to three per game. Tier 1: 1 coin, no recharge. Tier 2: 2 coins, 1 recharge game. Tier 3: 3 coins, 2 recharge games. Each remaining recharge game can be bypassed for 2 extra coins, plus the regular tier cost. Recharge counts down only when the player is unstarred for a team game; trades do not reset it.</p>
    <div className="star-player-grid">{(season.rosters?.[team]||[]).map(id=>{
      const player=byId.get(Number(id)),checked=selected.includes(id)
      const tier=starTier(player),left=Number(remaining[id]||0),price=starPrice(player,left)
      return <label key={id} className={left>0?'needs-recharge':''}>
        <input type="checkbox" aria-label={`Star ${player?.name}`} checked={checked} disabled={disabled||balance?.expired||(!checked&&selected.length>=3)} onChange={()=>onChange(checked?selected.filter(x=>x!==id):[...selected,id])}/>
        <PlayerPortrait player={player}/>
        <span className="star-player-description"><strong>{player?.name}</strong> <PlayerPriority player={player}/><small>Tier {tier} · {left>0?`${left} recharge game${left===1?'':'s'} remaining · ${tier} + ${left*2} bypass = ${price} coins`:`Ready · ${price} coin${price===1?'':'s'}`}</small></span>
      </label>
    })}</div>
    <p role="status"><strong>Selected cost: {cost} coin{cost===1?'':'s'}</strong> · {budget} available for this lineup{cost>budget&&<b className="season-error"> · Not enough coins; revise selections or other reservations.</b>}</p>
    <small>Future-game costs automatically update if earlier star selections change. Charges lock when game results are submitted.</small>
  </section>
}
