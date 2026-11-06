import React, {useMemo,useState} from 'react';
import {AchievementBadgeArt} from './AchievementBadgeArt.jsx';
import {GM_ACHIEVEMENTS,GM_ACHIEVEMENT_CATEGORIES,earnedAchievements} from './gm-achievements.js';
import './gm-achievements.css';
export {AchievementBadgeArt} from './AchievementBadgeArt.jsx';

const niceDate = input => {
  if(!input || !Number.isFinite(Date.parse(input))) return '';
  return new Date(input).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
};

export default function GmAchievements({seasons=[],slot,teams=[],commissioner=false}) {
  const knownTeams=useMemo(()=>{
    const names=new Map();
    for(const season of [...seasons].reverse()) for(const t of season.teams||[])
      if(t.slot!=null)names.set(Number(t.slot),t.name||'Team '+t.slot);
    for(const t of teams||[])if(t.slot!=null)
      names.set(Number(t.slot),t.name||names.get(Number(t.slot))||'Team '+t.slot);
    return [...names].sort((a,b)=>a[0]-b[0]).map(([slot,name])=>({slot,name}));
  },[seasons,teams]);
  const [chosenSlot,setChosenSlot]=useState(null);
  const activeSlot=commissioner?(knownTeams.some(t=>t.slot===chosenSlot)?chosenSlot:knownTeams[0]?.slot):Number(slot);
  const activeTeam=knownTeams.find(t=>t.slot===activeSlot);
  const [category,setCategory]=useState('All');
  const [status,setStatus]=useState('All badges');
  const seasonId='all';
  const badges=useMemo(()=>earnedAchievements(seasons,activeSlot,{seasonId}),[seasons,activeSlot,seasonId]);
  const earned=badges.filter(b=>b.earned).length;
  const total=GM_ACHIEVEMENTS.length;

  const visible=badges.filter(b=>(category==='All'||b.category===category) &&
    (status==='All badges'||(status==='Earned'?b.earned:!b.earned)));
  const teamsEarned=useMemo(()=>Object.fromEntries(knownTeams.map(t=>[t.slot,
    earnedAchievements(seasons,t.slot,{seasonId}).filter(b=>b.earned).length])),[seasons,knownTeams,seasonId]);
  return <section className="achievement-section" aria-label="GM achievement collection">
    <div className="achievement-hero">
      <div><span className="achievement-kicker">SLUGGERS SUPA LEAGUE • TROPHY CASE</span>
        <h2>GM ACHIEVEMENTS</h2>
        <p>93 collectible badges, including the Preseason Crown. Earn each badge just once across your entire GM career. Unlocked badges stay with your collection.</p>
        {activeTeam&&<div className="achievement-owner">TEAM • <strong>{activeTeam.name}</strong></div>}
      </div>
      <div className="achievement-progress" aria-label={earned+' of '+total+' badges unlocked'}>
        <strong>{earned}<span> / {total}</span></strong><small>BADGES UNLOCKED</small>
        <div className="achievement-track"><i style={{width:(earned/total*100)+'%'}}/></div>
      </div>
    </div>
    {commissioner&&<div className="achievement-team-panel">
      <h3>TEAM ACHIEVEMENT TRACKER</h3>
      <p>View each franchise's earned badges. Team names only—no GM usernames.</p>
      {knownTeams.length?<div className="achievement-team-picker">
        {knownTeams.map(t=><button type="button" key={t.slot} className={t.slot===activeSlot?'active':''}
          onClick={()=>setChosenSlot(t.slot)} aria-pressed={t.slot===activeSlot}>
          <span>{t.name}</span><strong>{teamsEarned[t.slot]||0}/{total}</strong></button>)}
      </div>:<p>No registered teams yet. Team achievements will appear once franchises are created.</p>}
    </div>}
    <div className="achievement-toolbar">
      <div className="achievement-category-tabs" role="group" aria-label="Achievement categories">
        {GM_ACHIEVEMENT_CATEGORIES.map(c=><button type="button" key={c} onClick={()=>setCategory(c)}
          aria-pressed={category===c} className={category===c?'active':''}>{c}</button>)}
      </div>
      <div className="achievement-selectors">
        <span className="achievement-lifetime-label">LIFETIME COLLECTION · UNLOCK ONCE</span>
        <label>Show <select value={status} onChange={e=>setStatus(e.target.value)}>
          {['All badges','Earned','Locked'].map(s=><option key={s}>{s}</option>)}
        </select></label>
      </div>
    </div>
    <div className="achievement-gallery">
      {visible.map(b=><article key={b.id} className={'achievement-card'+(b.earned?' earned':' locked')+(b.negative?' blooper':'')}
        title={b.description}>
        <AchievementBadgeArt badge={b} earned={b.earned}/>
        <div className="achievement-meta">
          <span className="achievement-type">{b.negative?'BLOOPER • ':''}{b.category.toUpperCase()}</span>
          <h3>{b.name}</h3><p>{b.description}</p>
          <span className={'achievement-status'+(b.earned?' won':'')}>{b.earned?'✓ UNLOCKED':'◉ LOCKED'}</span>
          {b.earned&&<small className="achievement-earned-line">
            {b.lastEarned?.seasonName}
            {b.lastEarned?.playerName?' · '+b.lastEarned.playerName:''}
            {niceDate(b.lastEarned?.earnedAt)?' · '+niceDate(b.lastEarned.earnedAt):''}
          </small>}
        </div>
      </article>)}
    </div>
    {!visible.length&&<p className="achievement-empty">No badges match these filters.</p>}
    <p className="achievement-footnote">Match-performance badges unlock only from released official match results. The Preseason Crown unlocks from the separately recorded single-elimination preseason championship. Season wins and season home runs are counted within each regular season. Putouts and assists require one individual player to reach the threshold; other match totals are team-wide. Badges are unlocked once for the entire GM career, not once per season. The Superstar Reliever badge requires verified substitution timing data.</p>
  </section>;
}
