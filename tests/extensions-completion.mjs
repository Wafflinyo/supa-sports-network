import assert from 'node:assert/strict'
import fs from 'node:fs'
export async function testExtensionCompletion(db) {
 await db.exec(fs.readFileSync('supabase/migrations/20261016191844_ssl_extension_window_completion.sql','utf8'))
 await db.query(`select set_config('test.uid','11111111-1111-4111-8111-111111111111',false),set_config('test.access','{"role":"commissioner","slot":0}',false)`)
 const row=(await db.query('select * from league_private.ssl_season_states where number=100')).rows[0],sid=row.id,teams=row.state.teams,t=teams[11].id,p=row.state.rosters[t][0]
 const call=async(op,payload={})=>(await db.query('select public.ssl_manage($1,$2,$3) r',[op,sid,JSON.stringify(payload)])).rows[0].r
 const raw=async()=>(await db.query('select state from league_private.ssl_season_states where id=$1',[sid])).rows[0].state
 const save=async st=>db.query('update league_private.ssl_season_states set state=$1 where id=$2',[JSON.stringify(st),sid])
 const fail=async fn=>{let err;try{await fn()}catch(e){err=e}assert(err)}
 let st={...row.state,status:'regular',extensionsOpen:false,champion:undefined,tradeDeadlineAt:new Date(Date.now()-1000).toISOString()};await save(st)
 await db.query('update league_private.ssl_franchises set tokens=0');await db.query('select league_private.ssl_tick($1)',[sid]);assert.equal((await raw()).extensionsOpen,false)
 await fail(()=>call('extension',{team:t,player:p}))
 st={...await raw(),status:'retention',extensionsOpen:true,champion:teams[0].id,finalStandings:teams.map((t,i)=>({id:t.id,rank:i+1})),championshipEndedAt:new Date(Date.now()-20*86400000).toISOString(),extensionClosesAt:new Date(Date.now()+10*86400000).toISOString()};await save(st)
 await db.query('update league_private.ssl_franchises set tokens=3')
 await db.query('select league_private.ssl_tick($1)',[sid]);assert.equal((await raw()).status,'retention','window must not close at the old 14-day deadline')
 await db.query('insert into league_private.ssl_extension_history(franchise,player,accepted) values($1,$2,5) on conflict(franchise,player) do update set accepted=5',[t,p])
 const preview=async()=>(await db.query('select public.ssl_extension_preview($1,$2,$3) r',[sid,t,p])).rows[0].r
 for(let i=0;i<3;i++) {const q=await preview();assert.equal(q.total,0);const r=await call('extension',{team:t,player:p,quoteFingerprint:q.fingerprint});assert.equal(r.accepted,false);assert.equal(r.remaining,2-i)}
 assert.equal((await db.query('select count(*)::int n from league_private.ssl_extension_offers where season=$1 and franchise=$2 and player=$3',[sid,t,p])).rows[0].n,3)
 assert.equal((await db.query('select accepted from league_private.ssl_extension_history where franchise=$1 and player=$2',[t,p])).rows[0].accepted,5)
 await fail(async()=>call('extension',{team:t,player:p,quoteFingerprint:(await preview()).fingerprint}))
 for(const team of teams.slice(0,11)) await call('void_extensions',{team:team.id})
 assert.equal((await raw()).status,'offseason');assert.equal((await raw()).tradingOpen,true)
 assert.equal((await db.query('select sum(tokens)::int n from league_private.ssl_franchises')).rows[0].n,0)
 st={...st,status:'retention',extensionsOpen:true,extensionClosesAt:new Date(Date.now()-1).toISOString()};await save(st);await db.query('update league_private.ssl_franchises set tokens=3')
 await db.query('select league_private.ssl_tick($1)',[sid]);assert.equal((await raw()).status,'offseason');assert.equal((await db.query('select sum(tokens)::int n from league_private.ssl_franchises')).rows[0].n,0)
 // A GM cannot void another franchise by forging the team argument.
 st={...st,status:'retention',extensionClosesAt:new Date(Date.now()+86400000).toISOString()};await save(st);await db.query('update league_private.ssl_franchises set tokens=3')
 await db.query(`select set_config('test.access',$1,false)`,[JSON.stringify({role:'gm',slot:teams[0].slot})]);await call('void_extensions',{team:t})
 assert.equal((await db.query('select tokens from league_private.ssl_franchises where id=$1',[teams[0].id])).rows[0].tokens,0)
 assert.equal((await db.query('select tokens from league_private.ssl_franchises where id=$1',[t])).rows[0].tokens,3)
 console.log('PASS: post-championship-only extensions, full month, repeated rejected offers/consumption/history, early void completion, automatic expiry and GM isolation.')
}
