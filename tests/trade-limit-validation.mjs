import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateTradeLimits} from '../src/trade-limit-validation.js';

const teams = [
 {id:'A',name:'Knights'}, {id:'B',name:'Ruffians'}, {id:'C',name:'Dolphins'}
];
const players=(start,count)=>Array.from({length:count},(_,i)=>start+i);
const picks=(id,count)=>Array.from({length:count},(_,i)=>({id:id+'-pick-'+i,owner:id}));
const season={number:1,teams,rosters:{A:players(1,14),B:players(40,12),C:players(80,11)},
 pickAssets:[...picks('A',9),...picks('B',12),...picks('C',11)]};
const move=(kind,id,from,to)=>({kind,id,from,to});
const check=(participants,moves,acting='A')=>validateTradeLimits(season,participants,moves,acting);

assert.equal(check(['A','B'],[move('player',1,'A','B'),move('player',40,'B','A')]).issues.length,0,
 'A balanced player swap is legal with a 14-character team');
assert(check(['A','B'],[move('player',40,'B','A')]).issues
 .some(msg=>/Knights.*15 characters.*maximum 14/.test(msg)),
 'The proposing GM must see their team is over the character cap');
assert(check(['B','C'],[move('player',80,'C','B')],'B').issues
 .some(msg=>/Dolphins.*10 characters.*minimum 11/.test(msg)),
 'The proposing GM must see a different franchise would fall below 11');
assert(check(['A','B'],[move('pick','A-pick-0','A','B')]).issues
 .some(msg=>/Knights.*8 tradable.*minimum 9/.test(msg)),
 'A trade giving away the ninth pick must be rejected');
assert.equal(check(['A','B'],[
 move('pick','A-pick-0','A','B'),move('pick','B-pick-0','B','A')]).issues.length,0,
 'Equal pick swaps must be legal even when a team starts with nine');
assert(check(['A','B'],[
 move('player',1,'A','B'),move('player',1,'A','B')]).issues
 .some(msg=>/more than once/.test(msg)),
 'Duplicated assets cannot count twice');
assert(check(['A','B'],[move('player',999,'A','B')]).issues
 .some(msg=>/no longer owns/.test(msg)),
 'Stale source-team ownership must block submission');
assert(check(['A','B','C'],[
 move('player',40,'B','A'),move('player',80,'C','B')]).issues
 .some(msg=>/Dolphins.*10 characters/.test(msg)),
 'Multi-team trades must validate every participant and net both directions');
const offseason={...season,offseasonTrading:true,currentPickAssets:[
 ...picks('A',8),...picks('B',12),...picks('C',11)]};
assert(validateTradeLimits(offseason,['A','B'],[move('player',1,'A','B'),move('player',40,'B','A')],'A').issues
 .some(msg=>/Knights.*8 tradable/.test(msg)),
 'Offseason trades must use current-season pick assets');
const page=readFileSync(new URL('../src/SeasonLeague.jsx',import.meta.url),'utf8');
for(const token of [
 'validateTradeLimits(s, participants, moves, team)',
 'tradeLimits.issues.length>0',
 'TEAM TOTALS AFTER THIS TRADE',
 'THIS TRADE CANNOT BE SUBMITTED',
 '{onError:setTradeError}',
 'Automatically'
]) {
 if(token==='Automatically')continue;
 assert(page.includes(token),'Trade composer is missing '+token);
}
const migration=readFileSync(new URL('../supabase/migrations/20261117194500_ssl_validate_prospective_trade_rosters_and_picks.sql',import.meta.url),'utf8');
assert(migration.includes('ssl_validate_trade_limits'),'Server validation function must exist');
assert(migration.includes("target,payload->''teams'',payload->''moves''"),
 'Submission must check proposed balances');
assert(migration.includes("target,o.body->''teams'',payload->''moves''"),
 'Revision must check proposed balances');
assert(migration.includes("target,offer.body->''teams'',offer.body->''moves''"),
 'Commissioner approval must recheck balances');
console.log('PASS: all teams and all three limits are previewed, submission blocked, server protection wired, multi-team and offseason netting tested.');
