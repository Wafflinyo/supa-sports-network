import React, {useEffect, useRef, useState} from 'react';
import {Volume2, VolumeX} from 'lucide-react';
import {LOTTERY_ROLL_MS} from './lottery-timing.js';
import './bingo-lottery.css';

// The physics below is visual only. Server-selected order and timeline are
// authoritative. No client can change the next winner by leaving/rejoining.
const SIZE=360, CENTER=180, CAGE_RADIUS=151, BALL_RADIUS=19;
const TWO_PI=2*Math.PI;

function useBingoAudio() {
  const [enabled,setEnabled]=useState(false);
  const audio=useRef(null), lastHit=useRef(0);
  useEffect(()=>()=>{audio.current?.close?.().catch(()=>{});audio.current=null;},[]);
  async function toggle() {
    if(enabled) {setEnabled(false);return;}
    try {
      const Engine=window.AudioContext||window.webkitAudioContext;
      if(!Engine) return;
      if(!audio.current) audio.current=new Engine();
      await audio.current.resume();
      setEnabled(true);
    } catch {setEnabled(false);}
  }
  function hit(strength=.5) {
    if(!enabled||!audio.current||audio.current.state!=='running')return;
    const ctx=audio.current,now=ctx.currentTime;
    if(now-lastHit.current<.075) return;
    lastHit.current=now;
    const gain=ctx.createGain();
    gain.gain.setValueAtTime(Math.min(.075,.014+strength*.04),now);
    gain.gain.exponentialRampToValueAtTime(.0001,now+.075+strength*.035);
    gain.connect(ctx.destination);
    const osc=ctx.createOscillator();
    osc.type='triangle';
    osc.frequency.setValueAtTime(780+Math.random()*390,now);
    osc.frequency.exponentialRampToValueAtTime(490+Math.random()*200,now+.065);
    osc.connect(gain);osc.start(now);osc.stop(now+.12);
    // A brief metallic high overtone makes the plastic/metal ball impact audible.
    const high=ctx.createOscillator(),hg=ctx.createGain();
    high.type='sine';high.frequency.value=1950+Math.random()*650;
    hg.gain.setValueAtTime(.016*strength,now);
    hg.gain.exponentialRampToValueAtTime(.0001,now+.035);
    high.connect(hg);hg.connect(ctx.destination);high.start(now);high.stop(now+.05);
  }
  function roll(elapsed=0) {
    if(!enabled||!audio.current||audio.current.state!=='running')return;
    const ctx=audio.current,now=ctx.currentTime,
      seconds=Math.max(.12,(LOTTERY_ROLL_MS-elapsed)/1000);
    const samples=Math.round(ctx.sampleRate*.24);
    const buffer=ctx.createBuffer(1,samples,ctx.sampleRate);
    const channel=buffer.getChannelData(0);
    for(let i=0;i<samples;i++)channel[i]=(Math.random()*2-1)*(.5+.5*Math.sin(i*.09));
    const source=ctx.createBufferSource();source.buffer=buffer;source.loop=true;
    const filter=ctx.createBiquadFilter();
    filter.type='lowpass';filter.frequency.setValueAtTime(580,now);
    filter.frequency.linearRampToValueAtTime(1250,now+seconds*.65);
    const gain=ctx.createGain();
    gain.gain.setValueAtTime(.0001,now);
    gain.gain.linearRampToValueAtTime(.04,now+Math.min(.18,seconds*.22));
    gain.gain.setValueAtTime(.04,now+Math.max(.18,seconds*.45));
    gain.gain.exponentialRampToValueAtTime(.0001,now+seconds);
    source.connect(filter);filter.connect(gain);gain.connect(ctx.destination);
    source.start(now);source.stop(now+seconds+.03);
    // Small tick as the ball settles in the presentation holder.
    const chime=ctx.createOscillator(),chimeGain=ctx.createGain();
    chime.type='sine';chime.frequency.value=650;
    chimeGain.gain.setValueAtTime(.0001,now+seconds*.86);
    chimeGain.gain.linearRampToValueAtTime(.04,now+seconds*.91);
    chimeGain.gain.exponentialRampToValueAtTime(.0001,now+seconds+.11);
    chime.connect(chimeGain);chimeGain.connect(ctx.destination);
    chime.start(now+seconds*.85);chime.stop(now+seconds+.13);
  }
  return {enabled,toggle,hit,roll};
}

function paintCage(ctx,balls,spin,images,isMixing) {
  ctx.clearRect(0,0,SIZE,SIZE);
  const cx=CENTER,cy=CENTER;
  // Metal stand and bearing, drawn behind glass chamber.
  ctx.fillStyle='#57411f';ctx.fillRect(cx-12,321,24,28);
  ctx.fillStyle='#e2ae54';ctx.fillRect(cx-80,344,160,11);
  const grad=ctx.createRadialGradient(130,109,25,cx,cy,159);
  grad.addColorStop(0,'#294b73');grad.addColorStop(.75,'#102846');grad.addColorStop(1,'#09182b');
  ctx.beginPath();ctx.arc(cx,cy,CAGE_RADIUS+5,0,TWO_PI);ctx.fillStyle=grad;ctx.fill();
  ctx.save();ctx.beginPath();ctx.arc(cx,cy,CAGE_RADIUS-6,0,TWO_PI);ctx.clip();
  // The back wires revolve, the actual ball sprites are simulated separately.
  ctx.save();ctx.translate(cx,cy);ctx.rotate(spin);
  ctx.strokeStyle='rgba(250,211,132,.22)';ctx.lineWidth=2;
  for(let i=-145;i<=145;i+=27){
    ctx.beginPath();ctx.moveTo(i,-155);ctx.lineTo(i,155);ctx.stroke();
  }
  for(let i=-135;i<=135;i+=31){
    ctx.beginPath();ctx.moveTo(-155,i);ctx.lineTo(155,i);ctx.stroke();
  }
  ctx.restore();
  // Each ball is a separate moving body, not fixed to a rotating spoke.
  for(const ball of balls){
    const {x,y}=ball;
    ctx.save();ctx.translate(x,y);ctx.rotate(ball.angle);
    const shade=ctx.createRadialGradient(-7,-7,3,0,0,BALL_RADIUS);
    shade.addColorStop(0,'#fff9dc');shade.addColorStop(.6,'#ffda6a');shade.addColorStop(1,'#b67a1d');
    ctx.beginPath();ctx.arc(0,0,BALL_RADIUS,0,TWO_PI);
    ctx.fillStyle=shade;ctx.shadowBlur=5;ctx.shadowColor='#0008';ctx.fill();
    ctx.shadowBlur=0;ctx.strokeStyle='#fbedc3';ctx.lineWidth=2;ctx.stroke();
    const image=images.get(ball.id);
    if(image?.complete && image.naturalWidth>0) {
      ctx.save();ctx.beginPath();ctx.arc(0,0,BALL_RADIUS-3,0,TWO_PI);ctx.clip();
      const scale=Math.min(28/image.naturalWidth,28/image.naturalHeight);
      const w=image.naturalWidth*scale,h=image.naturalHeight*scale;
      ctx.drawImage(image,-w/2,-h/2,w,h);
      ctx.restore();
    } else {
      ctx.fillStyle='#4d3116';ctx.font='900 13px sans-serif';
      ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(ball.number),0,1);
    }
    ctx.restore();
  }
  // Front protective cage wires convey that the balls are behind a mesh.
  ctx.save();ctx.translate(cx,cy);ctx.rotate(spin+.24);
  ctx.strokeStyle='rgba(240,210,146,.21)';ctx.lineWidth=2;
  for(let i=-130;i<=130;i+=47){
    ctx.beginPath();ctx.moveTo(i,-160);ctx.lineTo(i,160);ctx.stroke();
  }
  ctx.restore();ctx.restore();
  ctx.beginPath();ctx.arc(cx,cy,CAGE_RADIUS,0,TWO_PI);
  ctx.lineWidth=10;ctx.strokeStyle='#d69f45';ctx.stroke();
  ctx.lineWidth=3;ctx.strokeStyle='#ffe29b';ctx.stroke();
  ctx.beginPath();ctx.ellipse(134,117,29,52,-.65,Math.PI,1.9*Math.PI);
  ctx.lineWidth=6;ctx.strokeStyle='rgba(255,255,255,.11)';ctx.stroke();
  ctx.fillStyle='#fae6a6';ctx.beginPath();ctx.arc(cx,cy,7,0,TWO_PI);ctx.fill();
  // Chute opening: the rendered selected ball then rolls across the runway.
  ctx.fillStyle='#e3b256';ctx.fillRect(323,276,30,8);
  ctx.fillStyle='#8b5c22';ctx.fillRect(322,284,33,5);
}
function advancePhysics(balls,dt,impact){
  const r=BALL_RADIUS,allowed=CAGE_RADIUS-r-9;
  for(const b of balls){
    const dx=b.x-CENTER,dy=b.y-CENTER;
    // Rotary airflow and gravity keep the balls tumbling with irregular motion.
    b.vx+=((-dy*.95)+Math.sin(b.x*.04+b.seed)*90+(Math.random()-.5)*160)*dt;
    b.vy+=((dx*.95)+72+(Math.random()-.5)*160)*dt;
    const speed=Math.hypot(b.vx,b.vy);
    if(speed>230){b.vx=b.vx/speed*230;b.vy=b.vy/speed*230;}
    b.x+=b.vx*dt;b.y+=b.vy*dt;
    b.angle+=(b.vx+b.vy)*dt*.013;
    b.vx*=.995;b.vy*=.995;
    const rad=Math.hypot(b.x-CENTER,b.y-CENTER);
    if(rad>allowed){
      const nx=(b.x-CENTER)/rad,ny=(b.y-CENTER)/rad;
      b.x=CENTER+nx*allowed;b.y=CENTER+ny*allowed;
      const normal=b.vx*nx+b.vy*ny;
      if(normal>0) {
        b.vx-=1.82*normal*nx;b.vy-=1.82*normal*ny;
        if(normal>40)impact(Math.min(1,normal/210));
      }
    }
  }
  // Equal-mass circle/circle contact, overlap correction and elastic impulse.
  for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++){
    const a=balls[i],b=balls[j],dx=b.x-a.x,dy=b.y-a.y;
    const d=Math.max(.001,Math.hypot(dx,dy)),min=2*r+1;
    if(d>=min)continue;
    const nx=dx/d,ny=dy/d,overlap=(min-d)/2;
    a.x-=nx*overlap;a.y-=ny*overlap;
    b.x+=nx*overlap;b.y+=ny*overlap;
    const relative=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
    if(relative<0){
      const impulse=-(1+.86)*relative/2;
      a.vx-=impulse*nx;a.vy-=impulse*ny;
      b.vx+=impulse*nx;b.vy+=impulse*ny;
      if(-relative>24)impact(Math.min(1,-relative/175));
    }
  }
}
function BingoCage({teams,logos,mixing,onImpact,reducedMotion}){
  const canvas=useRef(null), impactRef=useRef(onImpact);
  impactRef.current=onImpact;
  const key=teams.map(t=>t.id).join('|'),logoKey=teams.map(t=>t.logoPath||'').join('|');
  useEffect(()=>{
    const element=canvas.current;
    if(!element)return;
    const ctx=element.getContext('2d');
    if(!ctx)return;
    const images=new Map();
    teams.forEach(t=>{
      if(!logos[t.id])return;
      const img=new Image();
      img.onload=()=>{if(!mixing)paintCage(ctx,balls,spin,images,false);};
      img.src=logos[t.id];images.set(t.id,img);
    });
    let spin=0,raf=0,last=0;
    const balls=teams.map((t,i)=>{
      const total=teams.length,angle=TWO_PI*i/Math.max(1,total)+.2;
      const radius= i%2 ? 48 : 91;
      return {id:t.id,number:i+1,x:CENTER+Math.cos(angle)*radius,y:CENTER+Math.sin(angle)*radius,
        vx:Math.sin(angle)*125,vy:-Math.cos(angle)*125,angle:0,seed:i*1.7};
    });
    function frame(ts){
      const dt=Math.min(.032,Math.max(.006,(ts-(last||ts-16))/1000));last=ts;
      if(mixing&&!reducedMotion) {
        // Small substeps keep fast spheres from tunneling through one another.
        advancePhysics(balls,dt/2,v=>impactRef.current(v));
        advancePhysics(balls,dt/2,v=>impactRef.current(v));
        spin+=dt*1.15;
      }
      paintCage(ctx,balls,spin,images,mixing);
      // Stop painting once the drum is stationary; long drafts can stay open
      // for hours without keeping an unnecessary animation loop running.
      if(mixing&&!reducedMotion)raf=requestAnimationFrame(frame);
    }
    raf=requestAnimationFrame(frame);
    return ()=>cancelAnimationFrame(raf);
  },[key,logoKey,mixing,reducedMotion]);
  return <canvas ref={canvas} width={SIZE} height={SIZE} className="ssl-physics-cage" aria-label={mixing?'Balls colliding and bouncing inside the turning cage':'Bingo cage waiting for the next mix'}/>;
}

function RollingLogoBall({team,logo,number,phaseElapsedMs}) {
  // Only read the delay on mount: changing it each second would restart CSS
  // animations and make late joiners see a ball jump or begin again.
  const delay=useRef(-Math.max(0,phaseElapsedMs)).current;
  return <span className="lottery-ball ssl-roll-ball" style={{animationDelay:delay+'ms'}} aria-label={team?.name||'Selected bingo ball'}>
    {logo?<img src={logo} alt=""/>:number}
  </span>;
}
export function BingoLottery({teams=[],order=[],lottery,logoFor}) {
  const audio=useBingoAudio();
  const soundRef=useRef(audio);soundRef.current=audio;
  const [reducedMotion,setReducedMotion]=useState(false);
  useEffect(()=>{
    const media=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if(!media)return;
    const change=()=>setReducedMotion(media.matches);
    change();media.addEventListener?.('change',change);
    return ()=>media.removeEventListener?.('change',change);
  },[]);
  const reveal=lottery.revealed,phase=lottery.phase;
  const mixing=phase==='intro'||phase==='mixing';
  const appearing=phase==='rolling'||phase==='announce'||phase==='complete';
  const chosen=appearing&&reveal>0?teams.find(t=>t.id===order[reveal-1]):null;
  const left=teams.filter(t=>!order.slice(0,reveal).includes(t.id));
  const logos=Object.fromEntries(teams.map(t=>[t.id,t.logoPath?logoFor(t.logoPath):null]));
  const prevPhase=useRef('');
  useEffect(()=>{
    const marker=phase+':'+reveal;
    if(marker===prevPhase.current)return;
    prevPhase.current=marker;
    if(phase==='rolling')soundRef.current.roll(lottery.phaseElapsedMs);
  },[phase,reveal]);
  return <div className="ssl-lottery-theater">
    <div className="ssl-cage-side">
      <div className="ssl-cage-caption"><strong>SSL LOTTERY CAGE</strong><span>{left.length} BALLS INSIDE</span></div>
      <BingoCage teams={left} logos={logos} mixing={mixing} reducedMotion={reducedMotion} onImpact={v=>soundRef.current.hit(v)}/>
      <button type="button" className="ssl-lottery-sound" aria-pressed={audio.enabled} onClick={audio.toggle}>
        {audio.enabled?<><Volume2 size={17}/> SOUND ON · MUTE</>:<><VolumeX size={17}/> ENABLE BALL SOUNDS</>}
      </button>
    </div>
    <div className="bingo-announcement ssl-bingo-stage">
      <span className="bingo-announcement-heading" aria-live="polite">
        {phase==='complete'?'THE OFFICIAL ORDER IS IN':phase==='rolling'?'THE NEXT BALL IS ROLLING OUT':phase==='announce'?'OFFICIAL PICK ANNOUNCED':phase==='intro'?'OPENING CAGE MIX':'MIXING FOR THE NEXT PICK'}
      </span>
      <div className="ssl-ball-runway">
        <span className="ssl-ball-runway-rail" aria-hidden="true"/>
        {phase==='rolling'?<RollingLogoBall key={reveal} team={chosen} number={reveal} logo={chosen?logos[chosen.id]:null} phaseElapsedMs={lottery.phaseElapsedMs}/>
          :appearing&&chosen?<span className="lottery-ball ssl-feature-ball" key={reveal}>
            {logos[chosen.id]?<img src={logos[chosen.id]} alt=""/>:reveal}
          </span>:<span className="lottery-ball ssl-waiting-ball">?</span>}
      </div>
      <strong aria-live="polite">{phase==='complete'?'ALL 12 FRANCHISES HAVE BEEN DRAWN':phase==='announce'&&chosen?'#'+reveal+' · '+chosen.name:phase==='rolling'?'THE BALL IS COMING DOWN THE CHUTE…':phase==='intro'?'LET THE BALLS MIX…':'NEXT FRANCHISE UP…'}</strong>
      {mixing?<div className="ssl-mix-countdown"><span>NEXT BALL ROLLS OUT IN</span><b>{lottery.secondsToNext}s</b></div>
        :phase==='rolling'?<small>Rolling into position · please stand by</small>
        :phase==='announce'?<small>{teams.length-reveal} {teams.length-reveal===1?'franchise':'franchises'} waiting · next mix starts after this announcement clears</small>
        :<small>Draft order finalized · return any time to view the results</small>}
    </div>
  </div>;
}
