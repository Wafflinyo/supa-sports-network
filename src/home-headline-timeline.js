// Keep the five homepage headline positions in a rolling season timeline.
// Awards are announcements, not permanent top-of-carousel banners.
const dateValue=value=>{
 const parsed=Date.parse(value||'');
 return Number.isFinite(parsed)?parsed:0;
};

export function conferenceAwardSlides(awards=[],seasonId=null){
 const byRound=new Map();
 for(const award of awards||[]){
  const round=Number(award?.roundNo);
  if(!Number.isInteger(round)||round<1)continue;
  if(award?.seasonId!=null&&seasonId!=null&&String(award.seasonId)!==String(seasonId))continue;
  if(award?.conference!=='supa'&&award?.conference!=='galaxy')continue;
  const bucket=byRound.get(round)||new Map();
  bucket.set(award.conference,award);
  byRound.set(round,bucket);
 }
 return [...byRound.entries()].filter(([,byConference])=>
  byConference.has('supa')&&byConference.has('galaxy')).map(([roundNo,byConference])=>{
  const pair=[byConference.get('supa'),byConference.get('galaxy')];
  return {
   id:'conference-potw-'+(seasonId??pair[0].seasonId??'season')+'-'+roundNo,
   kind:'potw',roundNo,awards:pair,
   week:2*roundNo,
   at:pair.reduce((latest,award)=>
     dateValue(award.awardedAt)>dateValue(latest)?award.awardedAt:latest,''),
  };
 });
}

const headlineWeek=slide=>{
 if(slide.kind==='potw')return Number(slide.week)||0;
 if(slide.kind==='champion')return -1;
 // Playoff/postseason game stories are always more recent than the regular
 // season award periods, even when their game week field is empty.
 const week=Number(slide.story?.week);
 return Number.isInteger(week)&&week>0?week:Number.MAX_SAFE_INTEGER;
};

// Preserve game-story rankings within a given week (importance/score), but
// interleave issued award announcements by official publication time.
export function rollingHomepageHeadlines(regularSlides=[],conferenceAwards=[],seasonId=null,maximum=5){
 const limit=Math.min(5,Math.max(1,Number(maximum)||5));
 const slides=[
  ...(regularSlides||[]),
  ...conferenceAwardSlides(conferenceAwards,seasonId),
 ].map((slide,index)=>({...slide,index}));
 slides.sort((a,b)=>{
  const wa=headlineWeek(a),wb=headlineWeek(b);
  if(wa!==wb)return wb-wa;
  if(a.kind!==b.kind){
   const ta=dateValue(a.at||a.story?.at);
   const tb=dateValue(b.at||b.story?.at);
   if(ta!==tb)return tb-ta;
   // Missing timestamps must not make a completed award disappear from
   // the first slot immediately after its commissioner announcement.
   if(a.kind==='potw')return -1;
   if(b.kind==='potw')return 1;
  }
  return a.index-b.index;
 });
 return slides.slice(0,limit).map(({index,...slide})=>slide);
}
