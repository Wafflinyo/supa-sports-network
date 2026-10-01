# Remove the temporary Test Week

Normal-site checkpoint: `8c38e8dd653c3c2d889172ca44da9ef62de20e95`.
Backup branch: `normal-site-before-test-week`.
This checkpoint keeps putouts at 1 point and assists at 0.75.

The trial is separate from official `games/`, official player appearances, registered accounts, and fantasy database tables. Its reports live only in `test-games/`; its fixture and computed results live in `src/temporary-*.json`.

When testing is finished, make a new cleanup commit rather than force-resetting main:

1. Restore `src/main.jsx`, `src/styles.css`, `.github/workflows/deploy.yml`, and `scripts/build_fantasy_games.py` from the checkpoint, reviewing any later non-test changes before applying them.
2. Delete `src/TemporaryLeague.jsx`, `src/temporary-league.json`, `src/temporary-results.json`, `src/temporary-stat-columns.json`, `scripts/build_temporary_results.py`, and `scripts/review_temporary_lineups.py`.
   Also delete `src/TestMatchupBreakdown.jsx` and `src/temporary-matchup-stats.js`, which provide the test matchup details.
3. Delete every test report and manifest in `test-games/`. Delete test-week documentation if a complete repository cleanup is desired.
   After restoring the original scorer, `scripts/rio_workbook.py` can also be removed if ODS support is no longer wanted. Keep it if any remaining importer still uses it.
4. Keep `src/fantasy-rules.json` at the current agreed weights; it was changed in a separate commit before the temporary setup.
5. Build and deploy. Confirm that Test Week navigation, its Fantasy shortcut, trial teams, scores, and trial assets are absent, and the regular site and Rules & Point System remain available.

Do not rewind main to the checkpoint if other changes were made during the test. Restore only the test-related changes so later legitimate work survives.
