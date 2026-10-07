import React from 'react'
import {playerPortraitStyle} from './player-portraits.js'
export function PlayerPortrait({player,size=32}) {
  if (!player) return null
  const portrait=playerPortraitStyle(player,size)
  return <span className={`player-avatar${portrait?' has-portrait':''}`} style={{width:size,height:size,flex:`0 0 ${size}px`,...portrait}} aria-hidden="true">{portrait?null:player.name.slice(0,1)}</span>
}
