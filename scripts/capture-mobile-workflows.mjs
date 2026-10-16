import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {createServer} from 'vite'
const require=createRequire(import.meta.url)
const {chromium}=require(process.env.SSN_PLAYWRIGHT_MODULE || 'playwright')
const root=process.cwd(),preview=path.join(root,'.mobile-preview'),copy=path.join(root,'src/__ui-screenshot-SeasonLeague.jsx'),output=path.join(root,'dist/ui-screenshots')
await fs.mkdir(preview,{recursive:true});await fs.mkdir(output,{recursive:true})
let source=await fs.readFile(path.join(root,'src/SeasonLeague.jsx'),'utf8')
for(const name of ['Draft','Trades','LineupEditor']) source=source.replace('function '+name+'(', 'export function '+name+'(')
await fs.writeFile(copy,source)
await fs.writeFile(path.join(preview,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>SSL sample GM screens</title></head><body><div id="root"></div><script type="module" src="/.mobile-preview/entry.jsx"></script></body></html>')
await fs.writeFile(path.join(preview,'entry.jsx'),"import React,{useState} from 'react';\nimport {createRoot} from 'react-dom/client';\nimport {Draft,Trades,LineupEditor} from '../src/__ui-screenshot-SeasonLeague.jsx';\nimport pool from '../src/players.json';\nimport '../src/styles.css';import '../src/season.css';import '../src/mobile.css';\nconst mode=new URLSearchParams(location.search).get('mode')||'draft';\nconst names=['Delfino Plaza Pirates',\"Yoshi’s Island Eggsplorers\",'Diamond City Gold Diggers','Bowser Castle Bombers','Luigi Mansion Ghosts','Peach Gardens Monarchs','Wario City Wildcards','DK Jungle Swingers','Toad Town Toadstools','Sarasaland Sun Kings','Rogueport Rascals','Galaxy Star Chasers'];\nconst teams=names.map((name,i)=>({id:'team'+(i+1),slot:i+1,name,conference:i<6?'supa':'galaxy',logoPath:null}));\nconst rosterA=[1,2,5,6,10,20,3,4,7,18,14,13],rosterB=[55,56,38,39,28,53,54,59,57,40,41,42],used=new Set([...rosterA,...rosterB]),rest=pool.filter(p=>!used.has(p.id));\nconst rosters=Object.fromEntries(teams.map((t,i)=>[t.id,i===0?rosterA:i===1?rosterB:rest.slice((i-2)*12,(i-1)*12).map(p=>p.id)]));\nconst positions=['P','C','1B','2B','3B','SS','LF','CF','RF'],defaults=Object.fromEntries(teams.map(t=>[t.id,{starters:rosters[t.id].slice(0,9).map((player,i)=>({player,position:positions[i]})),bench:rosters[t.id].slice(9)}]));\nconst now=Date.parse('2026-10-16T19:00:47Z');\nconst draftPicks=Array.from({length:24},(_,i)=>{const team=teams[i<12?i:23-i];return{number:i+1,round:i<12?1:2,team:team.id,player:rosters[team.id][i<12?0:1],seconds:38+i,pickedAt:new Date(now-60000).toISOString()}});\nconst base={id:'sample-season',number:1,name:'S1 · SAMPLE ONLY',status:mode==='draft'?'drafting':'regular',teams,rosters:mode==='draft'?Object.fromEntries(teams.map(t=>[t.id,rosters[t.id].slice(0,2)])):rosters,defaults,needsDefault:[],games:[],order:teams.map(t=>t.id),picks:mode==='draft'?draftPicks:[],draftAt:new Date(now-60000).toISOString(),lotteryAt:new Date(now-1260000).toISOString(),paused:false,pickStartedAt:new Date(now-47000).toISOString(),pickElapsed:0,baseDraftRounds:11,nextPick:{team:teams[0].id,round:3,cursor:24},tradingOpen:mode!=='draft',extensionsOpen:false,weekOne:'2026-10-18',transactions:[],pickAssets:teams.flatMap(t=>Array.from({length:11},(_,i)=>({id:t.id+'pick'+i,round:i+1,owner:t.id,originalTeam:t.id}))),starCoins:{balances:Object.fromEntries(teams.map(t=>[t.id,{available:55,reserved:0,spent:0,transfers:0}]))}};\nconst offer={id:'sample-offer',status:'pending',createdAt:new Date(now-300000).toISOString(),accepted:['team1'],body:{sender:'team1',teams:['team1','team2'],moves:[{kind:'player',from:'team1',to:'team2',id:10},{kind:'player',from:'team2',to:'team1',id:38},{kind:'coin',from:'team2',to:'team1',quantity:5}],note:'Would you swap King Boo and 5 Star Coins for Bowser?'}};\nfunction App(){const [notice,setNotice]=useState('');const mine=mode==='receive'?teams[1]:teams[0];const league={season:base,seasons:[base],myTeam:mine,access:{role:'gm',slot:mine.slot},now,busy:false,inbox:mode==='receive'?[offer]:[],notice,error:'',setSelected:()=>{},supabase:{storage:{from:()=>({getPublicUrl:()=>({data:{publicUrl:'/sluggers-supa-league-logo.svg'}})})}},act:async(op)=>{setNotice('Sample '+op+' submitted — no live data changed.');return true}};\nreturn <main className=\"container page-content\"><div className=\"page-heading\"><span className=\"eyebrow dark\">SAMPLE GM VIEW · NO LIVE DATA</span><h1>{mode==='draft'?'DRAFT ROOM':mode==='receive'?'MESSAGES':mode==='lineup'?'GAME LINEUP':'TRANSACTIONS'}</h1><p>{mine.name}</p></div>{notice&&<p role=\"status\" className=\"season-saved\">{notice}</p>}{mode==='draft'?<Draft league={league}/>:mode==='lineup'?<section className=\"panel season-box\"><LineupEditor league={league} team={mine.id}/></section>:<Trades league={league} messages={mode==='receive'}/>}</main>};\ncreateRoot(document.getElementById('root')).render(<App/>);\n")
let server,browser,page
const results=[],errors=[]
try {
 server=await createServer({configFile:false,root,base:'/',publicDir:path.join(root,'public'),server:{host:'127.0.0.1',port:4197,strictPort:true}})
 await server.listen()
 browser=await chromium.launch({headless:true})
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,serviceWorkers:'block'})
 await context.route('**/*',route=>{
  const url=route.request().url()
  if(url.includes('supabase.co'))return route.fulfill({status:200,contentType:'application/json',body:'[]'})
  if(url.startsWith('http://127.0.0.1:4197/'))return route.continue()
  return route.abort()
 })
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message))
 const fit=async(label)=>{
  const metrics=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth}))
  if(metrics.scroll>metrics.width+1||metrics.body>metrics.width+1){const offenders=await page.locator('body *').evaluateAll(nodes=>nodes.filter(n=>{const r=n.getBoundingClientRect();return r.width&&r.right>innerWidth+1&&getComputedStyle(n).position!=='absolute'}).slice(0,12).map(n=>({tag:n.tagName,class:n.className,text:n.textContent.slice(0,90),width:n.getBoundingClientRect().width,right:n.getBoundingClientRect().right})));throw Error(label+' overflows: '+JSON.stringify({metrics,offenders}))}
  results.push({view:label,...metrics})
 }
 const fillOffer=async()=>{
  await page.locator('.trade-participants > summary').click()
  await page.getByText('Yoshi’s Island Eggsplorers',{exact:true}).first().click()
  await page.locator('.trade-participants > summary').click()
  await page.getByLabel('From',{exact:true}).selectOption('team1')
  await page.getByLabel('To',{exact:true}).selectOption('team2')
  await page.getByLabel('Player',{exact:true}).selectOption('10')
  await page.getByRole('button',{name:'ADD TO OFFER',exact:true}).click()
  await page.getByLabel('From',{exact:true}).selectOption('team2')
  await page.getByLabel('To',{exact:true}).selectOption('team1')
  await page.getByLabel('Player',{exact:true}).selectOption('38')
  await page.getByRole('button',{name:'ADD TO OFFER',exact:true}).click()
  await page.getByLabel('Asset',{exact:true}).selectOption('coin')
  await page.getByRole('spinbutton').fill('5')
  await page.getByRole('button',{name:'ADD TO OFFER',exact:true}).click()
  await page.getByLabel('Note',{exact:true}).fill('Would you swap King Boo and 5 Star Coins for Bowser?')
 }
 for(const width of [320,360,390,430,768,1280]){
  await page.setViewportSize({width,height:900})
  for(const mode of ['draft','propose','receive','lineup']){
   await page.goto('http://127.0.0.1:4197/.mobile-preview/?mode='+mode,{waitUntil:'networkidle'})
   await page.getByRole('heading',{name:mode==='draft'?'DRAFT ROOM':mode==='receive'?'MESSAGES':mode==='lineup'?'GAME LINEUP':'TRANSACTIONS',exact:true}).waitFor()
   if(mode==='draft')await page.getByLabel('Draft player',{exact:true}).selectOption({index:1})
   if(mode==='propose')await fillOffer()
   await fit(mode+'-'+width)
   if(width<=430){
    const controls=await page.locator('select,input:not([type=checkbox]),textarea').evaluateAll(nodes=>nodes.filter(n=>n.getBoundingClientRect().width>0).map(n=>({font:parseFloat(getComputedStyle(n).fontSize),height:n.getBoundingClientRect().height})))
    assert(controls.every(c=>c.font>=16&&c.height>=43),'Small phone controls: '+mode+' '+width)
   }
   if([390,1280].includes(width)&&mode!=='lineup')await page.screenshot({path:path.join(output,mode+'-'+(width===390?'phone':'desktop')+'.png'),fullPage:true,animations:'disabled'})
   if(width===390&&mode==='propose'){
    await page.getByRole('button',{name:'SUBMIT TRADE OFFER',exact:true}).click()
    await page.getByRole('status').filter({hasText:'Sample submit_trade submitted'}).waitFor()
   }
   if(width===390&&mode==='receive'){
    await page.getByRole('button',{name:'ACCEPT EXACT OFFER',exact:true}).click()
    await page.getByRole('status').filter({hasText:'Sample accept_trade submitted'}).waitFor()
    await page.getByRole('button',{name:'COUNTER',exact:true}).click()
    await page.getByRole('button',{name:'SUBMIT COUNTEROFFER',exact:true}).waitFor()
   }
   if(width===390&&mode==='draft'){
    await page.getByRole('button',{name:'SUBMIT PICK',exact:true}).click()
    await page.getByRole('status').filter({hasText:'Sample pick submitted'}).waitFor()
   }
  }
 }
 for(const width of [320,390,430]){
  await page.setViewportSize({width,height:844})
  await page.goto('http://127.0.0.1:4197/',{waitUntil:'networkidle'})
  await page.getByRole('button',{name:'Open menu',exact:true}).click()
  assert.equal(await page.getByRole('button',{name:'Close menu',exact:true}).getAttribute('aria-expanded'),'true')
  await fit('navigation-'+width)
  assert.equal(await page.getByRole('navigation').getByRole('button',{name:'Messages',exact:true}).count(),0)
  if(width===390)await page.screenshot({path:path.join(output,'navigation-phone.png'),fullPage:false,animations:'disabled'})
  await page.keyboard.press('Escape')
  await page.getByRole('button',{name:'Open menu',exact:true}).waitFor()
  await page.getByRole('button',{name:'Open menu',exact:true}).click()
  await page.getByRole('navigation').getByRole('button',{name:'Draft Room',exact:true}).click()
  await page.getByRole('button',{name:'Open menu',exact:true}).waitFor()
 }
 assert.deepEqual(errors,[],'Browser errors')
 await fs.writeFile(path.join(output,'mobile-checks.json'),JSON.stringify({sampleDataOnly:true,checks:results,errors},null,2))
 console.log('PASS: draft, outgoing/incoming trades, lineup and navigation at 320–1280px; phone control sizes; sample pick/trade actions; menu open/Escape/page selection; no live data writes.')
} catch(error) {
 if(page)await page.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});
 await fs.writeFile(path.join(output,'failure.txt'),String(error));
 throw error;
} finally {
 if(browser)await browser.close()
 if(server)await server.close()
 await fs.rm(copy,{force:true});await fs.rm(preview,{recursive:true,force:true})
}
