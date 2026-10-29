import assert from 'node:assert/strict';
import {buildLeagueAlerts,opponentScouting} from '../src/league-alerts.js';
import {HEATING_UP_THRESHOLD} from '../src/heating-up.js';

const positions=['P','C','1B','2B','3B','SS','LF','CF','RF'];
const roster=Array.from({length:11},(_,i)=>i+1);
const opponentRoster=Array.from({length:11},(_,i)=>i+20);
const lineupFor=list=>({starters:list.slice(0,9).map((player,i)=>({player,position:positions[i]})),bench:list.slice(9)});
const team={id:'a',name:'First Team',slot:1};
const opponent={id:'b',name:'Second Team',slot:2};
const teams=[team,opponent,...Array.from({length:10},(_,i)=>({id:'z'+i,name:'Other '+i,slot:i+3}))];
const base={
  id:'season-1',status:'drafting',teams,rosters:{a:roster,b:opponentRoster},
  needsDefault:['a'],defaults:{},picks:[],order:teams.map(t=>t.id),games:[],inbox:[],schedulePublished:false,
};
const playerPool=[...roster,...opponentRoster].map(id=>({id,name:'Player '+id}));
const args={season:base,myTeam:team,role:'gm',players:playerPool,now:Date.parse('2026-11-01T12:00:00Z')};
const find=(rows,suffix)=>rows.find(row=>row.id.endsWith(suffix));

assert.deepEqual(buildLeagueAlerts(args),[], 'do not notify during a live draft');
const post={...base,status:'postdraft',picks:Array.from({length:12},(_,i)=>({team:teams[i].id,seconds:10}))};
let alerts=buildLeagueAlerts({...args,season:post});
assert(find(alerts,':default-lineup'), 'prompt for required default lineup');
assert(find(alerts,':preseason-bracket'), 'announce completed draft bracket');
assert.equal(find(alerts,':default-lineup').target.page,'GM Tools');

const previous={id:'previous',home:'a',away:'b',stage:'final',phase:'regular',
  startsAt:'2026-10-30T17:00:00Z',
  lineups:{b:lineupFor(opponentRoster)},
  result:{players:[{player:1,team:'a',gameScore:HEATING_UP_THRESHOLD}]}};
const upcoming={id:'upcoming',home:'b',away:'a',stage:'scheduled',phase:'regular',
  startsAt:'2026-11-03T17:00:00Z',lineups:{b:{starters:[{player:999,position:'P'}]}}};
const regular={...post,status:'regular',schedulePublished:true,needsDefault:[],
  defaults:{a:lineupFor(roster)},games:[previous,upcoming]};
alerts=buildLeagueAlerts({...args,season:regular,
  newsItems:[{gameId:'previous',teamId:'a',playerId:1,title:'Player 1 is heating up!'}]});
const upcomingAlert=find(alerts,':game-lineup:upcoming');
assert(upcomingAlert?.canUseDefault,'one-click default lineup uses saved lineup');
assert.equal(upcomingAlert.target.gameId,'upcoming');
assert(find(alerts,':schedule-published'), 'announce newly published schedule');
assert(find(alerts,':heat:previous'), 'announce last match Heating Up');
assert(find(alerts,':news:previous'), 'announce player in home news');

const scout=opponentScouting(regular,upcoming,'b');
assert.equal(scout.previous.id,'previous');
assert.equal(scout.lineup.starters[0].player,opponentRoster[0]);
assert.notEqual(scout.lineup.starters[0].player,999, 'never reveal future-game submitted lineups');
const noHistory=opponentScouting({...regular,games:[upcoming]},upcoming,'b');
assert.equal(noHistory.lineup,null,'do not use a changed default as last played lineup');

const submitted={...regular,games:[previous,{...upcoming,lineups:{...upcoming.lineups,a:lineupFor(roster)}}]};
alerts=buildLeagueAlerts({...args,season:submitted});
assert(!find(alerts,':game-lineup:upcoming'),'submission resolves the task automatically');
const play={...regular,status:'postseason'};
assert(find(buildLeagueAlerts({...args,season:play}),':playoff-bracket'),'announce playoff bracket');
console.log('PASS: notifications wait for draft completion, route lineups, announce brackets/schedule, feature heat/news, and preserve opponent scouting privacy.');
