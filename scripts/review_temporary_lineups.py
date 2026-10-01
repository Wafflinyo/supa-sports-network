"""Review saved rosters without changing either draft or consuming its RNG."""
import itertools
import json
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'src/temporary-league.json'
data = json.loads(path.read_text())
profiles = data['profiles']
owners = {pid: team for team in data['teams'] for pid in team['players']}

for team in data['teams']:
    roster = team['players']
    # Exhaustive ordering: contact/speed first, power 3–5, then remaining bats.
    # Chemistry breaks close choices; negative neighbors are forbidden.
    orders = np.array(list(itertools.permutations(range(9))), dtype=np.int8)
    weights = np.array([[.65 * profiles[str(pid)]['contact'] + .35 * profiles[str(pid)]['speed']
                         if slot < 2 else .7 * profiles[str(pid)]['chargePower'] + .3 * profiles[str(pid)]['contact']
                         if slot < 5 else .25 * (.65 * profiles[str(pid)]['batting'] + .2 * profiles[str(pid)]['contact'] + .15 * profiles[str(pid)]['speed'])
                         for pid in roster] for slot in range(9)])
    chemistry = np.zeros((9, 9))
    for key, value in [('goodChemistryPairs', 2), ('badChemistryPairs', -10000)]:
        for a, b in team[key]:
            i, j = roster.index(a), roster.index(b)
            chemistry[i, j] = chemistry[j, i] = value
    scores = weights[np.arange(9), orders].sum(axis=1)
    scores += chemistry[orders, np.roll(orders, -1, axis=1)].sum(axis=1)
    team['battingOrder'] = [roster[int(i)] for i in orders[int(scores.argmax())]]

def priority(pid):
    p = profiles[str(pid)]
    team = owners[pid]
    position = next(pos for pos, player in team['defense'].items() if player == pid)
    score = .32*p['batting'] + .19*p['contact'] + .20*p['fielding'] + .09*p['speed'] + .2*p['chargePower']
    score += 5 if p['trajectory'] == 'High' else 0
    score += 5 if p['ability'] in {'Super Dive','Scatter Dive','Ink Dive','Magical Catch','Tongue Catch','Suction Catch','Keeper Catch','Piranha Catch'} else 0
    # Higher putout weighting favors first base, followed by middle infield.
    score += 7 if position == '1B' else 5 if position in {'2B','SS'} else 0
    score += .18*p['pitching'] + 5 if position == 'P' else 3 if pid in team['pitchingDepth'][1:] else 0
    score += 4 if any(pid in pair for pair in team['buddyPairs']) else 0
    return score

for team in data['fantasyTeams']:
    if data.get('fantasyLineupsSetBy'): continue
    ranked = sorted(team['players'], key=lambda pid: (-priority(pid), pid))
    team['starters'], team['bench'] = ranked[:7], ranked[7:]

positions = {'P','C','1B','2B','3B','SS','LF','CF','RF'}
league_ids = [p for t in data['teams'] for p in t['players']]
assert len(set(league_ids)) == len(league_ids) == 90
for team in data['teams']:
    assert set(team['defense']) == positions
    assert set(team['defense'].values()) == set(team['battingOrder']) == set(team['players'])
    assert len(team['battingOrder']) == len(set(team['battingOrder'])) == 9
    assert team['pitchingDepth'][0] == team['defense']['P']
    assert profiles[str(team['defense']['P'])]['pitching'] >= sorted(profiles[str(p)]['pitching'] for p in team['players'])[-2]
    for a,b in zip(team['battingOrder'], team['battingOrder'][1:]+team['battingOrder'][:1]):
        assert [a,b] not in team['badChemistryPairs'] and [b,a] not in team['badChemistryPairs']
    outfield = {team['defense'][pos] for pos in ['LF','CF','RF']}
    assert team['buddyPairs'] and all(set(pair) <= outfield for pair in team['buddyPairs'])
for team in data['fantasyTeams']:
    assert len(team['starters']) == 7 and len(team['bench']) == 3
    assert set(team['starters']).isdisjoint(team['bench'])
    assert set(team['starters']+team['bench']) == set(team['players'])
    if not data.get('fantasyLineupsSetBy'):
        assert min(priority(p) for p in team['starters']) >= max(priority(p) for p in team['bench'])
fantasy_ids = [p for t in data['fantasyTeams'] for p in t['players']]
assert len(set(fantasy_ids)) == len(fantasy_ids) == 80 and set(fantasy_ids) <= set(league_ids)
path.write_text(json.dumps(data, indent=2)+'\n')
print('Reviewed 10 batting orders, all 90 defensive assignments, and eight 7/3 fantasy lineups. Draft ownership unchanged.')
