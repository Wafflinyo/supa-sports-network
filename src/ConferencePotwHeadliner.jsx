import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';
import {conferencePotwStory} from './conference-potw-story.js';
import {ConferenceMark} from './ConferenceMark.jsx';
import {PlayerPortrait} from './PlayerPortrait.jsx';
import {potwDate,potwPlayer,potwTrophyUrl,potwWeekLabel,potwConferenceName} from './player-of-the-week.js';
import './conference-potw.css';

const score=n=>(Number(n)||0).toFixed(2);
const pointCategories=[['OGP','ogp','offense'],['DGP','dgp','defense'],['PGP','pgp','pitching']];

function AwardArticle({award,story,conference,onClose}){
 const closeButton=useRef(null);
 useEffect(()=>{
   const prior=document.body.style.overflow;
   document.body.style.overflow='hidden';
   closeButton.current?.focus();
   const onKey=event=>{if(event.key==='Escape'){event.stopPropagation();onClose();}};
   document.addEventListener('keydown',onKey,true);
   return ()=>{
     document.body.style.overflow=prior;
     document.removeEventListener('keydown',onKey,true);
   };
 },[onClose]);
 const titleId='ssl-potw-dialog-title-'+conference;
 return createPortal(<div className="ssl-conf-potw-overlay" role="presentation"
   onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
   <article className={'ssl-conf-potw-article ssl-conf-potw-article-'+conference}
     role="dialog" aria-modal="true" aria-labelledby={titleId}>
     <div className="ssl-conf-potw-article-heading">
       <div>
         <span>{potwConferenceName(conference).toUpperCase()} · {potwWeekLabel(award.roundNo)}</span>
         <h2 id={titleId}>{story.title}</h2>
         <small>{award.teamName}</small>
       </div>
       <button type="button" className="ssl-conf-potw-article-close" ref={closeButton}
         aria-label="Close full article" onClick={onClose}><X size={23}/></button>
     </div>
     <div className="ssl-conf-potw-article-content">
       {(story.articleSections||[story.detail]).map((paragraph,index)=>
         <p key={index}>{paragraph}</p>)}
     </div>
     <button type="button" className="ssl-conf-potw-article-done" onClick={onClose}>
       CLOSE ARTICLE
     </button>
   </article>
 </div>,document.body);
}

export default function ConferencePotwHeadliner({awards=[],season,onPlayerSelect}){
 const [openArticle,setOpenArticle]=useState(null);
 const supa=awards.find(a=>a.conference==='supa');
 const galaxy=awards.find(a=>a.conference==='galaxy');
 if(!supa||!galaxy)return null;
 const sides=[['supa',supa],['galaxy',galaxy]];
 const awardedAt=supa.awardedAt||galaxy.awardedAt;
 const active=sides.find(([name])=>name===openArticle);
 const articleStory=active?conferencePotwStory(season,active[1]):null;
 return <>
   <section className="hero ssl-home-hero ssl-conference-awards-hero"
     aria-label={'Official SSL Conference Players of the Week, '+potwWeekLabel(supa.roundNo)}>
     <header className="ssl-conference-awards-title">
       <span className="eyebrow">OFFICIAL SSL AWARDS · {potwWeekLabel(supa.roundNo)}</span>
       <h1>CONFERENCE PLAYERS <em>OF THE WEEK</em></h1>
       <small>Presented {potwDate(awardedAt)}</small>
     </header>
     <div className="ssl-conference-awards-sides">
       <div className="ssl-conf-potw-spine" aria-hidden="true">
         <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
       </div>
       {sides.map(([conference,a])=>{
         const player=potwPlayer(a.player);
         const story=conferencePotwStory(season,a);
         const featuredPoints=pointCategories.filter(([,key,category])=>
           story.qualifyingCategories?.includes(category));
         return <div key={conference}
           className={'ssl-conf-potw-side ssl-conf-potw-'+conference}>
           <div className="ssl-conf-potw-bg-mark" aria-hidden="true">
             <ConferenceMark id={conference} size={185}/>
           </div>
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
               <span className="ssl-conf-potw-face"><PlayerPortrait player={player} size={70} showHeat={false}/></span>
             </button>
             <div className="ssl-conf-potw-player-info">
               <h2>{player?.name||'SSL Player'}</h2>
               <p>{a.teamName}</p>
             </div>
             <img className="ssl-conf-potw-trophy" src={potwTrophyUrl(conference)}
               alt={potwConferenceName(conference)+' trophy'} />
           </div>
           <div className="ssl-conf-potw-averages">
             <div className="ssl-conf-potw-major-stat">
               <span>AGP</span><strong>{score(a.metrics?.agp)}</strong>
             </div>
             {featuredPoints.map(([label,key],index)=>
               <div className={'ssl-conf-potw-stat ssl-conf-potw-feature-'+index} key={key}>
                 <span>{label} / G</span><strong>{score(a.metrics?.[key])}</strong>
               </div>)}
             <div className="ssl-conf-potw-total-stat" title="Total Game Points earned across these two award games">
               <span>TPG</span><strong>{score(story.stats?.totalGamePoints)}</strong>
             </div>
           </div>
           {!!story.standouts?.length&&<div className="ssl-conf-potw-standouts"
             aria-label="Outstanding stats from the two-game award period">
             {story.standouts.slice(0,4).map(item=>
               <div className="ssl-conf-potw-standout" key={item.label}>
                 <strong>{item.value}</strong><span>{item.label}</span>
               </div>)}
           </div>}
           <div className="ssl-conf-potw-editorial">
             <h3>{story.title}</h3>
             <p className="ssl-conf-potw-teaser">{story.teaser||story.summary}</p>
             <button type="button" className="ssl-conf-potw-view-article"
               onClick={()=>setOpenArticle(conference)}>View full Article</button>
           </div>
         </div>;
       })}
     </div>
   </section>
   {active&&articleStory&&<AwardArticle award={active[1]} story={articleStory}
     conference={openArticle} onClose={()=>setOpenArticle(null)}/>}
 </>;
}
