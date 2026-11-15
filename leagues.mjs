import {randomUUID} from 'node:crypto';
export const emptyLeagues=()=>({revision:0,leagues:[1,2,3].map(id=>({id,name:`Liga ${id}`,players:[]}))});
export function updateLeagues(state,input){
 const invalid=message=>{const e=Error(message);e.status=400;throw e;};
 if(!input||!['add','remove'].includes(input.action)||![1,2,3].includes(input.leagueId))invalid('Bitte eine gültige Liga und Aktion wählen.');
 if(input.revision!==state.revision){const e=Error('Die Teilnehmerliste wurde inzwischen geändert. Bitte neu laden und erneut versuchen.');e.status=409;throw e;}
 const next=structuredClone(state),league=next.leagues.find(l=>l.id===input.leagueId);
 if(input.action==='add'){
  const name=typeof input.name==='string'?input.name.trim():'';
  const tag=typeof input.tag==='string'?input.tag.trim().toUpperCase().replace(/^#?/,'#'):'';
  const cleanTag=tag==='#'?'':tag;
  if(!name||name.length>80||/[\u0000-\u001f]/.test(name))invalid('Spielername erforderlich (höchstens 80 Zeichen).');
  if(cleanTag&&!/^#[A-Z0-9]{3,15}$/.test(cleanTag))invalid('Bitte einen gültigen Spielertag eingeben oder das Feld leer lassen.');
  const duplicate=next.leagues.flatMap(l=>l.players).some(p=>cleanTag?(p.tag===cleanTag||(!p.tag&&p.name.toLocaleLowerCase('de')===name.toLocaleLowerCase('de'))):p.name.toLocaleLowerCase('de')===name.toLocaleLowerCase('de'));
  if(duplicate)invalid('Dieser Spieler ist bereits einer Liga zugeordnet. Entferne ihn dort zuerst.');
  if(league.players.length>=100)invalid('Diese Liga enthält bereits 100 Teilnehmer.');
  league.players.push({id:randomUUID(),name,tag:cleanTag});
 }else{
  const index=league.players.findIndex(p=>p.id===input.playerId);
  if(index<0)invalid('Der Teilnehmer ist nicht mehr in dieser Liga.');
  league.players.splice(index,1);
 }
 next.revision++;return next;
}
