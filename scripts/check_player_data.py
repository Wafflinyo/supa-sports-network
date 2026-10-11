"""Verify roster identity, Rio aliases, portraits, stats, and chemistry references."""
import json
from pathlib import Path
from player_identity import resolve_player
ROOT=Path(__file__).resolve().parents[1]
players=json.loads((ROOT/'src/players.json').read_text())
data=json.loads((ROOT/'src/player-data.json').read_text())['players']
ids={p['id'] for p in players}
assert len(ids)==len(players)==178
assert set(data)=={str(i) for i in ids}
assert [p['rosterOrder'] for p in players]==list(range(1,179))
assert sum(p['kind']=='mii' for p in players)==67
assert all(p['kind']=='mii' for p in players[-67:])
new_names=['Bone Goomba','Tropical Wiggler','Paragloomba','Bubble Blooper','Flower Fields Monty']
for name in new_names:
    p=next(p for p in players if p['name']==name)
    assert resolve_player(name)==p['id']
    assert p.get('portraitIndex') is None
assert resolve_player('Flower Field Monty')==178
assert resolve_player('Blue Paratroopa')==resolve_player('Yellow Paratroopa')==150
for p in players:
    record=data[str(p['id'])]
    assert len(record['stats'])==21
    assert record['stats']['player class']==p['class']
    groups=[set(record[key]) for key in ['goodChemistryIds','badChemistryIds','conditionalGoodChemistryIds']]
    assert all(group<=ids and p['id'] not in group for group in groups)
    assert not any(groups[i]&groups[j] for i in range(3) for j in range(i+1,3))
    if p.get('portrait'): assert (ROOT/'public'/p['portrait']).is_file()
assert {k:data['174']['stats'][k] for k in ['slap hit power','charge hit power','slap contact size','charge contact size']}=={'slap hit power':45,'charge hit power':58,'slap contact size':60,'charge contact size':40}
print('178 players verified: stable IDs, family order, Rio aliases, portraits, all 21 attributes, chemistry references, and Bone Goomba reductions.')
# These approved changes must not regress to the older DOL defaults.
by_name={p['name']:p for p in players}
assert data[str(by_name['Green Shy Guy']['id'])]['stats']['player class']=='Power'
assert data[str(by_name['White Toad']['id'])]['stats']['hit trajectory']=='High'
assert data[str(by_name['Purple Kritter']['id'])]['stats']['hit trajectory']=='High'
assert data[str(by_name['Mario']['id'])]['stats']['player class']=='Power'
assert data[str(by_name['Wario']['id'])]['stats']['hit trajectory']=='High'
assert all(r['stats']['hit trajectory'] in ['Medium','High'] for r in data.values())
assert all(data[str(p['id'])]['stats']['hit trajectory']=='Medium' for p in players if p.get('gameCharacterId') in [12,42,76])
print('Edited league classes, White Toad trajectory, Koopa trajectories, and no-low-trajectory rule verified.')
