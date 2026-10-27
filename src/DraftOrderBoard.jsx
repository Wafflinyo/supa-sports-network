import React,{useState} from 'react';
import {draftRoundQueue,lotteryOrderReady} from './draft-pick-stats-order.js';
import {teamLogo} from './TeamIdentity.jsx';
import './draft-order-board.css';

export default function DraftOrderBoard({league:l}){
  const season=l.season;
  const [roundChoice,setRoundChoice]=useState('current');
  if(!lotteryOrderReady(season,l.now))return null;
  const current=Number(season.nextPick?.round||
    (season.picks||[]).at(-1)?.round||1);
  const activeRound=roundChoice==='current'?Math.max(1,Math.min(12,current)):Number(roundChoice);
  const queue=draftRoundQueue(season,activeRound,l.now);
  const completed=queue.filter(item=>item.status==='picked').length;
  const now=queue.find(item=>item.isCurrent);
  return <section className="ssl-draft-order-board" aria-label="Official draft round picking order">
    <div className="ssl-draft-queue-top">
      <div>
        <span className="ssl-draft-queue-kicker">SAVED LOTTERY RESULTS · OFFICIAL SNAKE DRAFT</span>
        <h3>PICK ORDER · ROUND {activeRound}</h3>
        <p>{activeRound%2===1?'Lottery order, first to twelfth':'Reverse lottery order, twelfth to first'} ·
          {activeRound===12?' Retained-Stadium turns are skipped.':' Traded draft picks show their current owner.'}</p>
      </div>
      <label htmlFor="ssl-select-draft-round">VIEW ROUND
        <select id="ssl-select-draft-round" value={roundChoice} onChange={e=>setRoundChoice(e.target.value)}>
          <option value="current">Current / latest round</option>
          {Array.from({length:12},(_,i)=><option value={i+1} key={i}>Round {i+1}</option>)}
        </select>
      </label>
    </div>
    <div className="ssl-draft-queue-current" aria-live="off">
      <strong>{now?'ON THE CLOCK':season.status==='drafting'?'AWAITING NEXT ROUND':season.status==='scheduled'?'DRAFT NOT STARTED':'ROUND SUMMARY'}</strong>
      <span>{now?now.pickingTeam?.name||'Picking team':
        season.status==='drafting'?'Waiting for the server’s next pick':
          completed?completed+' selections completed in this round':'See the official lottery-based order below'}</span>
      {now&&<b>ROUND {activeRound} · PICK #{(season.picks||[]).length+1}</b>}
    </div>
    <div className="ssl-draft-queue-scroll" role="region" aria-label={'Round '+activeRound+' pick positions'} tabIndex={0}>
      <ol className="ssl-draft-queue-list">
        {queue.map(entry=><li key={entry.cursor}
          className={'ssl-draft-queue-item status-'+entry.status+(entry.transferred?' traded':'')}>
          <span className="ssl-draft-queue-rank" aria-label={'Round position '+entry.roundPosition}>{entry.roundPosition}</span>
          {entry.pickingTeam?.logoPath&&<img className="ssl-draft-queue-logo" alt=""
            src={teamLogo(l.supabase,entry.pickingTeam.logoPath)}/>}
          <div className="ssl-draft-queue-team">
            <strong>{entry.pickingTeam?.name||'Unknown team'}</strong>
            {entry.transferred&&<small>TRADED FROM {entry.originalTeam?.name||'ORIGINAL FRANCHISE'}</small>}
            {entry.mustStage&&<small>STADIUM PICK REQUIRED</small>}
            {entry.pick&&<small>{entry.pick.kind==='stage'?'STADIUM · '+entry.pick.stage:
              'PLAYER PICK #'+entry.pick.number}</small>}
          </div>
          <span className="ssl-draft-queue-status">
            {entry.status==='picked'?'PICKED':entry.status==='on-clock'?'ON THE CLOCK':'UPCOMING'}
          </span>
        </li>)}
      </ol>
    </div>
    <p className="ssl-draft-queue-footnote">Pick numbers and turn ownership come from the official server records.
      Changing rounds here only changes your view; it does not alter the draft or lottery.</p>
  </section>;
}
