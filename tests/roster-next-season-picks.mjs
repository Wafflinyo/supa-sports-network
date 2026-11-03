import assert from 'node:assert/strict';
import fs from 'node:fs';
import {nextSeasonPickSummary} from '../src/next-season-roster-picks.js';

const season={
  id:'season-1',number:1,tradePickSeason:2,
  teams:[
    {id:'a',name:'Delfino Dolphins'},
    {id:'b',name:'Petalburg Petilils'},
    {id:'c',name:'New Donk City Knights'},
  ],
  pickAssets:[
    {id:'a-r1',owner:'a',originalTeam:'a',round:1},
    {id:'a-r3',owner:'b',originalTeam:'a',round:3},
    {id:'b-r2',owner:'a',originalTeam:'b',round:2},
    {id:'c-r4',owner:'c',originalTeam:'c',round:4},
    {id:'b-r1',owner:'b',originalTeam:'b',round:1},
    {id:'a-r2',owner:'a',originalTeam:'a',round:2},
  ],
};
const dolphins=nextSeasonPickSummary(season,'a');
assert.equal(dolphins.available,true);
assert.equal(dolphins.nextSeason,2);
assert.deepEqual(dolphins.owned.map(p=>p.id),['a-r1','a-r2','b-r2'],
  'Current owner, not original franchise, determines which picks are in the list');
assert.equal(dolphins.owned[2].originName,'Petalburg Petilils');
assert.equal(dolphins.owned[2].acquired,true);
assert.equal(dolphins.owned[0].acquired,false);
assert.deepEqual(dolphins.tradedAway.map(p=>p.id),['a-r3']);
assert.equal(dolphins.tradedAway[0].currentOwnerName,'Petalburg Petilils');

const petilils=nextSeasonPickSummary(season,'b');
assert.deepEqual(petilils.owned.map(p=>p.id),['b-r1','a-r3']);
assert.equal(petilils.owned[1].originName,'Delfino Dolphins');
assert.deepEqual(petilils.tradedAway.map(p=>p.id),['b-r2']);
assert.equal(petilils.tradedAway[0].currentOwnerName,'Delfino Dolphins');
const knights=nextSeasonPickSummary(season,'c');
assert.deepEqual(knights.owned.map(p=>p.id),['c-r4']);
assert.equal(knights.tradedAway.length,0);

// No assets should ever be invented to fill missing rounds or a Stadium pick.
const empty=nextSeasonPickSummary({...season,pickAssets:[]},'a');
assert.equal(empty.available,true);
assert.equal(empty.owned.length,0);
assert.equal(empty.tradedAway.length,0);
const unpublished=nextSeasonPickSummary({...season,pickAssets:undefined},'a');
assert.equal(unpublished.available,false);
assert.equal(unpublished.owned.length,0,'Unpublished holdings must not be presented as made-up picks');
assert.equal(nextSeasonPickSummary({...season,tradePickSeason:null,number:3},'b').nextSeason,4);

const roster=fs.readFileSync('src/SeasonLeague.jsx','utf8');
const component=roster.slice(roster.indexOf('export function RosterManager('),roster.indexOf('\nfunction MyTeam('));
const ui=fs.readFileSync('src/NextSeasonDraftPicks.jsx','utf8');
const css=fs.readFileSync('src/season.css','utf8');
assert(component.indexOf('<Box title="NEXT SEASON DRAFT PICKS">')>component.indexOf('id="ssl-roster-players"'),
  'Pick holdings must appear beneath the selected team roster');
assert(component.indexOf('<Box title="NEXT SEASON DRAFT PICKS">')<component.indexOf('id="ssl-default-lineup"'),
  'Pick holdings must appear before the default lineup editor');
assert.match(component,/teamId=\{team\}/,'GM picks default to own franchise; commissioner to selected roster team');
assert.match(roster,/section==='Roster'&&<RosterManager/,'Same roster component used by GM and Commissioner Tools');
assert.match(ui,/View picks for/,'GMs must inspect other teams without beginning a trade');
assert.match(ui,/currentOwnerName/,'Outgoing picks should show the new owner');
assert.match(ui,/originName/,'Acquired picks must identify the original owner');
assert.match(ui,/STADIUM PICKS|Stadium Picks/,'Clarify Stadium Pick allocation rules');
assert.match(css,/\.ssl-future-picks-grid/,'Pick layout must be responsive');
assert(!ui.includes('l.act(')&&!ui.includes('submit_trade'),
  'Picker must remain a read-only inspection panel');
console.log('PASS: GM/Commissioner roster tab shows next-season picks between roster and defaults, accurate trade ownership and team comparison');
