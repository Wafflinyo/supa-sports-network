// Identify deliberately red inning typography/fills in Project Rio XLSX/ODS.
// Keep this separate from numeric parsing: colors signal context, not runs.
export function isRioRedColor(input){
  if(input==null)return false;
  if(typeof input==='object'){
    if(input.indexed===10)return true; // Excel standard red indexed color
    return isRioRedColor(input.argb??input.rgb??input.color??null);
  }
  let value=String(input).trim().toLowerCase();
  if(['red','darkred','firebrick','crimson'].includes(value))return true;
  if(value.startsWith('#'))value=value.slice(1);
  if(/^[a-f0-9]{8}$/.test(value))value=value.slice(2); // Excel ARGB
  if(/^[a-f0-9]{3}$/.test(value))value=value.split('').map(c=>c+c).join('');
  if(!/^[a-f0-9]{6}$/.test(value))return false;
  const r=parseInt(value.slice(0,2),16);
  const g=parseInt(value.slice(2,4),16);
  const b=parseInt(value.slice(4,6),16);
  return r>=120&&r-g>=60&&r-b>=60&&r>=1.45*g&&r>=1.45*b;
}
export function excelRioCellIsRed(cell){
  if(!cell)return false;
  if(isRioRedColor(cell.font?.color)||isRioRedColor(cell.fill?.fgColor)||
     isRioRedColor(cell.fill?.bgColor))return true;
  return (cell.value?.richText||[]).some(part=>isRioRedColor(part.font?.color));
}
export function rioOdsStyleIsRed(name,styles,seen=new Set()){
  if(!name||seen.has(name))return false;
  const entry=styles.get(name);
  if(!entry)return false;
  seen.add(name);
  if(entry.color!=null)return isRioRedColor(entry.color);
  if(entry.background!=null&&isRioRedColor(entry.background))return true;
  return rioOdsStyleIsRed(entry.parent,styles,seen);
}
