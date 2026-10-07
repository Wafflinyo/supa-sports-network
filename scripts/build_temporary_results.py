"""Rebuild exhibition stats and fantasy matchups from registered Rio reports.

Temporary reports are isolated from games/ and official season scoring.
"""
import hashlib
import json
import math
from collections import Counter
from pathlib import Path
from rio_workbook import read_rio_workbook
from build_fantasy_games import score_report, rows_by_heading, num, by_name
from player_identity import resolve_player

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / 'test-games'
STAT_COLUMNS = {
    'atBats':'At-Bats', 'plateAppearances':'Plate Appearances', 'runs':'Runs',
    'hits':'Hits', 'rbi':'RBI', 'homeRuns':'Home Runs', 'singles':'Singles',
    'doubles':'Doubles', 'triples':'Triples', 'walks':'Walks', 'hitByPitch':'Hit By Pitch',
    'batStrikeouts':'Strikeouts', 'stolenBases':'Stolen Bases', 'caughtStealing':'Caught Stealing',
    'putouts':'Putouts', 'assists':'Assists', 'buddyJumpPutouts':'Buddy Jump Putouts',
    'doublePlays':'Double Plays', 'triplePlays':'Triple Plays', 'bobbles':'Bobbles',
    'oneHr':'1HR', 'twoHr':'2HR', 'threeHr':'3HR', 'grandSlams':'Grand Slams',
    'itpHomeRuns':'ITP Home Runs', 'totalBases':'Total Bases', 'sacFlys':'Sac Flys',
    'doublePlaysHitInto':'Double Plays Hit Into', 'triplePlaysHitInto':'Triple Plays Hit Into',
    'buddyJumpsHitInto':'Buddy Jumps Hit Into', 'starSwings':'Star Swings', 'starHits':'Star Hits',
    'batStarsUsed':'Stars Used', 'stealAttempts':'Steal Attempts', 'buddyJumpAttempts':'Buddy Jump Attempts',
    'starBases':'Star Bases Helper',
}
STAT_COLUMNS['batWalks'] = STAT_COLUMNS.pop('walks')
PITCH_COLUMNS = {'pitchStrikeouts':'Strikeouts', 'hitsAllowed':'Hits Allowed',
                 'earnedRuns':'Earned Runs', 'pitchWalks':'Walks', 'hrAllowed':'HR Allowed',
                 'battersFaced':'Batters Faced', 'pitches':'Pitches', 'strikes':'Strikes', 'balls':'Balls',
                 'beanBalls':'Bean Balls', 'runsAllowed':'Runs Allowed', 'singlesAllowed':'Singles Allowed',
                 'doublesAllowed':'Doubles Allowed', 'triplesAllowed':'Triples Allowed',
                 'inheritedRuns':'Inherited Runs', 'starPitches':'Star Pitches', 'pitchStarsUsed':'Stars Used',
                 'pickoffs':'Pickoffs', 'pickoffAttempts':'Pickoff Attempts',
                 'atBatsAgainst':'At-Bats Against Helper', 'basesAllowed':'Total Bases Allowed Helper'}
BAT_RATES = {'battingAverage':'Batting Average', 'onBase':'On Base %', 'slug':'Slug %',
             'onBasePlusSlug':'On Base + Slug', 'starSlug':'Star Slug %'}
PITCH_RATES = {'era7':'ERA-7', 'era9':'ERA-9', 'whip':'WHIP', 'baAgainst':'BA Against',
               'obAgainst':'OB% Against', 'slgAgainst':'SLG Against', 'opsAgainst':'OPS Against'}

def ratio(numerator, denominator):
    return numerator/denominator if denominator else None

def collect_rates(row, columns, pid, samples):
    for key, heading in columns.items():
        if heading not in row: raise ValueError(f'Missing {heading} for {row.get("Player")}')
        value = row[heading]
        # Rio exports INF when a pitcher allows runs/hits without an out.
        # Preserve raw counts; leave undefined rate averages unavailable.
        if isinstance(value,str) and value.strip().upper() in {'INF','INFINITY','NAN'}: continue
        if value is not None:
            if not isinstance(value,(int,float)): raise ValueError(f'Invalid {heading}')
            if not math.isfinite(value): continue
            samples.setdefault(str(pid),{}).setdefault(key,[]).append(value)

def build(fixture_path=ROOT/'src/temporary-league.json', manifest_path=REPORTS/'reports.json',
          output_path=ROOT/'src/temporary-results.json', report_directory=REPORTS):
    fixture = json.loads(Path(fixture_path).read_text())
    entries = json.loads(Path(manifest_path).read_text())
    scheduled = {g['id']:g for g in fixture['schedule']}
    owners = {pid:t['id'] for t in fixture['teams'] for pid in t['players']}
    totals, games, seen, fingerprints = {}, [], set(), set()
    lineups, rate_samples = {}, {}
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
        before = {pid:dict(stats) for pid,stats in totals.items()}
        runs = Counter()
        wb = read_rio_workbook(path)
        try:
            export_teams = {}
            export_team = None
            reported_lineups = {}
            for row_number, row in enumerate(rows_by_heading(wb['Stats']), start=2):
                export_team = row.get('Team') or export_team
                if not row.get('Player') or row.get('Position') == 'N/A': continue
                pid = (entry.get('playerRows', {}).get(str(row_number)) or resolve_player(row['Player'], entry['players']))
                if pid not in game['players']: raise ValueError('Player is not in the scheduled roster')
                team = owners[pid]
                export_teams.setdefault(team,set()).add(export_team)
                # Rio lists the starting position first, followed by substitutions.
                position = row['Position'].split(',')[0].strip().upper()
                if position not in {'P','C','1B','2B','3B','SS','LF','CF','RF'}:
                    raise ValueError(f'Unknown starting position {position!r}')
                lineup = reported_lineups.setdefault(team,{'battingOrder':[],'defense':{},'positionsByPlayer':{},'pitchingDepth':[]})
                if position in lineup['defense']: raise ValueError(f'Duplicate starting position: {position}')
                lineup['battingOrder'].append(pid)
                lineup['defense'][position] = pid
                lineup['positionsByPlayer'][str(pid)] = row['Position']
                stats = totals.setdefault(str(pid), Counter())
                played_positions = stats.setdefault('positionsPlayed', [])
                for played in row['Position'].split(','):
                    played = played.strip().upper()
                    if played not in {'P','C','1B','2B','3B','SS','LF','CF','RF'}:
                        raise ValueError(f'Unknown played position {played!r}')
                    if played not in played_positions: played_positions.append(played)
                stats['gamesPlayed'] += 1
                for key, heading in STAT_COLUMNS.items(): stats[key] += num(row, heading)
                collect_rates(row, BAT_RATES, pid, rate_samples)
                runs[team] += num(row,'Runs')
                stats['fantasyPoints'] += scores[str(pid)]['total']
            if len(export_teams) != 2 or any(len(names)!=1 for names in export_teams.values()) or len(set.union(*export_teams.values()))!=2:
                raise ValueError('Report team assignments do not match the two scheduled rosters')
            for row_number, row in enumerate(rows_by_heading(wb['Pitching']), start=2):
                if not row.get('Player') or 'Totals' in row['Player']: continue
                pid = (entry.get('pitcherRows', {}).get(str(row_number)) or resolve_player(row['Player'], entry['players']))
                reported_lineups[owners[pid]]['pitchingDepth'].append(pid)
                stats = totals[str(pid)]
                stats['outs'] += round(num(row,'Innings Pitched')*3)
                stats['threeInningGames'] += int(round(num(row,'Innings Pitched')*3)>=9)
                stats['pitchingGames'] += 1
                for key, heading in PITCH_COLUMNS.items(): stats[key] += num(row,heading)
                collect_rates(row, PITCH_RATES, pid, rate_samples)
        finally:
            wb.close()
        away, home = game['awayId'], game['homeId']
        for team, lineup in reported_lineups.items():
            if len(lineup['defense']) != 9: raise ValueError('A report needs all nine starting positions per team')
            if len(lineup['pitchingDepth']) == 1:
                totals[str(lineup['pitchingDepth'][0])]['completeGames'] += 1
            starter = lineup['defense']['P']
            lineup['pitchingDepth'] = [starter]+[pid for pid in lineup['pitchingDepth'] if pid!=starter]
            lineups[team] = lineup
        for team, opponent in [(away,home),(home,away)]:
            s = standings[team]
            s['played'] += 1
            s['runsFor'] += runs[team]; s['runsAgainst'] += runs[opponent]
            s['wins' if runs[team]>runs[opponent] else 'losses' if runs[team]<runs[opponent] else 'ties'] += 1
            if runs[opponent] == 0:
                for pid in reported_lineups[team]['battingOrder']:
                    totals[str(pid)]['teamShutouts'] += 1
        game_stats = {}
        for pid in game['players']:
            key = str(pid)
            game_stats[key] = {k:v-before.get(key,{}).get(k,0) for k,v in totals[key].items() if isinstance(v,(int,float))}
            game_stats[key]['positionsPlayed'] = reported_lineups[owners[pid]]['positionsByPlayer'][key].split(',')
        games.append({'id':game_id,'startsAt':game['startsAt'],'awayRuns':runs[away],
                      'homeRuns':runs[home],'playerScores':scores,'teamLineups':reported_lineups,'playerStats':game_stats})
    per_game = {}
    for pid, s in totals.items():
        s['battingAverage'] = ratio(s['hits'],s['atBats'])
        s['onBase'] = ratio(s['hits']+s['batWalks']+s['hitByPitch'],s['plateAppearances'])
        s['slug'] = ratio(s['totalBases'],s['atBats'])
        s['onBasePlusSlug'] = s['onBase']+s['slug'] if s['onBase'] is not None and s['slug'] is not None else None
        s['starSlug'] = ratio(s['starBases'],s['starSwings'])
        if s['pitchingGames']:
            s['inningsPitched'] = s['outs']/3
            s['era7'],s['era9'] = ratio(s['earnedRuns']*21,s['outs']),ratio(s['earnedRuns']*27,s['outs'])
            s['whip'] = ratio((s['hitsAllowed']+s['pitchWalks'])*3,s['outs'])
            s['baAgainst'] = ratio(s['hitsAllowed'],s['atBatsAgainst'])
            s['obAgainst'] = ratio(s['hitsAllowed']+s['pitchWalks']+s['beanBalls'],s['battersFaced'])
            s['slgAgainst'] = ratio(s['basesAllowed'],s['atBatsAgainst'])
            s['opsAgainst'] = s['obAgainst']+s['slgAgainst'] if s['obAgainst'] is not None and s['slgAgainst'] is not None else None
        counting = {key:value/s['gamesPlayed'] for key,value in s.items()
                    if key not in {'gamesPlayed',*BAT_RATES,*PITCH_RATES} and isinstance(value,(int,float))}
        per_game[pid] = {**counting, **{key:sum(values)/len(values) for key,values in rate_samples.get(pid,{}).items()}}
    output = {'fixtureId':fixture['id'],'games':games,'playerStats':totals,'standings':standings,
              'lineups':lineups,'perGame':per_game}
    Path(output_path).write_text(json.dumps(output,indent=2)+'\n')
    print(f'Built {len(games)} exhibition results; {len(totals)} player stat lines. Official data untouched.')
    return output

if __name__ == '__main__': build()
