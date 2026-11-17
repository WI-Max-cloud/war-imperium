import test from 'node:test';import assert from 'node:assert/strict';import {familyStats,familyTags} from './family-stats.mjs';
test('Familienwerte verwenden die echten API-Felder, feste Tags und einen gemeinsamen Cache',async()=>{
 let value=[],calls=0;const storage={read:async()=>value,write:async(_,v)=>value=v};
 const get=familyStats(storage,async(path,absolute)=>{calls++;assert.equal(absolute,true);assert.ok(familyTags.some(t=>path==='clans/%23'+t));return {name:'Clan',members:49,clanWarTrophies:4123,clanScore:99999,secret:'nicht ausgeben'};});
 const [a,b]=await Promise.all([get(),get()]);assert.equal(calls,5);assert.deepEqual(a,b);assert.equal(a.clans[0].warTrophies,4123);assert.equal(a.clans[0].secret,undefined);await get();assert.equal(calls,5);
});
test('Fehler behalten vorhandene Werte; fehlende Werte werden nicht als Null erfunden',async()=>{
 let value=[{tag:familyTags[0],members:48,warTrophies:4000,updatedAt:'2020-01-01T00:00:00Z'}];const storage={read:async()=>value,write:async(_,v)=>value=v};
 const get=familyStats(storage,async()=>{throw Error('offline');});const result=await get();assert.equal(result.clans[0].members,48);assert.equal(result.clans[0].error,true);assert.equal(result.clans[1].members,null);
});
