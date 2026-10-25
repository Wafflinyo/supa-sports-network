import React from 'react';
import gameData from './player-data.json';
import {pitcherPriorityFor} from './player-roles.js';

// Shared pitching-priority labels across SSL roster, draft, fantasy and history.
export function taggedName(player) {
  const label = player && pitcherPriorityFor(player, gameData.players[player.id])?.code;
  return (player?.name || 'Player') + (label ? ' · ' + label : '');
}
export function PlayerPriority({player}) {
  const priority = player && pitcherPriorityFor(player, gameData.players[player.id]);
  return priority ? <span className={`pitcher-priority-badge ${priority.code.toLowerCase()}`} title={priority.label} aria-label={priority.label}>{priority.code}</span> : null;
}
