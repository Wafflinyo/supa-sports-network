import React from 'react';
import pool from './players.json';
import {PlayerPortrait} from './PlayerPortrait.jsx';
import {PlayerPriority} from './PlayerPriority.jsx';
import playerData from './player-data.json';
import {PlayerProfileLink} from './PlayerProfileLink.jsx';
import {teamDraftedPlayers} from './draft-pedigree.js';
import {homeStadium} from './matchup-display.js';
import './draft-pedigree.css';

const byId=new Map(pool.map(p=>[Number(p.id),p]));
export default function MyDraftTeam({league:l}) {
  const season=l.season,team=l.myTeam;
  if(!season||!team)return <section className="panel my-draft-team"><h2>MY TEAM</h2><p>Your team will appear when the commissioner registers it for the season.</p></section>;
  const cards=teamDraftedPlayers(season,team.id);
  const stadium=homeStadium(season,team.id);
  return <section className="panel my-draft-team" aria-label="My Team drafted roster">
    <div className="my-draft-team-header">
      <div><small>YOUR SSL FRANCHISE · SEASON {season.number}</small>
        <h2>MY TEAM · {team.name}</h2>
        <p>Your live roster updates after every draft pick, trade or signing. Tap a player card to view their career statistics. Original draft round and overall pick appear in that profile after the official draft concludes.</p>
      </div>
      <div className="my-draft-team-count"><strong>{cards.length}</strong><span>ROSTERED PLAYERS</span></div>
    </div>
    <div className="my-draft-team-venue"><strong>HOME STADIUM:</strong> {stadium||'Not drafted yet'}</div>
    {!cards.length?<div className="my-draft-team-empty">No players drafted yet. Players will appear here automatically when your franchise makes its first pick.</div>:
      <div className="my-draft-team-grid">
        {cards.map(({playerId})=>{
          const player=byId.get(playerId);
          if(!player)return null;
          return <PlayerProfileLink player={player} className="my-draft-team-card" key={playerId}>
            <div className="my-draft-team-identity"><PlayerPortrait player={player} size={38}/>
              <div className="my-draft-team-info"><strong>{player.name}</strong>
                <PlayerPriority player={player}/><span>{player.class}</span><span className="my-draft-team-trajectory">TRAJ · {playerData.players[player.id]?.stats?.['hit trajectory']||'—'}</span></div>
            </div>
          </PlayerProfileLink>;
        })}
      </div>}

  </section>;
}
