import assert from 'node:assert/strict';
import {unseenAchievements,noticesForBadges,isValidGmSlot} from '../src/gm-achievement-notice-utils.js';
import {GM_ACHIEVEMENTS,earnedAchievements} from '../src/gm-achievements.js';
import {readFileSync} from 'node:fs';

const alice='00000000-0000-4000-8000-000000000001';
const bob='00000000-0000-4000-8000-000000000002';
const rewards=[
  {id:'winning-1',name:'First Dub',earned:true},
  {id:'game-homer-1',name:'Going Yard',earned:true},
  {id:'player-putouts-5',name:'Glove Work',earned:false},
];
assert.deepEqual(unseenAchievements(rewards,[]).map(b=>b.id),
  ['winning-1','game-homer-1'],'pending alerts must include all newly earned awards');
assert.deepEqual(unseenAchievements(rewards,['winning-1']).map(b=>b.id),
  ['game-homer-1'],'previously acknowledged alerts never repeat');
assert.deepEqual(unseenAchievements(rewards,['winning-1','game-homer-1']),[],
  'none repeat after acknowledgement');
assert.equal(unseenAchievements(rewards,['player-putouts-5']).length,2,
  'an unearned badge must never be presented as a win');
assert.deepEqual(noticesForBadges(alice,rewards.slice(0,2)),[
  {user_id:alice,badge_id:'winning-1'},
  {user_id:alice,badge_id:'game-homer-1'}]);
assert.deepEqual(noticesForBadges(bob,rewards.slice(0,1)),[
  {user_id:bob,badge_id:'winning-1'}]);
assert.deepEqual(noticesForBadges(null,rewards),[],'no guest acknowledgement');
for(const invalid of ['',null,undefined,'oops',-1,0,1.5])assert(!isValidGmSlot(invalid));
for(const valid of ['1',1,2,12])assert(isValidGmSlot(valid));

// Real awards, not arbitrary client flags, produce the notifications.
assert.equal(GM_ACHIEVEMENTS.length,92);
const season={id:'s1',number:1,name:'Season 1',
  teams:[{id:'team-a',slot:1,name:'Alpha'},{id:'team-b',slot:2,name:'Beta'}],
  games:[{id:'g1',stage:'final',phase:'regular',home:'team-a',away:'team-b',
    result:{scores:{'team-a':4,'team-b':1},players:[{
      player:12,team:'team-a',stats:{homeRuns:1,oneHr:1,putouts:5}},
      {player:14,team:'team-b',stats:{}}]}}]};
const actual=earnedAchievements([season],1);
const pending=unseenAchievements(actual,[]);
assert(pending.some(b=>b.id==='winning-1'));
assert(pending.some(b=>b.id==='game-homer-1'));
assert(pending.some(b=>b.id==='player-putouts-5'));
assert(!unseenAchievements(earnedAchievements([season],2),[])
 .some(b=>b.id==='winning-1'),'opponent team must not receive the winner notification');
assert.equal(unseenAchievements(actual,pending.map(b=>b.id)).length,0,
  'the same GM does not get previously acknowledged badges on returning');

const client=readFileSync(new URL('../src/GmAchievementNotifications.jsx',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
const sql=readFileSync(new URL('../supabase/migrations/20261026171500_ssl_gm_achievement_notices.sql',import.meta.url),'utf8');
assert(client.includes("supabase.from(TABLE).upsert("),'backend acknowledgement must persist across devices');
assert(client.includes("window.addEventListener('focus',resume)") &&
  client.includes("document.addEventListener('visibilitychange',resume)"),
  'the returning GM needs catch-up without a new sign-in');
assert(client.includes("onViewAchievements?.()"),'popup links to the GM trophy case');
assert(app.includes("{isGM&&Number.isFinite(Number(access.slot))&&"),
  'notifications belong only to signed-in GMs');
assert(sql.includes("enable row level security"));
assert(sql.includes("auth.uid()) = user_id"),'another GM must not see or ack user notifications');
assert(!sql.includes('grant update')&&!sql.includes('grant delete'),
  'the client should only record notices, not mutate or delete other data');

console.log('PASS: authenticated GM login/resume notices, batch awards, one-time persisted acknowledgement, cross-user isolation and 92 real achievements');
