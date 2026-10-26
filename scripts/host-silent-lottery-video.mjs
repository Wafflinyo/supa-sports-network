import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {createServer} from 'vite';
import {lotteryProgress,lotteryDuration} from '../src/lottery-timing.js';
// Real website React machine; fully silent video with no audio track.
const {chromium}=createRequire(import.meta.url)('playwright');
const root=process.cwd(),work=path.join(root,'.ssl-silent-preview');
const output=path.join(root,'public/videos/ssl-draft-lottery-12-picks.mp4');
await fs.mkdir(path.dirname(output),{recursive:true});
await fs.mkdir(work,{recursive:true});
for(const name of ['main.jsx','preview.css','index.html']){
  await fs.copyFile(path.join(root,'scripts/lottery-video',name),path.join(work,name));
}
const identity=[
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
const teams=[];
for(const [id,name,filename] of identity){
  const resp=await fetch('https://vocaddalptoghysgdkvh.supabase.co/storage/v1/object/public/ssl-team-logos/'+filename,{signal:AbortSignal.timeout(35000)});
  if(!resp.ok)throw Error('Logo '+name+' failed: '+resp.status);
  const bytes=Buffer.from(await resp.arrayBuffer());
  if(bytes.byteLength<300)throw Error('Invalid logo '+name);
  const mime=filename.endsWith('.jpg')?'image/jpeg':'image/png';
  teams.push({id:String(id),name,logoPath:'data:'+mime+';base64,'+bytes.toString('base64')});
  console.log('Logo ready: '+name);
}
const order=[7,3,1,10,6,12,4,2,8,11,5,9].map(String); // Example ONLY
const fps=5,durationMs=lotteryDuration(order.length)+2000,frameCount=Math.ceil(durationMs/1000*fps);
console.log('Full silent lottery: '+frameCount+' frames, '+(durationMs/1000)+' sec.');
const server=await createServer({configFile:false,root,base:'/',server:{host:'127.0.0.1',port:4198,strictPort:true}});
let browser;
try{
  await server.listen();
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1});
  await context.addInitScript(({teams,order})=>{window.__teams=teams;window.__order=order;},{teams,order});
  const page=await context.newPage();
  page.on('pageerror',error=>console.error('BROWSER ERROR: '+error.message));
  await page.goto('http://127.0.0.1:4198/.ssl-silent-preview/',{waitUntil:'networkidle'});
  await page.locator('.ssl-machine-canvas').waitFor();
  const ff=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate',String(fps),
      '-vcodec','mjpeg','-i','pipe:0','-an','-c:v','libx264','-preset','veryfast','-crf','24',
      '-pix_fmt','yuv420p','-movflags','+faststart',output],{stdio:['pipe','inherit','inherit']});
  const finished=new Promise((resolve,reject)=>ff.on('exit',code=>code===0?resolve():reject(Error('ffmpeg exited '+code))));
  for(let i=0;i<frameCount;i++){
    const elapsed=i*1000/fps;
    const progress=lotteryProgress(order.length,'2026-10-01T10:00:00.000Z',Date.parse('2026-10-01T10:00:00.000Z')+elapsed);
    await page.evaluate(({elapsed,progress})=>window.__renderSample(elapsed,progress),{elapsed,progress});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    if(progress.phase==='rolling'){
      await page.evaluate(ms=>{
        const ball=document.querySelector('.ssl-display-ball-rolling');
        for(const animation of ball?.getAnimations()||[])animation.currentTime=ms;
      },progress.phaseElapsedMs);
    }
    const jpeg=await page.screenshot({type:'jpeg',quality:82,animations:'allow'});
    if(!ff.stdin.write(jpeg))await new Promise(resolve=>ff.stdin.once('drain',resolve));
    if(i%150===0)console.log('Frame '+i+'/'+frameCount+' phase '+progress.phase+' pick '+progress.revealed);
  }
  ff.stdin.end();await finished;await context.close();
}finally{
  if(browser)await browser.close();
  await server.close();
}
console.log('SILENT sample published at: '+output);
