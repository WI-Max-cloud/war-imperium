const names={'22QJG0':'War Imperium','PRUUQGRQ':'War Imperium II','L8GLPYRQ':'War Imperium 3','QJJ9QYYQ':'War Imperium 4','RPC9GR9V':'War Imp Relax'};
const tag=new URLSearchParams(location.search).get('clan')||'22QJG0';
const status=document.getElementById('crown-status'),body=document.getElementById('crown-rows'),sources=document.getElementById('crown-sources'),refresh=document.getElementById('crown-refresh');
const el=(name,text,cls)=>{const node=document.createElement(name);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
const date=value=>value?new Date(value).toLocaleString('de-DE',{timeZone:'Europe/Berlin'}):'Kein Datenstand';
async function load(){
 refresh.disabled=true;status.textContent='Mitglieder und fünf Ranglisten werden geprüft …';
 try{
  const response=await fetch('/api/crown-rankings?clan='+encodeURIComponent(tag));const data=await response.json();if(!response.ok)throw Error(data.error||'Abruf fehlgeschlagen.');
  body.replaceChildren();sources.replaceChildren();
  for(const p of data.rows){const row=el('tr'),player=el('td'),name=el('strong',p.name),identifier=el('small',p.tag);player.append(name,identifier);row.append(player,el('td',p.rank.toLocaleString('de-DE')),el('td',p.league+(p.stale?' · letzter Stand':'')));body.append(row);}
  const errors=data.boards.filter(b=>b.error).length;
  if(!data.rows.length){const cell=el('td',errors?'Die Prüfung ist unvollständig. In den verfügbaren Daten wurden keine aktuellen Mitglieder gefunden.':'Keine aktuellen Mitglieder in den verfügbaren Top 1.000 dieser fünf Ligen gefunden.');cell.colSpan=3;body.append(el('tr'));body.lastChild.append(cell);}
  const count=new Set(data.rows.map(p=>p.tag)).size;
  status.textContent=`${count} Clanmitglied${count===1?'':'er'} gefunden · ${5-errors}/5 Ranglisten erfolgreich geprüft${errors?' · Einige Daten fehlen oder stammen aus dem letzten erfolgreichen Abruf.':''}`;
  for(const b of data.boards){const item=el('li'),link=el('a',b.name);link.href=b.url;link.target='_blank';link.rel='noopener noreferrer';item.append(link,el('span',(b.error?'Abruf derzeit nicht verfügbar · ':'')+date(b.fetchedAt)));sources.append(item);}
  document.getElementById('crown-members-date').textContent='Mitgliederliste: '+date(data.membersUpdatedAt);
 }catch(error){status.textContent=error.message;}
 finally{refresh.disabled=false;}
}
document.getElementById('crown-clan').textContent='Spielerdaten · '+(names[tag]??'Unbekannter Clan');
document.title=(names[tag]??'Clan')+' · Spielerdaten';
refresh.addEventListener('click',load);
if(names[tag])load();else{status.textContent='Ungültige Clanauswahl.';refresh.disabled=true;}
