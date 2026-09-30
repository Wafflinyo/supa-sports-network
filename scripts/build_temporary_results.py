"""Rebuild exhibition stats and fantasy matchups from registered Rio reports.

Temporary reports are isolated from games/ and official season scoring.
"""
import hashlib
import json
from collections import Counter
from pathlib import Path
from openpyxl import load_workbook
from build_fantasy_games import score_report, rows_by_heading, num, by_name

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / 'test-games'
STAT_COLUMNS = {
    'atBats':'At-Bats', 'plateAppearances':'Plate Appearances', 'runs':'Runs',
    'hits':'Hits', 'rbi':'RBI', 'homeRuns':'Home Runs', 'singles':'Singles',
    'doubles':'Doubles', 'triples':'Triples', 'walks':'Walks', 'hitByPitch':'Hit By Pitch',
    'strikeouts':'Strikeouts', 'stolenBases':'Stolen Bases', 'caughtStealing':'Caught Stealing',
    'putouts':'Putouts', 'assists':'Assists', 'buddyJumpPutouts':'Buddy Jump Putouts',
    'doublePlays':'Double Plays', 'triplePlays':'Triple Plays', 'bobbles':'Bobbles',
}
PITCH_COLUMNS = {'pitchStrikeouts':'Strikeouts', 'hitsAllowed':'Hits Allowed',
                 'earnedRuns':'Earned Runs', 'pitchWalks':'Walks', 'hrAllowed':'HR Allowed'}

def build(fixture_path=ROOT/'src/temporary-league.json', manifest_path=REPORTS/'reports.json',
          output_path=ROOT/'src/temporary-results.json', report_directory=REPORTS):
    fixture = json.loads(Path(fixture_path).read_text())
    entries = json.loads(Path(manifest_path).read_text())
    scheduled = {g['id']:g for g in fixture['schedule']}
    owners = {pid:t['id'] for t in fixture['teams'] for pid in t['players']}
    totals, games, seen, fingerprints = {}, [], set(), set()
    standings = {t['id']:{'played':0,'wins':0,'losses':0,'ties':0,'runsFor':0,'runsAgainst':0} for t in fixture['teams']}
    for report in entries:
        game_id = report['gameId']
        if game_id not in scheduled or game_id in seen:
            raise ValueError(f'Unknown or duplicate fixture: {game_id}')
        seen.add(game_id)
        game = scheduled[game_id]
        entry = {**game, **report, 'id':game_id}
        # Manifest can map Mii row names, but cannot change roster/start-time contracts.
        entry['players'], entry['startsAt'] = game['players'], game['startsAt']
        scores = score_report(entry, report_directory)
        path = Path(report_directory)/entry['report']
        fingerprint = hashlib.sha256(path.read_bytes()).hexdigest()
        if fingerprint in fingerprints:
            raise ValueError('The same report cannot count for two fixtures')
        fingerprints.add(fingerprint)
        runs = Counter()
        wb = load_workbook(path, read_only=True, data_only=True)
        try:
            export_teams = {}
            export_team = None
            for row_number, row in enumerate(rows_by_heading(wb['Stats']), start=2):
                export_team = row.get('Team') or export_team
                if not row.get('Player') or row.get('Position') == 'N/A': continue
                pid = entry.get('playerRows',{}).get(str(row_number), by_name.get(row['Player'].strip().casefold()))
                if pid not in game['players']: raise ValueError('Player is not in the scheduled roster')
                team = owners[pid]
                export_teams.setdefault(team,set()).add(export_team)
                stats = totals.setdefault(str(pid), Counter())
                stats['gamesPlayed'] += 1
                for key, heading in STAT_COLUMNS.items(): stats[key] += num(row, heading)
                runs[team] += num(row,'Runs')
                stats['fantasyPoints'] += scores[str(pid)]['total']
            if len(export_teams) != 2 or any(len(names)!=1 for names in export_teams.values()) or len(set.union(*export_teams.values()))!=2:
                raise ValueError('Report team assignments do not match the two scheduled rosters')
            for row_number, row in enumerate(rows_by_heading(wb['Pitching']), start=2):
                if not row.get('Player') or 'Totals' in row['Player']: continue
                pid = entry.get('pitcherRows',{}).get(str(row_number), by_name.get(row['Player'].strip().casefold()))
                stats = totals[str(pid)]
                stats['outs'] += round(num(row,'Innings Pitched')*3)
                stats['pitchingGames'] += 1
                for key, heading in PITCH_COLUMNS.items(): stats[key] += num(row,heading)
        finally:
            wb.close()
        away, home = game['awayId'], game['homeId']
        for team, opponent in [(away,home),(home,away)]:
            s = standings[team]
            s['played'] += 1
            s['runsFor'] += runs[team]; s['runsAgainst'] += runs[opponent]
            s['wins' if runs[team]>runs[opponent] else 'losses' if runs[team]<runs[opponent] else 'ties'] += 1
        games.append({'id':game_id,'startsAt':game['startsAt'],'awayRuns':runs[away],
                      'homeRuns':runs[home],'playerScores':scores})
    for s in totals.values():
        s['inningsPitched'] = round(s['outs']/3,2)
        s['battingAverage'] = round(s['hits']/s['atBats'],3) if s['atBats'] else None
        bases = s['singles']+2*s['doubles']+3*s['triples']+4*s['homeRuns']
        s['slugging'] = round(bases/s['atBats'],3) if s['atBats'] else None
        s['era7'] = round(s['earnedRuns']*21/s['outs'],3) if s['outs'] else None
        s['whip'] = round((s['hitsAllowed']+s['pitchWalks'])*3/s['outs'],3) if s['outs'] else None
    output = {'fixtureId':fixture['id'],'games':games,'playerStats':totals,'standings':standings}
    Path(output_path).write_text(json.dumps(output,indent=2)+'\n')
    print(f'Built {len(games)} exhibition results; {len(totals)} player stat lines. Official data untouched.')
    return output

if __name__ == '__main__': build()
