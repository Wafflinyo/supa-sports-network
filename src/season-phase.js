// Public stages are the five SSL phases. A finished draft is Preseason;
// the championship extension window is the close of Postseason. Offseason
// always belongs to the NEXT season, after the old one is archived.
export function seasonPhaseLabel(status){
  if(['setup','poll','scheduled','drafting'].includes(status))return 'DRAFT';
  if(status==='preseason')return 'PRESEASON';
  if(status==='regular')return 'REGULAR SEASON';
  if(['postseason','retention'].includes(status))return 'POSTSEASON';
  if(status==='offseason')return 'OFFSEASON';
  if(status==='archived')return 'ARCHIVED';
  return 'SEASON';
}
