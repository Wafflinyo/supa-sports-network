// One-to-one Project Rio identity map supplied by the SSL commissioner.
// Maps the *in-game team slot / logo* to the permanent franchise slot.
// This has nothing to do with the players on a team or with captain ownership.
// The franchise's live name is always read from the season, never this file.
export const RIO_TEAM_MAPPINGS = Object.freeze([
  {rio:"Mario Fireballs",slot:7,ssl:"New Donk City Knights",aliases:["Fireballs"]},
  {rio:"Luigi Knights",slot:2,ssl:"HopeDogo Retrievers 3",aliases:["Knights"]},
  {rio:"Wario Muscles",slot:5,ssl:"Diamond City Checkers",aliases:["Muscles"]},
  {rio:"DK Wilds",slot:9,ssl:"New Donk City Fuggetaboudits",aliases:["Wilds"]},
  {rio:"Diddy Kong Monkeys",slot:10,ssl:"Rogueport Ruffians",aliases:["Diddy Monkeys","Monkeys"]},
  {rio:"Daisy Flowers",slot:8,ssl:"Petalburg Pangolins",aliases:["Flowers"]},
  {rio:"Peach Monarchs",slot:3,ssl:"Petalburg Petilils",aliases:["Monarchs"]},
  {rio:"Yoshi Eggs",slot:4,ssl:"Moleville Haliban",aliases:["Eggs"]},
  {rio:"Bowser Monsters",slot:11,ssl:"Twilight Town Tanks",aliases:["Monsters"]},
  {rio:"Waluigi Spitballs",slot:6,ssl:"Starborn Voidstriders",aliases:["Spitballs"]},
  {rio:"Bowser Jr. Rookies",slot:1,ssl:"Delfino Dolphins",aliases:["Jr. Rookies","Rookies"]},
  {rio:"Birdo Bows",slot:12,ssl:"Decalburg Dedennes",aliases:["Bows"]},
]);
// Optional batting-half annotations on Game Info scoreboard labels do not
// change the in-game team identity or SSL franchise mapping.
// e.g. "Jr. Rookies (Bottom)" and "DK Wilds (Top)".
export const rioBattingHalf = value =>
  String(value??'').match(/\(\s*(top|bottom)\s*\)\s*$/i)?.[1]?.toLowerCase()||null;
export const stripRioBattingHalf = value =>
  String(value??'').trim().replace(/\s*\(\s*(?:top|bottom)\s*\)\s*$/i,'').trim();
export const normalizeRioTeam = value => stripRioBattingHalf(value).toLowerCase().replace(/[^a-z0-9]/g,"");
const byAlias = new Map();
for(const mapping of RIO_TEAM_MAPPINGS){
  for(const label of [mapping.rio,...mapping.aliases]){
    const key=normalizeRioTeam(label);
    if(byAlias.has(key)&&byAlias.get(key).slot!==mapping.slot)throw Error("Ambiguous Project Rio team alias: "+label);
    byAlias.set(key,mapping);
  }
}
// Resolve from the permanent SSL franchise slot, not a particular team name.
// Registered display names can change without breaking previously saved identity links.
export function resolveRioTeam(label,seasonTeams=[]){
  const key=normalizeRioTeam(label);
  if(!key)return null;
  const direct=seasonTeams.find(t=>normalizeRioTeam(t.name)===key);
  if(direct)return direct;
  const mapping=byAlias.get(key);
  if(!mapping)return null;
  return seasonTeams.find(t=>Number(t.slot)===mapping.slot)||null;
}
export function recognizeRioGameInfo(rows,seasonTeams=[]){
  const found=new Map();
  for(const row of rows||[])for(const value of row||[]){
    if(typeof value!=="string")continue;
    const mapping=byAlias.get(normalizeRioTeam(value));
    if(!mapping)continue;
    const team=seasonTeams.find(t=>Number(t.slot)===mapping.slot);
    if(team)found.set(String(team.id),{team,source:value,canonical:mapping.rio});
  }
  return [...found.values()];
}
export function validateRioMatchup(gameInfoRows,seasonTeams,game){
  const found=recognizeRioGameInfo(gameInfoRows,seasonTeams);
  if(found.length!==2)throw Error("Game Info must identify exactly two recognized in-game teams. Review the commissioner team mappings.");
  const ids=new Set(found.map(x=>String(x.team.id)));
  if(!ids.has(String(game.away))||!ids.has(String(game.home)))
    throw Error("This Project Rio file is for "+found.map(x=>x.team.name).join(" vs ")+"; choose the matching scheduled SSL game before importing.");
  return found;
}
