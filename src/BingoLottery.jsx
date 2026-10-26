import React, {useEffect, useRef, useState} from 'react';
import './bingo-lottery.css';

// The official draw order remains server-controlled. This visual simulation
// affects only presentation, never picks or randomization.
const SIZE=360, CENTER=180, CAGE_RADIUS=150, BALL_RADIUS=19, TAU=Math.PI*2;

// Canvas-only "inside the cage" ball rendering. Logo art is clipped to a
// circular face at 72% of the diameter; source aspect/background is preserved
// until cover-scaled inside this inner circle.
function drawLogoFace(ctx,image,x,y,r) {
  ctx.save();
  ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.clip();
  ctx.fillStyle='#f4f2eb';ctx.fillRect(x-r,y-r,2*r,2*r);
  if(image?.complete&&image.naturalWidth>0){
    const scale=Math.max(2*r/image.naturalWidth,2*r/image.naturalHeight);
    const w=image.naturalWidth*scale,h=image.naturalHeight*scale;
    ctx.drawImage(image,x-w/2,y-h/2,w,h);
  }
  ctx.restore();
}
function paintCage(ctx,balls,spin,images){
  ctx.clearRect(0,0,SIZE,SIZE);
  const c=CENTER,R=CAGE_RADIUS;
  // Thick machined brass bearing and glass housing.
  const outer=ctx.createRadialGradient(125,102,10,c,c,R+10);
  outer.addColorStop(0,'#294b6d');outer.addColorStop(.65,'#142e4b');outer.addColorStop(1,'#071a32');
  ctx.beginPath();ctx.arc(c,c,R+5,0,TAU);ctx.fillStyle=outer;ctx.fill();
  ctx.save();ctx.beginPath();ctx.arc(c,c,R-8,0,TAU);ctx.clip();
  ctx.save();ctx.translate(c,c);ctx.rotate(spin);
  // Smooth wire drum, faint to keep franchise logos readable.
  ctx.lineWidth=2;
  for(let x=-147;x<=147;x+=37){
    ctx.strokeStyle='rgba(227,189,108,.24)';
    ctx.beginPath();ctx.moveTo(x,-160);ctx.lineTo(x,160);ctx.stroke();
  }
  for(let y=-147;y<=147;y+=42){
    ctx.strokeStyle='rgba(227,189,108,.20)';
    ctx.beginPath();ctx.moveTo(-160,y);ctx.lineTo(160,y);ctx.stroke();
  }
  ctx.restore();
  for(const ball of balls){
    ctx.save();ctx.translate(ball.x,ball.y);ctx.rotate(ball.angle);
    const metal=ctx.createRadialGradient(-8,-9,2,0,0,BALL_RADIUS);
    metal.addColorStop(0,'#fffce7');metal.addColorStop(.43,'#f6d375');metal.addColorStop(1,'#aa661d');
    ctx.beginPath();ctx.arc(0,0,BALL_RADIUS,0,TAU);
    ctx.fillStyle=metal;ctx.shadowColor='#000b';ctx.shadowBlur=4;ctx.fill();
    ctx.shadowBlur=0;ctx.strokeStyle='#ffe5a0';ctx.lineWidth=1.6;ctx.stroke();
    drawLogoFace(ctx,images.get(ball.id),0,0,BALL_RADIUS*.72);
    ctx.strokeStyle='#694719';ctx.lineWidth=.8;ctx.beginPath();ctx.arc(0,0,BALL_RADIUS*.72,0,TAU);ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  // Front glazing and ribs: these sit in front of moving balls.
  ctx.save();ctx.beginPath();ctx.arc(c,c,R-6,0,TAU);ctx.clip();
  const shine=ctx.createLinearGradient(45,20,210,210);
  shine.addColorStop(0,'rgba(230,245,255,.21)');
  shine.addColorStop(.43,'rgba(240,250,255,.02)');
  shine.addColorStop(1,'rgba(250,240,195,.065)');
  ctx.fillStyle=shine;ctx.fillRect(18,18,320,310);
  ctx.strokeStyle='rgba(245,214,141,.26)';ctx.lineWidth=3;
  for(const xx of [89,180,271]){
    ctx.beginPath();ctx.ellipse(xx,c,30,R,0,0,TAU);ctx.stroke();
  }
  ctx.restore();
  ctx.beginPath();ctx.arc(c,c,R+3,0,TAU);ctx.strokeStyle='#6c461e';ctx.lineWidth=16;ctx.stroke();
  ctx.beginPath();ctx.arc(c,c,R+3,0,TAU);ctx.strokeStyle='#eac277';ctx.lineWidth=9;ctx.stroke();
  ctx.beginPath();ctx.arc(c,c,R+3,0,TAU);ctx.strokeStyle='#fff0bc';ctx.lineWidth=2;ctx.stroke();
  for(let i=0;i<12;i++){
    const angle=i*TAU/12,rx=c+Math.cos(angle)*(R+3),ry=c+Math.sin(angle)*(R+3);
    ctx.fillStyle='#553819';ctx.beginPath();ctx.arc(rx,ry,4.5,0,TAU);ctx.fill();
    ctx.fillStyle='#ffdda3';ctx.beginPath();ctx.arc(rx-1,ry-1,2,0,TAU);ctx.fill();
  }
  ctx.beginPath();ctx.arc(c,c,10,0,TAU);ctx.fillStyle='#734d1d';ctx.fill();
  ctx.beginPath();ctx.arc(c,c,6,0,TAU);ctx.fillStyle='#ffe09b';ctx.fill();
}
function advanceBalls(balls,dt){
  const bound=CAGE_RADIUS-BALL_RADIUS-12;
  for(const b of balls){
    const dx=b.x-CENTER,dy=b.y-CENTER;
    b.vx+=((-dy*.92)+Math.sin(b.x*.04+b.seed)*90+(Math.random()-.5)*145)*dt;
    b.vy+=((dx*.92)+64+(Math.random()-.5)*145)*dt;
    const speed=Math.hypot(b.vx,b.vy);
    if(speed>215){b.vx=b.vx/speed*215;b.vy=b.vy/speed*215;}
    b.x+=b.vx*dt;b.y+=b.vy*dt;b.angle+=(b.vx+b.vy)*dt*.011;
    b.vx*=.995;b.vy*=.995;
    const radius=Math.hypot(b.x-CENTER,b.y-CENTER);
    if(radius>bound){
      const nx=(b.x-CENTER)/radius,ny=(b.y-CENTER)/radius;
      b.x=CENTER+nx*bound;b.y=CENTER+ny*bound;
      const normal=b.vx*nx+b.vy*ny;
      if(normal>0){b.vx-=1.81*normal*nx;b.vy-=1.81*normal*ny;}
    }
  }
  for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++){
    const a=balls[i],b=balls[j],dx=b.x-a.x,dy=b.y-a.y;
    const dist=Math.max(.001,Math.hypot(dx,dy)),minimum=2*BALL_RADIUS+1;
    if(dist>=minimum)continue;
    const nx=dx/dist,ny=dy/dist,over=(minimum-dist)/2;
    a.x-=nx*over;a.y-=ny*over;b.x+=nx*over;b.y+=ny*over;
    const relative=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
    if(relative<0){
      const impulse=-1.86*relative/2;
      a.vx-=impulse*nx;a.vy-=impulse*ny;
      b.vx+=impulse*nx;b.vy+=impulse*ny;
    }
  }
}
function BingoCage({teams,logos,mixing,reducedMotion}){
  const canvas=useRef(null);
  const teamKey=teams.map(t=>t.id).join('|');
  const logoKey=teams.map(t=>t.logoPath||'').join('|');
  useEffect(()=>{
    const el=canvas.current,ctx=el?.getContext('2d');if(!ctx)return;
    let frameId=0,last=0,spin=0,alive=true;
    const images=new Map();
    const balls=teams.map((t,i)=>{
      const a=TAU*i/Math.max(teams.length,1)+.21,rad=i%2?52:91;
      return {id:t.id,number:i+1,x:CENTER+Math.cos(a)*rad,y:CENTER+Math.sin(a)*rad,
        vx:Math.sin(a)*115,vy:-Math.cos(a)*115,angle:0,seed:i*1.79};
    });
    teams.forEach(t=>{
      if(!logos[t.id])return;
      const img=new Image();img.onload=()=>{if(alive&&!mixing)paintCage(ctx,balls,spin,images);};
      img.src=logos[t.id];images.set(t.id,img);
    });
    function tick(t){
      const dt=Math.min(.032,Math.max(.006,(t-(last||t-16))/1000));last=t;
      if(mixing&&!reducedMotion){
        advanceBalls(balls,dt/2);advanceBalls(balls,dt/2);spin+=dt*.78;
      }
      paintCage(ctx,balls,spin,images);
      if(mixing&&!reducedMotion)frameId=requestAnimationFrame(tick);
    }
    frameId=requestAnimationFrame(tick);
    return()=>{alive=false;cancelAnimationFrame(frameId);};
  },[teamKey,logoKey,mixing,reducedMotion]);
  return <canvas ref={canvas} width={SIZE} height={SIZE} className="ssl-machine-canvas"
    aria-label={mixing?'Bingo balls bouncing inside a metal-and-glass cage':'Bingo cage resting between draws'} />;
}

function LogoBall({logo,number,rolling,phaseElapsedMs}){
  const elapsedAtMount=useRef(Math.max(0,phaseElapsedMs)).current;
  return <span className={'ssl-display-ball'+(rolling?' ssl-display-ball-rolling':'')}
      style={rolling?{animationDelay:-elapsedAtMount+'ms'}:undefined}>
    <span className="ssl-display-ball-face">
      {logo?<img src={logo} alt=""/>:<span className="ssl-ball-number">{number}</span>}
    </span>
    <span className="ssl-display-ball-glint" aria-hidden="true"/>
  </span>;
}
function MachineArtwork(){
  return <svg className="ssl-machine-art" viewBox="0 0 960 475" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <defs>
      <radialGradient id="ssl-studio" cx=".35" cy=".22" r=".95">
        <stop offset="0" stopColor="#26486a"/><stop offset=".55" stopColor="#142942"/><stop offset="1" stopColor="#081626"/>
      </radialGradient>
      <linearGradient id="ssl-gold" x1="0" y1="0" x2=".08" y2="1">
        <stop stopColor="#fff0b9"/><stop offset=".18" stopColor="#daa956"/><stop offset=".50" stopColor="#906027"/><stop offset=".75" stopColor="#e4b96a"/><stop offset="1" stopColor="#5e3f1f"/>
      </linearGradient>
      <linearGradient id="ssl-silver" x1="0" y1="0" x2="0" y2="1">
        <stop stopColor="#f6f8f4"/><stop offset=".26" stopColor="#a8b9c4"/><stop offset=".6" stopColor="#485e73"/><stop offset="1" stopColor="#c6d3d8"/>
      </linearGradient>
      <linearGradient id="ssl-pedestal" x1="0" x2="1">
        <stop stopColor="#273e54"/><stop offset=".24" stopColor="#8798a1"/><stop offset=".5" stopColor="#dfe6e5"/><stop offset=".77" stopColor="#697d8c"/><stop offset="1" stopColor="#203447"/>
      </linearGradient>
      <filter id="ssl-shadow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="9"/>
      </filter>
      <pattern id="ssl-grid" width="36" height="36" patternUnits="userSpaceOnUse">
        <path d="M36 0H0V36" fill="none" stroke="#8eb6cc" strokeOpacity=".085"/>
      </pattern>
    </defs>
    <rect width="960" height="475" rx="16" fill="url(#ssl-studio)"/>
    <rect width="960" height="475" rx="16" fill="url(#ssl-grid)"/>
    <path d="M12 436H947" stroke="#b99655" strokeOpacity=".4" strokeWidth="2"/>
    <path d="M16 451H947" stroke="#284863" strokeWidth="24" strokeOpacity=".55"/>
    <ellipse cx="205" cy="425" rx="185" ry="21" fill="#000" opacity=".36" filter="url(#ssl-shadow)"/>
    <ellipse cx="713" cy="431" rx="170" ry="17" fill="#000" opacity=".4" filter="url(#ssl-shadow)"/>
    <g transform="translate(0,-2)">
      {/* Cage support is behind the drum canvas. */}
      <path d="M100 322L77 401H288L264 322" fill="#172b3c" stroke="url(#ssl-silver)" strokeWidth="12" strokeLinejoin="round"/>
      <path d="M108 312L130 391M257 312L234 391" stroke="#e2be79" strokeWidth="5" opacity=".8"/>
      <rect x="57" y="393" width="258" height="26" rx="8" fill="url(#ssl-silver)" stroke="#f1cf86" strokeWidth="4"/>
      <rect x="93" y="398" width="186" height="12" rx="4" fill="#132b42"/>
      <text x="186" y="409" textAnchor="middle" fontSize="12" fontWeight="900" letterSpacing="3" fill="#f3d891">SSL · DRAFT LOTTERY</text>
    </g>
    {/* Chute opening at the lower-right of the cage. Downhill is POSITIVE Y. */}
    <path d="M316 251L342 243L370 272L335 285Z" fill="#334859" stroke="#f2d28c" strokeWidth="4"/>
    <path d="M324 261L706 363" fill="none" stroke="#000" strokeWidth="38" opacity=".35" filter="url(#ssl-shadow)"/>
    <path d="M321 257L702 359" fill="none" stroke="#203547" strokeWidth="30" strokeLinecap="round"/>
    <path d="M321 252L702 354" fill="none" stroke="url(#ssl-silver)" strokeWidth="23" strokeLinecap="round"/>
    <path d="M321 244L702 346" fill="none" stroke="#ffe9aa" strokeWidth="5" strokeLinecap="round"/>
    <path d="M322 267L697 369" fill="none" stroke="#b07a30" strokeWidth="5" strokeLinecap="round"/>
    {/* Small safety rails on the ramp. */}
    <path d="M345 248L693 342" fill="none" stroke="#394f60" strokeWidth="3" opacity=".6"/>
    {[400,480,560,640].map((x,i)=><g key={x}>
      <circle cx={x} cy={270+i*21.4} r="3.5" fill="#132738" stroke="#fff1c2" strokeWidth="1.2"/>
    </g>)}
    {/* Lower receiving podium and built-in round retaining dish. */}
    <path d="M658 370L765 370L755 424L669 424Z" fill="url(#ssl-pedestal)" stroke="#c3d7df" strokeWidth="4"/>
    <path d="M664 383H760" stroke="#fff0be" strokeWidth="4"/>
    <rect x="623" y="344" width="183" height="28" rx="12" fill="url(#ssl-silver)" stroke="#f4d086" strokeWidth="4"/>
    <path d="M638 349Q712 365 791 348" fill="none" stroke="#f8e7bb" strokeWidth="3"/>
    <rect x="656" y="417" width="114" height="18" rx="7" fill="url(#ssl-gold)" stroke="#f7e7a8" strokeWidth="3"/>
    <rect x="675" y="382" width="74" height="29" rx="5" fill="#153047" stroke="#e4c682" strokeWidth="2"/>
    <text x="712" y="402" textAnchor="middle" fontSize="16" fontWeight="900" letterSpacing="3" fill="#fce6a2">SSL</text>
    {/* Broadcast sign fills the empty upper right, avoids clutter. */}
    <rect x="439" y="50" width="439" height="105" rx="11" fill="#0b2034" stroke="#cfab63" strokeWidth="2"/>
    <path d="M452 72H865" stroke="#778ca0" strokeOpacity=".45"/>
    <text x="657" y="86" textAnchor="middle" fill="#dfbf78" fontSize="16" letterSpacing="5" fontWeight="800">SUPA SPORTS NETWORK</text>
    <text x="657" y="127" textAnchor="middle" fill="#fff7df" fontSize="32" fontWeight="900" letterSpacing="3">DRAFT LOTTERY</text>
    <path d="M453 143H865" stroke="#e1b564" strokeWidth="2" opacity=".75"/>
    <path d="M20 18H139M820 18H940" stroke="#b58f56" strokeWidth="3" strokeOpacity=".6"/>
  </svg>;
}
export function BingoLottery({teams=[],order=[],lottery,logoFor}){
  const [reducedMotion,setReducedMotion]=useState(false);
  useEffect(()=>{
    const m=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if(!m)return;
    const onChange=()=>setReducedMotion(m.matches);
    onChange();m.addEventListener?.('change',onChange);
    return()=>m.removeEventListener?.('change',onChange);
  },[]);
  const reveal=lottery.revealed,phase=lottery.phase;
  const mixing=phase==='intro'||phase==='mixing';
  const displayed=phase==='rolling'||phase==='announce'||phase==='complete';
  const selected=displayed&&reveal>0?teams.find(t=>t.id===order[reveal-1]):null;
  const remaining=teams.filter(t=>!order.slice(0,reveal).includes(t.id));
  const logos=Object.fromEntries(teams.map(t=>[t.id,t.logoPath?logoFor(t.logoPath):null]));
  return <div className="ssl-lottery-theater">
    <div className="ssl-machine-viewport">
      <div className="ssl-machine-stage">
        <MachineArtwork/>
        <div className="ssl-machine-cage"><BingoCage teams={remaining} logos={logos} mixing={mixing} reducedMotion={reducedMotion}/></div>
        <div className="ssl-machine-draw">
          {displayed&&selected&&<LogoBall key={reveal} logo={logos[selected.id]} number={reveal} rolling={phase==='rolling'} phaseElapsedMs={lottery.phaseElapsedMs}/>}
        </div>
        <div className="ssl-machine-counter">{remaining.length} BALLS IN CAGE</div>
      </div>
    </div>
    <div className="ssl-lottery-footer">
      <div className="ssl-lottery-phase">
        <span className="ssl-lottery-kicker">{phase==='complete'?'DRAFT ORDER COMPLETE':phase==='rolling'?'BALL IN TRANSIT':phase==='announce'?'OFFICIAL FRANCHISE DRAW':mixing?'DRUM MIXING':'DRAFT LOTTERY'}</span>
        <strong aria-live="polite">{phase==='complete'?'ALL 12 FRANCHISES DRAWN':phase==='announce'&&selected?'#'+reveal+' · '+selected.name:phase==='rolling'?'ROLLING DOWN TO THE PODIUM…':mixing?'WHO WILL BE DRAWN NEXT?':'STANDBY'}</strong>
        <small>{phase==='rolling'?'Chute opened · ball moving downhill':phase==='announce'?'Next mixing cycle begins when this announcement clears':phase==='complete'?'The official order has been revealed':'Every ball has its own draw'}</small>
      </div>
      {mixing&&<div className="ssl-lottery-timer"><span>NEXT DRAW IN</span><b>{lottery.secondsToNext}s</b></div>}
      {phase==='announce'&&<span className="ssl-lottery-revealed">{reveal} / {order.length} REVEALED</span>}
    </div>
  </div>;
}
