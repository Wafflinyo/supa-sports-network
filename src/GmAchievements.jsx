import React, {useMemo,useState} from 'react';
import {signatureMarks,flourishMarks} from './badge-art-design.js';
import {GM_ACHIEVEMENTS,GM_ACHIEVEMENT_CATEGORIES,earnedAchievements} from './gm-achievements.js';
import './gm-achievements.css';

const palettes={
  Wins:['#f6bd54','#b65c17','#fff1b4'],Offense:['#f08067','#a02e4d','#ffe0a3'],
  Defense:['#66c7ec','#174a9a','#b6eeff'],Pitching:['#b99af6','#6540a7','#f1deff'],
  Playoffs:['#f9d36e','#9a5a17','#fff7bc'],
  'Front Office':['#54cfbd','#21766f','#c8fcf2'],
  'Season Honors':['#f4dc73','#735a2c','#fff3c3'],
};

function Motif({type}) {
  // Original vector illustrations are shared by achievement families. Each of
  // the original vector insignias combines a different number, rank, track and seal.
  const shared={stroke:'currentColor',strokeWidth:5,strokeLinecap:'round',strokeLinejoin:'round',fill:'none'};
  if(type==='flag')return <g {...shared}><path d="M-18 24V-27M-18-27Q-4-37 11-25T25-24V-1Q9-12-18-1"/><path d="M-26 24H0"/></g>;
  if(type==='crown')return <g {...shared}><path d="M-28-12L-16 16H19L29-12L8 2 0-24-10 2Z"/><path d="M-18 24H20"/></g>;
  if(type==='trophy')return <g {...shared}><path d="M-20-25H20V-1Q17 15 0 16-18 14-20-1Z"/><path d="M-20-17H-31Q-31 2-16 4M20-17H31Q31 2 16 4M0 16V26M-14 26H14"/></g>;
  if(type==='baseball')return <g {...shared}><circle r="28"/><path d="M-18-22Q0 0-18 22M18-22Q0 0 18 22M-16-15l-7 4m10 3-8 5m8 12-8 5m34-29 7 4m-10 3 8 5m-8 12 8 5" strokeWidth="3"/></g>;
  if(type==='fireball')return <g {...shared}><path d="M2-31C-16-11-2-5-18 6Q-26-6-21-19C-41 3-31 29-6 29C19 32 34 10 21-12Q18 2 10 1Q20-16 2-31Z"/><path d="M0 27Q-12 11 0 1Q10 12 8 25"/></g>;
  if(type==='diamond')return <g {...shared}><path d="M0-32L31 0 0 32-31 0Z"/><path d="M-31 0H31M0-32V32" opacity=".65"/><circle r="8" fill="currentColor" stroke="none"/></g>;
  if(type==='star')return <g {...shared}><path d="M0-33L10-12 34-8 17 8 21 31 0 20-21 31-17 8-34-8-10-12Z"/><circle r="5" fill="currentColor" stroke="none"/></g>;
  if(type==='glove')return <g {...shared}><path d="M-22 25L-25-1Q-31-24-20-24Q-13-24-13-11V-29Q-11-35-5-33Q2-32 2-24V-30Q6-36 12-31V-23Q18-29 23-24L20 2L29-5Q37-8 37 0L16 27Z" transform="translate(-5 0) scale(.87)"/></g>;
  if(type==='hand')return <g {...shared}><path d="M-28 8L-12-9-1 2 15-17Q23-22 26-15Q29-9 22-2L4 19Q-1 25-10 23L-28 8Z"/><path d="M-27-14L-12-27M-23-30L-10-17M19 8L28 16"/></g>;
  if(type==='double')return <g {...shared}><circle cx="-12" r="17"/><circle cx="12" r="17"/><path d="M-4-12H4M-4 12H4"/></g>;
  if(type==='triple')return <g {...shared}><path d="M0-28L30 23H-30Z"/><circle cx="0" cy="-12" r="3" fill="currentColor"/><circle cx="-15" cy="15" r="3" fill="currentColor"/><circle cx="15" cy="15" r="3" fill="currentColor"/></g>;
  if(type==='shield')return <g {...shared}><path d="M0-31L27-20V2Q25 20 0 32Q-25 20-27 2V-20Z"/><path d="M-14 1L-3 12 17-12"/></g>;
  if(type==='wings')return <g {...shared}><path d="M0-6Q-24-28-34-19Q-34 3-3 25M0-6Q24-28 34-19Q34 3 3 25M-29-8L-8 9M29-8L8 9"/><circle cy="-11" r="8"/></g>;
  if(type==='crack')return <g {...shared}><path d="M0-29Q-26-22-28 1Q-23 27 0 30Q25 26 28 0Q22-25 0-29Z"/><path d="M8-27L-5-6 9 1-9 27"/></g>;
  if(type==='exchange')return <g {...shared}><path d="M-30-10H22L12-21M22-10L12 2M30 14H-22L-12 3M-22 14L-12 25"/></g>;
  if(type==='contract')return <g {...shared}><path d="M-20-29H14L25-17V28H-20Z"/><path d="M14-29V-17H25M-11-6H13M-11 5H13M-11 17H8"/></g>;
  if(type==='stadium')return <g {...shared}><path d="M-29 22V-3L0-24 29-3V22Z"/><path d="M-18 22V-3H18V22M-29-3H29M-10 22V7H10V22"/></g>;
  if(type==='strike')return <g><text x="0" y="21" fill="currentColor" textAnchor="middle" fontWeight="1000" fontSize="64" fontFamily="Arial Black, sans-serif">K</text></g>;
  if(type==='arm')return <g {...shared}><path d="M-25 16Q-13-8 0-6Q9-4 10 5L18-2Q28-8 31 2Q30 15 15 25H-10Z"/><path d="M-25 16Q-30 0-20-13L-13-22Q-5-29 1-19L-4-8"/></g>;
  return <g {...shared}><path d="M-30 21H4Q25 21 25-1V-21"/><path d="M10-9L25-24L39-9"/><circle cx="-13" cy="-1" r="9"/></g>;
}

// Distinct in-icon insignia for every achievement, including higher levels of
// the same stat. The central sports motif is paired with a prominent, original
// etched symbol AND a separate sculpted flourish. 16 x 6 = 96 distinct pairs,
// more than enough for our current 92 badge designs.
function UniqueBadgeSymbol({badge}) {
  const idx=(badge.serial-1)%signatureMarks.length;
  const flourish=Math.floor((badge.serial-1)/signatureMarks.length);
  return <g color="#fffdf2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" fill="none">
    <path d={flourishMarks[flourish]} strokeWidth="4.8" opacity=".83"/>
    <g transform="translate(-7 4) scale(.73)" strokeWidth="5.4">
      <Motif type={badge.icon}/>
    </g>
    <g transform="translate(20 -13)">
      <circle r="18" fill="#182e53" stroke="#fff1c4" strokeWidth="2.5"/>
      <path d={signatureMarks[idx]} fill="none" strokeWidth="2.7"/>
    </g>
  </g>;
}

export function AchievementBadgeArt({badge,earned=false}) {
  const [light,dark,edge]=palettes[badge.category]||palettes.Wins;
  const variant=(badge.serial*11)%7;
  const grad='ssl-badge-gradient-'+badge.id;
  const glow='ssl-badge-light-'+badge.id;
  return <svg className={'achievement-insignia'+(earned?' is-unlocked':' is-locked')} viewBox="0 0 120 138" role="img"
      aria-label={badge.name+' '+(earned?'earned':'locked')} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id={grad} x1="0" x2="1" y1="0" y2="1"><stop stopColor={light}/><stop offset="1" stopColor={dark}/></linearGradient>
      <linearGradient id={glow} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#ffffff" stopOpacity=".35"/><stop offset="1" stopColor="#000000" stopOpacity=".19"/></linearGradient>
    </defs>
    <path d="M60 3L102 16 112 50 108 92 60 133 12 92 8 50 18 16Z"
      fill={'url(#'+grad+')'} stroke={edge} strokeWidth="3"/>
    <path d="M60 10L96 21 104 51 100 87 60 121 20 87 16 51 24 21Z"
      fill={'url(#'+glow+')'} stroke="rgba(255,255,255,.65)" strokeWidth="1.3"/>
    <path d={variant%2===0?'M24 37Q60 14 96 37':'M22 88Q60 116 98 88'}
      fill="none" stroke={edge} strokeOpacity=".72" strokeWidth="2"/>
    {Array.from({length:variant+1},(_,i)=><circle key={i} cx={36+i*(48/(variant+1))} cy="23" r="2.15" fill={edge} />)}
    <g transform="translate(60 70)" style={{filter:'drop-shadow(0 2px 2px rgba(0,0,0,.4))'}}>
      <UniqueBadgeSymbol badge={badge}/>
    </g>
    <path d="M29 102L60 116 91 102" fill="none" stroke={edge} strokeWidth="2.5"/>
    <rect x="30" y="101" width="60" height="25" rx="10" fill="#14233d" stroke={edge} strokeWidth="1.4"/>
    <text x="60" y="119" textAnchor="middle" fontWeight="900" fill="#fff8d7" fontSize="15" fontFamily="Arial, sans-serif">
      {badge.field==='perfect'?'22–0':badge.field==='opener'?'W':badge.field==='ironArm'?'CG':
       badge.field==='reliever'?'RP':badge.field==='shutout'?'0':badge.threshold+'+'}
    </text>
    <text x="60" y="15" fontSize="8" textAnchor="middle" fill="#fff" fontWeight="900" fontFamily="Arial, sans-serif">
      SSL  •  {String(badge.serial).padStart(2,'0')}
    </text>
    {!earned&&<g><circle cx="98" cy="116" r="13" fill="#303a4c" stroke="#fff" strokeWidth="2"/>
      <path d="M93 115v-3a5 5 0 0 1 10 0v3m-11 0h12v9h-12Z" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round"/></g>}
  </svg>;
}

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

  const visible=badges.filter(b=>(category==='All'||b.category===category) &&
    (status==='All badges'||(status==='Earned'?b.earned:!b.earned)));
  const teamsEarned=useMemo(()=>Object.fromEntries(knownTeams.map(t=>[t.slot,
    earnedAchievements(seasons,t.slot,{seasonId}).filter(b=>b.earned).length])),[seasons,knownTeams,seasonId]);
  return <section className="achievement-section" aria-label="GM achievement collection">
    <div className="achievement-hero">
      <div><span className="achievement-kicker">SLUGGERS SUPA LEAGUE • TROPHY CASE</span>
        <h2>GM ACHIEVEMENTS</h2>
        <p>92 original collectible badges. Earn each badge just once across your entire GM career. Unlocked badges stay with your collection.</p>
        {activeTeam&&<div className="achievement-owner">TEAM • <strong>{activeTeam.name}</strong></div>}
      </div>
      <div className="achievement-progress" aria-label={earned+' of 92 badges unlocked'}>
        <strong>{earned}<span> / 92</span></strong><small>BADGES UNLOCKED</small>
        <div className="achievement-track"><i style={{width:(earned/92*100)+'%'}}/></div>
      </div>
    </div>
    {commissioner&&<div className="achievement-team-panel">
      <h3>TEAM ACHIEVEMENT TRACKER</h3>
      <p>View each franchise's earned badges. Team names only—no GM usernames.</p>
      {knownTeams.length?<div className="achievement-team-picker">
        {knownTeams.map(t=><button type="button" key={t.slot} className={t.slot===activeSlot?'active':''}
          onClick={()=>setChosenSlot(t.slot)} aria-pressed={t.slot===activeSlot}>
          <span>{t.name}</span><strong>{teamsEarned[t.slot]||0}/92</strong></button>)}
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
    <p className="achievement-footnote">Badges unlock only from released official match results. Season wins and season home runs are counted within each regular season. Putouts and assists require one individual player to reach the threshold; other match totals are team-wide. Badges are unlocked once for the entire GM career, not once per season. The Superstar Reliever badge requires verified substitution timing data.</p>
  </section>;
}
