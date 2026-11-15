// Small, dependency-free OOXML workbook writer. Strings are always literal cells.
const enc = new TextEncoder();
const xml = v => String(v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function crc32(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function header(size){const bytes=new Uint8Array(size);return {bytes,view:new DataView(bytes.buffer)};}
function zip(files){
 const parts=[],directory=[];let offset=0;
 for(const [name,text] of Object.entries(files)){
  const filename=enc.encode(name),body=enc.encode(text),crc=crc32(body),local=header(30),central=header(46);
  const l=local.view;l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint32(14,crc,true);l.setUint32(18,body.length,true);l.setUint32(22,body.length,true);l.setUint16(26,filename.length,true);
  const c=central.view;c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint32(16,crc,true);c.setUint32(20,body.length,true);c.setUint32(24,body.length,true);c.setUint16(28,filename.length,true);c.setUint32(42,offset,true);
  parts.push(local.bytes,filename,body);directory.push(central.bytes,filename);offset+=30+filename.length+body.length;
 }
 const length=directory.reduce((n,p)=>n+p.length,0),end=header(22);end.view.setUint32(0,0x06054b50,true);end.view.setUint16(8,directory.length/2,true);end.view.setUint16(10,directory.length/2,true);end.view.setUint32(12,length,true);end.view.setUint32(16,offset,true);
 const result=new Uint8Array(offset+length+22);let i=0;for(const p of [...parts,...directory,end.bytes]){result.set(p,i);i+=p.length;}return result;
}
export function scoreBand(value){return typeof value==='number' && Number.isFinite(value) ? (value<=2500?'low':value>=2900?'high':'neutral') : 'neutral';}
export function excelWorkbook(rows, {scoreColumn=3, dataStart=8}={}){
 const sheet=rows.map((row,i)=>`<row r="${i+1}">${row.map((v,j)=>{const ref=`${String.fromCharCode(65+j)}${i+1}`;return typeof v==='number'&&Number.isFinite(v)?`<c r="${ref}" s="${j===scoreColumn && i>=dataStart && row.length===6 ? (scoreBand(v)==='low'?1:scoreBand(v)==='high'?2:0):0}"><v>${v}</v></c>`:`<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(v??'')}</t></is></c>`;}).join('')}</row>`).join('');
 return zip({
  'xl/styles.xml':'<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFB91C1C"/><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FF15803D"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>',
  '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
  '_rels/.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  'xl/workbook.xml':'<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Rangliste" sheetId="1" r:id="rId1"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
  'xl/worksheets/sheet1.xml':`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="10" customWidth="1"/><col min="2" max="2" width="30" customWidth="1"/><col min="3" max="6" width="22" customWidth="1"/></cols><sheetData>${sheet}</sheetData></worksheet>`
 });
}
