import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DRAFT_STAGES} from '../src/draft-stages.js';
import {ownedStadium,stadiumOwnership,availableStadiums,stadiumDraftState} from '../src/draft-stadium-state.js';

const season = {
  status:'drafting',paused:false,teams:[{id:'a',name:'Knights'},{id:'b',name:'Dedennes'},{id:'c',name:'Shy Guys'}],
  nextPick:{team:'b',supplemental:false,stageAlreadyChosen:false,mustStage:false},
  picks:[],retainedStadiums:{},
};
assert.equal(DRAFT_STAGES.length,13);
assert.equal(availableStadiums(season).length,13);
assert.equal(stadiumDraftState(season,'b',true).eligible,true);
assert.equal(stadiumDraftState(season,'a',false).eligible,false);
assert.equal(ownedStadium(season,'a'),null);

season.picks.push({team:'a',kind:'stage',stage:'Mario Stadium',number:7});
assert.deepEqual(ownedStadium(season,'a'),{name:'Mario Stadium',source:'drafted',pick:7});
assert(!availableStadiums(season).includes('Mario Stadium'));
assert.equal(availableStadiums(season).length,12);
assert.equal(stadiumOwnership(season).get('Mario Stadium').teamId,'a');
assert.equal(stadiumDraftState(season,'b',true).available.includes('Mario Stadium'),false,
  'other GMs must NOT see drafted Stadiums');
assert.equal(stadiumDraftState(season,'a',false).owned.name,'Mario Stadium',
  'GM sees only their own Stadium after picking');

season.picks.push({team:'b',kind:'player',player:100,number:8});
assert.equal(availableStadiums(season).length,12,
  'player picks do not affect Stadium availability');
season.picks.push({team:'b',kind:'stage',stage:'Toy Field',number:9});
assert(!availableStadiums(season).includes('Toy Field'));
assert.equal(stadiumDraftState(season,'b',true).eligible,false,
  'only one Stadium selection per team');
assert.equal(availableStadiums(season).length,11);

season.retainedStadiums={c:['Wii Sports Stadium']};
assert(!availableStadiums(season).includes('Wii Sports Stadium'),
  'Stadiums retained from past season must be exclusive too');
assert.equal(ownedStadium(season,'c').name,'Wii Sports Stadium');
assert.equal(stadiumDraftState(season,'c',false).owned.source,'retained');
assert.equal(availableStadiums(season).length,10);

season.nextPick={team:'d',supplemental:false,stageAlreadyChosen:false,mustStage:true};
assert.equal(stadiumDraftState(season,'d',true).mandatory,true);
assert.equal(stadiumDraftState(season,'d',true).eligible,true);
season.nextPick.supplemental=true;
assert.equal(stadiumDraftState(season,'d',true).eligible,false);
season.nextPick.supplemental=false;
season.nextPick.stadiumRetained=true;
assert.equal(stadiumDraftState(season,'d',true).eligible,false);
season.nextPick.stadiumRetained=false;
season.paused=true;
assert.equal(stadiumDraftState(season,'d',true).eligible,false);
season.paused=false;

season.picks=season.picks.filter(p=>p.stage!=='Mario Stadium');
assert(availableStadiums(season).includes('Mario Stadium'),
  'undoing an official Stadium pick returns the Stadium to the pool');

const draftUi=readFileSync(new URL('../src/DraftPlayers.jsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/draft-players.css',import.meta.url),'utf8');
assert(draftUi.includes('PLAYERS')&&draftUi.includes('STADIUMS'),
  'Players and Stadiums must be separate draft tabs');
assert(draftUi.includes("myStadium?<>")||draftUi.includes("myStadium?<>"),
  'owned Stadium mode must replace the available list');
assert(draftUi.includes("availableStadiums.map(stage=>"),
  'other GMs only see currently unclaimed Stadiums');
assert(draftUi.includes("l.act('pick_stage',{stage:selectedStadium})"),
  'Stadium cards must submit an official pick');
assert(draftUi.includes('disabled={!canDraftStadium||!selectedStadium||l.busy}'));
assert(css.includes('.draft-stadium-panel[hidden]'),
  'inactive Stadiums tab must be completely hidden');
const migration=readFileSync(new URL('../supabase/migrations/20261026184500_ssl_exclusive_stadium_draft.sql',import.meta.url),'utf8');
assert(migration.includes('league_private.ssl_stadium_claimed(st, payload->>\'stage\')'),
  'server must independently reject an unavailable Stadium');
assert(migration.includes('jsonb_each(')&&migration.includes("st->'picks'"),
  'both draft picks and retained Stadiums must be checked');
console.log('PASS: exclusive 13-Stadium draft; retained Stadiums; no duplicate view or pick; chosen-only owner tab; undo; server protection');
