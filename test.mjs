import {test} from 'node:test';import assert from 'node:assert/strict';import {normalized,parseLog,rankings} from './core.mjs';
import {filterMembers} from './core.mjs';
import {excelWorkbook} from './export.mjs';
import {scoreBand} from './export.mjs';
import {weeklyTrend} from './core.mjs';
import {clanPlacements} from './rankings.mjs';
import {attendanceWeeks,missingAttacks} from './core.mjs';
import {authorized,sameOrigin} from './access.mjs';
import {createStorage} from './storage.mjs';
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
