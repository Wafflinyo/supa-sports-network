import React,{useState,useEffect} from 'react';
import pool from './players.json';
import {PlayerPortrait} from './PlayerPortrait.jsx';
import {PlayerPriority} from './PlayerPriority.jsx';
import {PlayerDataDetails} from './PlayerData.jsx';
import {DraftPickBadge} from './DraftPickBadge.jsx';
import {teamDraftedPlayers} from './draft-pedigree.js';
import {homeStadium} from './matchup-display.js';
import './draft-pedigree.css';

const byId=new Map(pool.map(p=>[Number(p.id),p]));
export default function MyDraftTeam({league:l}) {
  const season=l.season,team=l.myTeam;
  const [openPlayer,setOpenPlayer]=useState(null);
  useEffect(()=>setOpenPlayer(null),[season?.id,team?.id]);
  if(!season||!team)return <section className="panel my-draft-team"><h2>MY TEAM</h2><p>Your team will appear when the commissioner registers it for the season.</p></section>;
  const cards=teamDraftedPlayers(season,team.id);
  const stadium=homeStadium(season,team.id);
  const active=byId.get(openPlayer);
  return <section className="panel my-draft-team" aria-label="My Team drafted roster">
    <div className="my-draft-team-header">
      <div><small>YOUR SSL FRANCHISE · SEASON {season.number}</small>
        <h2>MY TEAM · {team.name}</h2>
        <p>Your live roster updates after every draft pick, trade or signing. Select a card to scout the player. Original draft round and overall pick stay on their card throughout the season.</p>
      </div>
      <div className="my-draft-team-count"><strong>{cards.length}</strong><span>ROSTERED PLAYERS</span></div>
    </div>
    <div className="my-draft-team-venue"><strong>HOME STADIUM:</strong> {stadium||'Not drafted yet'}</div>
    {!cards.length?<div className="my-draft-team-empty">No players drafted yet. Players will appear here automatically when your franchise makes its first pick.</div>:
      <div className="my-draft-team-grid">
        {cards.map(({playerId})=>{
          const player=byId.get(playerId);
          if(!player)return null;
          return <button className="my-draft-team-card" type="button" key={playerId}
            aria-label={'View '+player.name+' profile'} onClick={()=>setOpenPlayer(openPlayer===playerId?null:playerId)}>
            <div className="my-draft-team-identity"><PlayerPortrait player={player} size={38}/>
              <div className="my-draft-team-info"><strong>{player.name}</strong>
                <PlayerPriority player={player}/><span>{player.class}</span></div>
            </div>
            <DraftPickBadge playerId={playerId} seasons={l.seasons} compact/>
            {!l.seasons.some(season=>(season.picks||[]).some(p=>Number(p.player)===playerId))&&
              <small>ACQUIRED · NO SSL DRAFT PICK</small>}
          </button>;
        })}
      </div>}
    {active&&<section className="my-draft-team-detail" aria-label={active.name+' detailed player stats'}>
      <button type="button" className="outline-btn" onClick={()=>setOpenPlayer(null)}>CLOSE PLAYER DETAILS</button>
      <DraftPickBadge playerId={active.id} seasons={l.seasons}/>
      <PlayerDataDetails player={active} seasons={l.seasons}/>
    </section>}
  </section>;
}
