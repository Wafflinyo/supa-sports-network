import React from 'react';
import {
  Trophy, Flag, Crown, Star, Flame, Target, Shield, Building2,
  TrendingUp, TrendingDown, Handshake, ArrowLeftRight, FilePenLine,
  LockKeyhole, Medal, Zap, Users, Sparkles, Rocket, Award,
  Swords, Timer, ShieldAlert, Footprints, Layers, BarChart3,
  ArrowUpRight, ArrowRight, PenLine, Landmark, CheckCheck,
  CircleDot, RotateCcw, ArrowDownRight, Castle, Gem, Activity,
  ArrowUp, CircleCheck, BadgeCheck, Crosshair,
} from 'lucide-react';
import {badgeScenes} from './achievement-badge-scenes.js';

const palette = {
  Wins: ['#bd354c','#6b142f','#f8cd7d'],
  Offense: ['#ec6339','#94212c','#ffd075'],
  Defense: ['#317dc5','#0d356d','#9be6ff'],
  Pitching: ['#9266d5','#3c237b','#dbc6ff'],
  Playoffs: ['#c18b2a','#63451c','#ffe6a2'],
  'Front Office': ['#1eab97','#07554f','#a9fbe6'],
  'Season Honors': ['#dba643','#73541d','#fff1ba'],
};

const lucide = {
  trophy:Trophy, pennant:Flag, crown:Crown, star:Star, fire:Flame,
  target:Target, shield:Shield, 'broken-shield':ShieldAlert,
  stadium:Building2, 'chart-up':TrendingUp, 'chart-down':TrendingDown,
  handshake:Handshake, exchange:ArrowLeftRight, contract:FilePenLine,
  lock:LockKeyhole, laurel:Medal, bolt:Zap, wings:Sparkles,
  stars:Sparkles, warning:ShieldAlert, spark:Sparkles,
  runner:Footprints, bullpen:Users, arm:Activity, arrow:ArrowUpRight,
  bracket:Layers, throw:ArrowRight, zero:CircleDot, podium:Award,
  pitcher:Rocket,
};

// A real wood baseball bat: visibly tapered barrel, slim wrapped handle,
// and knob. NOT a capsule/club/corn-dog silhouette.
export const BAT_PROFILE = 'M-3 28 L-3 9 Q-4 3 -7 -9 L-10 -23 Q-11 -31 -5 -34 Q2 -37 6 -31 Q10 -24 6 -10 L3 9 L3 28 Z';
function BatShape({angle=-36}) {
  return <g data-sport-object="real-baseball-bat" transform={`rotate(${angle})`}
    strokeLinecap="round" strokeLinejoin="round">
    <path d={BAT_PROFILE} fill="#e5ba79" stroke="#3d2b2f" strokeWidth="2.5"/>
    <path d="M-5-28Q-4-16-2-8M1-28Q4-18 2-10" stroke="#fff0be" strokeWidth="1.3" fill="none" opacity=".85"/>
    <path d="M-3 10L3 10M-3 14L3 14M-3 18L3 18M-3 22L3 22" stroke="#95684d" strokeWidth="2"/>
    <rect x="-6" y="25" width="12" height="5" rx="2.3" fill="#c18a58" stroke="#49352d" strokeWidth="1.7"/>
  </g>;
}
function BaseballShape() {
  return <g data-sport-object="baseball" strokeLinecap="round" strokeLinejoin="round">
    <circle r="24" fill="#fff9e9" stroke="#343d53" strokeWidth="2.5"/>
    <path d="M-15-18Q4 0-15 18M15-18Q-4 0 15 18" fill="none" stroke="#bf4146" strokeWidth="2.4"/>
    <path d="M-16-14l-7 3m9 4-7 4m8 3-7 4m7 4-7 4m35-26 7 3m-9 4 7 4m-8 3 7 4m-7 4 7 4" fill="none" stroke="#c8504c" strokeWidth="1.7"/>
    <path d="M-11-19Q0-24 10-19" fill="none" stroke="#fff" strokeWidth="2" opacity=".8"/>
  </g>;
}

// Baseball glove has precisely FIVE separate digits: four upper glove
// fingers plus one side thumb. Palm/webbing are not extra fingers.
export const GLOVE_FINGER_COUNT = 5;
function GloveShape() {
  return <g data-sport-object="baseball-glove" data-finger-count={GLOVE_FINGER_COUNT}
    stroke="#533323" strokeLinejoin="round" strokeLinecap="round">
    <path data-glove-digit="thumb" d="M-19 7L-33-1Q-38-5-35-11Q-31-15-26-12L-12-5L-8 9Z" fill="#dc9c58" strokeWidth="2.4"/>
    <path data-glove-digit="index" d="M-18 7L-20-25Q-20-31-14-31Q-8-31-8-25L-7 7Z" fill="#df9b56" strokeWidth="2.4"/>
    <path data-glove-digit="middle" d="M-8 7L-8-30Q-8-36-2-36Q4-36 4-30L4 7Z" fill="#eab16c" strokeWidth="2.4"/>
    <path data-glove-digit="ring" d="M3 8L5-27Q6-32 11-31Q16-30 16-25L15 9Z" fill="#e0a15a" strokeWidth="2.4"/>
    <path data-glove-digit="pinky" d="M14 12L17-21Q18-27 23-25Q29-23 26-17L24 14Z" fill="#ca8849" strokeWidth="2.4"/>
    <path d="M-22-1Q-12-15 0-9Q17-12 25-2L21 25Q9 36-8 30L-24 17Z" fill="#d39452" strokeWidth="2.7"/>
    <path d="M-17 8Q-7-12 10 0Q20 10 8 21Q-4 29-15 14Z" fill="#795033" stroke="#f7d49e" strokeWidth="2.3"/>
    <path d="M-15 7L-1 21M-14 17L5 2M-9 20L10 7" stroke="#e9b876" strokeWidth="1.7" fill="none"/>
    <path d="M-19 27Q-3 34 17 26M-21-1L-28-7M-15-19L-11-20M-4-23L1-23M8-18L14-18" stroke="#f7ddb1" strokeWidth="1.5" fill="none"/>
    <path d="M-18 26L-16 33Q-1 39 16 33L17 25" fill="#99643c" strokeWidth="2"/>
  </g>;
}

function HomePlateShape() {
  return <g stroke="#292c47" strokeWidth="3" strokeLinejoin="round">
    <path d="M-26-19H26V6L0 30-26 6Z" fill="#faf0db"/>
    <path d="M-20-14H20V4L0 23-20 4Z" stroke="#c58f4c" fill="none" strokeWidth="2"/>
  </g>;
}
function DiamondShape() {
  return <g strokeLinejoin="round"><path d="M0-31L31 0 0 31-31 0Z" fill="#f6e6a8" stroke="#4d3a39" strokeWidth="3"/>
    <path d="M0-22L22 0 0 22-22 0Z" fill="#9dcf94" stroke="#417866" strokeWidth="2"/>
    {[[-18,0],[18,0],[0,-18],[0,18]].map(([x,y],i)=><rect key={i} x={x-4} y={y-4} width="8" height="8" fill="#fffaf0" stroke="#986c54" strokeWidth="1" transform={`rotate(45 ${x} ${y})`}/>)}
  </g>;
}
function StadiumShape() {
  return <g strokeLinejoin="round">
    <path d="M-30-11L-18-23H18L30-11V24H-30Z" fill="#dfe8ed" stroke="#273d60" strokeWidth="3"/>
    <path d="M-24-10H24V20H-24Z" fill="#2a5e84"/>
    <path d="M-24-10Q0-26 24-10" fill="none" stroke="#f8dc84" strokeWidth="3"/>
    {[[-18,-11],[-6,-12],[6,-12],[18,-11]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="2.8" fill="#fff4ab"/>)}
    <path d="M-18 18Q0-3 18 18M-18 18L0 27 18 18" fill="#78ab70" stroke="#c1db92" strokeWidth="2"/>
    <path d="M-32 26H32" stroke="#f1d49b" strokeWidth="4"/>
  </g>;
}
function ScoreboardShape() {
  return <g strokeLinejoin="round">
    <rect x="-31" y="-24" width="62" height="49" rx="5" fill="#253a52" stroke="#e1bf7a" strokeWidth="3"/>
    <rect x="-24" y="-16" width="48" height="18" rx="3" fill="#112334"/>
    <path d="M-19-9H-7M5-9H18M0-15V0" stroke="#fff4d9" strokeWidth="3"/>
    {[[-18,12],[-6,12],[6,12],[18,12]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="2.2" fill="#ffc867"/>)}
    <path d="M-20 25V30M20 25V30" stroke="#a9824d" strokeWidth="3"/>
  </g>;
}
function PlayPath({three=false}) {
  const points = three ? [[0,-24],[-22,13],[22,13]]:[[-21,0],[21,0]];
  return <g><path d={three?'M0-24L-22 13 22 13Z':'M-21 0H21'} stroke="#fbdfaa" strokeWidth="4" fill="none"/>
    {points.map(([x,y],i)=><g key={i}><circle cx={x} cy={y} r="8" fill="#fbf6e5" stroke="#4b5063" strokeWidth="2"/><circle cx={x} cy={y} r="2" fill="#d66a4d"/></g>)}
    <path d="M-24-21L-10-7M23-13L10-1" fill="none" stroke="#bde9f1" strokeWidth="3.5"/>
  </g>;
}
function PitcherShape() {
  return <g stroke="#fbe0ad" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none">
    <circle cx="-5" cy="-20" r="7" fill="#ffe0ae" stroke="#4b3b4d" strokeWidth="2"/>
    <path d="M-1-12L8 0-8 12-18 29M8 0L22-18M-8 12L16 29" />
    <path d="M-4-7L-19-14M15-22L24-28" />
    <circle cx="25" cy="-27" r="4.7" fill="#faf2e6" stroke="#c4474f" strokeWidth="1.2"/>
  </g>;
}
function ShieldArtwork({size=48, icon}) {
  const Comp=lucide[icon]||Award;
  return <Comp x={-size/2} y={-size/2} width={size} height={size} strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round"/>;
}

function SportsIcon({type}) {
  if(type==='ball')return <BaseballShape/>;
  if(type==='bat')return <BatShape/>;
  if(type==='crossed-bats')return <g><g transform="translate(-8 0)"><BatShape angle={-46}/></g><g transform="translate(8 0)"><BatShape angle={46}/></g><BaseballShapeMini/></g>;
  if(type==='glove')return <GloveShape/>;
  if(type==='home-plate')return <HomePlateShape/>;
  if(type==='diamond')return <DiamondShape/>;
  if(type==='stadium')return <StadiumShape/>;
  if(type==='scoreboard')return <ScoreboardShape/>;
  if(type==='double-play')return <PlayPath/>;
  if(type==='triple-play')return <PlayPath three/>;
  if(type==='strike')return <g><text y="22" x="0" fontFamily="Georgia,serif" fontSize="59" textAnchor="middle" fontWeight="900" stroke="#26354f" strokeWidth="1" fill="#fff6d4">K</text><path d="M-25 26H24" stroke="#ffd47c" strokeWidth="4"/></g>;
  if(type==='throw')return <g><ShieldArtwork icon="arrow" size={53}/><circle cx="-20" cy="20" r="7" fill="#fdf3de" stroke="#c45652" strokeWidth="2"/><path d="M-24 16L-17 23" stroke="#d45a54" strokeWidth="1.5"/></g>;
  if(type==='jump')return <g><path d="M-29 21Q-10-15 6-2Q16 4 27-23" fill="none" stroke="#e0f2fe" strokeWidth="5" strokeLinecap="round"/><circle cx="-9" cy="-12" r="6" fill="#ffe6b2"/><path d="M-10-5L-8 11 8 17M-8 6L-24 19M-8 5L15-12" fill="none" stroke="#f8dcaf" strokeWidth="4.5" strokeLinecap="round"/><circle cx="27" cy="-23" r="5" fill="#fff" stroke="#e58b5f" strokeWidth="1.5"/></g>;
  if(type==='slip')return <g><path d="M-27-12Q-2-34 25-17" fill="none" stroke="#ffe1b1" strokeWidth="5" strokeLinecap="round"/><circle cx="-18" cy="-8" r="9" fill="#fff7ed" stroke="#bf5b56" strokeWidth="2"/><path d="M-12-1L6 21M-15 19L22-4" stroke="#ffc67a" strokeWidth="3" strokeLinecap="round"/><path d="M10-23L24-9M24-23L10-9" stroke="#fff" strokeWidth="3"/></g>;
  if(type==='two-contracts')return <g transform="translate(-7 -4)"><ShieldArtwork icon="contract" size={46}/><g transform="translate(16 11) scale(.8)"><ShieldArtwork icon="contract" size={46}/></g></g>;
  if(type==='podium')return <g><path d="M-29 27V7H-9V-5H10V15H29V27Z" fill="#edc978" stroke="#3a3944" strokeWidth="3"/><text x="0" y="11" fontSize="16" fontWeight="900" textAnchor="middle" fill="#3f3b45">1</text><path d="M0-15L4-6H-4Z" fill="#fff7bf"/></g>;
  return <ShieldArtwork icon={type} size={54}/>;
}
function BaseballShapeMini(){return <g transform="scale(.37)"><BaseballShape/></g>}

function SceneAccent({type}) {
  return <g transform="translate(86 44)">
    <circle r="15" fill="#152b49" stroke="#fce3a1" strokeWidth="2.2"/>
    <g transform="scale(.41)" color="#ffefd2"><SportsIcon type={type}/></g>
  </g>;
}

function Treatment({layout,tint}) {
  switch(layout){
    case 'sunburst':return <g stroke={tint} strokeOpacity=".67" strokeWidth="3" strokeLinecap="round">
      {[-60,-30,0,30,60,90,120,150,180,210,240,270].map(n=>
        <path key={n} d="M0-31V-39" transform={`translate(60 66) rotate(${n})`}/>)}</g>;
    case 'diagonal':return <g><path d="M25 91L95 29" stroke={tint} strokeWidth="4" opacity=".5"/><path d="M29 97L101 35" stroke="#fff" strokeWidth="1.6" opacity=".5"/></g>;
    case 'split':return <path d="M27 39L94 91" stroke={tint} strokeWidth="4" opacity=".62"/>;
    case 'rays':return <path d="M26 47L17 37M33 35L27 24M93 47L103 37M87 35L93 24M38 93L32 102M81 93L87 102"
      stroke={tint} strokeWidth="3" strokeLinecap="round" opacity=".72"/>;
    case 'wreath':return <g stroke={tint} fill="none" strokeWidth="2.3">
      <path d="M26 41Q13 75 37 94M94 41Q107 75 83 94"/>
      <path d="M26 61l-9-6m12 18-10-2m18 15-10 1M94 61l9-6m-12 18 10-2m-18 15 10 1"/>
    </g>;
    case 'laurel':return <g fill={tint} opacity=".8">
      {[0,1,2,3].map(i=><g key={i}><ellipse cx={24+i*4} cy={57+i*10} rx="3.2" ry="6" transform={`rotate(-35 ${24+i*4} ${57+i*10})`}/>
        <ellipse cx={96-i*4} cy={57+i*10} rx="3.2" ry="6" transform={`rotate(35 ${96-i*4} ${57+i*10})`}/></g>)}</g>;
    case 'wings':return <g stroke={tint} strokeWidth="2.2" fill="none">
      <path d="M43 71Q12 45 20 34L38 46M77 71Q108 45 100 34L82 46"/>
      <path d="M30 43L36 59M90 43L84 59"/></g>;
    case 'royal':return <g fill="none" stroke={tint} strokeWidth="3">
      <path d="M20 36Q60 15 100 36M22 88Q60 110 98 88"/>
      <path d="M24 50L18 56M96 50L102 56"/></g>;
    default:return null;
  }
}

export function AchievementBadgeArt({badge,earned=false}) {
  const scene=badgeScenes[badge.id];
  const [primary,deep,gold]=palette[badge.category]||palette.Wins;
  const grad='achievement-metal-'+badge.id;
  const bevel='achievement-bevel-'+badge.id;
  const level=badge.rank||1;
  return <svg className={`achievement-insignia achievement-badge-v3 ${earned?'is-unlocked':'is-locked'}`}
    viewBox="0 0 120 138" xmlns="http://www.w3.org/2000/svg" role="img" data-badge-id={badge.id}
    aria-label={`${badge.name}: ${earned?'unlocked':'locked'}`}>
    <defs>
      <linearGradient id={grad} x1="0" x2=".9" y1=".2" y2="1">
        <stop offset="0" stopColor={primary}/><stop offset=".48" stopColor={deep}/><stop offset="1" stopColor="#132442"/>
      </linearGradient>
      <linearGradient id={bevel} x1="0" x2="1" y1="0" y2="1">
        <stop stopColor="#fff8d1"/><stop offset=".25" stopColor="#e6be74"/>
        <stop offset=".55" stopColor="#8c5d33"/><stop offset=".82" stopColor="#fff1a8"/><stop offset="1" stopColor="#8d633f"/>
      </linearGradient>
    </defs>
    <path d="M60 3L103 16 113 50 109 92 60 135 11 92 7 50 17 16Z"
      fill={'url(#'+bevel+')'} stroke="#2f3548" strokeWidth="1.8"/>
    <path d="M60 10L97 21 105 51 100 88 60 125 20 88 15 51 23 21Z"
      fill={'url(#'+grad+')'} stroke="#ffefc1" strokeWidth="2"/>
    <path d="M60 15L91 26 99 53 94 84 60 117 26 84 21 53 29 26Z"
      fill="none" stroke={gold} strokeWidth="1.3" opacity=".8"/>
    <path d="M24 35Q55 18 90 28L100 47Q75 34 46 51Z" fill="#fff" opacity=".085"/>
    <Treatment layout={scene?.layout} tint={gold}/>
    <ellipse cx="59" cy="65" rx="31" ry="32" fill="#10243e" opacity=".54" stroke={gold} strokeWidth="1.2"/>
    <g transform="translate(60 68)" style={{filter:'drop-shadow(0 2px 2px rgba(0,0,0,.28))'}} color="#fce7b3">
      <SportsIcon type={scene?.hero}/>
    </g>
    <SceneAccent type={scene?.detail}/>
    <g fill={gold}>
      {Array.from({length:Math.min(5, Math.max(1,level))},(_,i)=>
        <path key={i} transform={`translate(${60+(i-(Math.min(5,Math.max(1,level))-1)/2)*10} 24) scale(.47)`}
          d="M0-9L3-3 10-2 5 3 6 9 0 6-6 9-5 3-10-2-3-3Z"/>)}
    </g>
    <path d="M26 98Q60 108 94 98L89 122H31Z" fill="#13243c" stroke={gold} strokeWidth="2.2"/>
    <text x="60" y="115" textAnchor="middle" fontWeight="900" fill="#fff4d5"
      fontSize={String(scene?.engraving||'').length>3?'12':'16'}
      fontFamily="Arial, sans-serif">{scene?.engraving}</text>
    {!earned&&<g><circle cx="99" cy="118" r="12" fill="#1c2c45" stroke="#fff6d9" strokeWidth="1.8"/>
      <path d="M94 116v-3a5 5 0 0 1 10 0v3m-11 0h12v9h-12Z"
        fill="none" stroke="#fff" strokeWidth="1.9" strokeLinejoin="round"/></g>}
  </svg>;
}
