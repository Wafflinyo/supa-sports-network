"""Publish pregame player starts for Supabase's server-enforced lineup locks."""
import json
import os
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
schedule = json.loads((ROOT / 'games/schedule.json').read_text())
if not schedule:
    print('No fantasy games scheduled')
    raise SystemExit(0)

url = os.environ.get('SUPABASE_URL')
secret = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
if not url or not secret:
    raise SystemExit('Scheduled games require SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enforce lineup locks')

rows = [{'game_key': game['id'], 'player_id': player_id, 'starts_at': game['startsAt']}
        for game in schedule for player_id in game['players']]
request = urllib.request.Request(
    url.rstrip('/') + '/rest/v1/fantasy_player_schedule?on_conflict=game_key%2Cplayer_id',
    data=json.dumps(rows).encode(), method='POST',
    headers={'apikey': secret, 'Authorization': f'Bearer {secret}',
             'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=minimal'},
)
with urllib.request.urlopen(request, timeout=30) as response:
    if response.status not in (200, 201, 204):
        raise RuntimeError(f'Schedule sync returned HTTP {response.status}')
print(f'Synced {len(rows)} player game starts')
