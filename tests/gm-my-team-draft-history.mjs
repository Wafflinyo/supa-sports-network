import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {originalPlayerDraft,teamDraftedPlayers,sslCareerTenure,isUndraftedSigning} from '../src/draft-pedigree.js';
import {draftPedigreeVisible} from '../src/DraftPickBadge.jsx';

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
assert.equal(isUndraftedSigning(99,[season1]),false,
  'an untouched AVAILABLE free agent is not yet a signed UNDRAFTED player');
assert.equal(isUndraftedSigning(1,[season1]),false,
  'an officially drafted roster player must retain Round and Pick #');
const signedSeason={
 id:'signed',number:1,status:'regular',picks:[...season1.picks],
 rosters:{knights:[1,99,100],dedennes:[]},games:[]
};
assert.equal(isUndraftedSigning(99,[signedSeason]),true,
  'a free agent signed by a franchise is labeled UNDRAFTED');
assert.equal(isUndraftedSigning(100,[signedSeason]),true,
  'random-fill additions without picks are also undrafted');
assert.equal(isUndraftedSigning(1,[signedSeason]),false,
  'drafted players never receive UNDRAFTED');
assert.equal(isUndraftedSigning(99,[season1,signedSeason]),true,
  'signings in any known SSL season retain UNDRAFTED');
signedSeason.rosters={knights:[1],dedennes:[99,100]};
assert.equal(isUndraftedSigning(99,[signedSeason]),true,
  'an undrafted signing transferred to another team stays UNDRAFTED');
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
assert(badge.includes('isUndraftedSigning(playerId,seasons)')&&badge.includes('UNDRAFTED'),
  'career profile should correctly distinguish undrafted signings from drafted players');
assert(badge.includes('ROUND {draft.round}')&&badge.includes('PICK #{draft.number}'),
  'draft pedigree remains available after the draft concludes');
assert(badge.includes('if(!draftPedigreeVisible(seasons))return null;'),
  'draft pedigree must be hidden until the active draft is complete');
assert.equal(draftPedigreeVisible([season1]),false,'drafting season hides pedigree');
assert.equal(draftPedigreeVisible([{...season1,status:'scheduled'}]),false,
  'scheduled draft never exposes draft badges');
assert.equal(draftPedigreeVisible([{...season1,status:'postdraft'}]),true,
  'pedigree appears immediately when the draft concludes');
assert.equal(draftPedigreeVisible([season2,{...season1,status:'archived'}]),true,
  'completed seasons keep original draft pedigree');
assert.equal(draftPedigreeVisible([{...season2,status:'drafting'},season1]),false,
  'new current draft also hides historical round and pick badges');
for(const [view,body] of Object.entries({main,draft,team,season,playerData})){
  assert(!body.includes('<DraftPickBadge'),'draft badge must not appear on '+view+' cards');
}
assert(main.includes('PlayerProfileContext.Provider')&&
  season.includes('<PlayerProfileLink player={p}')&&
  team.includes('<PlayerProfileLink player={player}')&&
  playerData.includes('<PlayerProfileLink player={p}'),
  'player cards across league, My Team, and Data use shared career profile');
assert(draft.includes('<PlayerCareerSnapshot player={selected} seasons={l.seasons}/>'),
  'draft card tap must show career stats without changing pick selection');
assert(season.includes('<Player id={p.player} seasons={l.seasons}/>')&&
  season.includes('<Player id={p.id} seasons={l.seasons} />'),
  'lineup and free agency use shared tappable player identities');
assert(season.includes('<Player id={id} seasons={l.seasons}/>'),
 'Team roster cards retain shared tappable player identities');
assert(profile.includes("'YEARS AS A SLUGGER',sslCareerTenure(player.id,fullSeasons)"),
 'career stat must show ROOKIE during first season; not raw zero seasons');
assert(profile.includes('<DraftPickBadge playerId={player.id} seasons={fullSeasons}/>'));
const css=readFileSync(new URL('../src/draft-players.css',import.meta.url),'utf8');
assert(css.includes('.draft-my-team-panel[hidden]{display:none!important}'),
 'inactive My Team tab cannot overlap draft player pool');
assert(draft.includes('if(await l.act(\'pick\',{player:selected.id}))close();'),
 'commissioner can still submit on-clock pick with explicit confirmation');
console.log('PASS: live draft unchanged; career profiles on player cards; draft round and pick visible only in career profile after draft');
