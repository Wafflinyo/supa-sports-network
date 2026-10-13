"""Export the SSL editor's actual DOL values and chemistry to the website.
Usage: python scripts/export_player_data.py /path/main.dol /path/SSL-Editor.html
Use --bone-bat-adjustment only for the SSL-Gear/Tune baseline.
Original stock character values come from the edited Game Data workbook.
Named Mii league profiles are preserved independently from their display names.
Custom additions and chemistry come from the supplied DOL.
Approved trajectory and Bone Goomba changes are applied last.
No game binaries are stored in this repository.
"""
import argparse, hashlib, json, re, struct, sys
import openpyxl
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
COLORS = ['Red','Orange','Yellow','Light Green','Green','Blue','Light Blue','Pink','Purple','Brown','White','Black']
CLASSES = ['Balanced','Power','Speed','Technique']
def export(dol_path, editor_path, bone_bat_adjustment=False, league_stats_path=None):
    if not league_stats_path:
        raise ValueError("Supply --league-stats: original roster values are overridden by the edited league workbook, not the base DOL.")
    binary = Path(dol_path).read_bytes()
    cfg = json.loads(re.search(r'const CFG=(.*?);\n', Path(editor_path).read_text(),re.S).group(1))
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
    previous=json.loads((ROOT/'src/player-data.json').read_text())
    def cid(p): return p['gameCharacterId'] if p['kind']=='character' else 77+COLORS.index(p['color'])
    workbook=openpyxl.load_workbook(league_stats_path,data_only=True,read_only=True)
    sheet=workbook['Game Data']
    header=next(sheet.iter_rows(values_only=True))
    def clean(value): return ' '.join(str(value).split()).lower()
    columns={clean(name):i for i,name in enumerate(header) if name is not None}
    names={row[0].strip().casefold():row for row in sheet.iter_rows(min_row=2,values_only=True) if isinstance(row[0],str) and row[2] in CLASSES}
    mapping={'player class':'Class','weight':'Weight','hit trajectory':'Hitting Trajectory (sweet spot)','slap contact size':'Slap hit contact size','charge contact size':'Charge Hit Contact Size','slap hit power':'Slap Hit Power?','charge hit power':'Charge Hit Power','bunting':'Bunting','speed':'Speed','outfield throwing speed':'Throwing Speed','fielding':'Fielding','curveball speed':'Curveball Speed','charge pitch speed':'Fastball Speed','curve':'Curve','pitching stamina':'Stamina','displayed pitching':'Pitching CSS','displayed batting':'Batting CSS','displayed fielding':'Fielding CSS','displayed speed':'Speed CSS'}
    adjustments=json.loads((ROOT/'src/player-data-adjustments.json').read_text())
    covered=[]
    records={}
    for p in players:
        a=cid(p); values=stats(a)
        if p['kind']=='mii':
            assert stats(a)==stats(a+12), p['name']
            for other in players:
                if other['kind']=='character': assert chemistry(a,cid(other))==chemistry(a+12,cid(other))
        if a==103 and bone_bat_adjustment:
            values.update({'slap contact size':60,'charge contact size':40,'slap hit power':45,'charge hit power':58})
        if p['kind']=='mii':
            values=previous['players'][str(p['id'])]['stats'].copy()
        if p['kind']=='character' and p['id']<=71:
            name=(p.get('portraitName',p['name']) if p['kind']=='mii' else p['name']).strip().casefold()
            if name not in names: raise ValueError(f"League workbook has no row for {p['name']}")
            row=names[name]
            for key, heading in mapping.items():
                value=row[columns[clean(heading)]]
                if key not in ['player class','hit trajectory']:
                    value=float(str(value).strip().rstrip(','))
                    if not value.is_integer(): raise ValueError(f"Non-integer {key} for {p['name']}")
                    value=int(value)
                values[key]=value
            covered.append(p['id'])
        if values['hit trajectory']=='Low':values['hit trajectory']='Medium'
        if p.get('gameCharacterId') in [12,42,76]: values['hit trajectory']='Medium'
        values.update(adjustments['players'].get(str(p['id']),{}))
        good=[];bad=[];conditional=[]
        for other in players:
            if other['id']==p['id']: continue
            if p['kind']==other['kind']=='mii' and p['color']==other['color']:
                assert chemistry(a,a+12)==2
                if other['id'] in previous['players'][str(p['id'])]['conditionalGoodChemistryIds']: conditional.append(other['id'])
                continue
            value=chemistry(a,cid(other))
            (good if value==2 else bad if value==0 else []).append(other['id'])
        records[str(p['id'])]={'stats':values,'goodChemistryIds':good,'badChemistryIds':bad,'conditionalGoodChemistryIds':conditional,'miiColorProfile':False,'statsSource':'current league Mii profile' if p['kind']=='mii' else 'league workbook' if p['id']<=71 else 'custom game DOL'}
        p['class']=values['player class']
    (ROOT/'src/players.json').write_text(json.dumps(players,indent=2)+'\n')
    assert len(covered)==71
    data={'source':{'label':adjustments['label'],'baselineSha256':hashlib.sha256(binary).hexdigest(),'leagueWorkbook':{'name':Path(league_stats_path).name,'sha256':hashlib.sha256(Path(league_stats_path).read_bytes()).hexdigest(),'coveredPlayerIds':covered},'adjustments':adjustments,'miiDatabase':previous['source'].get('miiDatabase'),'miiNote':previous['source']['miiNote']},'players':records}
    (ROOT/'src/player-data.json').write_text(json.dumps(data,indent=2)+'\n')
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('dol_path');parser.add_argument('editor_path')
    parser.add_argument('--bone-bat-adjustment',action='store_true',help='Apply the four approved BoneBat reductions to an older Gear/Tune baseline.')
    parser.add_argument('--league-stats',required=True,help='Edited Game Data workbook for the original 138-player roster.')
    args=parser.parse_args();export(args.dol_path,args.editor_path,args.bone_bat_adjustment,args.league_stats)
