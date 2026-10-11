"""Export the SSL editor's actual DOL values and chemistry to the website.
Usage: python scripts/export_player_data.py /path/main.dol /path/SSL-Editor.html
Use --bone-bat-adjustment only for the SSL-Gear/Tune baseline.
Otherwise all values are exported directly from the supplied DOL.
No game binaries are stored in this repository.
"""
import argparse, hashlib, json, re, struct, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
COLORS = ['Red','Orange','Yellow','Light Green','Green','Blue','Light Blue','Pink','Purple','Brown','White','Black']
CLASSES = ['Balanced','Power','Speed','Technique']
def export(dol_path, editor_path, bone_bat_adjustment=False):
    binary = Path(dol_path).read_bytes()
    cfg = json.loads(re.search(r'const CFG=(.*?);\n', Path(editor_path).read_text()).group(1))
    sections = [(struct.unpack_from('>I',binary,i*4)[0],struct.unpack_from('>I',binary,0x48+i*4)[0],struct.unpack_from('>I',binary,0x90+i*4)[0]) for i in range(18)]
    def read(address,size=1):
        for offset,start,length in sections:
            if start<=address and address+size<=start+length:
                return int.from_bytes(binary[offset+address-start:offset+address-start+size],'big')
        raise ValueError(f'Unmapped address {address:x}')
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
        address=cfg['base']+a*142+40+b if b<=100 else cfg['base']+b*142+40+a if a<=100 else cfg['chem']+(a-102)*cfg['chemStride']+(b-102)
        value=read(address)
        assert value in [0,1,2], (a,b,value)
        return value
    players=json.loads((ROOT/'src/players.json').read_text())
    def cid(p): return p['gameCharacterId'] if p['kind']=='character' else 77+COLORS.index(p['color'])
    records={}
    for p in players:
        a=cid(p); values=stats(a)
        if p['kind']=='mii':
            assert stats(a)==stats(a+12), p['name']
            for other in players:
                if other['kind']=='character': assert chemistry(a,cid(other))==chemistry(a+12,cid(other))
        if a==103 and bone_bat_adjustment:
            values.update({'slap contact size':60,'charge contact size':40,'slap hit power':45,'charge hit power':58})
        good=[];bad=[];conditional=[]
        for other in players:
            if other['id']==p['id']: continue
            if p['kind']==other['kind']=='mii' and p['color']==other['color']:
                assert chemistry(a,a+12)==2
                conditional.append(other['id']);continue
            value=chemistry(a,cid(other))
            (good if value==2 else bad if value==0 else []).append(other['id'])
        records[str(p['id'])]={'stats':values,'goodChemistryIds':good,'badChemistryIds':bad,'conditionalGoodChemistryIds':conditional,'miiColorProfile':p['kind']=='mii'}
        p['class']=values['player class']
    (ROOT/'src/players.json').write_text(json.dumps(players,indent=2)+'\n')
    data={'source':{'label':'SSL-BoneBat game setup' if bone_bat_adjustment else 'Current SSL game setup','baselineSha256':hashlib.sha256(binary).hexdigest(),'adjustments':{'Bone Goomba':{'slap contact size':60,'charge contact size':40,'slap hit power':45,'charge hit power':58}} if bone_bat_adjustment else {},'miiNote':'Mii stats use the matching color profile. Male and female values match. Same-color Mii chemistry requires opposite genders.'},'players':records}
    (ROOT/'src/player-data.json').write_text(json.dumps(data,indent=2)+'\n')
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('dol_path');parser.add_argument('editor_path')
    parser.add_argument('--bone-bat-adjustment',action='store_true',help='Apply the four approved BoneBat reductions to an older Gear/Tune baseline.')
    args=parser.parse_args();export(args.dol_path,args.editor_path,args.bone_bat_adjustment)
