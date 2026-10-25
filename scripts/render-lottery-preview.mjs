import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {lotteryProgress, LOTTERY_INTRO_MS, LOTTERY_DRAW_INTERVAL_MS} from '../src/lottery-timing.js';
const {chromium}=createRequire(import.meta.url)('playwright');
const root=process.cwd(),output=path.join(root,'dist','ssl-season1-bingo-lottery-preview.mp4');
const names=[
[1,'Delfino Dolphins','1/76fc9d22-ade5-4b0f-89b3-c23bcb055248.png'],
[2,'HopeDogo Retrievers 3','2/f1b981d6-d38d-4633-a575-20cc4e547e8c.png'],
[3,'Petalburg Petilils','3/f6a49cf7-ac71-4acb-9109-8a5f8bae826b.png'],
[4,'Moleville Haliban','4/f40d2bb4-dc79-484c-8923-7a492c03d5f2.jpg'],
[5,'Diamond City Checkers','5/96c5e34c-f328-4c17-98d7-9aeadae625b0.png'],
[6,'Starborn Voidstriders','6/5a445db7-b910-43e2-9adf-6eef16d5a559.png'],
[7,'New Donk City Knights','7/d775ab4f-5fe2-44d1-9445-24097700b9d7.jpg'],
[8,'Petalburg Pangolins','8/6f891562-13fe-4028-b250-7db8662a3acb.jpg'],
[9,'New Donk City Fuggetaboudits','9/13160e2b-3a52-4f33-9149-908a68af911f.png'],
[10,'Rogueport Ruffians','10/47db7ba3-31f0-4923-b434-7b920a3d77ad.png'],
[11,'TWILIGHT TOWN TANKS','11/c9d0548b-03b7-4eed-95f6-84e6f855391e.png'],
[12,'Decalburg Dedennes','12/8ba4cb95-271c-42f2-8f63-0be56141b374.png']];
await fs.mkdir(path.dirname(output),{recursive:true});
const teams=[];
for(const [slot,name,logo_path] of names){
 const r=await fetch('https://vocaddalptoghysgdkvh.supabase.co/storage/v1/object/public/ssl-team-logos/'+logo_path,{signal:AbortSignal.timeout(25000)});
 if(!r.ok)throw Error('Logo download '+name+' HTTP '+r.status);
 const bytes=Buffer.from(await r.arrayBuffer());
 if(bytes.length<250)throw Error('Invalid logo '+name);
 const mime=logo_path.endsWith('.jpg')?'image/jpeg':'image/png';
 teams.push({slot,name,logo:'data:'+mime+';base64,'+bytes.toString('base64')});
 console.log('Fetched '+name+' logo '+bytes.length+' bytes');
}
const css=await fs.readFile(path.join(root,'src/season.css'),'utf8');
const addcss=[
 'body{margin:0;background:#111b30;color:#fff;font-family:Arial,sans-serif;overflow:hidden}*{box-sizing:border-box}',
 '.movie{width:1280px;height:720px;padding:20px 52px 25px;background:radial-gradient(ellipse at 49% 50%,#263c62,#111b30 70%)}',
 '.movie-head{height:160px;text-align:center}.movie-kicker{color:#e9bd5c;font-size:14px;font-weight:900;letter-spacing:.2em}',
 '.movie h1{font-size:56px;line-height:1;margin:11px 0;color:#fff;letter-spacing:.06em}',
 '.movie-lede{color:#aabddb;font-size:13px;font-weight:bold;letter-spacing:.1em}.movie-disclaimer{font-size:11px;color:#efbd5c;margin:8px}',
 '.movie-stage{display:grid;grid-template-columns:300px 1fr;height:278px;align-items:center;border:2px solid #e8b94b;border-radius:12px;background:#152342;margin:0 0 14px;padding:15px 55px}',
 '.movie-stage .bingo-machine{transform:scale(1.2)}.movie-stage .bingo-announcement strong{font-size:28px}',
 '.movie-results-title{font-weight:900;color:#e9bd5c;letter-spacing:.1em;font-size:18px;margin-bottom:9px}',
 '.movie-results{display:grid;grid-template-columns:repeat(3,1fr);gap:6px 14px}',
 '.movie-results .lottery-result-team{display:flex;align-items:center;min-height:34px;border:1px solid #ffffff28;border-radius:6px;padding:3px 8px;background:#ffffff10;color:#fff;font-size:13px;font-weight:bold}',
 '.movie-results .lottery-result-team img{width:27px;height:27px}',
 '.movie-foot{color:#aec0dc;font-size:10px;text-align:center;position:absolute;top:700px;left:0;width:100%}'
].join('\n');
const html='<!doctype html><html><head><meta charset="utf-8"><style>'+css+'\n'+addcss+'</style></head>'+
'<body><main class="movie"><header class="movie-head"><div class="movie-kicker">SUPA SPORTS NETWORK · SEASON 1</div>'+
'<h1>DRAFT LOTTERY</h1><p class="movie-lede">12 FRANCHISES · LOGO BINGO BALLS · SNAKE DRAFT</p>'+
'<p class="movie-disclaimer">PREVIEW SIMULATION — EXAMPLE ORDER, NOT THE OFFICIAL DRAW</p></header>'+
'<section class="lottery-reveal lottery-reveal-bingo movie-stage"><div class="bingo-machine">'+
'<div class="bingo-drum bingo-drum-spinning" id="cage"></div><div class="bingo-crank"></div><div class="bingo-machine-base"></div></div>'+
'<div class="bingo-announcement"><span class="bingo-announcement-heading" id="status">ROTATING THE BINGO CAGE</span>'+
'<span class="lottery-ball bingo-drawn-ball" id="drawn">?</span><strong id="team-name">MIXING ALL 12 TEAM LOGO BALLS…</strong>'+
'<small id="remaining">12 balls remaining</small></div></section>'+
'<div class="movie-results-title">DRAFT ORDER · LIVE REVEAL</div><div id="results" class="season-draft-order movie-results"></div>'+
'<footer class="movie-foot">Uses the actual SSL site bingo styles and current franchise logo files. Official Season 1 draft order has not been drawn.</footer>'+
'</main></body></html>';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
await page.setContent(html,{waitUntil:'load'});
const order=[7,3,1,10,6,12,4,2,8,11,5,9]; // Example only, NOT the official draw.
await page.evaluate(({teams,order})=>{
 const bySlot=new Map(teams.map(t=>[t.slot,t]));
 const cage=document.getElementById('cage'), drawn=document.getElementById('drawn');
 const results=document.getElementById('results');
 cage.classList.remove('bingo-drum-spinning');
 let currentReveal=-1;
 window.renderLotteryStage=({revealed,phase,secondsToNext,elapsedMs})=>{
   // Capture the drum at each frame's timeline position: video speed doesn't
   // depend on machine performance or real-time JavaScript intervals.
   cage.style.transform='rotate('+(elapsedMs*.095)+'deg)';
   if(revealed!==currentReveal){
     currentReveal=revealed;
     cage.replaceChildren();
     const remaining=teams.filter(t=>!order.slice(0,revealed).includes(t.slot));
     remaining.forEach((t,i)=>{
       const shell=document.createElement('span');shell.className='bingo-cage-ball';
       shell.style.setProperty('--ball-angle',(i*360/Math.max(1,remaining.length))+'deg');
       shell.title=t.name;
       const im=document.createElement('img');im.src=t.logo;im.alt='';
       shell.append(im);cage.append(shell);
     });
     results.replaceChildren();
     order.slice(0,revealed).forEach((slot,i)=>{
       const t=bySlot.get(slot),line=document.createElement('span');line.className='lottery-result-team';
       const im=document.createElement('img');im.src=t.logo;im.alt='';
       line.append(im,document.createTextNode((i+1)+'. '+t.name));results.append(line);
     });
   }
   const announcement=(phase==='announce'||phase==='complete')&&revealed>0;
   drawn.replaceChildren();
   if(announcement){
     const winner=bySlot.get(order[revealed-1]);
     const im=document.createElement('img');im.src=winner.logo;im.alt=winner.name;
     drawn.append(im);
     drawn.className='lottery-ball bingo-drawn-ball';
   }else {
     drawn.textContent='?';
     drawn.className='lottery-ball bingo-ball-pending';
   }
   document.getElementById('status').textContent=phase==='complete'?'THE OFFICIAL ORDER IS IN':announcement?'BALL DRAWN · PICK ANNOUNCED':phase==='intro'?'MIXING ALL 12 FRANCHISES':'MIXING FOR THE NEXT PICK';
   document.getElementById('team-name').textContent=announcement?'#'+revealed+' · '+bySlot.get(order[revealed-1]).name:phase==='intro'?'THE CAGE IS MIXING…':'WHO WILL BE CALLED NEXT?';
   document.getElementById('remaining').textContent=phase==='complete'?'DRAFT LOTTERY COMPLETE':(order.length-revealed)+' balls remaining · next reveal in '+secondsToNext+'s';
 };
},{teams,order});
const fps=6, durationMs=LOTTERY_INTRO_MS+(order.length-1)*LOTTERY_DRAW_INTERVAL_MS+6500;
const frames=Math.ceil(fps*durationMs/1000);
const ff=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate',String(fps),'-vcodec','png','-i','pipe:0','-c:v','libx264','-preset','ultrafast','-crf','25','-pix_fmt','yuv420p','-movflags','+faststart',output],{stdio:['pipe','inherit','inherit']});
const done=new Promise((resolve,reject)=>ff.on('exit',code=>code===0?resolve():reject(Error('ffmpeg exited '+code))));
for(let i=0;i<frames;i++){
 const elapsedMs=Math.floor(i*1000/fps);
 const stage=lotteryProgress(order.length,'1970-01-01T00:00:00.000Z',elapsedMs);
 await page.evaluate(data=>window.renderLotteryStage(data),{...stage,elapsedMs});
 const png=await page.screenshot({type:'png',animations:'disabled'});
 if(!ff.stdin.write(png))await new Promise(res=>ff.stdin.once('drain',res));
}
ff.stdin.end();await done;await browser.close();
console.log('Video exported: '+output);
