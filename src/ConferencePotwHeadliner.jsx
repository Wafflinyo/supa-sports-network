import React from 'react';
import {conferencePotwStory} from './conference-potw-story.js';
import {ConferenceMark} from './ConferenceMark.jsx';
import {PlayerPortrait} from './PlayerPortrait.jsx';
import {potwDate,potwPlayer,potwTrophyUrl,potwWeekLabel,potwConferenceName} from './player-of-the-week.js';
import './conference-potw.css';

const score=n=>(Number(n)||0).toFixed(2);

export default function ConferencePotwHeadliner({awards=[],season,onPlayerSelect}){
 const supa=awards.find(a=>a.conference==='supa');
 const galaxy=awards.find(a=>a.conference==='galaxy');
 if(!supa||!galaxy)return null;
 const sides=[['supa',supa],['galaxy',galaxy]];
 const awardedAt=supa.awardedAt||galaxy.awardedAt;
 return <section className="hero ssl-home-hero ssl-conference-awards-hero"
   aria-label={'Official SSL Conference Players of the Week, '+potwWeekLabel(supa.roundNo)}>
   <header className="ssl-conference-awards-title">
     <span className="eyebrow">OFFICIAL SSL AWARDS · {potwWeekLabel(supa.roundNo)}</span>
     <h1>CONFERENCE PLAYERS <em>OF THE WEEK</em></h1>
     <small>Presented {potwDate(awardedAt)}</small>
   </header>
   <div className="ssl-conference-awards-sides">
     {sides.map(([conference,a])=>{
       const player=potwPlayer(a.player);
       const story=conferencePotwStory(season,a);
       return <div key={conference} className={'ssl-conf-potw-side ssl-conf-potw-'+conference}>
         <div className="ssl-conf-potw-bg-mark" aria-hidden="true"><ConferenceMark id={conference} size={185}/></div>
         <div className="ssl-conf-potw-side-head">
           <ConferenceMark id={conference} size={50}/>
           <div><small>{conference==='supa'?'SUPA MARIO':'MARIO GALAXY'}</small>
             <strong>PLAYER OF THE WEEK</strong>
           </div>
         </div>
         <div className="ssl-conf-potw-player-block">
           <button type="button" className="ssl-conf-potw-portrait"
             aria-label={'View '+(player?.name||'player')+' profile'}
             onClick={()=>player&&onPlayerSelect?.(player)}>
             <PlayerPortrait player={player} size={74} showHeat={false}/>
           </button>
           <div className="ssl-conf-potw-player-info">
             <h2>{player?.name||'SSL Player'}</h2>
             <p>{a.teamName}</p>
           </div>
           <img className="ssl-conf-potw-trophy" src={potwTrophyUrl(conference)}
             alt={potwConferenceName(conference)+' trophy'} />
         </div>
         <div className="ssl-conf-potw-averages">
           <div className="ssl-conf-potw-major-stat"><span>AGP</span><strong>{score(a.metrics?.agp)}</strong></div>
           {[
             ['OGP','ogp'],['DGP','dgp'],['PGP','pgp']
           ].map(([label,key])=><div className="ssl-conf-potw-stat" key={key}>
             <span>{label} / G</span><strong>{score(a.metrics?.[key])}</strong>
           </div>)}
         </div>
         <div className="ssl-conf-potw-editorial">
           <h3>{story.title}</h3>
           <p>{story.summary}</p>
           <details><summary>READ FULL PLAYER &amp; TEAM SPOTLIGHT</summary>
             <p>{story.detail}</p>
           </details>
         </div>
       </div>;
     })}
   </div>
 </section>;
}
