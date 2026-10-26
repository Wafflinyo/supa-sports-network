import {DRAFT_STAGES} from './draft-stages.js';

// Stadiums are unique league assets. Drafting or retaining one immediately
// removes it from EVERY other GM's list—not merely disabling its button.
const same = (a,b) => a != null && b != null && String(a)===String(b);
const retainedNames = (value) => {
  if(!Array.isArray(value))return [];
  return value.map(x => typeof x==='string'?x : x?.stadium??x?.stage??x?.name)
    .filter(x=>DRAFT_STAGES.includes(x));
};

export function ownedStadium(season,teamId) {
  if(!season || teamId==null)return null;
  const retained=retainedNames(season.retainedStadiums?.[String(teamId)]);
  if(retained.length)return {name:retained[0],source:'retained'};
  const selection=(season.picks||[]).find(p=>same(p.team,teamId)&&
    p.kind==='stage'&&DRAFT_STAGES.includes(p.stage));
  return selection?{name:selection.stage,source:'drafted',pick:selection.number}:null;
}

export function stadiumOwnership(season) {
  const owners=new Map();
  for(const [id,value] of Object.entries(season?.retainedStadiums||{}))
    for(const name of retainedNames(value))
      owners.set(name,{teamId:id,source:'retained'});
  for(const pick of season?.picks||[])
    if(pick.kind==='stage'&&DRAFT_STAGES.includes(pick.stage))
      owners.set(pick.stage,{teamId:String(pick.team),source:'drafted',pick:pick.number});
  return owners;
}

export function availableStadiums(season) {
  const taken=stadiumOwnership(season);
  return DRAFT_STAGES.filter(name=>!taken.has(name));
}

export function stadiumDraftState(season,teamId,canAct=false) {
  const owned=ownedStadium(season,teamId);
  const turn=season?.nextPick;
  const isTurn=same(turn?.team,teamId);
  const mandatory=Boolean(isTurn&&turn?.mustStage&&!owned);
  const eligible=Boolean(canAct&&season?.status==='drafting'&&!season?.paused &&
    isTurn&&!turn?.supplemental&&!turn?.stageAlreadyChosen&&!turn?.stadiumRetained&&!owned);
  return {owned,eligible,mandatory,isTurn,available:availableStadiums(season)};
}
