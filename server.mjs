import http from 'node:http';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {parseLog,demo} from './core.mjs';
import {clanPlacements} from './rankings.mjs';
import {createStorage} from './storage.mjs';
import {authorized,sameOrigin} from './access.mjs';
import {emptyLeagues,updateLeagues} from './leagues.mjs';
import {prepareLeagues} from './league-core.mjs';
import {finalsPreview,resolveFinals,updateFinals} from './finals-core.mjs';
const root=new URL('./',import.meta.url), data=new URL('./data/',root);
const storage=createStorage({directory:data});
if(process.env.RENDER==='true'&&(!process.env.APP_PASSWORD||process.env.APP_PASSWORD.length<16))throw Error('Für Render ein APP_PASSWORD mit mindestens 16 Zeichen setzen.');
let busy=false;
let attendanceBusy=false;
let leaguesBusy=false;
let finalsBusy=false;
async function absences(){return storage.read('absences',{});}
async function history(){return storage.read('history',[]);}
async function roster(){return storage.read('members',null);}
let placementCache=null,placementRequest=null;
if(process.env.CLASH_API_PROXY && process.env.CLASH_API_PROXY!=='royaleapi')throw Error('CLASH_API_PROXY muss leer oder royaleapi sein.');
const clashApiOrigin=process.env.CLASH_API_PROXY==='royaleapi'?'https://proxy.royaleapi.dev':'https://api.clashroyale.com';
async function api(path,absolute=false){
 const r=await fetch(clashApiOrigin+'/v1/'+(absolute?'':'clans/%2322QJG0/')+path,{headers:{Authorization:`Bearer ${process.env.CLASH_API_KEY}`},redirect:'error',signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Error(({403:'API-Zugriff verweigert: Schlüssel und freigegebene öffentliche IP prüfen.',429:'API-Limit erreicht. Später erneut versuchen.',503:'Clash-Royale-API vorübergehend nicht verfügbar.'})[r.status]||`API antwortet mit Status ${r.status}`);
 return r.json();
}
export const server=http.createServer(async(req,res)=>{
 const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
 try{
 if(req.method==='GET'&&req.url==='/health')return send(200,{status:'ok'});
 if(!authorized(req.headers.authorization)){res.writeHead(401,{'WWW-Authenticate':'Basic realm="War Imperium", charset="UTF-8"','Cache-Control':'no-store'});res.end('Bitte mit deinem App-Zugang anmelden.');return;}
 if(req.method==='GET'&&req.url==='/api/finals'){
  const state=await storage.read('finals',null);return send(200,{state,view:resolveFinals(state),preview:finalsPreview(await storage.read('leagues',emptyLeagues()))});
 }
 if(req.method==='POST'&&req.url==='/api/finals'){
  if(!sameOrigin(req)||req.headers['x-war-imperium']!=='local')return send(403,{error:'Anfrage nicht erlaubt'});
  let body='';for await(const chunk of req){body+=chunk;if(body.length>4096)return send(413,{error:'Anfrage zu groß'});}
  let input;try{input=JSON.parse(body);}catch{return send(400,{error:'Ungültige Eingabe'});}
  if(finalsBusy)return send(409,{error:'Speicherung läuft. Bitte erneut versuchen.'});finalsBusy=true;
  try{
   const current=await storage.read('finals',null);let next;
   try{next=updateFinals(current,input,await storage.read('leagues',emptyLeagues()));}catch(e){if(e.status)return send(e.status,{error:e.message});throw e;}
   await storage.write('finals',next);return send(200,{state:next,view:resolveFinals(next)});
  }finally{finalsBusy=false;}
 }
 if(req.method==='GET'&&req.url==='/api/leagues')return send(200,{state:prepareLeagues(await storage.read('leagues',emptyLeagues())),members:(await roster())?.members??[]});
 if(req.method==='POST'&&req.url==='/api/leagues'){
  if(!sameOrigin(req)||req.headers['x-war-imperium']!=='local')return send(403,{error:'Anfrage nicht erlaubt'});
  let body='';for await(const chunk of req){body+=chunk;if(body.length>4096)return send(413,{error:'Anfrage zu groß'});}
  let input;try{input=JSON.parse(body);}catch{return send(400,{error:'Ungültige Eingabe'});}
  if(leaguesBusy)return send(409,{error:'Speicherung läuft. Bitte erneut versuchen.'});leaguesBusy=true;
  try{
   const current=await storage.read('leagues',emptyLeagues());let next;
   try{next=updateLeagues(current,input);}catch(e){if(e.status)return send(e.status,{error:e.message});throw e;}
   await storage.write('leagues',next);return send(200,{state:next});
  }finally{leaguesBusy=false;}
 }
 if(req.method==='POST' && req.url==='/api/absence'){
  if(!sameOrigin(req)||req.headers['x-war-imperium']!=='local')return send(403,{error:'Anfrage nicht erlaubt'});
  let body='';for await(const chunk of req){body+=chunk;if(body.length>4096)return send(413,{error:'Anfrage zu groß'});}
  let input;try{input=JSON.parse(body);}catch{return send(400,{error:'Ungültige Eingabe'});}
  const {weekId,tag,excused}=input??{};
  if(typeof weekId!=='string'||typeof tag!=='string'||typeof excused!=='boolean')return send(400,{error:'Ungültige Eingabe'});
  const week=(await history()).find(w=>w.id===weekId);
  if(!week||!(week.season>137||(week.season===137&&week.section>=2))||!week.players.some(p=>p.tag===tag&&p.attacks<16))return send(400,{error:'Spieler oder Woche für diese Übersicht nicht verfügbar'});
  if(attendanceBusy)return send(409,{error:'Speicherung läuft. Bitte erneut versuchen.'});
  attendanceBusy=true;
  try{
   const saved=await absences();saved[weekId]??={};saved[weekId][tag]=excused;
   await storage.write('absences',saved);
   return send(200,{excused});
  }finally{attendanceBusy=false;}
 }
 if(req.method==='POST' && req.url==='/api/placements'){
  if(!sameOrigin(req)||req.headers['x-war-imperium']!=='local')return send(403,{error:'Anfrage nicht erlaubt'});
  if(!process.env.CLASH_API_KEY)return send(400,{error:'API-Schlüssel fehlt. Bitte lokal einrichten.'});
  if(placementCache && Date.now()-Date.parse(placementCache.updatedAt)<600000)return send(200,placementCache);
  if(!placementRequest)placementRequest=clanPlacements(path=>api(path,true)).then(value=>{placementCache=value;return value;}).finally(()=>{placementRequest=null;});
  return send(200,await placementRequest);
 }
 if(req.method==='GET' && req.url==='/api/history')return send(200,{weeks:await history(),roster:await roster(),absences:await absences(),configured:!!process.env.CLASH_API_KEY});
 if(req.method==='GET' && req.url==='/api/demo')return send(200,{weeks:demo(),roster:{updatedAt:null,members:demo()[0].players.slice(0,4).map(p=>({tag:p.tag,name:p.name}))}});
 if(req.method==='POST' && req.url==='/api/sync'){
  if(!sameOrigin(req))return send(403,{error:'Fremder Ursprung abgelehnt'});
  if(req.headers['x-war-imperium']!=='local')return send(403,{error:'Lokale Anfrage erforderlich'});
  if(!process.env.CLASH_API_KEY)return send(400,{error:'Bitte CLASH_API_KEY lokal in .env eintragen und Server neu starten.'});
  if(busy)return send(409,{error:'Abruf läuft bereits.'});
  busy=true;
  try{
   let cursor,items=[],seen=new Set();
   for(let page=0;page<30;page++){
    const log=await api('riverracelog?limit=50'+(cursor?'&after='+encodeURIComponent(cursor):''));
    if(!Array.isArray(log.items))throw Error('Unerwartetes API-Format');
    items.push(...log.items);cursor=log.paging?.cursors?.after;
    if(!cursor)break;
    if(seen.has(cursor)||page===29)throw Error('Unvollständige Pagination; vorhandene Daten bleiben erhalten');seen.add(cursor);
   }
   const incoming=parseLog(items), old=await history(), merged=new Map(old.map(w=>[w.id,w]));
   incoming.forEach(w=>merged.set(w.id,w));
   let memberCursor, members=[], memberCursors=new Set();
   for(let page=0;page<30;page++){
    const result=await api('members?limit=50'+(memberCursor?'&after='+encodeURIComponent(memberCursor):''));
    if(!Array.isArray(result.items)||result.items.some(m=>typeof m.tag!=='string'||typeof m.name!=='string'))throw Error('API-Mitgliederliste ungültig');
    members.push(...result.items.map(m=>({tag:m.tag,name:m.name})));
    memberCursor=result.paging?.cursors?.after;
    if(!memberCursor)break;
    if(memberCursors.has(memberCursor)||page===29)throw Error('API-Mitgliederliste unvollständig');
    memberCursors.add(memberCursor);
   }
   const snapshot={fetchedAt:new Date().toISOString(),items};
   if(storage.remote)await storage.write('latest-raw',snapshot);
   else {await mkdir(data,{recursive:true});await writeFile(new URL(`raw-${Date.now()}.json`,data),JSON.stringify(snapshot,null,2));}
   await storage.write('history',[...merged.values()]);
   await storage.write('members',{updatedAt:new Date().toISOString(),members});
   return send(200,{imported:incoming.length,total:merged.size});
  }finally{busy=false;}
 }
 const files={'/':'index.html','/liga':'liga.html','/finals':'finals.html','/finals.html':'finals.html','/finals.mjs':'finals.mjs','/liga.html':'liga.html','/liga.mjs':'liga.mjs','/liga.css':'liga.css','/league-core.mjs':'league-core.mjs','/finals-core.mjs':'finals-core.mjs','/app.mjs':'app.mjs','/core.mjs':'core.mjs','/export.mjs':'export.mjs','/style.css':'style.css'};
 if(req.method!=='GET'||!files[req.url])return send(404,{error:'Nicht gefunden'});
 res.writeHead(200,{'Content-Type':req.url.endsWith('.mjs')?'text/javascript':req.url.endsWith('.css')?'text/css':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'"});
 res.end(await readFile(new URL(files[req.url],root)));
 }catch(e){send(500,{error:e.message?.startsWith('API')||e.message?.includes('fehlen')?e.message:'Abruf oder Speicherung fehlgeschlagen. Verbindung und lokales Datenverzeichnis prüfen.'});}
});
if(process.argv[1]===fileURLToPath(import.meta.url))server.listen(Number(process.env.PORT||3000),process.env.RENDER==='true'?'0.0.0.0':'127.0.0.1',()=>console.log(`War Imperium gestartet · Port ${process.env.PORT||3000}`));
