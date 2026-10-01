# Temporary Project Rio reports

Keep exhibition reports here, outside official `games/` data.

Reports can be original Project Rio `.xlsx` files or LibreOffice `.ods` files. ODS imports read cached cell values, including merged team-name cells, without converting or editing the source report. Undefined pitching rates such as `INF` are displayed as unavailable; the underlying counts still score normally.

Alternatively, publish a reviewed `.rio.json` extract containing only `Stats` and `Pitching` row objects needed for the site. This keeps the source workbook, unused sheets, and document metadata out of the public repository. Registered JSON reports go through the same roster, lineup, duplicate-report, and scoring validation.

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

To reset results, clear `reports.json` and remove the exhibition report files, then rebuild. To remove the whole trial later, follow `docs/remove-test-week.md`. Official season data is separate.
