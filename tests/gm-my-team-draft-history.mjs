import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {originalPlayerDraft,teamDraftedPlayers,sslCareerTenure} from '../src/draft-pedigree.js';

const player1=1,player2=2;
const season1={
 id:'s1',number:1,status:'drafting',
 teams:[{id:'knights',name:'New Donk City Knights'},{id:'dedennes',name:'Decalburg Dedennes'}],
 picks:[
  {number:1,round:1,kind:'player',player:player1,team:'knights'},
  {number:2,round:1,kind:'stage',stage:'Mario Stadium',team:'dedennes'},
  {number:25,round:3,kind:'player',player:player2,team:'knights',supplemental:true}
 ],
 rosters:{knights:[1,2],dedennes:[]},
 games:[{stage:'final',result:{players:[{player:1,team:'knights'}]}}]
};
assert.deepEqual(originalPlayerDraft(1,[season1]),
 {season:1,round:1,number:1,team:'knights',supplemental:false});
assert.deepEqual(originalPlayerDraft(2,[season1]),
 {season:1,round:3,number:25,team:'knights',supplemental:true});
assert.equal(originalPlayerDraft(99,[season1]),null,'free agents have no invented pick');
assert.equal(originalPlayerDraft(NaN,[season1]),null);
assert.equal(teamDraftedPlayers(season1,'knights').length,2);
assert.equal(teamDraftedPlayers(season1,'dedennes').length,0);
assert.equal(sslCareerTenure(1,[season1]),'ROOKIE',
 'every SSL Season 1 player is rookie even after an official match');
assert.equal(sslCareerTenure(2,[season1]),'ROOKIE');
assert.equal(sslCareerTenure(123,[season1]),'ROOKIE','all Season 1 characters rookies');
season1.rosters.knights=[2];season1.rosters.dedennes=[1];
assert.equal(originalPlayerDraft(1,[season1]).team,'knights',
 'a trade cannot rewrite the original drafting franchise');
assert.equal(teamDraftedPlayers(season1,'dedennes')[0].draft.number,1,
 'pick number travels with drafted player on new team roster');
const season2={id:'s2',number:2,status:'regular',picks:[],
 rosters:{dedennes:[1],knights:[]},games:[]};
assert.equal(originalPlayerDraft(1,[season2,season1]).number,1);
assert.equal(sslCareerTenure(1,[season2,season1]),'2 YEARS',
 'returning player is no longer rookie after SSL Season 1');
assert.equal(sslCareerTenure(123,[season2,season1]),'ROOKIE',
 'unseasoned newcomer remains a rookie in a future SSL season');

const main=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
const draft=readFileSync(new URL('../src/DraftPlayers.jsx',import.meta.url),'utf8');
const profile=readFileSync(new URL('../src/PlayerProfile.jsx',import.meta.url),'utf8');
const playerData=readFileSync(new URL('../src/PlayerData.jsx',import.meta.url),'utf8');
const season=readFileSync(new URL('../src/SeasonLeague.jsx',import.meta.url),'utf8');
const team=readFileSync(new URL('../src/MyDraftTeam.jsx',import.meta.url),'utf8');
const badge=readFileSync(new URL('../src/DraftPickBadge.jsx',import.meta.url),'utf8');
assert(draft.includes("draft-tab-my-team")&&draft.includes("<MyDraftTeam league={l}/>"),
  'GM Draft Room has My Team tab');
assert(main.includes("gmToolsTab==='My Team'?<MyDraftTeam league={seasonLeague}/>"),
  'GM Tools My Team remains available throughout season');
assert(team.includes("teamDraftedPlayers(season,team.id)")&&
 team.includes('<PlayerPortrait player={player} size={38}/>'),
 'GM only sees live roster with actual shared player portraits');
assert(badge.includes('ROUND {draft.round}')&&badge.includes('PICK #{draft.number}'),
 'original round and overall pick must display on every player card');
assert(draft.includes('<DraftPickBadge playerId={p.id} seasons={l.seasons} compact/>'),
 'draft pool cards show completed draft history');
assert(main.includes('<DraftPickBadge playerId={p.id} seasons={seasonLeague.seasons} compact/>'),
 'Player Stats cards must retain pick history during season');
assert(season.includes('<Player id={id} seasons={l.seasons}/>'),
 'Team roster cards retain pick history throughout season');
assert(playerData.includes('<DraftPickBadge playerId={p.id} seasons={seasons} compact/>'),
 'Player Data cards include the draft history too');
assert(profile.includes("'YEARS AS A SLUGGER',sslCareerTenure(player.id,fullSeasons)"),
 'career stat must show ROOKIE during first season; not raw zero seasons');
assert(profile.includes('<DraftPickBadge playerId={player.id} seasons={fullSeasons}/>'));
const css=readFileSync(new URL('../src/draft-players.css',import.meta.url),'utf8');
assert(css.includes('.draft-my-team-panel[hidden]{display:none!important}'),
 'inactive My Team tab cannot overlap draft player pool');
assert(draft.includes('if(await l.act(\'pick\',{player:selected.id}))close();'),
 'commissioner can still submit on-clock pick with explicit confirmation');
console.log('PASS: commissioner unchanged; GM My Team, draft provenance on player cards and career Rookie Season 1');
