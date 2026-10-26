import {DRAFT_STAGES} from './draft-stages.js';

// Draft selections are in the shared league state. A Stadium can also be
// carried into the season by the previous offseason contract extension.
export function ownedStadium(season,teamId) {
  if(!season || !teamId)return null;
  const id=String(teamId);
  const retained=season.retainedStadiums?.[id];
  if(Array.isArray(retained)&&retained.length){
    const name=retained.find(x=>DRAFT_STAGES.includes(x));
    if(name)return {name,source:'retained'};
  }
  const selection=(season.picks||[]).find(p=>String(p.team)===id &&
    p.kind==='stage' && DRAFT_STAGES.includes(p.stage));
  return selection?{name:selection.stage,source:'drafted',pick:selection.number}:null;
}

export function stadiumDraftState(season,teamId,canAct=false){
  const mine=ownedStadium(season,teamId);
  const turn=season?.nextPick;
  const isTurn=String(turn?.team)===String(teamId)&&teamId!=null;
  const mandatory=Boolean(isTurn&&turn?.mustStage);
  const eligible=Boolean(canAct&&season?.status==='drafting'&&!season?.paused &&
    isTurn&&!turn?.supplemental&&!turn?.stageAlreadyChosen&&!turn?.stadiumRetained&&!mine);
  return {owned:mine, eligible, mandatory, isTurn};
}
