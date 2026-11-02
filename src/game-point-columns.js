// Display total game points (TGP) only in Totals and average game points
// (AGP) only in Averages per Game, across all SSL statistical tables.
export function visibleGamePointFields(fields,view){
  return fields.filter(field=>{
    const key=Array.isArray(field)?field[0]:field;
    return view==='Totals'?key!=='agp':view==='Averages per Game'?key!=='tgp':true;
  });
}
