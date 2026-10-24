import assert from 'node:assert/strict'
import fs from 'node:fs'
export async function testLotteryStars(db) {
  await db.exec(fs.readFileSync('supabase/migrations/20261016191659_ssl_lottery_and_star_coins.sql','utf8'))
  await db.exec(fs.readFileSync('supabase/migrations/20261024140000_ssl_tiered_star_coins_60.sql','utf8'))
  await db.query(`select set_config('test.uid','11111111-1111-4111-8111-111111111111',false),set_config('test.access','{"role":"commissioner","slot":0}',false)`)
  const fixture=(await db.query('select * from league_private.ssl_season_states order by number limit 1')).rows[0],teams=fixture.state.teams
  const ranking=teams.map((t,i)=>({id:t.id,rank:i+1})),a=teams[0].id,b=teams[1].id,c=teams[2].id
  const draw=async rolls=>(await db.query('select league_private.ssl_lottery_order($1,$2,$3) r',[JSON.stringify(teams),JSON.stringify(ranking),JSON.stringify(rolls)])).rows[0].r
  for(const [n,id] of [[0,teams[11].id],[.54999,teams[11].id],[.55,teams[10].id],[.79999,teams[10].id],[.8,teams[9].id],[.94999,teams[9].id],[.95,teams[8].id],[.99999,teams[8].id]]) {
    const order=await draw([n,0,0,0]);assert.equal(order[0],id);assert.equal(new Set(order).size,12);assert.deepEqual(order.slice(4),teams.slice(0,8).reverse().map(t=>t.id))
  }
  const ids=(await db.query('select id from league_private.ssl_catalog order by id')).rows.map(p=>p.id),rosters=Object.fromEntries(teams.map((t,i)=>[t.id,ids.slice(i*11,i*11+11)])),pid=rosters[a][0]
  const positions=['P','C','1B','2B','3B','SS','LF','CF','RF'],lineup=t=>({starters:rosters[t].slice(0,9).map((player,i)=>({player,position:positions[i]})),bench:rosters[t].slice(9)})
  const makeGame=(n,away=a,home=b)=>({id:`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`,away,home,phase:'regular',startsAt:new Date(Date.now()+(n+1)*86400000).toISOString(),stage:'scheduled',lineups:{}})
  let state={status:'regular',teams,order:teams.map(t=>t.id),picks:[],rosters,defaults:Object.fromEntries(teams.map(t=>[t.id,lineup(t.id)])),needsDefault:[],games:[makeGame(1),makeGame(2),makeGame(3),makeGame(4)],schedulePublished:true,tradingOpen:true,paused:false}

  // Tier pricing: Bowser=3 and two cooldown games, Mario=2 and one, Baby Mario=1 and none.
  const trial=structuredClone(state)
  trial.games=state.games.map((g,i)=>({...g,starRequests:{[a]:[[10,1,8],[1,8],[10],[10,1]][i],[b]:[]}}))
  const trialView=(await db.query('select league_private.ssl_star_view($1) r',[JSON.stringify(trial)])).rows[0].r
  assert.equal(trialView.balances[a].allocation,60)
  assert.equal(trialView.games[trial.games[0].id][a].cost,6)
  assert.equal(trialView.games[trial.games[1].id][a].cost,5)
  assert.equal(trialView.games[trial.games[1].id][a].priceByPlayer['10'],7)
  assert.equal(trialView.games[trial.games[2].id][a].cost,5)
  assert.equal(trialView.games[trial.games[3].id][a].byPlayer['10'],7)
  assert.equal(trialView.games[trial.games[3].id][a].byPlayer['1'],2)
  const tierMap=(await db.query('select league_private.ssl_star_tiers() t')).rows[0].t
  for(const id of [10,3,38,39,57,59,60,61,62,63,143,28,53,54,145,164,162,11]) assert.equal(tierMap[id],3,'Tier 3 id '+id)
  for(const id of [1,22,23,24,49,50,52,146,147,142,171,172,178]) assert.equal(tierMap[id],2,'Tier 2 id '+id)
  for(const id of [8,9,16,21]) assert.equal(tierMap[id],1,'Tier 1 id '+id)
  const sid=(await db.query("insert into league_private.ssl_season_states(number,name,state) values(100,'Star test',$1) returning id",[JSON.stringify(state)])).rows[0].id
  const raw=async()=>(await db.query('select state from league_private.ssl_season_states where id=$1',[sid])).rows[0].state
  const save=async st=>db.query('update league_private.ssl_season_states set state=$1 where id=$2',[JSON.stringify(st),sid])
  const call=async(op,p={})=>(await db.query('select public.ssl_manage($1,$2,$3) r',[op,sid,JSON.stringify(p)])).rows[0].r
  const view=async()=>(await db.query('select public.ssl_seasons() r')).rows[0].r.find(s=>s.id===sid).starCoins
  const fail=async(fn,label)=>{let err;try{await fn()}catch(e){err=e}assert(err,label)}
  const game=state.games[0].id,second=state.games[1].id,third=state.games[2].id,fourth=state.games[3].id
  assert.equal((await view()).balances[a].available,60)
  await call('game_lineup',{team:a,game,lineup:lineup(a),stars:[pid]});assert.equal((await view()).balances[a].reserved,2)
  await call('game_lineup',{team:a,game:second,lineup:lineup(a),stars:[pid]});assert.equal((await view()).games[second][a].cost,4)
  await call('game_lineup',{team:a,game:fourth,lineup:lineup(a),stars:[pid]});assert.equal((await view()).games[fourth][a].cost,2)
  await call('game_lineup',{team:a,game:third,lineup:lineup(a),stars:[pid]});assert.equal((await view()).games[fourth][a].cost,4)
  await fail(()=>call('game_lineup',{team:a,game,lineup:lineup(a),stars:rosters[a].slice(0,4)}),'four starred players rejected')
  await fail(()=>call('game_lineup',{team:a,game,lineup:lineup(a),stars:[pid,pid]}),'duplicate starred player')
  await fail(()=>call('game_lineup',{team:a,game,lineup:lineup(a),stars:[rosters[c][0]]}),'unowned starred player')
  const report=(n,ta=a,tb=b)=>({fingerprint:String(n).repeat(64),filename:'stars.xlsx',players:[ta,tb].flatMap((team,k)=>rosters[team].slice(0,9).map((player,i)=>({player,team,positions:[positions[i]],stats:{runs:i===0?(k?1:2):0,hits:1,atBats:3}})))})
  await fail(()=>call('result',{game:second,report:report(2)}),'out of order upload rejected')
  await call('result',{game,report:report(1)});let v=await view();assert.equal(v.balances[a].spent,2);assert.equal(v.games[second][a].cost,4)
  assert((await raw()).games[0].starRecord)
  await call('result',{game,report:report(1)});assert.equal((await view()).balances[a].spent,2)
  await fail(()=>call('game_lineup',{team:a,game,lineup:lineup(a),stars:[] }),'locked stars immutable')
  await call('result',{game:second,report:report(2)});assert.equal((await view()).balances[a].spent,6)
  await call('cancel_game',{game:second});assert.equal((await view()).balances[a].spent,2)
  assert.equal((await view()).games[third][a].cost,4)
  // Swap an already-starred player into a new team without altering their recharge history.
  let st=await raw();const other=rosters[c][0];st.rosters[a]=st.rosters[a].map(p=>p===pid?other:p);st.rosters[c]=st.rosters[c].map(p=>p===other?pid:p)
  st.games.push(makeGame(5,c,b));await save(st);v=await view();assert(v.games[st.games.at(-1).id][c].recharging.includes(pid))
  // Unstarred games on the receiving team before acquisition do not reset history.
  assert.equal(v.recharging[pid],1)
  const simulated=structuredClone(st);simulated.games.at(-1).starRecord={sequence:3,teams:{[c]:{selected:[],cost:0},[b]:{selected:[],cost:0}}};simulated.games.at(-1).stage='recorded';simulated.games.at(-1).frozenRosters={[c]:simulated.rosters[c],[b]:simulated.rosters[b]};
  const cleared=(await db.query('select league_private.ssl_star_view($1) r',[JSON.stringify(simulated)])).rows[0].r;assert.equal(cleared.recharging[pid],0)
  // Exhausted budgets reject atomically without saving an unaffordable reservation.
  st=await raw();st.starTransfers=[{from:a,to:b,quantity:58}];st.games=st.games.filter(g=>g.starRecord);await save(st)
  const next=makeGame(6);st.games.push(next);await save(st)
  await fail(()=>call('game_lineup',{team:a,game:next.id,lineup:{starters:st.rosters[a].slice(0,9).map((player,i)=>({player,position:positions[i]})),bench:st.rosters[a].slice(9)},stars:[other]}),'spent coins cannot be reserved twice')
  assert.equal((await raw()).games.at(-1).starRequests,undefined)
  // Coin-only trades go through unanimous acceptance and commissioner approval.
  st=await raw();st.starTransfers=[];st.games=[];await save(st)
  await db.query('insert into league_private.ssl_pick_assets(season_number,original_team,round,owner) select 101,id,i,id from league_private.ssl_franchises cross join generate_series(1,11)i on conflict do nothing')
  await call('submit_trade',{team:a,teams:[a,b],moves:[{kind:'coin',from:a,to:b,quantity:5}]})
  const offer=(await db.query('select id from league_private.ssl_offers where season=$1 order by created_at desc limit 1',[sid])).rows[0].id
  await fail(()=>call('approve_trade',{offer}),'unaccepted coin trade')
  await call('accept_trade',{team:b,offer});await call('approve_trade',{offer});v=await view();assert.equal(v.balances[a].available,55);assert.equal(v.balances[b].available,65)
  await fail(()=>call('submit_trade',{team:a,teams:[a,b],moves:[{kind:'coin',from:a,to:b,quantity:56}]}),'unavailable coin offer')
  await fail(()=>call('submit_trade',{team:a,teams:[a,b],moves:[{kind:'coin',from:a,to:b,quantity:1.5}]}),'fractional coins')
  await call('submit_trade',{team:a,teams:[a,b],moves:[{kind:'coin',from:a,to:b,quantity:55}]})
  const stale=(await db.query('select id from league_private.ssl_offers where season=$1 order by created_at desc limit 1',[sid])).rows[0].id
  st=await raw();const later=makeGame(7);st.games=[later];await save(st)
  const changedLineup={starters:st.rosters[a].slice(0,9).map((player,i)=>({player,position:positions[i]})),bench:st.rosters[a].slice(9)}
  await call('game_lineup',{team:a,game:later.id,lineup:changedLineup,stars:[st.rosters[a][0]]})
  await call('accept_trade',{team:b,offer:stale});await fail(()=>call('approve_trade',{offer:stale}),'approval rechecks coins reserved after offer')
  assert.equal((await view()).balances[a].available,53)
  assert.equal((await db.query('select status from league_private.ssl_offers where id=$1',[stale])).rows[0].status,'ready')
  st=await raw();st.champion=a;await save(st);assert.equal((await view()).balances[b].available,0)
  await fail(()=>call('submit_trade',{team:a,teams:[a,b],moves:[{kind:'coin',from:a,to:b,quantity:1}]}),'expired coin trade')
  // A completely separate season receives fresh balances and no old recharge.
  const fresh=(await db.query('select league_private.ssl_star_view($1) r',[JSON.stringify({...state,games:[]})])).rows[0].r;assert.equal(fresh.balances[a].available,60);assert.deepEqual(fresh.recharging,{})
  const current=await raw()
  await db.query("insert into league_private.ssl_season_states(number,name,state) values(99,'Previous lottery fixture',$1)",[JSON.stringify({...state,status:'archived',finalStandings:ranking})])
  await save({...state,status:'scheduled',draftAt:new Date(Date.now()-1000).toISOString(),lotteryAt:new Date(Date.now()-1200000).toISOString(),order:[]})
  await db.query('select public.ssl_seasons()');const first=(await raw()).order
  assert.equal(first.length,12);assert.deepEqual(first.slice(4),teams.slice(0,8).reverse().map(t=>t.id))
  await db.query('select public.ssl_seasons()');assert.deepEqual((await raw()).order,first)
  assert.equal((await db.query("select count(*)::int n from league_private.ssl_actions where season=$1 and operation='lottery'",[sid])).rows[0].n,1)
  await save(current)
  await db.query(`select set_config('test.access','{"role":"participant"}',false)`)

  await fail(()=>call('game_lineup',{team:a,game,lineup:lineup(a),stars:[] }),'viewer write')
  await db.exec('set role anon');await fail(()=>db.query('select league_private.ssl_star_view($1)',[JSON.stringify(state)]),'private helper denied');await db.query('select public.ssl_seasons()');await db.exec('reset role')
  console.log('PASS: weighted lottery boundaries/no repeats/reverse seeds, reservations/repricing/cap/ownership, recharge across trades, atomic spending/corrections/refunds, coin trade approval/budget/expiry, fresh seasons and role isolation.')
}
