import React from 'react'
import {playerPortraitStyle} from './player-portraits.js'
import {starTier} from './star-tiers.js'
export function PlayerPortrait({player,size=32}) {
  if (!player) return null
  const portrait=playerPortraitStyle(player,size)
  return <span className="tier-portrait-wrap" style={{width:size,height:size,flex:`0 0 ${size}px`}}><span className={`player-avatar${portrait?' has-portrait':''}`} style={{width:size,height:size,display:'inline-block',...portrait}} aria-hidden="true">{portrait?null:player.name.slice(0,1)}</span><span className={`player-tier-badge tier-${starTier(player)}`} title={`Star tier ${starTier(player)}`} aria-label={`Tier ${starTier(player)}`}>T{starTier(player)}</span></span>
}
