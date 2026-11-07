// Read both LibreOffice ODS and Excel XLSX as the same dense worksheet arrays.
// No Game Info name edits or spreadsheet conversion are needed.
import JSZip from 'jszip';
import {excelRioCellIsRed,rioOdsStyleIsRed} from './rio-red-color.js';
const TABLE="urn:oasis:names:tc:opendocument:xmlns:table:1.0";
const OFFICE="urn:oasis:names:tc:opendocument:xmlns:office:1.0";
const TEXT="urn:oasis:names:tc:opendocument:xmlns:text:1.0";
const STYLE="urn:oasis:names:tc:opendocument:xmlns:style:1.0";
const FO="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0";
// Non-enumerable row metadata preserves the existing plain numeric worksheet
// arrays used throughout SSL, without inserting style objects into score cells.
const markRedColumns=(row,redCols)=>{
  if(redCols.length)Object.defineProperty(row,'_rioRedCols',{value:redCols});
  return row;
};
function odsStyles(doc,extras=null){
  const styles=new Map();
  for(const source of [extras,doc].filter(Boolean)){
    for(const node of Array.from(source.getElementsByTagNameNS(STYLE,'style'))){
      const name=get(node,STYLE,'name');
      if(!name)continue;
      let color=null,background=null;
      for(const prop of Array.from(node.children)){
        if(prop.namespaceURI!==STYLE)continue;
        if(prop.localName==='text-properties'){
          color=prop.getAttributeNS(FO,'color')??color;
        }else if(prop.localName==='table-cell-properties'){
          background=prop.getAttributeNS(FO,'background-color')??background;
        }
      }
      styles.set(name,{parent:get(node,STYLE,'parent-style-name'),color,background});
    }
  }
  return styles;
}
function odsCellIsRed(cell,styles){
  if(rioOdsStyleIsRed(get(cell,TABLE,'style-name'),styles))return true;
  // Some LibreOffice files color only the displayed text or a text span.
  const labels=[...cell.getElementsByTagNameNS(TEXT,'p'),
    ...cell.getElementsByTagNameNS(TEXT,'span')];
  return labels.some(node=>rioOdsStyleIsRed(get(node,TEXT,'style-name'),styles));
}
const MAX_ROWS=1000,MAX_COLS=150;
const get=(element,ns,key)=>element.getAttributeNS(ns,key);
const repeat=(element,attribute,max)=>Math.min(max,Math.max(1,Number(get(element,TABLE,attribute)||1)));
// Enforce the row limit on actual data, not on LibreOffice's repeated blank
// formatting rows (often 1,048,576 worksheet rows in a valid Rio ODS file).
export function appendRioDataRows(output,cells,count=1){
  if(cells.every(v=>v===""||v==null))return output;
  if(!Number.isSafeInteger(count)||count<1||output.length+count>MAX_ROWS)
    throw Error("Project Rio worksheet has more than 1000 non-empty rows.");
  for(let i=0;i<count;i++)output.push(cells);
  return output;
}

function odsValue(cell){
  if(cell.localName==="covered-table-cell")return "";
  const type=get(cell,OFFICE,"value-type");
  if(["float","currency","percentage"].includes(type)){
    const value=get(cell,OFFICE,"value");
    if(value!=null&&value!=="")return Number(value);
  }
  if(type==="boolean")return get(cell,OFFICE,"boolean-value")==="true";
  const paragraphs=Array.from(cell.getElementsByTagNameNS(TEXT,"p"));
  if(paragraphs.length)return paragraphs.map(p=>p.textContent??"").join("\n").trim();
  return get(cell,OFFICE,"string-value")??get(cell,OFFICE,"value")??"";
}
function parseOds(xml,styleXml=''){
  const doc=new DOMParser().parseFromString(xml,"application/xml");
  if(doc.getElementsByTagName("parsererror").length)throw Error("The ODS file has invalid worksheet XML.");
  const extras=styleXml?new DOMParser().parseFromString(styleXml,'application/xml'):null;
  const styles=odsStyles(doc,extras);
  const sheets={};
  for(const sheet of Array.from(doc.getElementsByTagNameNS(TABLE,"table"))){
    const name=get(sheet,TABLE,"name");
    if(!["Stats","Pitching","Game Info"].includes(name))continue;
    const output=[];
    for(const node of Array.from(sheet.children)){
      if(node.namespaceURI!==TABLE||node.localName!=="table-row")continue;
      const cells=[],redCols=[];
      for(const cell of Array.from(node.children)){
        if(cell.namespaceURI!==TABLE||!["table-cell","covered-table-cell"].includes(cell.localName))continue;
        const value=odsValue(cell);
        const count=repeat(cell,"number-columns-repeated",MAX_COLS-cells.length);
        const isRed=name==='Game Info'&&odsCellIsRed(cell,styles);
        for(let j=0;j<count&&cells.length<MAX_COLS;j++){
          if(isRed)redCols.push(cells.length);
          cells.push(value);
        }
      }
      markRedColumns(cells,redCols);
      appendRioDataRows(output,cells,Number(get(node,TABLE,"number-rows-repeated")||1));
    }
    sheets[name]=output;
  }
  return sheets;
}
export async function loadRioSheets(file){
  const lower=file?.name?.toLowerCase()||"";
  if(file.size>10*1024*1024||(!lower.endsWith(".xlsx")&&!lower.endsWith(".ods")))
    throw Error("Choose a Project Rio ODS or XLSX file under 10 MB.");
  const bytes=await file.arrayBuffer();
  if(lower.endsWith(".ods")){
    const zip=await JSZip.loadAsync(bytes);
    const entry=zip.file("content.xml");
    if(!entry)throw Error("This ODS does not contain content.xml.");
    const xml=await entry.async("string");
    if(xml.length>12*1024*1024)throw Error("ODS contents exceed the worksheet limit.");
    const styleEntry=zip.file('styles.xml');
    const styleXml=styleEntry?await styleEntry.async('string'):'';
    return parseOds(xml,styleXml);
  }
  const ExcelJS=(await import("exceljs")).default;
  const workbook=new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  const unwrap=value=>value&&typeof value==="object"
    ?(value.result??value.text??value.richText?.map(x=>x.text).join("")??""):value;
  const sheets={};
  for(const name of ["Stats","Pitching","Game Info"]){
    const sheet=workbook.getWorksheet(name);
    if(!sheet)continue;
    // XLSX files can have thousands of style-only rows/columns too. Iterate
    // populated cells instead of sheet.rowCount (which includes formatting).
    const rows=[];
    sheet.eachRow({includeEmpty:false},row=>{
      const cells=[],redCols=[];
      let tooWide=false;
      row.eachCell({includeEmpty:false},(cell,column)=>{
        const value=unwrap(cell.value);
        if(value==null||value==="")return;
        if(column>MAX_COLS){tooWide=true;return;}
        cells[column-1]=value;
        if(name==='Game Info'&&excelRioCellIsRed(cell))
          redCols.push(column-1);
      });
      if(tooWide)throw Error("Project Rio worksheet has data beyond column 150.");
      if(!cells.some(v=>v!=null&&v!==""))return;
      if(rows.length>=MAX_ROWS)
        throw Error("Project Rio worksheet has more than 1000 non-empty rows.");
      rows.push(markRedColumns(cells,redCols));
    });
    sheets[name]=rows;
  }
  return sheets;
}
