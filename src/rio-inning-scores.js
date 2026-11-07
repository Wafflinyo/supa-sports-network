// Project Rio "Game Info" inning-by-inning score extraction.
// Prefer explicit in-game team labels; never infer scores from unrelated
// numeric metadata or guess a scoring sequence if the worksheet is ambiguous.
import {resolveRioTeam,rioBattingHalf} from './rio-team-mapping.js';

const label=v=>String(v??'').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
const asRuns=v=>{
  if(v==null||v===''||/^(x|—|–|-|n\/a)$/i.test(String(v).trim()))return null;
  const number=Number(v);
  return Number.isInteger(number)&&number>=0&&number<=99?number:undefined;
};
const asInning=v=>{
  const t=String(v??'').trim();
  const m=t.match(/^(?:inning\s*)?([1-9]|1[0-9]|20)(?:st|nd|rd|th)?$/i);
  return m?Number(m[1]):null;
};
const rowTeam=(row,teams,game,exclude=new Set())=>{
  // Identify team by its name, not by physical row order. The first
  // spreadsheet row can represent the BOTTOM half of each inning.
  for(let i=0;i<row.length;i++){
    if(exclude.has(i))continue;
    const value=String(row[i]??'').trim();
    let team=resolveRioTeam(value,teams);
    let annotation=rioBattingHalf(value);
    if(!team&&/^(?:team\s*[:=-]\s*|(?:away|home|visitor)\s*[:=-]\s*)/i.test(value)){
      const cleaned=value.replace(/^(?:team\s*[:=-]\s*|(?:away|home|visitor)\s*[:=-]\s*)/i,'');
      team=resolveRioTeam(cleaned,teams);
      annotation=rioBattingHalf(cleaned);
    }
    if(team&&[String(game.away),String(game.home)].includes(String(team.id)))
      return {id:String(team.id),half:annotation};
  }
  // Also accept older Rio exports with generic Away/Home row identifiers.
  for(let i=0;i<row.length;i++){
    if(exclude.has(i))continue;
    const t=label(row[i]);
    if(['away','visitor','visitors','top'].includes(t))return {id:String(game.away),half:null};
    if(['home','bottom'].includes(t))return {id:String(game.home),half:null};
  }
  return null;
};
// Explicit (Top)/(Bottom) tags are batting order, not worksheet row order.
// A conflict must be corrected instead of assigning a CG to the wrong pitcher.
const validateHalfLabels=(found,game)=>{
  const away=found.get(String(game.away)),home=found.get(String(game.home));
  if(!away?.half&&!home?.half)return;
  if(away?.half!=='top'||home?.half!=='bottom')
    throw Error('Game Info (Top)/(Bottom) labels conflict with this scheduled matchup. Mark the away team (Top) and home team (Bottom), regardless of which worksheet row is first.');
};
const scoreLines=(game,away,home)=>{
  if(!away.length||away.length!==home.length||away.length>20)return null;
  if(away.some(x=>!Number.isInteger(x)||x<0||x>99)||
     home.some((x,i)=>(x!==null&&(!Number.isInteger(x)||x<0||x>99))||
       (x===null&&i!==home.length-1)))return null;
  return {away,home};
};
function horizontalScore(rows,teams,game){
  for(let h=0;h<rows.length;h++){
    const header=rows[h]||[];
    const starts=[];
    for(let col=0;col<header.length;col++){
      if(asInning(header[col])!==1)continue;
      const sequence=[];
      for(let i=0;i<20&&asInning(header[col+i])===i+1;i++)sequence.push(col+i);
      if(sequence.length>=3)starts.push(sequence);
    }
    for(const cols of starts){
      const found=new Map();
      for(let r=h+1;r<Math.min(rows.length,h+8);r++){
        const row=rows[r]||[];
        const team=rowTeam(row,teams,game,new Set(cols));
        if(!team||found.has(team.id))continue;
        const values=cols.map(c=>asRuns(row[c]));
        if(values.some(v=>v===undefined))continue;
        found.set(team.id,{values,half:team.half});
      }
      if(found.size!==2)continue;
      const awayTeam=found.get(String(game.away));
      const homeTeam=found.get(String(game.home));
      if(!awayTeam||!homeTeam)continue;
      validateHalfLabels(found,game);
      const rawAway=awayTeam.values;
      const rawHome=homeTeam.values;
      // The home team may not bat in the final inning, shown as X/blank.
      let end=cols.length;
      while(end>0&&rawAway[end-1]===null&&rawHome[end-1]===null)end--;
      const away=rawAway.slice(0,end),home=rawHome.slice(0,end);
      if(away.some(x=>x===null))continue;
      const parsed=scoreLines(game,away,home);
      if(parsed)return parsed;
    }
  }
  return null;
}
function verticalScore(rows,teams,game){
  for(let h=0;h<rows.length;h++){
    const header=rows[h]||[];
    const inningCol=header.findIndex(v=>/^(inning|innings|inn)$/i.test(String(v??'').trim()));
    if(inningCol<0)continue;
    let awayCol=-1,homeCol=-1;
    const found=new Map();
    for(let c=0;c<header.length;c++){
      if(c===inningCol)continue;
      const team=rowTeam([header[c]],teams,game);
      if(!team)continue;
      if(team.id===String(game.away))awayCol=c;
      if(team.id===String(game.home))homeCol=c;
      found.set(team.id,team);
    }
    if(awayCol<0||homeCol<0)continue;
    validateHalfLabels(found,game);
    const away=[],home=[];
    for(let r=h+1;r<Math.min(rows.length,h+21);r++){
      const row=rows[r]||[];
      const inning=asInning(row[inningCol]);
      if(inning!==away.length+1)break;
      const a=asRuns(row[awayCol]),b=asRuns(row[homeCol]);
      if(a==null||a===undefined||b===undefined)break;
      away.push(a);home.push(b);
    }
    if(away.length>=3)return scoreLines(game,away,home);
  }
  return null;
}
export function extractRioInningScores(gameInfo,seasonTeams,game){
  if(!Array.isArray(gameInfo)||!game)return null;
  const rows=gameInfo.map(row=>Array.isArray(row)?row:[]);
  return horizontalScore(rows,seasonTeams,game)||verticalScore(rows,seasonTeams,game);
}
export function validateInningScores(lines,awayTotal,homeTotal){
  if(!lines)return null;
  const parsed=scoreLines(null,lines.away,lines.home);
  if(!parsed)throw Error('Game Info inning scores must be nonnegative whole runs in each inning.');
  const sum=x=>x.reduce((n,v)=>n+(v??0),0);
  if(sum(parsed.away)!==Number(awayTotal)||sum(parsed.home)!==Number(homeTotal))
    throw Error('Game Info inning scores do not match Stats totals. Check team order and the selected away/home matchup.');
  return parsed;
}
// Half-inning progression: away bats first, home bats second. Ties don't
// constitute a new leader; a change in the non-tied leader does.
export function inningScoringDrama(lines){
  if(!lines)return null;
  const valid=scoreLines(null,lines.away,lines.home);
  if(!valid)return null;
  let away=0,home=0,lastLeader=0,leadChanges=0;
  let penultimateLead=0,preBottomLead=0,finalLeader=0;
  for(let i=0;i<valid.away.length;i++){
    if(i===valid.away.length-1)penultimateLead=Math.sign(away-home);
    away+=valid.away[i];
    const topLeader=Math.sign(away-home);
    if(topLeader&&lastLeader&&topLeader!==lastLeader)leadChanges++;
    if(topLeader)lastLeader=topLeader;
    if(i===valid.away.length-1)preBottomLead=topLeader;
    home+=valid.home[i]??0;
    const bottomLeader=Math.sign(away-home);
    if(bottomLeader&&lastLeader&&bottomLeader!==lastLeader)leadChanges++;
    if(bottomLeader)lastLeader=bottomLeader;
    finalLeader=bottomLeader;
  }
  // A home walk-off is verifiable if the home side was trailing or tied
  // entering its final turn, then finished ahead after scoring.
  const walkoff=finalLeader===-1&&preBottomLead>=0&&
    (valid.home.at(-1)||0)>0;
  const lateComeback=!walkoff&&finalLeader!==0&&penultimateLead!==0&&
    finalLeader!==penultimateLead;
  const lateTieBreaking=!walkoff&&finalLeader!==0&&penultimateLead===0&&
    valid.away.length>=2;
  return {leadChanges,lateFinish:walkoff?'walkoff':lateComeback?'late-comeback':'none',
    lateTieBreaking,inningCount:valid.away.length,
    evidence:'scored innings (top then bottom)',walkoff};
}
