import test from 'node:test';import assert from 'node:assert/strict';import {defaultTournaments,updateTournaments,tournamentStorage} from './tournaments.mjs';
test('Bestehendes Turnier bleibt erhalten, neue Turniere besitzen stabile IDs',()=>{
 const current=defaultTournaments();const created=updateTournaments(current,{action:'create',revision:0,name:'Liga Saison 2'}),id=created.tournaments[0].id;
 assert.equal(created.tournaments[1].id,'current');assert.equal(current.tournaments.length,1);
 const renamed=updateTournaments(created,{action:'rename',revision:1,id,name:'Neue Saison'});assert.equal(renamed.tournaments[0].id,id);assert.equal(renamed.tournaments[0].name,'Neue Saison');
 assert.throws(()=>updateTournaments(created,{action:'rename',revision:0,id,name:'Andere Saison'}),{status:409});
 const archived=updateTournaments(renamed,{action:'archive',revision:2,id,archived:true});assert.equal(archived.tournaments[0].archived,true);assert.equal(archived.tournaments[1].archived,false);
 assert.throws(()=>updateTournaments(current,{action:'create',revision:0,name:' '}),{status:400});
});
test('Jedes Turnier speichert eigene Ligen und Finals; bestehende Schlüssel bleiben unverändert',async()=>{
 const values=new Map([['leagues',{old:true}],['finals',{winner:'alt'}]]),storage={read:async(k,f)=>values.has(k)?values.get(k):f,write:async(k,v)=>values.set(k,v)};
 const old=tournamentStorage(storage,'current'),one=tournamentStorage(storage,'one'),two=tournamentStorage(storage,'two');
 await one.write('leagues',{players:['A']});await two.write('leagues',{players:['B']});await one.write('finals',{winner:'A'});
 assert.deepEqual(await old.read('leagues'),{old:true});assert.deepEqual(await old.read('finals'),{winner:'alt'});assert.deepEqual(await one.read('leagues'),{players:['A']});assert.deepEqual(await two.read('leagues'),{players:['B']});assert.equal(await two.read('finals',null),null);
});
