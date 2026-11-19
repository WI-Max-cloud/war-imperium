import test from 'node:test';import assert from 'node:assert/strict';
import {defaultConfig,validateConfig} from './tournament-config.mjs';import {emptyLeagues,updateLeagues} from './leagues.mjs';import {leagueZones} from './league-core.mjs';import {defaultTournaments,updateTournaments} from './tournaments.mjs';import {finalsPreview,updateFinals,resolveFinals} from './finals-core.mjs';
test('Neue Turniere übernehmen Liga-Anzahl und individuell konfigurierte Plätze',()=>{
 const config=validateConfig({leagues:[{up:0,down:1,finals:3},{up:1,down:1,finals:0},{up:2,down:0,finals:2},{up:1,down:0,finals:0}]});
 const catalog=updateTournaments(defaultTournaments(),{action:'create',revision:0,name:'Vier Ligen',config});assert.equal(catalog.tournaments[0].config.leagues.length,4);
 let leagues=emptyLeagues(config);leagues=updateLeagues(leagues,{action:'add',revision:0,leagueId:4,name:'Liga vier',tag:''});assert.equal(leagues.leagues[3].players.length,1);
 assert.deepEqual(leagueZones(3,1,10,config.leagues[2]),['Finalsplatz','Aufstiegsplatz']);assert.deepEqual(leagueZones(2,1,10,config.leagues[1]),['Aufstiegsplatz']);
 assert.throws(()=>validateConfig({leagues:[]}),{status:400});assert.throws(()=>validateConfig({leagues:[{up:0,down:0,finals:0},{up:0,down:0,finals:4}]}),{status:400});
 assert.throws(()=>validateConfig({leagues:[{up:0,down:0,finals:33}]}),{status:400});
});
test('Nur nicht archivierte Turniere können mit exakter Namensbestätigung gelöscht werden',()=>{
 const state=defaultTournaments();assert.throws(()=>updateTournaments(state,{action:'delete',revision:0,id:'current',confirmName:'falsch'}),{status:400});
 const archived=updateTournaments(state,{action:'archive',revision:0,id:'current',archived:true});assert.throws(()=>updateTournaments(archived,{action:'delete',revision:1,id:'current',confirmName:'War Imperium Liga'}),{status:403});
 const deleted=updateTournaments(state,{action:'delete',revision:0,id:'current',confirmName:'War Imperium Liga'});assert.equal(deleted.tournaments.length,0);
});
function qualified(upper,lower){const config={leagues:[{id:1,up:0,down:0,finals:upper},{id:2,up:0,down:0,finals:lower}]},state=emptyLeagues(config);for(const l of state.leagues)l.players=Array.from({length:l.rules.finals},(_,i)=>({id:l.id+'-'+i,name:'Spieler '+l.id+'-'+i,tag:''}));return state;}
test('Variable Double-Elimination-Finals beenden alle geprüften Teilnehmergrößen korrekt',()=>{
 for(let upper=1;upper<=10;upper++)for(let lower=0;lower<=6;lower++)if(upper+lower>=2)for(let seed=0;seed<6;seed++){
  const leagues=qualified(upper,lower),preview=finalsPreview(leagues);assert.equal(preview.slots.length,upper+lower);assert.equal(preview.ready,true);
  let state=updateFinals(null,{action:'start',revision:0,leagueRevision:0,allowUnfinished:true},leagues),step=0;
  while(!resolveFinals(state).champion){const view=resolveFinals(state),match=view.matches.find(m=>m.ready&&!m.winner);assert.ok(match,`Turnier hängt: Upper ${upper}, Lower ${lower}, Seed ${seed}`);
   const homeWins=(step*7+seed*3+match.id)%5<2;state=updateFinals(state,{action:'result',revision:state.revision,matchId:match.id,homeScore:homeWins?2:0,awayScore:homeWins?0:2},leagues);assert.ok(++step<=2*upper+lower, 'Zu viele Spiele');
  }
  const view=resolveFinals(state);assert.equal(view.players.filter(p=>!p.eliminated).length,1);assert.equal(view.players.find(p=>p.id===view.champion.id).eliminated,false);assert.ok(view.players.every(p=>p.id===view.champion.id||p.losses===2));
 }
});
test('Ergebniskorrekturen im variablen Turnierbaum löschen alle abhängigen Ergebnisse',()=>{
 const leagues=qualified(5,3);let state=updateFinals(null,{action:'start',revision:0,leagueRevision:0,allowUnfinished:true},leagues);
 while(!resolveFinals(state).champion){const match=resolveFinals(state).matches.find(m=>m.ready&&!m.winner);state=updateFinals(state,{action:'result',revision:state.revision,matchId:match.id,homeScore:2,awayScore:0},leagues);}
 const first=resolveFinals(state).matches[0];assert.throws(()=>updateFinals(state,{action:'result',revision:state.revision,matchId:first.id,homeScore:0,awayScore:2},leagues),{status:409});
 const corrected=updateFinals(state,{action:'result',revision:state.revision,matchId:first.id,homeScore:0,awayScore:2,confirmDownstream:true},leagues);assert.equal(resolveFinals(corrected).champion,null);assert.ok(Object.keys(corrected.results).length<Object.keys(state.results).length);
});
test('Grenzfälle mit 32 Finals-Plätzen funktionieren ebenfalls',()=>{
 for(const [upper,lower]of [[1,31],[31,1],[32,0],[16,16]]){
  const leagues=qualified(upper,lower);let state=updateFinals(null,{action:'start',revision:0,leagueRevision:0,allowUnfinished:true},leagues),steps=0;
  while(!resolveFinals(state).champion){const match=resolveFinals(state).matches.find(m=>m.ready&&!m.winner);assert.ok(match);state=updateFinals(state,{action:'result',revision:state.revision,matchId:match.id,homeScore:steps%2?0:2,awayScore:steps%2?2:0},leagues);assert.ok(++steps<=2*upper+lower);}
  assert.equal(resolveFinals(state).players.filter(p=>!p.eliminated).length,1);
 }
});
test('Cloud-Löschung entfernt genau den ausgewählten Speicherschlüssel',async()=>{
 const {createStorage}=await import('./storage.mjs');let called;
 const storage=createStorage({directory:new URL('./data/',import.meta.url),env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_test'},request:async(url,options)=>{called={url:new URL(url),options};return {ok:true};}});
 await storage.remove('tournament-test-leagues');assert.equal(called.options.method,'DELETE');assert.equal(called.url.searchParams.get('key'),'eq.tournament-test-leagues');assert.equal(called.options.headers.apikey,'sb_secret_test');
 await assert.rejects(storage.remove('../leagues'));
});
