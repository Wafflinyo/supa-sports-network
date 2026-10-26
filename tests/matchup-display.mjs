import assert from 'node:assert/strict';
import {matchupTeams,homeStadium,matchupDisplay} from '../src/matchup-display.js';

const teams=[
  {id:'knights',name:'New Donk City Knights',conference:'galaxy'},
  {id:'dedennes',name:'Decalburg Dedennes',conference:'supa'},
  {id:'dolphins',name:'Delfino Plaza Dolphins',conference:'galaxy'},
  {id:'tanks',name:'Twilight Town Tanks',conference:'supa'},
];
const season={
  teams,
  picks:[{team:'dedennes',kind:'stage',stage:'Mario Stadium'},
         {team:'knights',kind:'stage',stage:'Toy Field'},
         {team:'dedennes',kind:'player',player:18}],
  retainedStadiums:{dolphins:['Luigi’s Mansion'],tanks:['Wario City','Bowser’s Castle']},
};
const game={away:'knights',home:'dedennes',week:1,startsAt:null};
assert.equal(matchupTeams(season,game).home.name,'Decalburg Dedennes');
assert.equal(matchupTeams(season,game).away.name,'New Donk City Knights');
assert.deepEqual(matchupDisplay(season,game),{
  awayName:'New Donk City Knights',
  homeName:'Decalburg Dedennes',
  stadium:'Mario Stadium'
});
assert.equal(homeStadium(season,'knights'),'Toy Field','Stadium belongs to selected team');
assert.equal(matchupDisplay(season,{...game,away:game.home,home:game.away}).stadium,'Toy Field','Reversing home/away changes the stadium');
assert.equal(homeStadium(season,'dolphins'),'Luigi’s Mansion','Retained stadium survives into the next season');
assert.equal(homeStadium(season,'tanks'),null,'Do not invent a single home venue when a team has two retained stadiums');
assert.equal(homeStadium({...season,picks:[]},'dedennes'),null,'Before drafting a stadium, venue remains TBD');
assert.equal(homeStadium({...season,picks:[{team:'dolphins',kind:'stage',stage:'Peach Ice Garden'}]},'dolphins'),'Peach Ice Garden','Stadium Pick takes precedence over retained venue');
assert.equal(homeStadium(season,'no-such-team'),null);
assert.equal(matchupDisplay(season,{home:'dolphins',away:'dedennes'}).stadium,'Luigi’s Mansion');
console.log('SSL schedule roles, Home Stadium Pick, retained stadium, and Date TBD venue rules passed.');
