import {test} from 'node:test';
import assert from 'node:assert/strict';
import {finalsPreview,resolveFinals,updateFinals} from './finals-core.mjs';
const leagues=()=>({revision:7,leagues:[{id:1,players:[1,2,3,4].map(i=>({id:`a${i}`,name:`Spieler A${i}`}))},{id:2,players:[{id:'b1',name:'Liga 2 Sieger'}]},{id:3,players:[{id:'c1',name:'Liga 3 Sieger'}]}]});
const start=()=>updateFinals(null,{action:'start',revision:0,leagueRevision:7,allowUnfinished:true},leagues());
const result=(state,id,winner='home',extra={})=>updateFinals(state,{action:'result',revision:state.revision,matchId:id,homeScore:winner==='home'?2:1,awayScore:winner==='away'?2:1,...extra},leagues());
test('Finals übernehmen sechs Plätze und die exakten Paarungen des Referenzbilds',()=>{
 const state=start(),view=resolveFinals(state);
 assert.equal(view.matches[0].home.id,'a1');assert.equal(view.matches[0].away.id,'a4');assert.equal(view.matches[1].home.id,'a2');assert.equal(view.matches[1].away.id,'a3');
 assert.equal(view.matches[2].home.id,'c1');assert.equal(view.matches[3].home.id,'b1');assert.equal(view.matches[2].ready,false);assert.equal(view.matches[8].active,false);
 assert.equal(view.players.find(p=>p.id==='b1').losses,1);assert.equal(view.players.find(p=>p.id==='a1').losses,0);
});
test('Lower-Einsteiger scheidet nach erster Niederlage aus; Upper-Verlierer spielt unten weiter',()=>{
 let state=result(start(),1);let view=resolveFinals(state);assert.equal(view.matches[2].away.id,'a4');assert.equal(view.players.find(p=>p.id==='a4').eliminated,false);
 state=result(state,3,'away');view=resolveFinals(state);assert.equal(view.players.find(p=>p.id==='c1').eliminated,true);assert.equal(view.players.find(p=>p.id==='c1').losses,2);
});
test('Alle möglichen Finalverläufe haben genau einen Champion und fünf ausgeschiedene Spieler',()=>{
 let endings=0,withReset=0,withoutReset=0;
 function explore(state){
  const view=resolveFinals(state);
  if(view.champion){endings++;if(state.results[9])withReset++;else withoutReset++;
   assert.equal(view.players.filter(p=>p.eliminated).length,5);assert.ok(view.players.filter(p=>p.eliminated).every(p=>p.losses===2));assert.ok(view.players.find(p=>p.id===view.champion.id).losses<2);return;
  }
  const next=view.matches.find(m=>m.ready&&!m.winner);assert.ok(next,'Ein laufendes Turnier hat eine spielbare Begegnung');
  explore(result(state,next.id,'home'));explore(result(state,next.id,'away'));
 }
 explore(start());assert.ok(endings>100);assert.ok(withReset>0);assert.ok(withoutReset>0);
});
test('Reset-Finale wird nur nach Sieg des Lower-Finalisten aktiv',()=>{
 let state=start();for(const id of [1,2,3,4,5,6,7])state=result(state,id);
 const upperWins=result(state,8,'home');assert.ok(resolveFinals(upperWins).champion);assert.equal(resolveFinals(upperWins).matches[8].active,false);
 const lowerWins=result(state,8,'away');assert.equal(resolveFinals(lowerWins).champion,null);assert.equal(resolveFinals(lowerWins).matches[8].ready,true);
 const finished=result(lowerWins,9,'away');assert.equal(resolveFinals(finished).champion.id,resolveFinals(lowerWins).matches[8].away.id);
});
test('Ergebniskorrekturen erfordern Bestätigung und entfernen abhängige Folgeergebnisse',()=>{
 let state=start();for(const id of [1,2,3,4,5,6,7])state=result(state,id);state=result(state,8,'away');state=result(state,9);
 assert.throws(()=>result(state,1,'away'),/Folgeergebnisse/);
 const next=result(state,1,'away',{confirmDownstream:true});assert.ok(next.results[2]);assert.ok(next.results[4]);for(const id of [3,5,6,7,8,9])assert.equal(next.results[id],undefined);
 assert.equal(resolveFinals(next).champion,null);
 const cleared=updateFinals(next,{action:'clearResult',revision:next.revision,matchId:1},leagues());assert.equal(cleared.results[1],undefined);
});
test('Start und Ergebnisse validieren Revision, Teilnehmer, Abhängigkeiten und Unentschieden',()=>{
 assert.throws(()=>updateFinals(null,{action:'start',revision:0,leagueRevision:7},leagues()),/Ligaspiele offen/);
 const missing=leagues();missing.leagues[0].players.pop();assert.equal(finalsPreview(missing).ready,false);
 assert.throws(()=>updateFinals(null,{action:'start',revision:0,leagueRevision:7,allowUnfinished:true},missing),/fehlen Teilnehmer/);
 const state=start();assert.throws(()=>result(state,8),/freigeschaltet/);
 assert.throws(()=>result(state,1,'home',{homeScore:0,awayScore:0}),/keinen Sieger|benötigt einen Sieger/);
 assert.throws(()=>result(state,1,'home',{homeScore:1.5,awayScore:0}),/Ganze Zahlen/);
 assert.throws(()=>result(state,1,'home',{revision:0}),e=>e.status===409);
 const changedLeagues=leagues();changedLeagues.leagues[0].players.reverse();assert.deepEqual(resolveFinals(state).matches[0].home,state.seeds[0].player);
 assert.throws(()=>updateFinals(state,{action:'start',revision:1,leagueRevision:7,allowUnfinished:true},changedLeagues),/bereits gestartet/);
});
