# Temporary Project Rio reports

Keep exhibition reports here, outside official `games/` data.

Add each report to `reports.json` with its fixture ID, for example:

```json
[
  {
    "gameId": "test-week-1-game-1",
    "report": "Delfino vs Ricco.xlsx",
    "playerRows": {"2": 1},
    "pitcherRows": {"2": 1}
  }
]
```

`playerRows` and `pitcherRows` map actual Excel row numbers to site player IDs. Only use overrides when the export name differs, such as a named Mii or `Hammer Bro.`. Always review the full report mapping; the example is not a complete roster.

Each report must match all 18 scheduled players and their two team rosters. Fixture dates determine the fantasy week even if games are simulated early. One report per fixture; duplicate files and duplicate fixtures fail the build.

Run `python scripts/build_temporary_results.py`, then `npm run build`. GitHub deployment also runs this builder. The output updates the Test Week results, player stats, standings, and fixed-lineup fantasy totals. Bench points are displayed but excluded from matchup totals. This does not activate web uploads or account-based lineup editing.

To reset results, clear `reports.json` and remove the exhibition XLSX files, then rebuild. To remove the whole trial later, remove the Test Week entry/component and builder workflow step. Official season data is separate.
