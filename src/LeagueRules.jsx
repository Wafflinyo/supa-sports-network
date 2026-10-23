import React from 'react'
import rules from './fantasy-rules.json' with { type: 'json' }
import './league-rules.css'

const sections = [
  ['League structure', [
    'The Sluggers Supa League has 12 franchises in two conferences of six: the Supa Mario Conference and Mario Galaxy Conference. Each team plays every other team once at home and once away: 22 regular-season games per team across 22 matchup weeks.',
    'The All-Star break falls between Weeks 11 and 12. The first-place team in each conference earns the Conference Champion title. The top eight teams overall qualify for the playoffs, with no fixed conference quota. All deadlines and scheduled times use Eastern Time.'
  ]],
  ['Accounts and team management', [
    'Anyone can view the public website without an account. An account is required to participate in team management, fantasy leagues, and voting. Sign in with a username and password; enter a valid GM or commissioner code to activate management access for that session. Leaving the code blank gives normal participant access.',
    'A GM code grants full management access to its franchise. GMs may share their code with someone they trust, who receives the same lineup and roster permissions. The commissioner can regenerate a code when management changes.',
    'Messages and management tools are available only to signed-in GMs and the commissioner. The commissioner administers seasons, schedules, result uploads, trade approvals, teams and access. Franchise history remains with the franchise through rebrands and changes of GM, including extension history.'
  ]],
  ['Preparing a season', [
    'Set Up Season prepares a season; it does not start regular-season play. The commissioner selects all 12 participating teams. Each team registers its name, logo and an available Mario-universe home location; the commissioner may register these on its behalf.',
    'The commissioner assigns six teams to each conference and opens a draft-date poll using selected date options. After the final date and time are confirmed, the draft room opens on schedule. Teams establish default lineups after the draft, and the commissioner posts the regular-season schedule.'
  ]],
  ['Draft rules', [
    'The draft uses a snake order, reversing direction each round. The room opens one hour before the draft. The lottery or draft-order reveal takes place 15–30 minutes before the scheduled start.',
    'The pick timer counts upward with no automatic deadline. Pick times are recorded for review. GMs submit their own selections; the commissioner may select on a GM’s behalf when that GM sends their choice outside the site.',
    'After Season 1, the previous regular-season 9th–12th seeds enter a weighted lottery for picks 1–4: 12th has a 55% first-pick chance, 11th 25%, 10th 15%, and 9th 5%. After each draw the winner is removed and the remaining weights are normalized for the next pick. The other teams follow in reverse regular-season standings: 8th gets pick 5, 7th pick 6, 6th pick 7, 5th pick 8, 4th pick 9, 3rd pick 10, 2nd pick 11, and 1st pick 12. The draft snakes from that order. Season 1 uses an equal lottery for all twelve teams.',
    'Captains are not required draft picks. Any eligible combination of players is allowed.',
    'Season 1 has twelve rounds per franchise: eleven player picks and one nontradable Stadium Pick. A Stadium may be selected on ANY main-draft turn. If the Stadium has not been chosen after eleven selections, the twelfth turn must be the Stadium Pick. A team can choose its Stadium only once.',
    'From Season 2 onward, each team receives eleven tradable player picks and one nontradable Stadium Pick ONLY if it did not retain a Stadium. A successfully extended Stadium carries into the following season and replaces that Stadium Pick. Teams must always retain at least nine player picks after trades. Without a retained Stadium, teams retain the protected Stadium Pick for ten minimum total turns; if the team has nine player picks and has not chosen its Stadium after nine turns, its final turn must be a Stadium Pick. Teams with a retained Stadium get no Stadium Pick, so their minimum is nine player picks.',
    'After the main draft (up to twelve rounds), teams below eleven rostered players enter supplemental snake turns until they reach eleven. Supplemental turns are player-only and cannot be traded. A team retaining a Stadium skips its nontradable twelfth-round Stadium turn. For example, nine player picks and no retained players require two supplemental player selections, regardless of Stadium status.',
  ]],
  ['Rosters and lineups', [
    'Rosters must contain 11–14 players, except for the temporary post-trade shortfall described in Free Agency. Each lineup has nine starters, one at each defensive position, a complete batting order, and the remaining roster on the bench.',
    'Every team submits a default lineup after drafting. For each upcoming game, the GM may submit a new lineup or choose the default. The default is the fallback if no game-specific lineup is submitted.',
    'Pitcher substitution priority guide: P1P (Priority 1 Pitcher) identifies the 12 captains; captains have first replacement priority when a pitcher tires. P2P (Priority 2 Pitcher) identifies non-captains with a displayed pitching rating of 7 or higher; they come next. When neither group is available, the replacement is random. These roster labels help GMs plan lineups; the website does not operate or alter Dolphin substitutions.',
    'A lineup locks when the commissioner uploads that game’s results, even if those results remain hidden ahead of a premiere. After results are published, the team prepares for its next scheduled game. Player transactions prompt a review of the default lineup; picks-only or coins-only trades do not.'
  ]],
  ['Star Coins and recharge', [
    'Every franchise begins each season with 55 Star Coins for the entire regular season and playoff run combined. A team may star up to three players per game, at an ordinary cost of one coin per player. Using fewer than three, or none, is allowed.',
    'Star Recharge Clause: starring the same player in consecutive team games costs five additional coins, for six coins total for that player. Every further consecutive starred game also costs six. One team game with the player unstarred restores the ordinary one-coin cost, whether the player participates or stays on the bench.',
    'Example: Bowser starred in Game 1 costs one coin; starred again in Game 2 costs six; unstarred in Game 3 costs nothing; starred in Game 4 costs one.',
    'A trade never clears recharge. If an acquired player needs recharge, the receiving team must play one game with that player unstarred or pay six coins to bypass it. Receiving-team games before the acquisition do not count.',
    'Submitted star selections reserve their cost. Reserved coins cannot be traded or spent on another game. Editing before the lineup locks releases the old reservation and reserves the revised cost. Uploading results locks the selections and spends the reservation once. A replacement or corrected report does not charge again.',
    'A postponed game keeps its reservation unless selections change or the game is cancelled. Cancellation releases the reservation or refunds the charge.',
    'Available coins may be traded during open trading periods under normal trade approval rules. Use whole coins only; available balances cannot go negative. Remaining coins expire league-wide after the championship series ends. Every franchise receives a fresh 55 next season, with no rollover.'
  ]],
  ['Free agency', [
    'Free agency is first come, first served: the first team to complete a valid signing gets the available player. There are no waiver bids or waiting periods.',
    'At the 14-player cap, the GM chooses a player to drop as part of the signing. The addition and drop complete together. An ordinary drop cannot leave the roster below 11.',
    'A trade may temporarily leave a team below 11. It must immediately sign enough free agents or choose Random Fill to reach 11, then review its default lineup. Transactions must respect locked games and season restrictions. Offseason free-agent signings do not replace the next season’s draft.'
  ]],
  ['Trades and deadlines', [
    'Trades may include players, eligible next-season draft picks and available Star Coins. Extension contracts cannot be traded. Two or more teams may participate.',
    'Every involved GM must accept before the commissioner gives final approval. Approval checks asset ownership, roster and pick restrictions, coin availability, and locked-game conflicts. Player trades require default-lineup review.',
    'A franchise receives eleven tradable player picks and one nontradable Stadium Pick, unless a Stadium was successfully retained for that season. Trades must leave at least nine player picks; that means ten minimum total turns without a retained Stadium (nine players plus Stadium) or nine player turns when the Stadium is already retained. Stadium Picks and supplemental picks cannot be traded.',
    'Trading opens after the draft and establishment of rosters and default lineups. The regular-season deadline is Saturday of Week 12 at 11:59:59 p.m. Eastern. Trading stays closed for the rest of the regular season, playoffs and extension window. Offseason trading opens when extensions close and continues until the next draft starts.'
  ]],
  ['All-Star voting and awards', [
    'The All-Star break is between Weeks 11 and 12. Each registered account may submit a ballot selecting nine eligible players from the Supa Mario Conference and nine from the Mario Galaxy Conference, up to 18 selections total.',
    'The commissioner announces voting windows, ballot requirements and the event schedule. End-of-season awards voting, announcements and ceremonies take place after the regular season and before the playoffs. Other polls appear in Voting when opened.'
  ]],
  ['Standings and conference champions', [
    'Rank teams by win percentage (higher first), then run differential (higher first), then runs allowed (lower first). Run differential equals runs scored minus runs allowed.',
    'The regular-season leader in each conference is a Conference Champion. The top eight teams in the overall league standings make the playoffs, regardless of conference.'
  ]],
  ['Playoff bracket', [
    'Opening matchups are 1 vs 8, 4 vs 5, 2 vs 7, and 3 vs 6. Reseed after every round: the highest remaining seed plays the lowest remaining seed.',
    'Quarterfinals and semifinals are best of three (two wins). The championship is best of five (three wins). The higher seed hosts Game 1; home field alternates every game. The higher seed therefore hosts Games 1 and 3, and Game 5 if needed.',
    'A series ends as soon as a team reaches the required wins. Unnecessary games are not played. Star Coin costs and recharge continue through the playoffs, without an additional playoff coin grant.'
  ]],
  ['Contract extensions', [
    'Each franchise receives three shared one-season extension contracts per season. A contract may be offered to a player or an owned Stadium using the same repeat-offer percentages and postseason modifiers. An accepted offer retains that player or Stadium for the following season. Every applied offer consumes one contract, whether accepted or rejected. Contracts cannot be traded or rolled over.',
    'The extension window opens after the championship series ends, with final standings and playoff achievements known. It closes one calendar month after the championship ends, or earlier once all 12 teams have used or voided every contract.',
    'A GM may choose Void Remaining Extensions to forfeit unused contracts. At the automatic deadline all unused contracts expire. Players without accepted extensions leave their team when the window closes and enter the following season’s pool. Closing the window opens offseason trading.',
    'The base chance depends on previously accepted extensions from that same franchise: none = 100%; one = 85%; two = 70%; three = 50%; four = 25%; five or more = 15%. Only acceptance increases the count. Departure, rebranding and a new GM never reset franchise/player history.',
    'Apply only the highest playoff achievement bonus: made playoffs +5 percentage points; reached semifinals +10; reached finals +15; won finals +20. These bonuses do not stack. Final regular-season placement penalties are 9th or 10th: −10 points; 11th: −15; 12th: −20. Clamp the final chance between 0% and 100%.',
    'Before applying, the site displays the base chance, achievement or placement modifier, and total. Example: one previously accepted extension gives 85%; reaching the semifinals adds 10%; total chance is 95%. Applying consumes the contract and reveals the result after a short pause.',
    'A rejection may be retried with another remaining contract during the same window. Each attempt consumes a contract and uses the same percentage because rejection does not advance the repeat history. Once accepted, the player is secured for next season and cannot receive another offer during that window.'
  ]],
  ['Recorded games and results', [
    'Games are prerecorded and scheduled to premiere on Supa League TV. The commissioner may upload Project Rio results ahead of the premiere. This locks lineups and related selections while keeping the result hidden.',
    'Results release after the premiere finishes, using its configured release time or commissioner confirmation. Released results update schedules, standings, player and team statistics, profiles, records, playoff series and eligible fantasy matchups.',
    'Correcting a report replaces that game’s contribution instead of adding a duplicate game. Postponements are announced on Home and Schedule. Hidden results remain held until the revised release.'
  ]],
  ['Offseason and next season', [
    'After the championship, GMs use or void extension contracts. The window closes when all teams finish, or at the one-month deadline. Unretained players and Stadiums leave. Retaining a Stadium means losing the next Stadium Pick; teams without a retained Stadium can draft one. Offseason trades open.',
    'The commissioner then uses Set Up Next Season to prepare the new draft and archive the completed season in SSL History. Records, awards and extension history remain attached to the franchise. Accepted retains and eligible assets carry into the next season; Star Coins reset to 55.'
  ]],
  ['Sluggers Fantasy', [
    'Fantasy leagues can be created or started only after the SSL draft is fully complete and all 12 rosters have at least 11 players. League sizes are six, eight or ten managers. Each fantasy team drafts ten players: seven open starter slots and three bench slots, without position restrictions.',
    'Weekly head-to-head matchups run Sunday at 12:00 a.m. through Saturday at 11:59:59 p.m. Eastern. Both players must be unlocked for a starter/bench swap. Uploading the SSL results locks the involved players for the premiere’s fantasy week. Points appear only after results release.',
    'Only starters count toward the matchup score; bench scores remain available for review. A preseason fantasy league can run all 22 regular-season weeks. A midseason league runs only the remaining weeks, with no retroactive scoring. Prior games and playoff games do not count.',
    `A team shutout awards +${rules.team.shutoutBonus} points to every player who played for the team that allowed zero runs. It stacks with other scoring and pitching bonuses. Full fantasy scoring values are available under Sluggers Fantasy → Rules & Point System.`
  ]]
]

export default function LeagueRules() {
  return <>
    <div className="page-heading"><span className="eyebrow dark">THE LEAGUE HANDBOOK</span><h1>LEAGUE RULES</h1><p>Season setup, team management, Star Coins, playoffs and retaining your players. All times are Eastern.</p></div>
    <div className="league-rules-sections">{sections.map(([title,paragraphs],i)=><details className="panel league-rule-section" key={title} open={i===0?true:undefined}><summary><span className="league-rule-number">{String(i+1).padStart(2,'0')}</span><h2>{title}</h2></summary><div className="league-rule-body">{paragraphs.map(p=><p key={p}>{p}</p>)}</div></details>)}</div>
  </>
}
