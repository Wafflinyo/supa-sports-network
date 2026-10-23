"""Synchronize every non-Mii SSL player directly from the CURRENT patched main.dol.

Usage: python scripts/export_player_data.py /path/main.dol /path/SSL-Editor.html

Mii profiles and portraits are maintained separately and are preserved. All
non-Mii game fields, including LOW trajectories, come from the binary, never
from an older workbook or an arbitrary all-Medium trajectory override.
Changes to game stats require the current matching main.dol.
"""
import argparse
import hashlib
import json
import re
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COLORS = ['Red','Orange','Yellow','Light Green','Green','Blue','Light Blue','Pink','Purple','Brown','White','Black']
CLASSES = ['Balanced','Power','Speed','Technique']

def export(dol_path, editor_path):
    binary = Path(dol_path).read_bytes()
    cfg_match = re.search(r'const CFG=(.*?);\n', Path(editor_path).read_text(), re.S)
    if not cfg_match:
        raise ValueError('The SSL editor has no recognizable CFG. Do not export unverified stats.')
    cfg = json.loads(cfg_match.group(1))
    sections = [(struct.unpack_from('>I',binary,i*4)[0],
                 struct.unpack_from('>I',binary,0x48+i*4)[0],
                 struct.unpack_from('>I',binary,0x90+i*4)[0]) for i in range(18)]
    def read(address,size=1):
        for offset,start,length in sections:
            if start<=address and address+size<=start+length:
                return int.from_bytes(binary[offset+address-start:offset+address-start+size],'big')
        raise ValueError(f'Unmapped main.dol address {address:x}')
    def stats(cid):
        result={}
        for field in cfg['fields']:
            offset=field['offset']
            address=cfg['stamina']+cid*2 if offset==-2 else cfg['traj']+cid*2 if offset==-1 else cfg['base']+cid*142+offset
            result[field['name']]=read(address,field['size'])
        result['player class']=CLASSES[result['player class']]
        result['hit trajectory']=['Medium','High','Low'][result['hit trajectory']]
        return result
    def chemistry(a,b):
        address=(cfg['base']+a*142+40+b if b<=100 else
                 cfg['base']+b*142+40+a if a<=100 else
                 cfg['chem']+(a-102)*cfg['chemStride']+(b-102))
        value=read(address)
        if value not in (0,1,2):
            raise ValueError(f'Invalid chemistry: {a},{b} -> {value}')
        return value

    players=json.loads((ROOT/'src/players.json').read_text())
    previous=json.loads((ROOT/'src/player-data.json').read_text())
    def cid(p):
        return p['gameCharacterId'] if p['kind']=='character' else 77+COLORS.index(p['color'])
    covered=[]
    records={}
    for p in players:
        char_id=cid(p)
        if p['kind']=='mii':
            # Each color/gender pair plays with the same base Mii statistics.
            if stats(char_id)!=stats(char_id+12):
                raise ValueError(f'Mii male/female base mismatch for {p["name"]}')
            values=previous['players'][str(p['id'])]['stats'].copy()
        else:
            values=stats(char_id)
            covered.append(p['id'])
        good=[];bad=[];conditional=[]
        for other in players:
            if other['id']==p['id']:
                continue
            if p['kind']==other['kind']=='mii' and p['color']==other['color']:
                if other['id'] in previous['players'][str(p['id'])]['conditionalGoodChemistryIds']:
                    conditional.append(other['id'])
                continue
            value=chemistry(char_id,cid(other))
            (good if value==2 else bad if value==0 else []).append(other['id'])
        records[str(p['id'])]={
            'stats':values,'goodChemistryIds':good,'badChemistryIds':bad,
            'conditionalGoodChemistryIds':conditional,'miiColorProfile':False,
            'statsSource':'Current Wii Mii profile' if p['kind']=='mii' else 'Current SSL main.dol'
        }
        p['class']=values['player class']
    if len(covered)!=111:
        raise ValueError(f'Expected exactly 111 non-Mii characters, got {len(covered)}')

    result={'source':{
        'label':'Current SSL main.dol (direct binary export)',
        'baselineSha256':hashlib.sha256(binary).hexdigest(),
        'coveredPlayerIds':covered,
        'miiDatabase':previous['source'].get('miiDatabase'),
        'miiNote':previous['source']['miiNote'],
        'exportNote':'Non-Mii stats come from the binary; Mii identities/stats preserved. Chemistry is read from the binary. No forced trajectory edits.'
        }, 'players':records}
    (ROOT/'src/players.json').write_text(json.dumps(players,indent=2)+'\n')
    (ROOT/'src/player-data.json').write_text(json.dumps(result,indent=2)+'\n')

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('dol_path')
    parser.add_argument('editor_path')
    args=parser.parse_args()
    export(args.dol_path,args.editor_path)
