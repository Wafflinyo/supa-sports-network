import React,{useMemo} from 'react';
import archive from './player-careers.json';
import {playerCareer} from './player-career.js';
import {aggregate} from './season-data.js';

// Safe to embed inside the official draft selection dialog: viewers see career
// information on tap, while the original pick confirmation controls stay intact.
export function PlayerCareerSnapshot({player,seasons=[]}){
  const rows=useMemo(()=>seasons.map(s=>({id:s.id,playerStats:aggregate(s)})),[seasons]);
  const career=playerCareer(player.id,[...archive.seasons,...rows]);
  const fields=[
    ['Career games',career.games],
    ['Career MVPs',career.mvps],
    ['Career game score',career.gameScore],
    ['Batting average',career.averages.battingAverage?.toFixed(3)],
    ['Hits / game',career.averages.hits?.toFixed(2)],
    ['Home runs / game',career.averages.homeRuns?.toFixed(2)],
    ['RBIs / game',career.averages.rbi?.toFixed(2)],
    ['Pitching strikeouts / game',career.averages.pitchStrikeouts?.toFixed(2)],
  ];
  return <section className="draft-career-snapshot" aria-label={player.name+' career statistics'}>
    <h3>CAREER STATISTICS</h3>
    <dl className="career-average-grid">{fields.map(([label,value])=>
      <div key={label}><dt>{label}</dt><dd>{value??'—'}</dd></div>)}</dl>
  </section>;
}
