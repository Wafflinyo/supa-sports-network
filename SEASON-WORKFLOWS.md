# SSL season administration

Sign in with commissioner access and open **SSL Draft Room → Set Up Season** (also available in Commissioner Tools). This creates preparation for S1; it does not start games.

1. In **Teams, Locations & Access**, register the 12 teams (or let their GMs submit them), then select them for the season.
2. Open the draft-date poll, review team votes and confirm a date/time. Times entered use the commissioner’s device timezone; public times display Eastern Time.
3. The draft room opens one hour early. The lottery runs once, 15–30 minutes before the draft. The 11-round snake draft has a count-up clock without a deadline. GMs submit their own picks; the commissioner can submit on their behalf, pause/resume and correct the last unfinalized pick.
4. After the draft, each team saves nine starters with distinct fielding positions, batting order and the remaining roster on the bench. Trading opens once all defaults are valid.
5. Generate or manually enter the 22-week schedule: 132 games, every team facing each opponent once home and once away. Week 1 begins on a Sunday in Eastern Time. The All-Star break falls between Weeks 11 and 12; trades close at the end of Saturday in Week 12. Publish the schedule, then explicitly start the regular season. GMs submit upcoming-game lineups or choose their defaults. Lineups close at scheduled game time. The commissioner marks the game started before importing results; this freezes its roster and default fallback.
6. Upload the Project Rio XLSX in **Schedule & Results**. Review team labels, player identities (especially ambiguous Miis) and optional MVP. Posted results update season statistics, standings, profiles and fantasy scores. Replacing a report updates that game rather than counting another game. Result corrections close when retention opens.
7. Open postseason after all regular games finish, enter playoff games/series and post their results. After the championship series, confirm the champion, runner-up and actual end time. Extensions close two weeks later, releasing every unsigned player. Unused contracts carry over. Offseason trades reopen then. Use **SSL Draft Room → Set Up Next Season** to archive the finished season and begin preparation; offseason trades continue until the new draft starts.

## GM actions

**Team Tools** manages the default lineup and team identity. **Schedule** accepts upcoming-game lineups. **Transactions** proposes player, next-season pick and unused contract trades; **Messages** contains private offers. Every participant accepts the same offer, then the commissioner approves it. Future pick ownership follows trades into the next draft. Every franchise keeps at least nine of its eleven next-season picks.

A trade may leave fewer than eleven players. That team must sign free agents or use **Random Fill to 11**, then update its default lineup. Ordinary drops cannot reduce a roster below eleven. Roster moves involving a team with an unreported live game are blocked. Free agency signings use the current unrostered player pool; fantasy draft picks must belong to current SSL rosters.

## Extensions

Each franchise receives three one-season extension contracts after the Week 12 trade deadline. Offers are allowed from then until two weeks after the championship ends. Unused contracts carry over and can be traded. Retained players are additional to the eleven new draft picks. The first accepted extension with a franchise is guaranteed. Subsequent offers use 85%, 70%, 50%, 25%, then 15%. Add only the highest finish bonus: playoffs +10, finalist +15, champion +20 percentage points; last in the regular-season standings subtracts ten. Cap at 100%.

Each offer consumes one contract even if rejected. Only an accepted offer increases the player/franchise repeat count. One offer per player/franchise/season window; odds reflect achievements earned when the offer is submitted, without rerolls from later bonuses; the result is stored and cannot be rerolled. Stable franchise IDs preserve history through departure, rebrand or GM replacement. Shared GM codes grant the same team permissions to all authorized holders. Public visitors can view league data but cannot change it.

## Validation

`npm run test:season` runs an isolated in-memory Postgres league through setup, 132 picks, default lineups, trade approval and roster refill, pick limits, corrected results, postseason, accepted/rejected extensions and S2 carryover. It checks ordinary-account and anonymous restrictions without touching the live database. Set `SSL_RIO_FIXTURE` to a local Project Rio XLSX to run the real workbook import regression as well.
