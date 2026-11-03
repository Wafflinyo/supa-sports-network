// Read both LibreOffice ODS and Excel XLSX as the same dense worksheet arrays.
// No Game Info name edits or spreadsheet conversion are needed.
import JSZip from 'jszip';
const TABLE="urn:oasis:names:tc:opendocument:xmlns:table:1.0";
const OFFICE="urn:oasis:names:tc:opendocument:xmlns:office:1.0";
const TEXT="urn:oasis:names:tc:opendocument:xmlns:text:1.0";
const MAX_ROWS=1000,MAX_COLS=150;
const get=(element,ns,key)=>element.getAttributeNS(ns,key);
const repeat=(element,attribute,max)=>Math.min(max,Math.max(1,Number(get(element,TABLE,attribute)||1)));
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
function parseOds(xml){
  const doc=new DOMParser().parseFromString(xml,"application/xml");
  if(doc.getElementsByTagName("parsererror").length)throw Error("The ODS file has invalid worksheet XML.");
  const sheets={};
  for(const sheet of Array.from(doc.getElementsByTagNameNS(TABLE,"table"))){
    const name=get(sheet,TABLE,"name");
    if(!["Stats","Pitching","Game Info"].includes(name))continue;
    const output=[];
    for(const node of Array.from(sheet.children)){
      if(node.namespaceURI!==TABLE||node.localName!=="table-row")continue;
      const cells=[];
      for(const cell of Array.from(node.children)){
        if(cell.namespaceURI!==TABLE||!["table-cell","covered-table-cell"].includes(cell.localName))continue;
        const value=odsValue(cell);
        const count=repeat(cell,"number-columns-repeated",MAX_COLS-cells.length);
        for(let j=0;j<count&&cells.length<MAX_COLS;j++)cells.push(value);
      }
      const rowRepeat=repeat(node,"number-rows-repeated",MAX_ROWS-output.length);
      if(cells.every(v=>v===""||v==null)&&output.length>40)continue;
      for(let i=0;i<rowRepeat&&output.length<MAX_ROWS;i++)output.push(cells);
      if(output.length>=MAX_ROWS)throw Error("ODS worksheet exceeds 1000 rows.");
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
    return parseOds(xml);
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
    if(sheet.rowCount>MAX_ROWS||sheet.columnCount>MAX_COLS)throw Error("Unexpected report dimensions.");
    const rows=[];
    for(let i=1;i<=sheet.rowCount;i++){
      const row=sheet.getRow(i);
      rows.push(Array.from({length:sheet.columnCount},(_,j)=>unwrap(row.getCell(j+1).value)??""));
    }
    sheets[name]=rows;
  }
  return sheets;
}
