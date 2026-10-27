import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const data=JSON.parse(read('src/player-data.json'));
const players=JSON.parse(read('src/players.json'));
const records=data.players;
const miis=players.filter(p=>p.kind==='mii');
const characters=players.filter(p=>p.kind==='character');
assert.equal(miis.length,70,'existing Wii Mii roster unchanged');
assert.equal(characters.length,111,'all other characters preserved');
assert(miis.every(p=>records[p.id]?.stats?.['hit trajectory']==='Low'),
  'all seventy named Miis must show Low trajectory in live draft and scouting');
assert.equal(records[1].stats['hit trajectory'],'Medium',
  'non-Mii trajectories must not be globally overridden');
assert.equal(records[145].stats['hit trajectory'],'High',
  'Ice Bro trajectory and every other stat stay unchanged');
const ice=players.find(p=>p.name==='Ice Bro');
assert.equal(ice.id,145);
const hisRecord=records[ice.id];
const lightBlue=miis.filter(p=>p.color==='Light Blue');
const green=miis.filter(p=>p.color==='Green');
assert.equal(lightBlue.length,6);
assert.equal(green.length,6);
assert.deepEqual(lightBlue.map(p=>p.name).sort(),
  ['Frozone','Mr. Beast','Sans','Wendy','Lois G','Katara'].sort());
for(const p of miis) {
 const shouldBeGood=p.color==='Light Blue';
 assert.equal(hisRecord.goodChemistryIds.includes(p.id),shouldBeGood,
   'Ice Bro must only link Light Blue Mii, not '+p.name);
 assert.equal(records[p.id].goodChemistryIds.includes(ice.id),shouldBeGood,
   'reciprocal Ice Bro chemistry must agree for '+p.name);
 assert.equal(hisRecord.badChemistryIds.includes(p.id),false,
   'change only good Mii chemistry, not introduce bad chemistry');
}
const oldDisplayed=['displayed batting','displayed pitching','displayed fielding','displayed speed'];
assert(oldDisplayed.every(key=>Object.hasOwn(records[1].stats,key)),
  'keep original rating numbers in data; P2P logic still needs them');
const ui=read('src/PlayerData.jsx');
const draft=read('src/DraftPlayers.jsx');
const team=read('src/MyDraftTeam.jsx');
const priority=read('src/player-roles.js');
const priorityLabel=read('src/PlayerPriority.jsx');
assert(ui.includes("'Overview': ['hit trajectory','pitching stamina'"));
for(const key of oldDisplayed)
  assert(!ui.includes("'"+key+"'"),'display ratings must not be rendered in shared UI: '+key);
assert(draft.includes("['hit trajectory']")&&draft.includes('draft-player-stats-traj'),
  'Draft Room card itself shows hit trajectory before selection');
assert(draft.includes('<PlayerDataDetails player={selected} seasons={l.seasons}/>'),
  'selected draft player modal inherits cleaned-up rating-free details');
assert(team.includes("['hit trajectory']")&&team.includes('my-draft-team-trajectory'),
  'GM My Team roster cards show accurate hit trajectory');
assert(team.includes('<PlayerDataDetails player={active} seasons={l.seasons}/>'),
  'GM My Team details share rating-free player view');
assert(priority.includes("record?.stats?.['displayed pitching']"),
  'P2P eligibility must still use actual underlying pitching rating');
assert(priorityLabel.includes('pitcherPriorityFor(player, gameData.players[player.id])'),
  'P1P/P2P badges stay visible without exposing numeric ratings');
assert(draft.includes("l.act('pick',{player:selected.id})")&&
  draft.includes("l.act('pick_stage',{stage:selectedStadium})"),
  'unchanged actual draft pick actions');
assert(draft.includes("l.access.role==='commissioner'||(l.access.role==='gm'&&l.myTeam?.id===owner)"),
  'original on-clock GM and commissioner pick restrictions remain unchanged');
console.log('PASS: all 70 Miis Low, Ice Bro Mii chemistry symmetric Light Blue only, hidden displayed ratings, draft scouting & pick authorization preserved');
