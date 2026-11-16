import {test} from 'node:test';import assert from 'node:assert/strict';import {normalized,parseLog,rankings} from './core.mjs';
import {filterMembers} from './core.mjs';
import {excelWorkbook} from './export.mjs';
import {scoreBand} from './export.mjs';
import {weeklyTrend} from './core.mjs';
import {clanPlacements} from './rankings.mjs';
import {attendanceWeeks,missingAttacks} from './core.mjs';
import {authorized,sameOrigin} from './access.mjs';
import {createStorage} from './storage.mjs';
import {emptyLeagues,updateLeagues} from './leagues.mjs';
import {scheduleLeague,leagueStandings} from './league-core.mjs';
import {leagueZones} from './league-core.mjs';
import {accessRole,publicRoute,canScore} from './access.mjs';
import {membershipRows,validJoinedOn} from './membership.mjs';
import {scanPlayerRankings} from './player-rankings.mjs';
import {issueSession,issuePlayerSession,sessionRole,sessionCookie} from './sessions.mjs';
test('Öffentliche Ansichten sind lesbar; die neue Rechteverteilung erlaubt nur Admin und Spieler Ergebnisse',()=>{
 const env={APP_USER:'admin',APP_PASSWORD:'admin-test',VICE_USER:'Vize',VICE_PASSWORD:'vice-test'};
 assert.equal(accessRole('Basic '+Buffer.from('Vize:vice-test').toString('base64'),env),'vice');
 for(const path of ['/','/liga','/finals','/home.css','/site-auth.mjs','/api/leagues','/api/finals'])assert.equal(publicRoute('GET',path),true);
 for(const path of ['/clankrieg','/api/history','/api/member-profile','/api/player-rankings'])assert.equal(publicRoute('GET',path),false);
 assert.equal(publicRoute('POST','/api/leagues'),false);assert.equal(canScore('vice'),false);assert.equal(canScore('guest'),false);assert.equal(canScore('player'),true);assert.equal(canScore('admin'),true);
});
test('Spielersitzungen sind signiert, zeitlich begrenzt und nach Passwortänderung ungültig',()=>{
 const env={APP_PASSWORD:'admin-test-secret',PLAYER_USER:'Spieler',PLAYER_PASSWORD:'player-test'};
 const now=Date.now(),token=issuePlayerSession(env,now),cookie=sessionCookie(token,true);
 assert.equal(sessionRole(cookie,env,now),'player');assert.ok(cookie.includes('HttpOnly'));assert.ok(cookie.includes('Secure'));assert.ok(cookie.includes('SameSite=Strict'));
 assert.equal(sessionRole(cookie,env,now+8*3600000+1),null);assert.equal(sessionRole(cookie,{...env,PLAYER_PASSWORD:'changed'},now),null);
 assert.equal(sessionRole('wi_player='+token.slice(0,-1)+'x',env,now),null);assert.equal(sessionRole('wi_player=broken',env,now),null);
});
test('Spielerranglisten prüfen alle entdeckten Regionen und Modi, verfolgen Seiten und melden Teilfehler',async()=>{
 const calls=[],progress=[];
 const result=await scanPlayerRankings(async path=>{
  calls.push(path);
  if(path==='clans/%2322QJG0')return {memberList:[{tag:'#A',name:'Aktueller Name'},{tag:'#B',name:'B'}]};
  if(path.startsWith('locations?'))return {items:[{id:1,name:'Germany'},{id:2,name:'France'}]};
  if(path==='leaderboards')return {items:[{id:10,name:'Modus'},{id:11,name:null}]};
  if(path.startsWith('globaltournaments?'))return {items:[{tag:'#TOUR',title:'Turnier'}]};
  if(path.startsWith('leaderboard/10'))return path.includes('after=')?{items:[{tag:'#A',rank:1500,score:100}]}:{items:[{tag:'#OUTSIDER',rank:1}],paging:{cursors:{after:'next'}}};
  if(path.startsWith('locations/2/pathoflegend'))throw Error('API antwortet mit Status 503');
  if(path.startsWith('locations/1/rankings/players'))return {items:[{tag:'#B',rank:12,trophies:10000},{tag:'#OUTSIDER',rank:3}]};
  if(path.includes('tournaments/'))return {items:[{tag:'#A',rank:10,score:12}]};
  return {items:[]};
 },p=>progress.push(p));
 assert.equal(result.total,9);assert.equal(result.completed,9);assert.equal(result.hits.length,3);assert.equal(result.partial,true);
 assert.equal(result.hits.find(h=>h.boardId==='mode-10').rank,1500);assert.equal(result.hits.find(h=>h.tag==='#A').name,'Aktueller Name');
 assert.ok(calls.some(p=>p.includes('after=next')));assert.ok(result.coverage.some(b=>b.error?.includes('503')));assert.ok(result.coverage.some(b=>b.name.includes('ID 11')));assert.equal(progress.at(-1).completed,9);
});
test('Fehlende Ranglistenquellen und Ratenlimits erzeugen keine falsche vollständige Prüfung',async()=>{
 const result=await scanPlayerRankings(async path=>{
  if(path==='clans/%2322QJG0')return {memberList:[{tag:'#A',name:'A'}]};
  if(path.startsWith('locations?'))throw Error('API antwortet mit Status 503');
  if(path==='leaderboards')return {items:[{id:10,name:'Modus'}]};
  if(path.startsWith('globaltournaments?'))return {items:[]};
  throw Error('API-Limit erreicht. Später erneut versuchen.');
 });
 assert.equal(result.partial,true);assert.equal(result.hits.length,0);assert.ok(result.discovery.some(d=>d.source==='Länder und Regionen'));assert.ok(result.coverage.some(b=>b.error));
});
test('Manuelle Kriegsdaten sortieren älteste zuerst und leere Daten zuletzt',()=>{
 const members=[{tag:'#A',name:'A'},{tag:'#B',name:'B'},{tag:'#C',name:'C'},{tag:'#D',name:'D'}];
 const profiles={'#A':{joinedOn:'2026-11-01'},'#B':{joinedOn:'2025-01-01'},'#D':{joinedOn:'2025-01-01'}};
 assert.deepEqual(membershipRows([],members,profiles,'2026-11-15').map(m=>m.tag),['#B','#D','#A','#C']);
 profiles['#C']={joinedOn:'2024-01-01'};assert.equal(membershipRows([],members,profiles,'2026-11-15')[0].tag,'#C');
});
test('Mitgliederhistorie zeigt nur aktuelle Mitglieder und ersten Krieg mit tatsächlichen Angriffen',()=>{
 const weeks=[{season:138,section:0,date:'20261109T094306.000Z',players:[{tag:'#A',attacks:3}]},{season:137,section:2,players:[{tag:'#A',attacks:0}]},{season:137,section:3,players:[{tag:'#A',attacks:16},{tag:'#LEFT',attacks:16}]}];
 const rows=membershipRows(weeks,[{tag:'#A',name:'A'},{tag:'#B',name:'B'}],{},'2026-11-15');
 assert.equal(rows.length,2);assert.equal(rows[0].firstWar.season,137);assert.equal(rows[0].firstWar.section,3);assert.equal(rows[0].days,null);assert.equal(rows[1].firstWar,null);
});
test('Mitgliedsdauer beruht nur auf manuellem Datum und berücksichtigt Schaltjahre',()=>{
 const rows=membershipRows([],[{tag:'#A',name:'A'}],{'#A':{joinedOn:'2024-02-28'}},'2024-03-01');assert.equal(rows[0].days,2);
 assert.equal(membershipRows([],[{tag:'#A',name:'A'}],{},'2026-11-15')[0].days,null);
 assert.equal(validJoinedOn('2026-02-30','2026-11-15'),false);assert.equal(validJoinedOn('2026-11-16','2026-11-15'),false);assert.equal(validJoinedOn('','2026-11-15'),true);assert.equal(validJoinedOn('2026-11-15','2026-11-15'),true);
});
test('Spielerzugang ist getrennt vom Verwalter und darf nur Turnierrouten öffnen',()=>{
 const env={APP_USER:'admin',APP_PASSWORD:'test-admin-password',PLAYER_USER:'Spieler',PLAYER_PASSWORD:'test-player-password'};
 assert.equal(accessRole('Basic '+Buffer.from('Spieler:test-player-password').toString('base64'),env),'player');
 assert.equal(accessRole('Basic '+Buffer.from('admin:test-admin-password').toString('base64'),env),'admin');
 assert.equal(accessRole('Basic '+Buffer.from('Spieler:wrong').toString('base64'),env),null);
 for(const path of ['/api/history','/api/demo','/api/sync','/api/absence','/api/placements','/app.mjs','/.env'])assert.equal(publicRoute('GET',path),false);
 assert.equal(publicRoute('GET','/liga'),true);assert.equal(publicRoute('GET','/finals'),true);assert.equal(canScore('player'),true);
});
test('0:0 zählt als gespielt mit null Punkten für beide und bleibt beim Neuaufbau erhalten',()=>{
 let state={revision:0,leagues:[{id:1,name:'Liga 1',players:[{id:'a',name:'A'},{id:'b',name:'B'}]}]};
 state=updateLeagues(state,{action:'result',leagueId:1,matchId:'a:b',homeScore:0,awayScore:0,revision:0});
 assert.equal(scheduleLeague(state.leagues[0]).matches[0].homeScore,0);
 assert.deepEqual(leagueStandings(state.leagues[0]).map(p=>[p.games,p.points,p.won,p.lost]),[[1,0,0,0],[1,0,0,0]]);
 state=updateLeagues(state,{action:'result',leagueId:1,matchId:'a:b',homeScore:2,awayScore:1,revision:1});
 assert.equal(leagueStandings(state.leagues[0])[0].points,3);
 state=updateLeagues(state,{action:'result',leagueId:1,matchId:'a:b',homeScore:0,awayScore:0,revision:2});
 assert.ok(leagueStandings(state.leagues[0]).every(p=>p.games===1&&p.points===0&&p.won===0));
 state=updateLeagues(state,{action:'clearResult',leagueId:1,matchId:'a:b',revision:3});
 assert.equal(state.leagues[0].matches[0].homeScore,null);assert.ok(leagueStandings(state.leagues[0]).every(p=>p.games===0));
});
test('Aufstieg, Abstieg und Finalsplätze gelten pro Liga einschließlich Grenzplätzen',()=>{
 assert.deepEqual(leagueZones(1,4,12),['Finalsplatz']);assert.deepEqual(leagueZones(1,5,12),[]);assert.deepEqual(leagueZones(1,9,12),[]);assert.deepEqual(leagueZones(1,10,12),['Abstiegsplatz']);
 assert.deepEqual(leagueZones(2,1,12),['Finalsplatz','Aufstiegsplatz']);assert.deepEqual(leagueZones(2,3,12),['Aufstiegsplatz']);assert.deepEqual(leagueZones(2,4,12),[]);assert.deepEqual(leagueZones(2,10,12),['Abstiegsplatz']);
 assert.deepEqual(leagueZones(3,1,12),['Finalsplatz','Aufstiegsplatz']);assert.deepEqual(leagueZones(3,3,12),['Aufstiegsplatz']);assert.deepEqual(leagueZones(3,12,12),[]);
 assert.deepEqual(leagueZones(2,1,2),['Finalsplatz','Aufstiegsplatz','Abstiegsplatz']);assert.deepEqual(leagueZones(1,1,0),[]);
});
test('Jeder-gegen-jeden: jedes Paar genau einmal und pro Spieltag höchstens ein Spiel',()=>{
 for(let count=0;count<=15;count++){
  const league=scheduleLeague({players:Array.from({length:count},(_,i)=>({id:String(i),name:`P${i}`}))});
  assert.equal(league.matches.length,Math.max(0,count*(count-1)/2));assert.equal(new Set(league.matches.map(m=>m.id)).size,league.matches.length);
  for(const player of league.players)assert.equal(league.matches.filter(m=>m.home===player.id||m.away===player.id).length,Math.max(0,count-1));
  for(const round of new Set(league.matches.map(m=>m.round))){const ids=league.matches.filter(m=>m.round===round).flatMap(m=>[m.home,m.away]);assert.equal(new Set(ids).size,ids.length);}
 }
});
test('2:1 ergibt 3 Punkte, ein Spiel und spiegelbildliches Matchverhältnis; Änderung und Reset',()=>{
 let state={revision:0,leagues:[{id:1,name:'Liga 1',players:[{id:'a',name:'Spieler 1'},{id:'b',name:'Spieler 2'}]}]};
 state=updateLeagues(state,{action:'result',leagueId:1,matchId:'a:b',homeScore:2,awayScore:1,revision:0});
 let rows=leagueStandings(state.leagues[0]);assert.deepEqual(rows.map(p=>[p.name,p.games,p.points,p.won,p.lost]),[['Spieler 1',1,3,2,1],['Spieler 2',1,0,1,2]]);
 state=updateLeagues(state,{action:'result',leagueId:1,matchId:'a:b',homeScore:0,awayScore:2,revision:1});rows=leagueStandings(state.leagues[0]);assert.equal(rows[0].name,'Spieler 2');assert.equal(rows[0].games,1);assert.equal(rows[0].points,3);
 state=updateLeagues(state,{action:'clearResult',leagueId:1,matchId:'a:b',revision:2});assert.ok(leagueStandings(state.leagues[0]).every(p=>p.games===0&&p.points===0&&p.won===0));
});
test('Ligatabelle sortiert nach Punkten, Differenz und gewonnenen Matches',()=>{
 const league={players:[{id:'a',name:'A'},{id:'b',name:'B'},{id:'c',name:'C'}],matches:[{id:'a:b',homeScore:2,awayScore:0},{id:'b:c',homeScore:3,awayScore:0},{id:'a:c',homeScore:0,awayScore:1}]};
 assert.deepEqual(leagueStandings(league).map(p=>[p.id,p.points,p.difference,p.won]),[['b',3,1,3],['a',3,1,2],['c',3,-2,1]]);
});
test('Neue Teilnehmer erhalten Begegnungen; alte Ergebnisse bleiben; Entfernen bereinigt Spiele',()=>{
 let state={revision:0,leagues:[{id:1,name:'Liga 1',players:[{id:'a',name:'A'},{id:'b',name:'B'}],matches:[{id:'a:b',homeScore:2,awayScore:1}]}]};
 state=updateLeagues(state,{action:'add',leagueId:1,name:'C',revision:0});assert.equal(state.leagues[0].matches.length,3);assert.equal(state.leagues[0].matches.find(m=>m.id==='a:b').homeScore,2);
 assert.throws(()=>updateLeagues(state,{action:'result',leagueId:1,matchId:'a:b',homeScore:1,awayScore:1,revision:1}),/Sieger/);
 assert.throws(()=>updateLeagues(state,{action:'result',leagueId:1,matchId:'a:b',homeScore:1.5,awayScore:0,revision:1}),/ganze Zahlen/);
 state=updateLeagues(state,{action:'remove',leagueId:1,playerId:'a',revision:1});assert.equal(state.leagues[0].matches.length,1);assert.ok(leagueStandings(state.leagues[0]).every(p=>p.games===0));
});
test('Ligateilnehmer werden getrennt hinzugefügt und entfernt; Originalzustand bleibt erhalten',()=>{
 const initial=emptyLeagues();let state=updateLeagues(initial,{action:'add',leagueId:2,name:' Max ',tag:'p0ly89',revision:0});
 assert.equal(initial.leagues[1].players.length,0);assert.equal(state.leagues[0].players.length,0);assert.equal(state.leagues[1].players[0].name,'Max');assert.equal(state.leagues[1].players[0].tag,'#P0LY89');
 const id=state.leagues[1].players[0].id;state=updateLeagues(state,{action:'remove',leagueId:2,playerId:id,revision:1});assert.equal(state.leagues[1].players.length,0);assert.equal(state.revision,2);
});
test('Liga-Eingaben verhindern Duplikate, ungültige Namen und veraltete Änderungen',()=>{
 const initial=emptyLeagues(),state=updateLeagues(initial,{action:'add',leagueId:1,name:'Max',tag:'#P0LY89',revision:0});
 assert.throws(()=>updateLeagues(state,{action:'add',leagueId:3,name:'Anderer Name',tag:'#P0LY89',revision:1}),/bereits/);
 assert.throws(()=>updateLeagues(state,{action:'add',leagueId:3,name:'max',revision:1}),/bereits/);
 assert.throws(()=>updateLeagues(state,{action:'add',leagueId:3,name:'Neu',revision:0}),e=>e.status===409);
 assert.throws(()=>updateLeagues(initial,{action:'add',leagueId:1,name:' ',revision:0}),/Spielername/);
 assert.throws(()=>updateLeagues(initial,{action:'add',leagueId:4,name:'Max',revision:0}),/gültige Liga/);
 assert.throws(()=>updateLeagues(initial,{action:'add',leagueId:1,name:'Max',tag:'#bad tag',revision:0}),/Spielertag/);
});
test('Online-Zugang und HTTPS-Ursprung werden geprüft',()=>{
 const env={RENDER:'true',APP_USER:'admin',APP_PASSWORD:'example-test-only-password',RENDER_EXTERNAL_URL:'https://example.onrender.com'};
 assert.equal(authorized(undefined,env),false);
 assert.equal(authorized('Basic '+Buffer.from('admin:wrong').toString('base64'),env),false);
 assert.equal(authorized('Basic '+Buffer.from('admin:example-test-only-password').toString('base64'),env),true);
 assert.equal(authorized(undefined,{RENDER:'true'}),false);
 assert.equal(authorized(undefined,{}),true);
 assert.equal(sameOrigin({headers:{origin:'https://example.onrender.com',host:'internal'}},env),true);
 assert.equal(sameOrigin({headers:{origin:'https://foreign.example'}},env),false);
});
test('Render startet ohne dauerhafte Speicherung nicht; Teilkonfiguration wird abgelehnt',()=>{
 const directory=new URL('./data/',import.meta.url);
 assert.throws(()=>createStorage({directory,env:{RENDER:'true'}}));
 assert.throws(()=>createStorage({directory,env:{SUPABASE_URL:'https://example.supabase.co'}}));
});
test('Cloud-Speicher überlebt neuen Storage-Client und schützt Daten bei Fehlern',async()=>{
 const records=new Map(),requests=[];
 const request=async(url,options)=>{
  requests.push(options);
  if(options.method==='POST'){
   const row=JSON.parse(options.body);
   if(!options.headers.Prefer.includes('ignore')||!records.has(row.key))records.set(row.key,row.value);
   return {ok:true};
  }
  const key=new URL(url).searchParams.get('key').slice(3);
  return {ok:true,json:async()=>records.has(key)?[{value:records.get(key)}]:[]};
 };
 const config={directory:new URL('./data/',import.meta.url),env:{RENDER:'true',SUPABASE_URL:'https://example.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_test'},request};
 const first=createStorage(config);assert.deepEqual(await first.read('history',[]),[]);
 await first.write('history',[{id:'137-2'}]);await first.write('absences',{'137-2':{'#A':true}});
 const restarted=createStorage(config);assert.equal((await restarted.read('absences',{}))['137-2']['#A'],true);
 await restarted.write('history',[],{onlyNew:true});assert.deepEqual(await restarted.read('history',[]),[{id:'137-2'}]);
 assert.equal(requests[0].headers.apikey,'sb_secret_test');assert.equal(requests[0].headers.Authorization,undefined);
 const broken=createStorage({...config,request:async()=>({ok:false,status:503})});
 await assert.rejects(()=>broken.read('history',[]),/503/);
});
test('Abmeldungen beginnen bei angezeigter Woche 137/3 und zeigen nur 1 bis 15 Angriffe',()=>{
 const weeks=[{id:'old',season:137,section:1},{id:'start',season:137,section:2},{id:'later',season:138,section:0}];
 assert.deepEqual(attendanceWeeks(weeks).map(w=>w.id),['later','start']);
 const week={players:[{tag:'#A',name:'A',attacks:0},{tag:'#B',name:'B',attacks:15},{tag:'#C',name:'C',attacks:16},{tag:'#D',name:'D',attacks:17}]};
 assert.deepEqual(missingAttacks(week,null,false).map(p=>p.tag),['#B']);assert.deepEqual(missingAttacks(week,[{tag:'#B'}],true).map(p=>p.tag),['#B']);
});
test('Clanplatzierungen: Region, Folgeseiten, fehlender Rang und Teilfehler',async()=>{
 const calls=[];
 const result=await clanPlacements(async path=>{
  calls.push(path);
  if(path==='clans/%2322QJG0')return {location:{id:57000094,name:'Germany'}};
  if(path.includes('/global/')&&path.includes('/clans?')){
   if(!path.includes('after='))return {items:[{tag:'#OTHER',rank:1}],paging:{cursors:{after:'next'}}};
   return {items:[{tag:'#22QJG0',rank:42,previousRank:45,clanScore:120000}]};
  }
  if(path.includes('/global/'))throw Error('API antwortet mit Status 503');
  return {items:[],paging:{cursors:{}}};
 });
 assert.equal(result.results.length,4);assert.equal(result.results[0].rank,42);assert.equal(result.results[0].score,120000);assert.ok(result.results[1].error);assert.equal(result.results[2].rank,null);assert.ok(calls.some(p=>p.includes('locations/57000094/')));assert.ok(calls.some(p=>p.includes('after=next')));
});
test('Clantrend nimmt zehn neueste Wochen chronologisch und summiert Originalpunkte',()=>{
 const weeks=Array.from({length:12},(_,i)=>({id:String(i),season:100+i,section:0,date:'20261109T094306.000Z',players:[{points:1000+i,attacks:1},{points:500,attacks:0}]}));
 const trend=weeklyTrend(weeks.reverse());assert.equal(trend.length,10);assert.equal(trend[0].id,'2');assert.equal(trend[9].id,'11');assert.equal(trend[9].points,1511);assert.equal(trend[9].date,'09.11.2026');assert.deepEqual(weeklyTrend([]),[]);
 assert.equal(weeklyTrend([{id:'x',season:1,section:0,players:[]}])[0].date,null);
});
test('Punktefarben schließen Grenzwerte ein und färben nur die Punktespalte',()=>{
 assert.equal(scoreBand(2500),'low');assert.equal(scoreBand(2500.1),'neutral');assert.equal(scoreBand(2899.9),'neutral');assert.equal(scoreBand(2900),'high');assert.equal(scoreBand(null),'neutral');assert.equal(scoreBand(0),'low');
 const xml=new TextDecoder().decode(excelWorkbook([[1,'Rot','#A',2500,1,1],[2,'Grün','#B',2900,1,1],[3,'Normal','#C',2700,1,1]],{dataStart:0}));
 assert.ok(xml.includes('<c r="D1" s="1"><v>2500</v>'));assert.ok(xml.includes('<c r="D2" s="2"><v>2900</v>'));assert.ok(xml.includes('<c r="D3" s="0"><v>2700</v>'));assert.ok(xml.includes('<c r="A1" s="0">'));assert.ok(xml.includes('xl/styles.xml'));
});
test('Excel-Export schreibt Zahlen und sichere wörtliche Spielernamen',()=>{
 const bytes=excelWorkbook([['Name','Punkte'],['=HYPERLINK("x") & <König>',1234.5],[null,0]]);
 assert.equal(new DataView(bytes.buffer).getUint32(0,true),0x04034b50);
 const text=new TextDecoder().decode(bytes);
 assert.ok(text.includes('xl/worksheets/sheet1.xml'));
 assert.ok(text.includes('&amp; &lt;König&gt;'));
 assert.ok(text.includes('<v>1234.5</v>'));
 assert.ok(!text.includes('<f>'));
});
test('Mitgliederfilter nutzt Tags und verändert die Historie nicht',()=>{
 const rows=[{tag:'#A',name:'Gleicher Name',value:100},{tag:'#B',name:'Gleicher Name',value:200}];
 assert.deepEqual(filterMembers(rows,[{tag:'#A',name:'Neuer Name'}],true),[rows[0]]);
 assert.equal(filterMembers(rows,[],false),rows);
 assert.deepEqual(filterMembers(rows,null,true),[]);
 assert.equal(rows.length,2);
});
test('16er-Normalisierung und Nullangriffe',()=>{assert.equal(normalized(1001,3),5338);assert.equal(normalized(0,0),null);assert.equal(normalized(0,16),0)});
test('Mittelwerte trennen Null und fehlende Teilnahme',()=>{const w=[{id:'a',season:2,section:0,players:[{tag:'#A',name:'A',points:1600,attacks:16}]},{id:'b',season:1,section:1,players:[{tag:'#A',name:'Alt',points:0,attacks:0}]},{id:'c',season:1,section:0,players:[{tag:'#A',name:'Alt',points:0,attacks:16}]}];assert.equal(rankings(w,'a',5)[0].value,800);assert.equal(rankings(w,'a',1)[0].value,1600)});
test('Parser wählt Zielclan und lehnt fehlende Deckzahlen ab',()=>{const item={seasonId:1,sectionIndex:0,standings:[{clan:{tag:'#OTHER',participants:[]}},{clan:{tag:'#22QJG0',participants:[{tag:'#A',name:'A',fame:100,decksUsed:1}]}}]};assert.equal(parseLog([item])[0].players[0].points,100);delete item.standings[1].clan.participants[0].decksUsed;assert.throws(()=>parseLog([item]));});

test('Admin-Sitzung erhält nur signierte Rechte und verfällt bei Passwortwechsel',()=>{
 const env={APP_USER:'admin',APP_PASSWORD:'admin-session-test'},now=Date.now();
 const token=issueSession('admin',env,now);assert.equal(sessionRole(sessionCookie(token),env,now),'admin');
 assert.equal(sessionRole(sessionCookie(token),{...env,APP_PASSWORD:'rotated'},now),null);
 assert.equal(sessionRole(sessionCookie(token),env,now+8*3600000+1),null);
 const [payload,mac]=issueSession('player',{...env,PLAYER_PASSWORD:'test'},now).split('.');
 const forged=Buffer.from(JSON.stringify({...JSON.parse(Buffer.from(payload,'base64url')),role:'admin',user:'admin'})).toString('base64url');
 assert.equal(sessionRole('wi_player='+forged+'.'+mac,env,now),null);
});
