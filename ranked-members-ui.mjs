const tag=new URLSearchParams(location.search).get('clan')||'22QJG0';
const refresh=document.getElementById('ranked-refresh');
const el=(name,text)=>{const node=document.createElement(name);if(text!==undefined)node.textContent=text;return node;};
const date=value=>value?new Date(value).toLocaleString('de-DE',{timeZone:'Europe/Berlin'}):'Kein Datenstand';
async function load(){
 refresh.disabled=true;
 for(const id of ['global','germany'])document.getElementById('ranked-'+id+'-status').textContent='Ranked-Rangliste wird geprüft …';
 try{
  const response=await fetch('/api/ranked-members?clan='+encodeURIComponent(tag));const data=await response.json();if(!response.ok)throw Error(data.error||'Ranked-Ranglisten derzeit nicht verfügbar.');
  for(const board of data.boards){
   const status=document.getElementById('ranked-'+board.id+'-status'),body=document.getElementById('ranked-'+board.id+'-rows');body.replaceChildren();
   for(const p of board.rows){const row=el('tr'),player=el('td');player.append(el('strong',p.name),el('small',p.tag));row.append(player,el('td',p.rank.toLocaleString('de-DE')),el('td',p.score.toLocaleString('de-DE')));body.append(row);}
   if(!board.rows.length){const row=el('tr'),cell=el('td',board.error?'Keine Treffer in den derzeit verfügbaren Daten. Die Prüfung ist unvollständig.':'Keine aktuellen Clanmitglieder in dieser verfügbaren Rangliste gefunden.');cell.colSpan=3;row.append(cell);body.append(row);}
   status.textContent=`${board.rows.length} Treffer · ${board.checked.toLocaleString('de-DE')} Ranglisteneinträge geprüft · Stand: ${date(board.updatedAt)}`+(board.error?(board.partial?' · Abruf unvollständig.':board.updatedAt?' · Abruf fehlgeschlagen; letzter verfügbarer Stand.':' · Abruf fehlgeschlagen; derzeit keine Ranglistendaten.'):'');
  }
  document.getElementById('ranked-members-date').textContent='Mitgliederliste: '+date(data.membersUpdatedAt);
 }catch(error){for(const id of ['global','germany'])document.getElementById('ranked-'+id+'-status').textContent=error.message;}
 finally{refresh.disabled=false;}
}
refresh.addEventListener('click',load);load();
