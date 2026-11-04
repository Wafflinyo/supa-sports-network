import React,{useEffect,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,Newspaper,Trophy} from 'lucide-react';
import {teamLogo} from './TeamIdentity.jsx';
import {PlayerPortrait} from './PlayerPortrait.jsx';
import './home-headliners.css';

function Crest({team,supabase,large=false}){
 const logo=team?.logoPath&&supabase?teamLogo(supabase,team.logoPath):null;
 return <div className={'ssl-headliner-crest'+(large?' featured':'')}>
   {logo?<img src={logo} alt={(team?.name||'Team')+' logo'}/>:
     <Trophy aria-hidden="true" size={large?66:35}/>}
 </div>;
}
function MatchStorySlide({story,seasons,supabase,players,onOpenGame}){
 const season=(seasons||[]).find(s=>String(s.id)===String(story.seasonId));
 const teams=season?.teams||[];
 const away=teams.find(t=>String(t.id)===String(story.awayId));
 const home=teams.find(t=>String(t.id)===String(story.homeId));
 const winner=teams.find(t=>String(t.id)===String(story.winnerId));
 const featurePlayer=story.highlights?.[0]&&players.find(p=>Number(p.id)===story.highlights[0].playerId);
 return <section className="hero ssl-home-hero ssl-headliner-match" aria-label={story.label+': '+story.title}>
   <div className="ssl-headliner-match-copy">
     <span className="eyebrow">SUPA LEAGUE TV · {story.season}{story.week?' · WEEK '+story.week:''}</span>
     <div className="ssl-headliner-category"><Newspaper size={18} aria-hidden="true"/>{story.label}</div>
     <h1>{story.title}</h1>
     <div className="ssl-headliner-scoreboard">
       <div className={String(story.awayId)===String(story.winnerId)?'winning':''}>
         <Crest team={away} supabase={supabase}/>
         <span>{away?.name||'Away'}</span><strong>{story.awayRuns}</strong>
       </div>
       <span className="ssl-headliner-score-separator">–</span>
       <div className={String(story.homeId)===String(story.winnerId)?'winning':''}>
         <Crest team={home} supabase={supabase}/>
         <span>{home?.name||'Home'}</span><strong>{story.homeRuns}</strong>
       </div>
     </div>
     <button type="button" className="yellow-btn ssl-headliner-match-action" onClick={()=>onOpenGame(story)}>
       VIEW MATCH &amp; BOX SCORE <span aria-hidden="true">›</span>
     </button>
   </div>
   <div className="ssl-headliner-side">
     <Crest team={winner} supabase={supabase} large/>
     {featurePlayer&&<div className="ssl-headliner-featured-player">
       <PlayerPortrait player={featurePlayer} size={48}/>
       <strong>{featurePlayer.name}</strong>
     </div>}
     <div className="ssl-headliner-keyplays">
       <strong>{story.highlights?.length?'STANDOUT PERFORMANCES':'GAME HIGHLIGHTS'}</strong>
       {story.highlights?.length?<ul>{story.highlights.map(event=>
         <li key={event.kind}>{event.text}</li>)}</ul>:
         <p>{story.summary}</p>}
       {story.leadChanges>=2&&<p>{story.leadChanges} confirmed lead changes</p>}
       {story.lateFinish==='walkoff'&&<p>Walk-off finish confirmed</p>}
       {story.lateFinish==='late-comeback'&&<p>Late-inning comeback confirmed</p>}
     </div>
   </div>
 </section>;
}
export default function HomeHeadliners({slides,championContent,seasons,supabase,players,onOpenGame}){
 const [active,setActive]=useState(0);
 const swipeX=useRef(null);
 const count=Math.min(5,slides?.length||0);
 useEffect(()=>setActive(index=>Math.min(index,Math.max(0,count-1))),[count]);
 if(!count)return null;
 const index=Math.min(active,count-1),slide=slides[index];
 const next=()=>setActive(i=>(i+1)%count);
 const prev=()=>setActive(i=>(i-1+count)%count);
 const swipeEnd=event=>{
   if(swipeX.current==null)return;
   const diff=event.changedTouches[0].clientX-swipeX.current;
   swipeX.current=null;
   if(Math.abs(diff)<45||count<=1)return;
   if(diff<0)next();else prev();
 };
 return <section className="ssl-headliners" aria-label="SSL top headlines" aria-roledescription="carousel"
    onKeyDown={event=>{
      if(event.target instanceof HTMLButtonElement)return;
      if(event.key==='ArrowRight'){event.preventDefault();next();}
      if(event.key==='ArrowLeft'){event.preventDefault();prev();}
    }}
    onTouchStart={event=>{swipeX.current=event.touches[0]?.clientX??null;}}
    onTouchEnd={swipeEnd}
    onTouchCancel={()=>{swipeX.current=null;}}>
   <div className="ssl-headliners-stage" role="group" aria-roledescription="slide"
     aria-label={'Headline '+(index+1)+' of '+count} key={slide.id}>
     {slide.kind==='champion'?championContent:
       <MatchStorySlide story={slide.story} seasons={seasons} supabase={supabase}
         players={players} onOpenGame={onOpenGame}/>}
   </div>
   {count>1&&<nav className="ssl-headliners-controls" aria-label="Headline carousel controls">
     <button type="button" className="ssl-headliners-arrow" aria-label="Previous headline"
       onClick={prev}><ChevronLeft size={20}/></button>
     <div className="ssl-headliners-dots" role="group" aria-label="Select headline">
       {slides.slice(0,count).map((item,i)=><button key={item.id} type="button"
         className={index===i?'active':''} aria-label={'Show headline '+(i+1)+' of '+count}
         aria-current={index===i?'true':undefined} onClick={()=>setActive(i)}>
         <span aria-hidden="true"/>
       </button>)}
     </div>
     <span className="ssl-headliners-count">{index+1} / {count}</span>
     <button type="button" className="ssl-headliners-arrow" aria-label="Next headline"
       onClick={next}><ChevronRight size={20}/></button>
   </nav>}
 </section>;
}
