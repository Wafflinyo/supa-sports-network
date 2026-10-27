"""Verify roster identity, Rio aliases, portraits, stats, and chemistry references."""
import json
from pathlib import Path
from player_identity import resolve_player
ROOT=Path(__file__).resolve().parents[1]
players=json.loads((ROOT/'src/players.json').read_text())
data=json.loads((ROOT/'src/player-data.json').read_text())['players']
ids={p['id'] for p in players}
assert len(ids)==len(players)==181
assert set(data)=={str(i) for i in ids}
assert [p['rosterOrder'] for p in players]==list(range(1,182))
assert sum(p['kind']=='mii' for p in players)==70
assert all(p['kind']=='mii' for p in players[-70:])
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
assert {k:data['174']['stats'][k] for k in ['slap hit power','charge hit power','slap contact size','charge contact size']}=={'slap hit power':40,'charge hit power':55,'slap contact size':55,'charge contact size':40}
print('181 players verified: stable IDs, family order, Rio aliases, portraits, all 21 attributes, chemistry references, and Bone Goomba reductions.')
# These approved changes must not regress to the older DOL defaults.
by_name={p['name']:p for p in players}
assert data[str(by_name['Green Shy Guy']['id'])]['stats']['player class']=='Power'
assert data[str(by_name['White Toad']['id'])]['stats']['hit trajectory']=='Medium'
assert data[str(by_name['Purple Kritter']['id'])]['stats']['hit trajectory']=='High'
assert data[str(by_name['Mario']['id'])]['stats']['player class']=='Power'
assert data[str(by_name['Wario']['id'])]['stats']['hit trajectory']=='High'
assert sum(p['kind']=='character' and data[str(p['id'])]['stats']['hit trajectory']=='Low' for p in players)==29
assert all(data[str(p['id'])]['stats']['hit trajectory']=='Medium' for p in players if p.get('gameCharacterId') in [12,42,76])
assert all(data[str(by_name[n]['id'])]['stats']['hit trajectory']=='Low' for n in ['Baby Mario','Baby Luigi','Baby Peach','Blue Yoshi'])
assert by_name['Iggy']['class']=='Speed'
assert data[str(by_name['Mario']['id'])]['stats']['slap contact size']==50
print('29 Low trajectory characters, Patch 2 contact values, classes and Koopa values verified.')

miis=[p for p in players if p['kind']=='mii']
assert all(data[str(p['id'])]['stats']['hit trajectory']=='Low' for p in miis), 'All named Miis must have Low trajectory on site'
assert all('mii' not in p['name'].lower() for p in miis)
assert all(p['portrait'].startswith('portraits/mii-roster-') for p in miis)
assert all((ROOT/'public'/p['portrait']).read_bytes()[8:12]==b'WEBP' for p in miis)
assert all(name not in by_name for name in ['Cap','Pauline (Mii)','Narf','Comet','Rosalina (Mii)','OAO','PANCAKE!?!','Paula','Goombella','Steve Harvey','Mario Judah','Waffle'])
for p in miis:
 for other_id in data[str(p['id'])]['conditionalGoodChemistryIds']:
  q=next(q for q in miis if q['id']==other_id)
  assert p['color']==q['color']
print('All 70 current Wii Mii names, color identities, rendered portraits and replaced-player removals verified.')

assert {p['portraitIndex'] for p in miis}==set(range(70))

wendys=[p for p in players if p['name']=='Wendy']
assert len(wendys)==2 and {p['kind'] for p in wendys}=={'mii','character'}
for p in wendys: assert resolve_player('Wendy',[p['id']])==p['id']
try: resolve_player('Wendy')
except ValueError: pass
else: raise AssertionError('Namesakes must require scheduled or explicit IDs')

assert all(not any(k in p for k in ['gender','miiId','miiSlot']) for p in miis)
