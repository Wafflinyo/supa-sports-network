import React,{useEffect,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,Newspaper,Trophy} from 'lucide-react';
import {teamLogo} from './TeamIdentity.jsx';
import {PlayerPortrait} from './PlayerPortrait.jsx';
import {HeatFlame} from './HeatingUpBadge.jsx';
import HeadlineReadMore from './HeadlineReadMore.jsx';
import ConferencePotwHeadliner from './ConferencePotwHeadliner.jsx';
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
 const singleLogo=story.teamSpotlight==='winner';
 const topPlayers=story.topPlayers||[];
 const playerPool=new Map(players.map(p=>[Number(p.id),p]));
 const pointsLabel=value=>Number.isInteger(value)?String(value):Number(value).toFixed(2).replace(/0+$/,'').replace(/\.$/,'');
 return <section className={'hero ssl-home-hero ssl-headliner-match'+(story.private?' ssl-headliner-private':'')}
    aria-label={(story.private?'Private headline preview · ':'')+story.label+': '+story.title}>
   <div className="ssl-headliner-match-copy">
     <span className="eyebrow">SUPA LEAGUE TV · {story.season}{story.week?' · WEEK '+story.week:''}
       {story.private&&<span className="ssl-headliner-private-tag">PRIVATE PREVIEW</span>}
     </span>
     <div className="ssl-headliner-category"><Newspaper size={18} aria-hidden="true"/>{story.label}</div>
     <h1>{story.title}</h1>
     <div className="ssl-headliner-scoreboard">
       <div className={String(story.awayId)===String(story.winnerId)?'winning':''}>
         <span>{away?.name||'Away'}</span><strong>{story.awayRuns}</strong>
       </div>
       <span className="ssl-headliner-score-separator">–</span>
       <div className={String(story.homeId)===String(story.winnerId)?'winning':''}>
         <span>{home?.name||'Home'}</span><strong>{story.homeRuns}</strong>
       </div>
     </div>
     <button type="button" className="yellow-btn ssl-headliner-match-action" onClick={()=>onOpenGame(story)}>
       {story.private?'VIEW PRIVATE MATCH & BOX SCORE':'VIEW MATCH & BOX SCORE'} <span aria-hidden="true">›</span>
     </button>
   </div>
   <div className="ssl-headliner-side">
     <div className={'ssl-headliner-logo-stage '+(singleLogo?'solo':'matchup')}
       aria-label={singleLogo?'Winning team crest':'Both team crests'}>
       {singleLogo?<Crest team={winner} supabase={supabase} large/>:
         <><Crest team={away} supabase={supabase} large/>
         <span className="ssl-headliner-versus">VS</span>
         <Crest team={home} supabase={supabase} large/></>}
     </div>
     {topPlayers.length>0&&<div className="ssl-headliner-leaders" aria-label="Top players ranked by total game points">
       <strong>TOP {topPlayers.length} GAME POINT {topPlayers.length===1?'LEADER':'LEADERS'}</strong>
       <ol>{topPlayers.map((p,i)=><li key={p.playerId}>
         <span className="ssl-headliner-rank">{i+1}</span>
         <PlayerPortrait player={playerPool.get(Number(p.playerId))||{id:p.playerId,name:p.name}} size={32} showHeat={false}/>
         <span className="ssl-headliner-player-name">{p.name}</span>
         <span className="ssl-headliner-tgp" title="Total Game Points">{pointsLabel(p.gamePoints)} <small>TGP</small></span>
         {p.heatingUp&&<span className="ssl-headliner-hot" aria-label="Heating Up threshold reached" title="Heating Up"><HeatFlame/></span>}
       </li>)}</ol>
     </div>}
     <div className="ssl-headliner-keyplays">
       <strong>{story.highlights?.length?'GAME HIGHLIGHTS':'MATCH REPORT'}</strong>
       <HeadlineReadMore key={story.id} id={story.id}
         text={story.summary} limit={145} className="ssl-headliner-expanded-story"/>
     </div>
   </div>
 </section>;
}
export default function HomeHeadliners({slides,championContent,seasons,supabase,players,onOpenGame,onPlayerSelect}){
 const [active,setActive]=useState(0);
 const count=Math.min(5,slides?.length||0);
 useEffect(()=>setActive(index=>Math.min(index,Math.max(0,count-1))),[count]);
 if(!count)return null;
 const index=Math.min(active,count-1),slide=slides[index];
 const next=()=>setActive(i=>(i+1)%count);
 const prev=()=>setActive(i=>(i-1+count)%count);
 const touchStart=useRef(null);
 const onSwipeStart=event=>{
   const point=event.changedTouches?.[0];
   touchStart.current=point?{x:point.clientX,y:point.clientY}:null;
 };
 const onSwipeEnd=event=>{
   const origin=touchStart.current;touchStart.current=null;
   const point=event.changedTouches?.[0];
   if(!origin||!point||count<2)return;
   const dx=point.clientX-origin.x,dy=point.clientY-origin.y;
   if(Math.abs(dx)<45||Math.abs(dx)<Math.abs(dy)*1.25)return;
   if(dx<0)next();else prev();
 };
 return <section className="ssl-headliners" aria-label="SSL top headlines" aria-roledescription="carousel"
    onTouchStart={onSwipeStart}
    onTouchEnd={onSwipeEnd}
    onTouchCancel={()=>{touchStart.current=null;}}
    onKeyDown={event=>{
      if(event.target instanceof HTMLButtonElement)return;
      if(event.key==='ArrowRight'){event.preventDefault();next();}
      if(event.key==='ArrowLeft'){event.preventDefault();prev();}
    }}>
   <div className="ssl-headliners-stage" role="group" aria-roledescription="slide"
     aria-label={'Show headline '+(index+1)+' of '+count} key={slide.id}>
     {slide.kind==='potw'?<ConferencePotwHeadliner awards={slide.awards} season={(seasons||[]).find(season=>String(season.id)===String(slide.awards?.[0]?.seasonId))} onPlayerSelect={onPlayerSelect}/>:
       slide.kind==='champion'?championContent:
       <MatchStorySlide story={slide.story} seasons={seasons} supabase={supabase}
         players={players} onOpenGame={onOpenGame}/>}
   </div>
   {count>1&&<nav className="ssl-headliners-controls" aria-label="Headline carousel controls">
     <button type="button" className="ssl-headliners-arrow" aria-label="Previous headline"
       onClick={prev}><ChevronLeft size={20}/></button>
     <span className="ssl-headliners-count">{index+1} / {count}</span>
     <button type="button" className="ssl-headliners-arrow" aria-label="Next headline"
       onClick={next}><ChevronRight size={20}/></button>
   </nav>}
 </section>;
}
