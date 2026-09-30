# USA Supa League

A GitHub Pages-ready front end for the league, using the approved USA Supa League crest. The public player pool comes from the user's `Untitled spreadsheet.xlsx` Master Sheet: 138 rows with numeric character IDs and nonempty names. The workbook's team cells are empty and several game-stat formulas currently evaluate to `#REF!`, so the site leaves teams, results, and game stats unfilled.

## What works now

- Responsive Home, Schedule, Standings, Teams, Player Stats, Team Stats, Transactions, Sluggers Fantasy, Draft, and Free Agency views.
- Search and sortable player directory with Offensive, Defensive, and Pitching columns, plus Totals and Averages per Game views.
- Games Played appears before At-Bats and remains a whole-number total in either view.
- Email magic-link sign-in through Supabase Auth after setup.
- Signed-in users can create fantasy leagues and join by invite code. Database row-level security restricts league and membership reads to members.
- The Fantasy tab displays the agreed weekly rules and exact point weights, a snake draft room, seven starter and three bench spots, weekly head-to-head matchups, and scored-game standings.
- Draft turns and weekly swaps run as atomic database functions. Both players must have no game started that week to swap. Official Project Rio reports feed the point totals after they are uploaded.
- GitHub Actions builds and deploys the site to GitHub Pages.

The season schedule, team rosters, scores, trade approval, and main Supa League draft still need league setup. Fantasy game points stay empty until official reports are scheduled and uploaded. No game statistics or scores are fabricated.

## Upload official games for Games Played

Upload each official Project Rio `.xlsx` report to the repository's [`games/`](games/) folder on `main` using **Add file → Upload files → Commit changes**. The Pages workflow rebuilds Games Played automatically. Each player listed in the report's `Stats` sheet counts once for that game, including pitchers and players with no at-bats. Team total rows and duplicate copies of the exact same report are ignored. Unknown player names stop deployment so they can be corrected before the count changes.

There is no upload form on the public site yet. Games Played and Fantasy points are built from the files in `games/`; other public Player Stats columns remain blank until the full season stats importer is built. Sample reports are not official games and are not in `games/`.

## Run locally

Requires Node.js 22 or newer.

```bash
npm ci
cp .env.example .env
npm run dev -- --host 127.0.0.1
```

The public site works without Supabase settings. Sign-in and league creation become available after the next step.

## Set up accounts and private fantasy leagues

1. Create a Supabase project. In its SQL editor, run `supabase/migrations/001_fantasy.sql` and then `supabase/migrations/002_fantasy_draft_and_lineups.sql`.
2. In Authentication, enable Email sign-in. Add the exact GitHub Pages URL, including the repository path and trailing slash, to **URL Configuration → Redirect URLs**. Add a localhost URL for local sign-in if desired.
3. Copy the project URL and **publishable** key into `.env` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Restart the local server.
4. In the GitHub repository, set the same two values under **Settings → Secrets and variables → Actions → Variables**. These are public client settings. Never add a Supabase secret/service-role key to this frontend.

The generated invite code is visible to league members. Anyone with that code and an account can join; future commissioner controls can add admission rules if needed.

## Fantasy draft and lineup rules

Each fantasy league accepts 6–8 managers. Once everyone joins, the commissioner starts a ten-round snake draft. Its order is the join order, reversed on alternate rounds. Every manager drafts ten distinct players. The first seven picks start by default, and the last three begin on the bench. All seven starting spots are open to any player. The commissioner should have all invited managers join before starting: late joins and undrafted replacements are not available yet. A manager must make their own pick; there is no draft timer or automatic pick.

Matchup weeks run Sunday 12:00 a.m. through Saturday 11:59:59 p.m. **America/New_York**. Scored games belong to the week of their scheduled actual start, even if a game ends after the boundary. Both players in a starter/bench swap must be unlocked; each locks in their current spot at the start of their first game that week. Weekly lineup records preserve prior weeks and copy forward to the next Sunday. A starter gets all three categories of points from every game in that week. Head-to-head pairings rotate round-robin by week; completed weeks with scored games determine W–L–T standings.

The point values live in `src/fantasy-rules.json`, read by the scorer and the on-site rules panel. If the scoring system changes, edit that file and rebuild; historical scores from reports will recalculate under the new weights. See the Fantasy tab for every value and bonus.

## Schedule games and import fantasy points

Before a game starts, add it to `games/schedule.json` and push the change to `main`. Use the actual scheduled start time with an offset, a unique game ID, and every expected player ID from `src/players.json`:

```json
[
  {
    "id": "knights-monsters-2026-10-04",
    "startsAt": "2026-10-04T13:00:00-04:00",
    "players": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]
  }
]
```

Replace those illustrative IDs with the actual nine players on each team. Publishing the schedule before first pitch is essential: the database uses the listed start for secure lineup locks. When a game finishes, upload its Project Rio XLSX to `games/`, then add `"report": "Exact Uploaded Filename.xlsx"` to that schedule entry and push. The build rejects missing files, unmapped players and mismatched rosters rather than silently awarding points to the wrong player. If Project Rio displays the same name for two distinct players, map their **Stats** sheet row numbers to player IDs with `"playerRows": {"4": 44, "9": 81}`. If either pitches, map the **Pitching** sheet row too using `"pitcherRows": {"3": 81}`. The source workbook rows begin at 2.

Set the repository Actions secret `SUPABASE_SERVICE_ROLE_KEY` to your Supabase service-role key. The deploy job uses it only on the GitHub Actions runner to sync pregame player starts into the protected schedule table. It is never passed to Vite or sent to browsers. If the schedule has games but the server key or project URL is missing, deployment fails rather than silently leaving lineup locks unenforced. The Fantasy screen then reads scored games from the rebuilt site. The local `python scripts/build_fantasy_games.py` command scores the same files without uploading a schedule.

Game times must be kept accurate before the game begins. A changed start time should be pushed promptly. Fantasy accounts, draft persistence, and lineup locks require a configured Supabase project and the two migrations. Without it, the public rules remain readable but account actions cannot run.

## Publish on GitHub Pages

1. Create a new GitHub repository named `usa-supa-league` (or any name). Upload/push this project's contents to its `main` branch.
2. In repository **Settings → Pages → Build and deployment**, choose **GitHub Actions** as the source.
3. The included workflow deploys automatically on pushes to `main`. It sets Vite's base path from the repository name, so assets load under `https://USERNAME.github.io/REPOSITORY/`.
4. Update the Supabase redirect URL to that final address. For a custom domain or a `USERNAME.github.io` repository, adjust `GITHUB_PAGES_BASE` in the workflow to `/`.

## Next league inputs

- Team names, owners, roster size and draft order/date.
- Season schedule and transaction approval rules.
- Dates and official reports for each fantasy game; fantasy transaction and waiver rules.
- Final rules for importing the remaining public Player Stats columns.

Player data is in `src/players.json`; each record has ID, name, class, color and source. The current workbook's calculated game-stat cells are intentionally omitted.
