import {defaultTournaments,updateTournaments,tournamentStorage} from './tournaments.mjs';
import {familyStats} from './family-stats.mjs';
import {contentHandler} from './content-store.mjs';
import http from 'node:http';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {parseLog,demo} from './core.mjs';
import {clanPlacements} from './rankings.mjs';
import {createStorage} from './storage.mjs';
import {accessRole,canScore,publicRoute,viceRouteAllowed,sameOrigin} from './access.mjs';
import {issueSession,sessionRole,sessionCookie} from './sessions.mjs';
import {emptyLeagues,updateLeagues} from './leagues.mjs';
import {prepareLeagues} from './league-core.mjs';
import {finalsPreview,resolveFinals,updateFinals} from './finals-core.mjs';
import {validJoinedOn} from './membership.mjs';
import {scanPlayerRankings} from './player-rankings.mjs';
const root=new URL('./',import.meta.url), data=new URL('./data/',root);
const storage=createStorage({directory:data});
if(process.env.RENDER==='true'&&(!process.env.APP_PASSWORD||process.env.APP_PASSWORD.length<16))throw Error('Für Render ein APP_PASSWORD mit mindestens 16 Zeichen setzen.');
const handleContent=contentHandler(storage);
const getFamilyStats=familyStats(storage,api,()=>!!process.env.CLASH_API_KEY);
let busy=false;
let attendanceBusy=false;
let tournamentCatalogBusy=false;
let leaguesBusy=false;
let finalsBusy=false;
let membershipBusy=false;
let playerRankingJob=null,playerRankingResult;
const loginAttempts=new Map();
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
 const requestUrl=new URL(req.url,'http://localhost');
 const tournamentPath=['/liga','/liga.html','/finals','/finals.html','/api/leagues','/api/finals'].includes(requestUrl.pathname);
 const selectedTournament=tournamentPath?(requestUrl.searchParams.get('tournament')||'current'):'current';
 if(tournamentPath){if(!/^(current|[a-f0-9-]{36})$/.test(selectedTournament))return send(400,{error:'Ungültige Turnierauswahl'});req.url=requestUrl.pathname;}
 if(req.method==='GET'&&req.url==='/health')return send(200,{status:'ok'});
 const role=sessionRole(req.headers.cookie)||(!process.env.APP_PASSWORD?accessRole(undefined):null)||'guest';
 if(req.method==='POST'&&['/api/login','/api/logout'].includes(req.url)){
  if(!sameOrigin(req)||req.headers['x-war-imperium']!=='local')return send(403,{error:'Anfrage nicht erlaubt'});
  if(req.url==='/api/logout'){res.setHeader('Set-Cookie',sessionCookie('',process.env.RENDER==='true'));return send(200,{role:'guest'});}
  const key=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'local').slice(0,256),now=Date.now();
  for(const [id,value] of loginAttempts)if(value.until<=now)loginAttempts.delete(id);
  const attempts=loginAttempts.get(key)||{count:0,until:now+600000};
  if(attempts.count>=15)return send(429,{error:'Zu viele Anmeldeversuche. Bitte in 10 Minuten erneut versuchen.'});
  let body='';for await(const chunk of req){body+=chunk;if(body.length>2048)return send(413,{error:'Anfrage zu groß'});}
  let input;try{input=JSON.parse(body);}catch{return send(400,{error:'Ungültige Eingabe'});}
  if(typeof input?.username!=='string'||typeof input?.password!=='string')return send(400,{error:'Benutzername und Passwort erforderlich'});
  const candidate='Basic '+Buffer.from(input.username+':'+input.password).toString('base64');
  const loginRole=accessRole(candidate);
  if(!['admin','player','vice'].includes(loginRole)||(input.admin===true&&loginRole!=='admin')){attempts.count++;loginAttempts.set(key,attempts);return send(401,{error:'Benutzername oder Passwort nicht korrekt.'});}
  loginAttempts.delete(key);res.setHeader('Set-Cookie',sessionCookie(issueSession(loginRole),process.env.RENDER==='true'));return send(200,{role:loginRole});
 }
 if(req.method==='GET'&&req.url==='/api/session')return send(200,{role,canScore:canScore(role),playerUser:process.env.PLAYER_USER||'Spieler',adminUser:process.env.APP_USER||'admin'});
 const tournamentWrite=req.method==='POST'&&['/api/leagues','/api/finals'].includes(req.url);
 if(tournamentWrite&&!canScore(role))return send(403,{error:'Bitte zuerst über „Ergebnisse eintragen“ als Spieler anmelden.'});
 if(!publicRoute(req.method,req.url)&&!tournamentWrite&&role!=='admin'&&!(role==='vice'&&viceRouteAllowed(req.method,req.url))){
  if(req.url.startsWith('/api/'))return send(403,{error:'Dieser Bereich ist ausschließlich für den Admin freigeschaltet.'});
  if(!['/clankrieg','/clankrieg/'].includes(req.url))return send(404,{error:'Nicht gefunden'});
  res.writeHead(302,{'Location':'/#admin-login','Cache-Control':'no-store'});res.end();return;
 }
 if(req.url==='/api/tournaments'&&req.method==='GET')return send(200,{role,...await storage.read('tournaments',defaultTournaments())});
 if(req.url==='/api/tournaments'&&req.method==='POST'){
  if(!sameOrigin(req)||req.headers['x-war-imperium']!=='local')return send(403,{error:'Anfrage nicht erlaubt'});
  let body='';for await(const chunk of req){body+=chunk;if(body.length>4096)return send(413,{error:'Anfrage zu groß'});}
  let input;try{input=JSON.parse(body);}catch{return send(400,{error:'Ungültige Eingabe'});}
  if(tournamentCatalogBusy)return send(409,{error:'Speicherung läuft. Bitte erneut versuchen.'});tournamentCatalogBusy=true;
  try{let next;try{next=updateTournaments(await storage.read('tournaments',defaultTournaments()),input);}catch(e){if(e.status)return send(e.status,{error:e.message});throw e;}await storage.write('tournaments',next);return send(200,{role,...next});}finally{tournamentCatalogBusy=false;}
 }
 let tournament;
 if(tournamentPath){tournament=(await storage.read('tournaments',defaultTournaments())).tournaments.find(t=>t.id===selectedTournament);if(!tournament)return send(404,{error:'Turnier nicht gefunden'});if(req.method==='POST'&&tournament.archived)return send(403,{error:'Dieses Turnier ist archiviert. Ein Admin muss es zuerst wieder aktivieren.'});}
 const selectedStorage=tournamentStorage(storage,selectedTournament);
 if(req.url==='/api/content'||/^\/api\/gallery-image\/[a-f0-9-]{36}$/.test(req.url)){
  if(req.method==='POST'&&(!sameOrigin(req)||req.headers['x-war-imperium']!=='local'))return send(403,{error:'Anfrage nicht erlaubt'});
  if(req.method==='GET'||req.method==='POST')return await handleContent(req,res,role,send);
 }
 if(req.method==='GET'&&req.url==='/api/clan-public'){
  const members=await roster(),profiles=await storage.read('member-profiles',{});
  return send(200,{role,roster:members,profiles:Object.fromEntries((members?.members??[]).map(m=>[m.tag,{joinedOn:profiles[m.tag]?.joinedOn??''}])),placements:await storage.read('clan-placements',{updatedAt:null,results:[]})});
 }
 if(req.method==='GET'&&req.url==='/api/family-stats')return send(200,await getFamilyStats());
 if(req.method==='GET'&&req.url==='/api/public-clan'){

  const summary=(await storage.read('clan-placements',null))?.publicClan;
  const current=await roster();return send(200,{name:summary?.name||'War Imperium',tag:'#22QJG0',warTrophies:summary?.warTrophies??null,members:summary?.members??current?.members.length??null,updatedAt:summary?.updatedAt??current?.updatedAt??null});
 }
 if((req.method==='GET'||req.method==='POST')&&req.url==='/api/player-rankings'){
  if(playerRankingResult===undefined)playerRankingResult=await storage.read('player-rankings',null);
  const response=()=>({running:!!playerRankingJob?.running,progress:playerRankingJob?.progress??null,error:playerRankingJob?.error??null,result:playerRankingResult});
  if(req.method==='GET')return send(200,response());
  if(!sameOrigin(req)||req.headers['x-war-imperium']!=='local')return send(403,{error:'Anfrage nicht erlaubt'});
  if(!process.env.CLASH_API_KEY)return send(400,{error:'API-Schlüssel fehlt.'});
  if(playerRankingJob?.running)return send(202,response());
  if(playerRankingResult&&Date.now()-Date.parse(playerRankingResult.startedAt)<600000)return send(200,{...response(),cached:true});
  const job={running:true,progress:{completed:0,total:0,hits:0},error:null};playerRankingJob=job;
  scanPlayerRankings(path=>api(path,true),progress=>{job.progress=progress;}).then(async result=>{
   await storage.write('player-rankings',result);playerRankingResult=result;job.running=false;
  }).catch(()=>{job.running=false;job.error='Ranglistenprüfung fehlgeschlagen. API-Verbindung und Datenbank prüfen; die letzte gespeicherte Auswertung bleibt erhalten.';});
  return send(202,response());
 }
 if(req.method==='POST'&&req.url==='/api/member-profile'){
  if(!sameOrigin(req)||req.headers['x-war-imperium']!=='local')return send(403,{error:'Anfrage nicht erlaubt'});
  let body='';for await(const chunk of req){body+=chunk;if(body.length>4096)return send(413,{error:'Anfrage zu groß'});}
  let input;try{input=JSON.parse(body);}catch{return send(400,{error:'Ungültige Eingabe'});}
  if(typeof input?.tag!=='string'||!validJoinedOn(input?.joinedOn))return send(400,{error:'Bitte ein gültiges Beitrittsdatum zwischen 2016 und heute eingeben oder das Feld leeren.'});
  if(!(await roster())?.members.some(m=>m.tag===input.tag))return send(400,{error:'Dieses Mitglied ist nicht in der aktuellen gespeicherten Clanliste.'});
  if(membershipBusy)return send(409,{error:'Speicherung läuft. Bitte erneut versuchen.'});membershipBusy=true;
  try{const profiles=await storage.read('member-profiles',{});profiles[input.tag]={joinedOn:input.joinedOn,updatedAt:new Date().toISOString(),source:'manual'};await storage.write('member-profiles',profiles);return send(200,{profile:profiles[input.tag]});}finally{membershipBusy=false;}
 }
 if(req.method==='GET'&&req.url==='/api/finals'){
  const state=await selectedStorage.read('finals',null);return send(200,{role,tournament,state,view:resolveFinals(state),preview:finalsPreview(await selectedStorage.read('leagues',emptyLeagues()))});
 }
 if(req.method==='POST'&&req.url==='/api/finals'){
  if(!sameOrigin(req)||req.headers['x-war-imperium']!=='local')return send(403,{error:'Anfrage nicht erlaubt'});
  let body='';for await(const chunk of req){body+=chunk;if(body.length>4096)return send(413,{error:'Anfrage zu groß'});}
  let input;try{input=JSON.parse(body);}catch{return send(400,{error:'Ungültige Eingabe'});}
  if(role!=='admin'&&input?.action!=='result')return send(403,{error:'Mit diesem Zugang können nur Ergebnisse eingetragen oder geändert werden.'});
  if(finalsBusy)return send(409,{error:'Speicherung läuft. Bitte erneut versuchen.'});finalsBusy=true;
  try{
   const current=await selectedStorage.read('finals',null);let next;
   try{next=updateFinals(current,input,await selectedStorage.read('leagues',emptyLeagues()));}catch(e){if(e.status)return send(e.status,{error:e.message});throw e;}
   await selectedStorage.write('finals',next);return send(200,{role,tournament,state:next,view:resolveFinals(next)});
  }finally{finalsBusy=false;}
 }
 if(req.method==='GET'&&req.url==='/api/leagues')return send(200,{role,tournament,state:prepareLeagues(await selectedStorage.read('leagues',emptyLeagues())),members:role==='admin'?(await roster())?.members??[]:[]});
 if(req.method==='POST'&&req.url==='/api/leagues'){
  if(!sameOrigin(req)||req.headers['x-war-imperium']!=='local')return send(403,{error:'Anfrage nicht erlaubt'});
  let body='';for await(const chunk of req){body+=chunk;if(body.length>4096)return send(413,{error:'Anfrage zu groß'});}
  let input;try{input=JSON.parse(body);}catch{return send(400,{error:'Ungültige Eingabe'});}
  if(role!=='admin'&&input?.action!=='result')return send(403,{error:'Mit diesem Zugang können nur Ergebnisse eingetragen oder geändert werden.'});
  if(leaguesBusy)return send(409,{error:'Speicherung läuft. Bitte erneut versuchen.'});leaguesBusy=true;
  try{
   const current=await selectedStorage.read('leagues',emptyLeagues());let next;
   try{next=updateLeagues(current,input);}catch(e){if(e.status)return send(e.status,{error:e.message});throw e;}
   await selectedStorage.write('leagues',next);return send(200,{role,tournament,state:next});
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
 if(req.method==='GET'&&req.url==='/api/placements'){
  if(!placementCache)placementCache=await storage.read('clan-placements',null);
  return send(200,placementCache??{updatedAt:null,location:null,results:[]});
 }
 if(req.method==='POST' && req.url==='/api/placements'){
  if(!sameOrigin(req)||req.headers['x-war-imperium']!=='local')return send(403,{error:'Anfrage nicht erlaubt'});
  if(!process.env.CLASH_API_KEY)return send(400,{error:'API-Schlüssel fehlt. Bitte lokal einrichten.'});
  if(placementCache && Date.now()-Date.parse(placementCache.updatedAt)<600000)return send(200,placementCache);
  if(!placementRequest)placementRequest=clanPlacements(path=>api(path,true)).then(async value=>{await storage.write('clan-placements',value);placementCache=value;return value;}).finally(()=>{placementRequest=null;});
  return send(200,await placementRequest);
 }
 if(req.method==='GET' && req.url==='/api/history')return send(200,{role,weeks:await history(),roster:await roster(),absences:await absences(),memberProfiles:await storage.read('member-profiles',{}),configured:!!process.env.CLASH_API_KEY});
 if(req.method==='GET' && req.url==='/api/demo')return send(200,{role,weeks:demo(),roster:{updatedAt:null,members:demo()[0].players.slice(0,4).map(p=>({tag:p.tag,name:p.name}))}});
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
 const files={'/turniere':'turniere.html','/turniere.html':'turniere.html','/tournaments-ui.mjs':'tournaments-ui.mjs','/tournament-context.mjs':'tournament-context.mjs','/menu-login.mjs':'menu-login.mjs','/navigation-update.css':'navigation-update.css','/content-ui.mjs':'content-ui.mjs','/content.css':'content.css','/membership.mjs':'membership.mjs','/news':'news.html','/news.html':'news.html','/clans':'clans.html','/clans.html':'clans.html','/clan':'clans.html','/clan.html':'clans.html','/galerie':'galerie.html','/galerie.html':'galerie.html','/admin-auth.mjs':'admin-auth.mjs','/':'home.html','/index.html':'home.html','/home.css':'home.css','/home.mjs':'home.mjs','/home-hero.png':'home-hero.png','/crest.svg':'crest.svg','/clankrieg':'index.html','/clankrieg/':'index.html','/site-auth.mjs':'site-auth.mjs','/site-auth.css':'site-auth.css','/liga':'liga.html','/finals':'finals.html','/finals.html':'finals.html','/finals.mjs':'finals.mjs','/liga.html':'liga.html','/liga.mjs':'liga.mjs','/liga.css':'liga.css','/league-core.mjs':'league-core.mjs','/finals-core.mjs':'finals-core.mjs','/app.mjs':'app.mjs','/core.mjs':'core.mjs','/membership.mjs':'membership.mjs','/export.mjs':'export.mjs','/responsive.mjs':'responsive.mjs','/style.css':'style.css'};
 if(req.method!=='GET'||!files[req.url])return send(404,{error:'Nicht gefunden'});
 res.writeHead(200,{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Type':req.url.endsWith('.png')?'image/png':req.url.endsWith('.svg')?'image/svg+xml':req.url.endsWith('.mjs')?'text/javascript':req.url.endsWith('.css')?'text/css':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'self'; img-src 'self' blob:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"});
 res.end(await readFile(new URL(files[req.url],root)));
 }catch(e){send(500,{error:e.message?.startsWith('API')||e.message?.includes('fehlen')?e.message:'Abruf oder Speicherung fehlgeschlagen. Verbindung und lokales Datenverzeichnis prüfen.'});}
});
if(process.argv[1]===fileURLToPath(import.meta.url))server.listen(Number(process.env.PORT||3000),process.env.RENDER==='true'?'0.0.0.0':'127.0.0.1',()=>console.log(`War Imperium gestartet · Port ${process.env.PORT||3000}`));
