"""Resolve Rio names against stable site IDs, using scheduled IDs for namesakes."""
import json
from pathlib import Path
ROSTER = json.loads((Path(__file__).resolve().parents[1] / 'src/players.json').read_text())
CANDIDATES = {}
for player in ROSTER:
    for name in [player['name'], *player.get('rioAliases', []), player.get('portraitName', player['name'])]:
        CANDIDATES.setdefault(name.strip().casefold(), set()).add(player['id'])
def resolve_player(name, eligible=None):
    candidates = CANDIDATES.get(name.strip().casefold(), set())
    if eligible is not None:
        candidates = candidates.intersection(eligible)
    if len(candidates) == 1:
        return next(iter(candidates))
    if len(candidates) > 1:
        raise ValueError(f'Ambiguous Rio name {name!r}; specify the player ID in playerRows/pitcherRows')
    return None
