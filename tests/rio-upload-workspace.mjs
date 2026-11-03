import assert from 'node:assert/strict';
import fs from 'node:fs';
import ExcelJS from 'exceljs';
import {appendRioDataRows,loadRioSheets} from '../src/rio-spreadsheet.js';

// Project Rio ODS from LibreOffice commonly describes an entire 1,048,576
// row worksheet using one repeated EMPTY row. Such rows are not game data.
const cells=[];
appendRioDataRows(cells,Array(45).fill(''),1048546);
assert.equal(cells.length,0,'A million styled/blank ODS rows must count as zero data rows');
appendRioDataRows(cells,['Team','Player','Position'],1);
appendRioDataRows(cells,['Rookies','Mario','C'],1);
appendRioDataRows(cells,Array(45).fill(''),1048520);
assert.equal(cells.length,2,'Blank trailing repeats must leave valid Rio rows unchanged');
assert.throws(()=>appendRioDataRows([],['real data'],1001),/1000 non-empty rows/,
  'Actual excessive nonempty data must still be bounded');
assert.equal(appendRioDataRows([],['genuine data'],1000).length,1000);

// An XLSX file with high-index style-only rows must likewise be accepted.
const workbook=new ExcelJS.Workbook();
const sheet=workbook.addWorksheet('Stats');
sheet.addRow(['Team','Player','Position','Item Score']);
sheet.addRow(['Rookies','Mario','C',0]);
sheet.getCell('A2001').font={bold:true};
const bytes=await workbook.xlsx.writeBuffer();
const file={name:'formatted-rio.xlsx',size:bytes.length,
  arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
const loaded=await loadRioSheets(file);
assert.equal(loaded.Stats.length,2,'Style-only XLSX rows must be ignored');
assert.deepEqual(loaded.Stats[0].slice(0,4),['Team','Player','Position','Item Score']);
assert.equal(loaded.Stats[1][1],'Mario');

// Both upload flows must use the same portaled full-width review dialog.
const bracket=fs.readFileSync('src/SeasonPreseason.jsx','utf8');
const schedule=fs.readFileSync('src/SeasonLeague.jsx','utf8');
const dialog=fs.readFileSync('src/RioReportDialog.jsx','utf8');
const css=fs.readFileSync('src/rio-report-dialog.css','utf8');
assert.match(bracket,/showUploader&&<RioReportDialog/);
assert.match(schedule,/admin&&selectedReportGame&&<RioReportDialog/);
assert.match(dialog,/createPortal\(/);
assert.match(dialog,/aria-modal="true"/);
assert.match(dialog,/document\.body/);
assert.match(css,/max-height:calc\(100dvh/);
assert.match(css,/overflow-x:auto/);
console.log('PASS: LibreOffice million-row blank repeats, XLSX style-only rows, and separate responsive import dialogs');
