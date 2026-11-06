import {compareTeamRecords} from './season-data.js';

const numberOrZero=value=>Number.isFinite(Number(value))?Number(value):0;

// Sort the underlying unrounded values, not the two-decimal strings shown
// in the table. Null averages (teams without a released game) sort last.
export function teamStatColumnValue(row,key,view='Totals') {
  const gp=numberOrZero(row.gp);
  if(key==='name')return row.name||'';
  if(key==='gp')return gp;
  if(key==='record')return numberOrZero(row.wins)+numberOrZero(row.losses)
    ? numberOrZero(row.wins)/(numberOrZero(row.wins)+numberOrZero(row.losses)) : 0;
  if(key==='homeRecord'||key==='awayRecord'){
    const prefix=key==='homeRecord'?'home':'away';
    const wins=numberOrZero(row[prefix+'Wins']),losses=numberOrZero(row[prefix+'Losses']);
    return wins+losses?wins/(wins+losses):0;
  }
  if(key==='agp')return row.agp??null;
  if(key==='runsFor'||key==='runsAgainst')
    return view==='Averages per Game'?(gp?numberOrZero(row[key])/gp:null):numberOrZero(row[key]);
  const raw=row.totals?.[key];
  if(raw==null)return null;
  return view==='Averages per Game'?(gp?numberOrZero(raw)/gp:null):numberOrZero(raw);
}

function compareSplitRecords(a,b,prefix){
  const aw=numberOrZero(a[prefix+'Wins']),al=numberOrZero(a[prefix+'Losses']);
  const bw=numberOrZero(b[prefix+'Wins']),bl=numberOrZero(b[prefix+'Losses']);
  const apct=aw+al?aw/(aw+al):0,bpct=bw+bl?bw/(bw+bl):0;
  return bpct-apct||bw-aw||al-bl;
}

export function sortTeamStatRows(rows,sort={key:'record',direction:'desc'},view='Totals'){
  const key=sort?.key||'record';
  const ascending=sort?.direction==='asc';
  return [...rows].sort((a,b)=>{
    let comparison;
    if(key==='record')comparison=compareTeamRecords(a,b);
    else if(key==='homeRecord')comparison=compareSplitRecords(a,b,'home');
    else if(key==='awayRecord')comparison=compareSplitRecords(a,b,'away');
    else {
      const av=teamStatColumnValue(a,key,view),bv=teamStatColumnValue(b,key,view);
      // Unknown per-game values are not zero: keep unplayed teams at bottom
      // in either direction rather than ranking them above real results.
      if(av==null||bv==null) {
        if(av==null&&bv!=null)return 1;
        if(av!=null&&bv==null)return -1;
        comparison=0;
      } else {
        const raw=typeof av==='number'&&typeof bv==='number'?av-bv:String(av).localeCompare(String(bv));
        comparison=-raw;
      }
    }
    const primary=ascending?-comparison:comparison;
    return primary||compareTeamRecords(a,b)||String(a.name||'').localeCompare(String(b.name||''));
  });
}
