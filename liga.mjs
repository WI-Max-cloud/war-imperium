const $=id=>document.getElementById(id);
let state=null,busy=false;
function toggleBusy(value){busy=value;$('add-player').disabled=value||!state;$('reload-leagues').disabled=value;document.querySelectorAll('.remove-player').forEach(b=>b.disabled=value);}
function render(){
 $('league-tables').replaceChildren();
 for(const league of state.leagues){
  const section=document.createElement('section');section.className='panel league-table';
  const heading=document.createElement('h2');heading.textContent=league.name;
  const count=document.createElement('small');count.textContent=`${league.players.length} Teilnehmer`;heading.append(count);section.append(heading);
  if(!league.players.length){const empty=document.createElement('p');empty.className='league-empty';empty.textContent='Noch keine Teilnehmer. Füge oben den ersten Spieler hinzu.';section.append(empty);}
  else{
   const scroll=document.createElement('div');scroll.className='table';const table=document.createElement('table'),thead=document.createElement('thead'),tr=document.createElement('tr');
   ['Nr.','Spieler','Spielertag','Verwalten'].forEach(value=>{const th=document.createElement('th');th.textContent=value;tr.append(th);});thead.append(tr);table.append(thead);
   const body=document.createElement('tbody');
   league.players.forEach((p,index)=>{const row=document.createElement('tr');[index+1,p.name,p.tag||'—'].forEach(value=>{const td=document.createElement('td');td.textContent=value;row.append(td);});
    const td=document.createElement('td'),button=document.createElement('button');button.type='button';button.className='remove-player';button.textContent='Entfernen';button.setAttribute('aria-label',`${p.name} aus ${league.name} entfernen`);
    button.onclick=()=>{if(!busy&&confirm(`${p.name} aus ${league.name} entfernen?`))mutate({action:'remove',leagueId:league.id,playerId:p.id});};td.append(button);row.append(td);body.append(row);
   });table.append(body);scroll.append(table);section.append(scroll);
  }
  $('league-tables').append(section);
 }
}
async function load(){
 if(busy)return;toggleBusy(true);
 try{const response=await fetch('/api/leagues');const result=await response.json();if(!response.ok)throw Error(result.error||'Laden fehlgeschlagen');state=result.state;
  $('clan-player').replaceChildren(new Option('Spieler manuell eingeben',''),...result.members.sort((a,b)=>a.name.localeCompare(b.name,'de')).map(p=>new Option(`${p.name} (${p.tag})`,JSON.stringify(p))));
  render();$('league-status').textContent='Teilnehmerlisten geladen.';
 }catch(e){$('league-status').textContent=`Teilnehmer konnten nicht geladen werden. ${e.message}`;}finally{toggleBusy(false);}
}
async function mutate(input){
 if(busy||!state)return;toggleBusy(true);$('league-status').textContent='Wird gespeichert …';
 try{const response=await fetch('/api/leagues',{method:'POST',headers:{'Content-Type':'application/json','X-War-Imperium':'local'},body:JSON.stringify({...input,revision:state.revision})});const result=await response.json();if(!response.ok)throw Error(result.error||'Speichern fehlgeschlagen');state=result.state;render();
  if(input.action==='add'){$('player-name').value='';$('player-tag').value='';$('clan-player').value='';}
  $('league-status').textContent=input.action==='add'?'Teilnehmer hinzugefügt und gespeichert.':'Teilnehmer entfernt und gespeichert.';
 }catch(e){$('league-status').textContent=e.message;}finally{toggleBusy(false);}
}
$('participant-form').onsubmit=event=>{event.preventDefault();mutate({action:'add',leagueId:Number($('league').value),name:$('player-name').value,tag:$('player-tag').value});};
$('clan-player').onchange=()=>{if($('clan-player').value){const p=JSON.parse($('clan-player').value);$('player-name').value=p.name;$('player-tag').value=p.tag;}};
$('reload-leagues').onclick=load;load();
