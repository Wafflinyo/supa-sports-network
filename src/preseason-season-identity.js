// Historic built-in Project Rio reports belong exclusively to Season 1.
// Determine a league season from its explicit number or official display name;
// never guess from its position in a list of seasons.
export function sslSeasonNumber(season){
  if(!season)return null;
  const direct=Number(season.number??season.seasonNumber);
  if(Number.isSafeInteger(direct)&&direct>=1)return direct;
  const label=/^season\s*#?\s*(\d+)(?:\b|$)/i.exec(String(season.name||'').trim());
  const parsed=label?Number(label[1]):NaN;
  return Number.isSafeInteger(parsed)&&parsed>=1?parsed:null;
}

export const isSeasonOne=season=>sslSeasonNumber(season)===1;
