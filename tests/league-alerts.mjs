import assert from 'node:assert/strict';
import {buildLeagueAlerts,opponentScouting} from '../src/league-alerts.js';
import {HEATING_UP_THRESHOLD} from '../src/heating-up.js';
import {snapshotTeamSchedule,reconcileScheduleHistory} from '../src/schedule-change-alerts.js';

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
const find=(rows,fragment)=>rows.find(row=>row.id.includes(fragment));

assert.deepEqual(buildLeagueAlerts(args),[], 'do not notify during a live draft');
const post={...base,status:'postdraft',picks:Array.from({length:12},(_,i)=>({team:teams[i].id,seconds:10}))};
let alerts=buildLeagueAlerts({...args,season:post});
assert(find(alerts,':default-lineup'), 'prompt for required default lineup');
assert(find(alerts,':preseason-bracket'), 'announce completed draft bracket');
assert.equal(find(alerts,':default-lineup').target.page,'GM Tools');

const previous={id:'previous',home:'a',away:'b',stage:'final',phase:'regular',
  startsAt:'2026-10-30T17:00:00Z',
  lineups:{b:lineupFor(opponentRoster)},
  result:{scores:{a:4,b:2},players:[{player:1,team:'a',gameScore:HEATING_UP_THRESHOLD}]}};
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

// Released match alerts are based exclusively on public final records.
assert(find(buildLeagueAlerts({...args,season:regular}),':game-result:previous'),'final score is announced');
const embargo={...regular,games:[{...previous,stage:'recorded'},upcoming]};
assert(!find(buildLeagueAlerts({...args,season:embargo}),':game-result:previous'),
  'private/pre-premiere scores must not produce GM alerts');
assert.equal(find(buildLeagueAlerts({...args,season:regular}),':game-result:previous').target.gameId,'previous',
  'final result alert opens the correct matchup');

// Voting opens immediately and reminds non-voters in the final 48 hours.
const close='2026-11-02T11:00:00Z';
const voteWindow={open:true,label:'All-Star Voting',closesAt:close,myChoices:[]};
const voting={...regular,ballotWindows:{allstar:voteWindow}};
const voteAlerts=buildLeagueAlerts({...args,season:voting});
assert(find(voteAlerts,':vote-open:allstar:'),'opening announcement shown');
assert(find(voteAlerts,':vote-deadline:allstar:'),'48-hour reminder shown');
assert.equal(find(voteAlerts,':vote-deadline:allstar:').target.ballot,'allstar');
const voted=buildLeagueAlerts({...args,season:{...voting,ballotWindows:{
  allstar:{...voteWindow,myChoices:[1,2]}}}});
assert(!find(voted,':vote-deadline:'),'no deadline nag for submitted ballots');
assert(!find(buildLeagueAlerts({...args,season:voting,now:Date.parse(close)+1}),':vote-open:'),
  'closed ballots cannot trigger alerts');

// Trade participants get actionable offers and durable state-transition updates;
// the commissioner is notified when an accepted offer needs final approval.
const trade={id:'offer-1',body:{teams:['a','b'],sender:'a'},accepted:['b'],status:'pending'};
const tradeAlert=buildLeagueAlerts({...args,season:regular,inbox:[trade]});
assert(find(tradeAlert,':trade-action:offer-1'),'pending offer needs a response');
assert.equal(find(tradeAlert,':trade-action:offer-1').target.offerId,'offer-1');
const accepted={...trade,accepted:['a','b'],status:'ready'};
const acceptedAlert=buildLeagueAlerts({...args,season:regular,inbox:[accepted]});
assert(find(acceptedAlert,':trade-update:offer-1:accepted'),'all-team acceptance announcement shown');
assert(!find(acceptedAlert,':trade-action:offer-1'),'no need to accept again');
assert(find(buildLeagueAlerts({...args,season:regular,inbox:[accepted],role:'commissioner'}),
  ':trade-review:offer-1'),'commissioner approval task');
for(const status of ['approved','rejected','countered','cancelled']){
  const transitions=buildLeagueAlerts({...args,season:regular,inbox:[{...trade,status}]});
  assert(find(transitions,':trade-update:offer-1:'+status),'trade '+status+' status must be announced');
}
assert(!find(buildLeagueAlerts({...args,season:regular,inbox:[
  {...trade,id:'other-team-offer',body:{teams:['b','z0']}}
]}),':trade-action:other-team-offer'),'do not alert uninvolved GMs');

// Schedule changes are compared against the last known published version.
// They must never be fabricated on first visit or for the other team's match.
const otherGame={id:'other-game',home:'z0',away:'z1',phase:'regular',stage:'scheduled',
  startsAt:'2026-11-06T17:00:00Z'};
const beforeSchedule={...regular,games:[previous,upcoming,otherGame]};
const initial=reconcileScheduleHistory({season:beforeSchedule,teamId:'a',now:args.now});
assert(initial.snapshot && initial.history.length===0,'first observation creates baseline');
assert.equal(Object.keys(initial.snapshot).length,1,'only relevant future active matchups tracked');
const changedGame={...upcoming,startsAt:'2026-11-04T19:30:00Z',postponed:true};
const changedSeason={...beforeSchedule,games:[previous,changedGame,
  {...otherGame,startsAt:'2026-11-07T17:00:00Z'}]};
const detected=reconcileScheduleHistory({season:changedSeason,teamId:'a',
  previous:initial.snapshot,history:initial.history,now:args.now+8000});
assert.equal(detected.history.length,1,'one notification for affected matchup, not other team');
assert(find(detected.history,':schedule-change:upcoming:'),'date and postponement detected');
assert(detected.history[0].detail.includes('New date:')&&detected.history[0].detail.includes('Game postponed'),
  'schedule notification explains exactly what changed');
assert.equal(detected.history[0].target.gameId,'upcoming','schedule alert deep links to matchup');
const noDuplicates=reconcileScheduleHistory({season:changedSeason,teamId:'a',
  previous:detected.snapshot,history:detected.history,now:args.now+16000});
assert.equal(noDuplicates.history.length,1,'polling unchanged schedule does not duplicate alert');
const finalAlerts=buildLeagueAlerts({...args,season:changedSeason,
  scheduleChanges:detected.history});
assert(find(finalAlerts,':schedule-change:upcoming:'),'history events appear in GM bell');
assert(!find(buildLeagueAlerts({...args,season:changedSeason,myTeam:opponent,
  scheduleChanges:detected.history}),':schedule-change:upcoming:'),
  'other teams do not receive private GM-specific change history');

// A newly published schedule is one official release notification, not
// dozens of fabricated individual rescheduling alerts.
assert.equal(reconcileScheduleHistory({season:post,teamId:'a'}).snapshot,null);
assert(snapshotTeamSchedule(beforeSchedule,'a').upcoming,'published schedule snapshot is stable');

console.log('PASS: GM alerts for published results, ballots and deadlines, trade approvals/rejections, schedule edits, and the original draft/lineup privacy guards.');
