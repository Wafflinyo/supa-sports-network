import React from 'react'
import pool from './players.json'
import {PlayerPortrait} from './PlayerPortrait.jsx'

export function StarBalance({season,team}) {
  const b=season?.starCoins?.balances?.[team]
  if(!b) return null
  return <div className="star-balance" aria-label="Star Coin balance"><strong>★ STAR COINS</strong><span>{b.available} available</span><span>{b.reserved} reserved</span><span>{b.spent} spent</span>{b.transfers!==0&&<span>{b.transfers>0?'+':''}{b.transfers} traded</span>}{b.expired&&<b>Season coins expired</b>}</div>
}
export function StarSelections({season,team,game,selected,onChange,disabled}) {
  const info=season.starCoins?.games?.[game.id]?.[team]||{},need=new Set(info.recharging||[]),b=season.starCoins?.balances?.[team],cost=selected.reduce((n,p)=>n+(need.has(p)?6:1),0),budget=(b?.available||0)+(info.cost||0)
  return <section className="star-selections"><h4>STAR PLAYERS · {selected.length}/3</h4><StarBalance season={season} team={team}/><p>Choose up to three. Save the game lineup to reserve coins. ↻ means recharge is needed for this game: 6 coins instead of 1. An unstarred team game recharges the player; trades do not clear it.</p><div className="star-player-grid">{(season.rosters[team]||[]).map(id=>{const p=pool.find(p=>p.id===id),checked=selected.includes(id);return <label key={id} className={need.has(id)?'needs-recharge':''}><input type="checkbox" aria-label={`Star ${p?.name}`} checked={checked} disabled={disabled||b?.expired||(!checked&&selected.length>=3)} onChange={()=>onChange(checked?selected.filter(x=>x!==id):[...selected,id])}/><PlayerPortrait player={p}/><span>{p?.name}<small>{need.has(id)?'↻ Recharge bypass · 6 coins':'★ Ready · 1 coin'}</small></span></label>})}</div><p role="status"><strong>Selected cost: {cost} coin{cost===1?'':'s'}</strong> · {budget} available for this lineup{cost>budget&&<b className="season-error"> · Not enough coins; revise selections or other reservations.</b>}</p><small>Costs for future games are recalculated by the server when earlier selections change.</small></section>
}
