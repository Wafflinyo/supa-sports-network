# USA Supa League

A GitHub Pages-ready front end for the league, using the approved USA Supa League crest. The public player pool comes from the user's `Untitled spreadsheet.xlsx` Master Sheet: 138 rows with numeric character IDs and nonempty names. The workbook's team cells are empty and several game-stat formulas currently evaluate to `#REF!`, so the site leaves teams, results, and game stats unfilled.

## What works now

- Responsive Home, Schedule, Standings, Teams, Player Stats, Team Stats, Transactions, Sluggers Fantasy, Draft, and Free Agency views.
- Search and sortable player directory with Offensive, Defensive, and Pitching columns, plus Totals and Averages per Game views.
- Games Played appears before At-Bats and remains a whole-number total in either view.
- Email magic-link sign-in through Supabase Auth after setup.
- Signed-in users can create fantasy leagues and join by invite code. Database row-level security restricts league and membership reads to members.
- GitHub Actions builds and deploys the site to GitHub Pages.

The season schedule, team rosters, scores, trade approval, league draft, fantasy draft, scoring, and import of other Project Rio stats still need league setup. Their views currently show honest empty states. No game statistics or scores are fabricated.

## Upload official games for Games Played

Upload each official Project Rio `.xlsx` report to the repository's [`games/`](games/) folder on `main` using **Add file → Upload files → Commit changes**. The Pages workflow rebuilds Games Played automatically. Each player listed in the report's `Stats` sheet counts once for that game, including pitchers and players with no at-bats. Team total rows and duplicate copies of the exact same report are ignored. Unknown player names stop deployment so they can be corrected before the count changes.

There is no upload form on the public site yet. Only Games Played is imported from these files; other columns remain blank until the full stats importer is built. The sample report used to design the columns is not in `games/`.

## Run locally

Requires Node.js 22 or newer.

```bash
npm ci
cp .env.example .env
npm run dev -- --host 127.0.0.1
```

The public site works without Supabase settings. Sign-in and league creation become available after the next step.

## Set up accounts and private fantasy leagues

1. Create a Supabase project. In its SQL editor, run `supabase/migrations/001_fantasy.sql`.
2. In Authentication, enable Email sign-in. Add the exact GitHub Pages URL, including the repository path and trailing slash, to **URL Configuration → Redirect URLs**. Add a localhost URL for local sign-in if desired.
3. Copy the project URL and **publishable** key into `.env` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Restart the local server.
4. In the GitHub repository, set the same two values under **Settings → Secrets and variables → Actions → Variables**. These are public client settings. Never add a Supabase secret/service-role key to this frontend.

The generated invite code is visible to league members. Anyone with that code and an account can join; future commissioner controls can add admission rules if needed.

## Publish on GitHub Pages

1. Create a new GitHub repository named `usa-supa-league` (or any name). Upload/push this project's contents to its `main` branch.
2. In repository **Settings → Pages → Build and deployment**, choose **GitHub Actions** as the source.
3. The included workflow deploys automatically on pushes to `main`. It sets Vite's base path from the repository name, so assets load under `https://USERNAME.github.io/REPOSITORY/`.
4. Update the Supabase redirect URL to that final address. For a custom domain or a `USERNAME.github.io` repository, adjust `GITHUB_PAGES_BASE` in the workflow to `/`.

## Next league inputs

- Team names, owners, roster size and draft order/date.
- Season schedule and transaction approval rules.
- Fantasy scoring weights, roster composition, draft order, and season cutoff.
- Final rules for importing the other Project Rio stats and calculating fantasy results.

Player data is in `src/players.json`; each record has ID, name, class, color and source. The current workbook's calculated game-stat cells are intentionally omitted.
