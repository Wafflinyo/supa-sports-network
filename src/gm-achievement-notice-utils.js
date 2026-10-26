// Never infer badge earning from an acknowledgement: notifications are only
// a filter over the real lifetime GM awards generated from released results.
export const unseenAchievements=(achievements,acknowledgedIds)=>{
  const seen=new Set(acknowledgedIds);
  return achievements.filter(b=>b.earned&&!seen.has(b.id));
};

export const noticesForBadges=(userId,achievements)=>
  !userId?[]:achievements.map(b=>({user_id:userId,badge_id:b.id}));

export const isValidGmSlot=slot=>slot!==null && slot!==undefined &&
  slot!=='' && Number.isInteger(Number(slot)) && Number(slot)>0;
