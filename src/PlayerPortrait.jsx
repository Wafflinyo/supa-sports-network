import React,{createContext,useContext} from 'react'
import {playerPortraitStyle} from './player-portraits.js'
import {HeatMark} from './HeatingUpBadge.jsx'
// Player profile links supply an inline name flame; never repeat one over their portrait.
export const PortraitFlameContext=createContext(true);
export function PlayerPortrait({player,size=32,showHeat=true}) {
  const contextAllowsPortraitHeat=useContext(PortraitFlameContext);
  if(!player)return null
  const portrait=playerPortraitStyle(player,size)
  return <span className="tier-portrait-wrap" style={{width:size,height:size,flex:`0 0 ${size}px`}}><span className={`player-avatar${portrait?' has-portrait':''}`} style={{width:size,height:size,display:'inline-block',...portrait}} aria-hidden="true">{portrait?null:player.name.slice(0,1)}</span>{showHeat&&contextAllowsPortraitHeat&&<HeatMark playerId={player.id}/>} </span>
}
