import {randomUUID} from 'node:crypto';
import {defaultConfig,validateConfig} from './tournament-config.mjs';
export const defaultTournaments=()=>({revision:0,tournaments:[{id:'current',name:'War Imperium Liga',archived:false,createdAt:null}]});
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
export function updateTournaments(state,input){
 if(input?.revision!==state.revision)throw fail('Die Turnierliste wurde inzwischen geändert. Bitte neu laden.',409);
 const next=structuredClone(state);
 if(input.action==='create'||input.action==='rename'){
  const name=typeof input.name==='string'?input.name.trim():'';if(!name||name.length>100||/[\u0000-\u001f]/.test(name))throw fail('Bitte einen Turniernamen mit 1 bis 100 Zeichen eingeben.');
  if(next.tournaments.some(t=>t.id!==input.id&&t.name.toLocaleLowerCase('de')===name.toLocaleLowerCase('de')))throw fail('Dieser Turniername wird bereits verwendet.');
  if(input.action==='create'){if(next.tournaments.length>=50)throw fail('Maximal 50 Turniere möglich.');next.tournaments.unshift({id:randomUUID(),name,config:validateConfig(input.config??defaultConfig()),archived:false,createdAt:new Date().toISOString()});}
  else{const tournament=next.tournaments.find(t=>t.id===input.id);if(!tournament)throw fail('Turnier nicht gefunden.',404);tournament.name=name;}
 }else if(input.action==='archive'){
  const tournament=next.tournaments.find(t=>t.id===input.id);if(!tournament)throw fail('Turnier nicht gefunden.',404);if(typeof input.archived!=='boolean')throw fail('Ungültiger Status.');tournament.archived=input.archived;
 }else if(input.action==='delete'){
  const tournament=next.tournaments.find(t=>t.id===input.id);if(!tournament)throw fail('Turnier nicht gefunden.',404);if(tournament.archived)throw fail('Archivierte Turniere können nicht gelöscht werden.',403);if(input.confirmName!==tournament.name)throw fail('Bitte den Turniernamen zur Löschbestätigung exakt eingeben.');next.tournaments=next.tournaments.filter(t=>t.id!==tournament.id);
 }else throw fail('Unbekannte Aktion.');
 next.revision++;return next;
}
export function tournamentStorage(storage,id){
 const key=name=>id==='current'?name:'tournament-'+id+'-'+name;
 return {read:(name,fallback)=>storage.read(key(name),fallback),write:(name,value)=>storage.write(key(name),value),remove:name=>storage.remove(key(name))};
}
