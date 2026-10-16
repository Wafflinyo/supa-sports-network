# SSL season administration

Sign in with commissioner access and open **SSL Draft Room → Set Up Season** (also available in Commissioner Tools). This creates preparation for S1; it does not start games.

1. In **Teams, Locations & Access**, register the 12 teams (or let their GMs submit them), then select them for the season.
2. Open the draft-date poll, review team votes and confirm a date/time. Times entered use the commissioner’s device timezone; public times display Eastern Time.
3. The draft room opens one hour early. The lottery runs once, 15–30 minutes before the draft. Every season has eleven main snake rounds, followed by supplemental snake turns only for franchises below eleven players after traded picks. The snake continues its direction and skips teams already at eleven. Supplemental picks belong to the franchise and are not tradable. The draft has a count-up clock without a deadline. GMs submit their own picks; the commissioner can submit on their behalf, pause/resume and correct the last unfinalized pick.
4. After the draft, each team saves nine starters with distinct fielding positions, batting order and the remaining roster on the bench. Trading opens once all defaults are valid.
5. Generate or manually enter the 22-week schedule: 132 games, every team facing each opponent once home and once away. Week 1 begins on a Sunday in Eastern Time. The All-Star break falls between Weeks 11 and 12; trades close at the end of Saturday in Week 12. Publish the schedule, then explicitly start the regular season. GMs submit upcoming-game lineups or choose their defaults. Lineups remain editable until the commissioner uploads results. Uploading the verified report freezes lineups and game rosters immediately, even before the premiere.
6. Upload the Project Rio XLSX in **Schedule & Results**. Review team labels, player identities (especially ambiguous Miis) and optional MVP. Reports are stored privately until the premiere ends. Set the exact video end time for automatic release, or confirm the premiere ended to release manually. Public release updates season statistics, standings, profiles and fantasy scores. Scheduled release uses the configured time; it does not query YouTube for actual completion. Postponement holds scheduled release until cleared. Replacing a report updates that game rather than counting another game. Result corrections close when retention opens.
7. Open postseason after all regular games finish, enter playoff games/series and post their results. After the championship series, confirm the champion, runner-up and actual end time. Extensions close two weeks later, releasing every unsigned player. Unused contracts expire. Offseason trades reopen then. Use **SSL Draft Room → Set Up Next Season** to archive the finished season and begin preparation; offseason trades continue until the new draft starts.

## GM actions

**Team Tools** manages the default lineup and team identity. **Schedule** accepts upcoming-game lineups. **Transactions** proposes player and next-season pick trades; **Messages** contains private offers. Every participant accepts the same offer, then the commissioner approves it. Future pick ownership follows trades into the next draft. Every franchise receives eleven main-round picks for subsequent seasons. The existing minimum of nine owned next-season picks remains enforced; supplemental fill picks cannot be traded.

A trade may leave fewer than eleven players. That team must sign free agents or use **Random Fill to 11**, then update its default lineup. Ordinary drops cannot reduce a roster below eleven. Roster moves involving a team with an unreported live game are blocked. Free agency is first come, first served and has a fourteen-player maximum. At fourteen, the selected drop and signing happen atomically; a failed signing does not drop anyone. Free agency signings use the current unrostered player pool; fantasy draft picks must belong to current SSL rosters.

## Extensions

Each franchise receives exactly three one-season extension contracts after the Week 12 trade deadline. The maximum balance is three. Unused contracts expire at the window cutoff, do not roll over, and cannot be traded. Offers remain open until two weeks after the championship ends. Retained players join the eleven main-round draft selections. Only teams still below eleven players continue drafting until they reach eleven.

Base odds for the next accepted extension are 1st 100%, 2nd 85%, 3rd 70%, 4th 50%, 5th 25%, then 15%. Add only the highest earned finish bonus: making playoffs +5, semifinals +10, finals +15, champion +20 percentage points. The top eight teams qualify. Final regular-season places 9–10 subtract ten, 11th subtracts fifteen, and 12th subtracts twenty. Final chances are base plus modifier, capped from 0% to 100%. Final-standing penalties begin after the regular season ends.

Each offer consumes one contract even if rejected. Only an accepted offer increases the player/franchise repeat count. One offer per player/franchise/season window; odds reflect achievements earned when the offer is submitted, without rerolls from later bonuses; the result is stored and cannot be rerolled. Stable franchise IDs preserve history through departure, rebrand or GM replacement. Shared GM codes grant the same team permissions to all authorized holders. Public visitors can view league data but cannot change it.

## Validation

`npm run test:season` runs an isolated in-memory Postgres league through setup, 132 picks, default lineups, trade approval and roster refill, pick limits, corrected results, postseason, accepted/rejected extensions and S2 preparation. It checks ordinary-account and anonymous restrictions without touching the live database. Set `SSL_RIO_FIXTURE` to a local Project Rio XLSX to run the real workbook import regression as well.

Select an available contract, then a rostered player. The server previews the next extension number, base, finish adjustment and total chance without spending anything. Apply consumes one contract and stores the decision atomically; the screen reveals acceptance or free agency after a short pause. Changed odds require a new review. Repeated clicks or reloads cannot reroll the offer.

## Conferences, playoffs and voting

The commissioner assigns six franchises to the Supa Mario Conference and six to the Mario Galaxy Conference before the draft-date poll. Standings offer Overall, Supa and Galaxy views; each conference’s regular-season leader receives its Conference Champions title after all 132 results are public. Conference affiliation does not alter the double home/away schedule or the top-eight overall playoff field.

Quarterfinal display order is 1–8, 4–5, 2–7, 3–6. Quarterfinals and semifinals are best of three; finals best of five. Each round reseeds highest surviving seed against lowest. Higher seed hosts Game 1 and all odd games. Create the round’s series before entering games; schedule the next series game after the prior result is released, so clinched series have no unnecessary games. Confirm the championship only when the recorded finalists and winner match the completed final series.

All-Star voting accepts one editable ballot per signed-in account, with nine distinct players per conference. Candidates are snapshotted from team rosters when the ballot opens. Award ballots accept one candidate per account per award. The commissioner opens/closes ballots and publishes the awards ceremony announcement before opening playoffs. Ballot totals and own selections are visible; voter identities and other users’ ballots remain private. Awards announcements and postponement notices appear on Home.

## Broadcasts and interruptions

Attach a YouTube premiere URL to each game. The commissioner may upload Rio results before airing; viewers and GMs cannot read the report payload before release. Automatic release happens at the exact configured video-end time, visible on the next site refresh (about eight seconds); manual release requires commissioner confirmation after premiere start. If a premiere moves, update its broadcast time/end or mark it postponed to hold release. This implementation does not automatically detect YouTube’s actual end time.

Dolphin crashes, lost recordings, and replay/forfeit rules remain commissioner decisions. A postponement announcement and revised date can be published through the game’s broadcast controls without exposing results.

## Fantasy season eligibility

Fantasy creation and draft starts are blocked on the server until the associated SSL draft is finished and all twelve franchises have at least eleven players. Each fantasy league binds to one SSL season. Completing its fantasy draft fixes its scoring activation timestamp and first eligible week. Before SSL Week 1, the league receives all 22 regular-season weeks; midseason leagues receive only the remaining weeks through Week 22. Games starting before fantasy activation, older SSL seasons and playoff games do not score. A late-start league’s earlier weeks have no matchup records or lineup rows.

The fantasy Schedule tab lists its weekly head-to-head pairings. New leagues, draft starts and lineup swaps close after the associated regular season; standings remain viewable. A season calendar published after the fantasy draft still anchors the first matchup to SSL Week 1 or the activation week, whichever is later.
