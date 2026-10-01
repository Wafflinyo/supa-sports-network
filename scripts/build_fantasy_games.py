"""Score official Project Rio reports using the site's fantasy-rules.json.

games/schedule.json supplies the real pregame start time and each participating
player ID. Its IDs are also synced to Supabase for authoritative lineup locks.
"""
import json
from collections import Counter
from datetime import datetime
from pathlib import Path
from rio_workbook import read_rio_workbook

ROOT = Path(__file__).resolve().parents[1]
rules = json.loads((ROOT / 'src/fantasy-rules.json').read_text())
roster = json.loads((ROOT / 'src/players.json').read_text())
by_name = {p['name'].strip().casefold(): p['id'] for p in roster}
assert len(by_name) == len(roster), 'Player names must be unique or explicitly mapped'

BAT = {'singles': 'Singles', 'doubles': 'Doubles', 'triples': 'Triples', 'homeRuns': 'Home Runs',
       'runs': 'Runs', 'rbi': 'RBI', 'walks': 'Walks', 'hitByPitch': 'Hit By Pitch',
       'stolenBases': 'Stolen Bases', 'caughtStealing': 'Caught Stealing',
       'strikeouts': 'Strikeouts', 'doublePlaysHitInto': 'Double Plays Hit Into', 'grandSlams': 'Grand Slams'}
FIELD = {'putouts': 'Putouts', 'assists': 'Assists', 'buddyJumpPutouts': 'Buddy Jump Putouts',
         'doublePlays': 'Double Plays', 'triplePlays': 'Triple Plays', 'bobbles': 'Bobbles'}
PITCH = {'strikeouts': 'Strikeouts', 'hitsAllowed': 'Hits Allowed', 'earnedRuns': 'Earned Runs',
         'hrAllowed': 'HR Allowed', 'walks': 'Walks', 'beanBalls': 'Bean Balls', 'pickoffs': 'Pickoffs'}


def rows_by_heading(sheet):
    values = sheet.iter_rows(values_only=True)
    headings = next(values)
    return (dict(zip(headings, row)) for row in values)


def num(row, heading):
    value = row.get(heading)
    if value is None:
        raise ValueError(f'Missing {heading} for {row.get("Player")}')
    if not isinstance(value, (int, float)):
        raise ValueError(f'Invalid {heading} for {row.get("Player")}: {value!r}')
    return value


def weighted(row, mapping, weights):
    return sum(num(row, heading) * weights[key] for key, heading in mapping.items())


def score_report(entry, report_directory=None):
    filename = entry['report']
    if Path(filename).name != filename or not (Path(filename).suffix.lower() in {'.xlsx','.ods'} or filename.endswith('.rio.json')):
        raise ValueError('A report must be XLSX, ODS, or reviewed Rio JSON inside its report directory')
    path = (Path(report_directory) if report_directory else ROOT / 'games') / filename
    if not path.is_file():
        raise ValueError(f'Missing report: {filename}')
    wb = read_rio_workbook(path)
    try:
        batting = {}
        pitchers = []
        team = None
        team_runs = Counter()
        for row_number, row in enumerate(rows_by_heading(wb['Stats']), start=2):
            team = row.get('Team') or team
            if not row.get('Player') or row.get('Position') == 'N/A':
                continue
            team_runs[team] += num(row, 'Runs')
            name = row['Player'].strip()
            player_id = entry.get('playerRows', {}).get(str(row_number), by_name.get(name.casefold()))
            if player_id not in entry['players']:
                raise ValueError(f'{filename} row {row_number}: {name} has no scheduled player ID; fix schedule.json')
            if player_id in batting:
                raise ValueError(f'{filename}: player ID {player_id} occurs twice in Stats; map duplicate names by row')
            batting[player_id] = {'name': name, 'team': team,
                                  'batting': weighted(row, BAT, rules['batting']),
                                  'fielding': weighted(row, FIELD, rules['fielding'])}
        for row_number, row in enumerate(rows_by_heading(wb['Pitching']), start=2):
            name = row.get('Player')
            if not name or 'Totals' in name:
                continue
            player_id = entry.get('pitcherRows', {}).get(str(row_number), by_name.get(name.strip().casefold()))
            if player_id not in batting:
                raise ValueError(f'{filename} Pitching row {row_number}: unmapped pitcher {name}')
            pitchers.append((player_id, row))
        team_counts = Counter(batting[player_id]['team'] for player_id, _ in pitchers)
        if not batting or set(batting) != set(entry['players']):
            raise ValueError(f'{filename}: scheduled and actual player IDs differ')
        for player_id, row in pitchers:
            outs = round(num(row, 'Innings Pitched') * 3)
            if outs < 0:
                raise ValueError(f'{filename}: negative innings')
            score = outs * rules['pitching']['outs'] + weighted(row, PITCH, rules['pitching'])
            score += (outs >= 9) * rules['pitching']['threeInningBonus']
            score += (team_counts[batting[player_id]['team']] == 1) * rules['pitching']['completeGameBonus']
            batting[player_id]['pitching'] = score
        if len(team_runs) != 2:
            raise ValueError(f'{filename}: expected two teams for shutout scoring')
        for stats in batting.values():
            opponent_runs = sum(runs for team, runs in team_runs.items() if team != stats['team'])
            stats['teamBonus'] = rules['team']['shutoutBonus'] if opponent_runs == 0 else 0
        return {str(player_id): {**{k: round(stats[k], 2) for k in ('batting', 'fielding', 'teamBonus')},
                                 'pitching': round(stats.get('pitching', 0), 2),
                                 'total': round(stats['batting'] + stats['fielding'] + stats.get('pitching', 0) + stats['teamBonus'], 2)}
                for player_id, stats in batting.items()}
    finally:
        wb.close()


def build(schedule_path=ROOT / 'games/schedule.json', output_path=ROOT / 'src/fantasy-games.json'):
    entries = json.loads(Path(schedule_path).read_text())
    seen = set()
    reports = set()
    result = []
    for entry in entries:
        start = datetime.fromisoformat(entry['startsAt'].replace('Z', '+00:00'))
        if start.tzinfo is None or start.utcoffset() is None:
            raise ValueError(f'{entry["id"]}: startsAt needs a timezone offset')
        if not entry['id'] or entry['id'] in seen or not entry['players'] or len(set(entry['players'])) != len(entry['players']):
            raise ValueError('Each scheduled game needs a unique ID and distinct player IDs')
        if entry.get('report') in reports:
            raise ValueError(f'{entry["id"]}: report used by another game')
        if not set(entry['players']).issubset({p['id'] for p in roster}):
            raise ValueError(f'{entry["id"]}: unknown player ID')
        seen.add(entry['id'])
        if entry.get('report'):
            reports.add(entry['report'])
        scores = score_report(entry) if entry.get('report') else None
        result.append({'id': entry['id'], 'startsAt': entry['startsAt'], 'playerScores': scores or {}})
    Path(output_path).write_text(json.dumps(result, indent=2) + '\n')
    print(f'Scored {sum(bool(x["playerScores"]) for x in result)} of {len(result)} scheduled games')
    return result


if __name__ == '__main__':
    build()
