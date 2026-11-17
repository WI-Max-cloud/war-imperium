import {leagueStandings,leagueZones} from './league-core.mjs';
const $=id=>document.getElementById(id);
let state=null,busy=false,isAdmin=false,currentRole=null,canEnterResults=false;
let selectedLeague=1;const tableOpen=new Map();
const tabs=document.createElement('div');tabs.className='league-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Liga auswählen');document.getElementById('league-tables').before(tabs);
function selectLeague(id,focus=false){selectedLeague=id;for(const tab of tabs.children){const active=Number(tab.dataset.league)===id;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;if(active&&focus)tab.focus();}document.querySelectorAll('[data-league-panel]').forEach(panel=>panel.hidden=Number(panel.dataset.leaguePanel)!==id);}
tabs.onkeydown=event=>{const ids=[...tabs.children].map(b=>Number(b.dataset.league)),index=ids.indexOf(selectedLeague);let next;if(event.key==='ArrowRight')next=ids[(index+1)%ids.length];if(event.key==='ArrowLeft')next=ids[(index+ids.length-1)%ids.length];if(event.key==='Home')next=ids[0];if(event.key==='End')next=ids.at(-1);if(next){event.preventDefault();selectLeague(next,true);}};
const openRounds=new Set();
const pdfRanges=new Map();
const pdfReport=document.createElement('div');pdfReport.id='matchday-report';document.body.append(pdfReport);
function printMatchdays(league,from,to){
 if(currentRole!=='admin')return;
 if(busy)return;
 const matches=(league.matches??[]).filter(m=>m.round>=from&&m.round<=to);
 if(!matches.length)return;
 pdfReport.replaceChildren();
 const title=document.createElement('h2');title.textContent=`War Imperium Liga · ${league.name}`;
 const summary=document.createElement('p');summary.textContent=`${from===to?'Spieltag '+from:'Spieltage '+from+' bis '+to} · Stand: ${new Date().toLocaleString('de-DE')}`;
 const note=document.createElement('p');note.textContent='Gespeicherte Ergebnisse; „Offen“ bedeutet noch kein Ergebnis. 0:0 zählt als absolviertes Spiel mit 0 Punkten für beide.';
 pdfReport.append(title,summary,note);
 const names=new Map(league.players.map(p=>[p.id,p.name]));
 for(const round of [...new Set(matches.map(m=>m.round))]){
  const section=document.createElement('section'),heading=document.createElement('h3');heading.textContent=`Spieltag ${round}`;section.append(heading);
  const table=document.createElement('table'),thead=document.createElement('thead'),head=document.createElement('tr');
  ['Spieler','Ergebnis','Gegner'].forEach(label=>{const th=document.createElement('th');th.textContent=label;head.append(th);});thead.append(head);table.append(thead);
  const tbody=document.createElement('tbody'),active=new Set();
  for(const match of matches.filter(m=>m.round===round)){
   active.add(match.home);active.add(match.away);const row=document.createElement('tr');
   [names.get(match.home),match.homeScore===null||match.awayScore===null?'Offen':`${match.homeScore}:${match.awayScore}`,names.get(match.away)].forEach(value=>{const td=document.createElement('td');td.textContent=value;row.append(td);});tbody.append(row);
  }
  table.append(tbody);section.append(table);
  const free=league.players.filter(p=>!active.has(p.id));if(free.length){const p=document.createElement('p');p.textContent='Spielfrei: '+free.map(p=>p.name).join(', ');section.append(p);}
  pdfReport.append(section);
 }
 const previousTitle=document.title;document.title=`War Imperium ${league.name} Spieltage ${from}-${to}`;document.body.classList.add('print-matchdays');
 const restore=()=>{document.body.classList.remove('print-matchdays');document.title=previousTitle;pdfReport.replaceChildren();};window.addEventListener('afterprint',restore,{once:true});
 try{window.print();}catch(e){window.removeEventListener('afterprint',restore);restore();throw e;}
}
function matchdayExport(league){
 const rounds=[...new Set((league.matches??[]).map(m=>m.round))].sort((a,b)=>a-b);
 const menu=document.createElement('div');menu.className='matchday-export';
 const from=document.createElement('select'),to=document.createElement('select');
 for(const round of rounds){from.add(new Option(`Spieltag ${round}`,String(round)));to.add(new Option(`Spieltag ${round}`,String(round)));}
 const saved=pdfRanges.get(league.id);from.value=String(rounds.includes(saved?.from)?saved.from:rounds[0]);to.value=String(rounds.includes(saved?.to)?saved.to:rounds.at(-1));
 for(const [text,input] of [['Von Spieltag',from],['Bis Spieltag',to]]){const label=document.createElement('label');label.textContent=text;input.setAttribute('aria-label',`${league.name}: ${text}`);label.append(input);menu.append(label);}
 const button=document.createElement('button');button.type='button';button.className='matchday-pdf';button.textContent='Auswahl als PDF speichern';
 const note=document.createElement('p');note.className='schedule-note';note.textContent='Exportiert nur diese Liga und die gewählten Spieltage mit gespeicherten Ergebnissen.';
 const change=()=>{if(Number(to.value)<Number(from.value))to.value=from.value;for(const option of to.options)option.disabled=Number(option.value)<Number(from.value);pdfRanges.set(league.id,{from:Number(from.value),to:Number(to.value)});};from.onchange=change;to.onchange=change;if(rounds.length)change();
 from.disabled=to.disabled=button.disabled=rounds.length===0;
 button.onclick=()=>printMatchdays(state.leagues.find(l=>l.id===league.id),Number(from.value),Number(to.value));menu.append(button,note);return menu;
}
function toggleBusy(value){busy=value;$('add-player').disabled=value||!state||!isAdmin;document.querySelectorAll('.remove-player,.match-reset').forEach(b=>b.disabled=value||!isAdmin);document.querySelectorAll('.match-save,.match-score').forEach(b=>b.disabled=value||!canEnterResults);}
function renderSchedule(league,section){
 const title=document.createElement('h3');title.textContent='Spielplan · Jeder gegen jeden';section.append(title);
 const matches=league.matches??[],note=document.createElement('p');note.className='schedule-note';
 note.textContent=matches.length?`${matches.filter(m=>m.homeScore!==null).length} / ${matches.length} Spiele abgeschlossen · Jede Paarung genau einmal.`:'Ab zwei Teilnehmern wird der Spielplan automatisch erstellt.';section.append(note);
 if(currentRole==='admin')section.append(matchdayExport(league));
 const names=new Map(league.players.map(p=>[p.id,p.name]));
 for(const round of [...new Set(matches.map(m=>m.round))]){
  const roundMatches=matches.filter(m=>m.round===round),details=document.createElement('details'),summary=document.createElement('summary'),key=`${league.id}-${round}`;
  details.className='match-round';details.open=openRounds.has(key)||round===1;
  details.ontoggle=()=>{if(details.open)openRounds.add(key);else openRounds.delete(key);};
  summary.textContent=`Spieltag ${round} · ${roundMatches.filter(m=>m.homeScore!==null).length} / ${roundMatches.length} abgeschlossen`;
  details.append(summary);
  for(const match of roundMatches){
   if(!canEnterResults){const result=document.createElement('p');result.className='public-match-result';result.textContent=`${names.get(match.home)} — ${names.get(match.away)} · ${match.homeScore===null?'Noch offen':match.homeScore+':'+match.awayScore}`;details.append(result);continue;}
   const form=document.createElement('form');form.className='match-form';
   const homeLabel=document.createElement('label'),awayLabel=document.createElement('label');
   homeLabel.textContent=names.get(match.home);awayLabel.textContent=names.get(match.away);
   const score=()=>{const input=document.createElement('input');input.type='number';input.min='0';input.max='99';input.step='1';input.required=true;input.inputMode='numeric';input.className='match-score';return input;};
   const home=score(),away=score();home.value=match.homeScore??'';away.value=match.awayScore??'';
   home.setAttribute('aria-label',`Gewonnene Matches: ${names.get(match.home)} gegen ${names.get(match.away)}`);away.setAttribute('aria-label',`Gewonnene Matches: ${names.get(match.away)} gegen ${names.get(match.home)}`);
   homeLabel.append(home);awayLabel.append(away);
   const separator=document.createElement('span');separator.textContent=':';
   const actions=document.createElement('div');actions.className='match-actions';
   const save=document.createElement('button');save.type='submit';save.className='match-save';save.textContent=match.homeScore===null?'Ergebnis speichern':'Ergebnis ändern';
   const reset=document.createElement('button');reset.type='button';reset.className='match-reset';reset.textContent='Zurücksetzen';reset.hidden=match.homeScore===null||!isAdmin;
   reset.onclick=()=>{if(confirm('Dieses Ergebnis löschen und das Spiel wieder als offen führen?'))mutate({action:'clearResult',leagueId:league.id,matchId:match.id});};
   actions.append(save,reset);form.append(homeLabel,separator,awayLabel,actions);
   form.onsubmit=async event=>{
    event.preventDefault();if(home.value===''||away.value==='')return;
    const ok=await mutate({action:'result',leagueId:league.id,matchId:match.id,homeScore:Number(home.value),awayScore:Number(away.value)});
    if(!ok){let error=form.querySelector('.match-error');if(!error){error=document.createElement('p');error.className='match-error';error.setAttribute('role','alert');form.append(error);}error.textContent=$('league-status').textContent;}
   };
   details.append(form);
  }
  if(league.players.length%2===1){const active=new Set(roundMatches.flatMap(m=>[m.home,m.away])),idle=league.players.find(p=>!active.has(p.id));if(idle){const free=document.createElement('p');free.className='schedule-note';free.textContent=`Spielfrei: ${idle.name}`;details.append(free);}}
  section.append(details);
 }
}
function render(){
 $('league-tables').replaceChildren();tabs.replaceChildren();
 for(const league of state.leagues){
  const section=document.createElement('section');section.className='panel league-table';section.dataset.leaguePanel=league.id;section.id='league-panel-'+league.id;section.setAttribute('role','tabpanel');section.setAttribute('aria-labelledby','league-tab-'+league.id);
 const tab=document.createElement('button');tab.type='button';tab.textContent=league.name;tab.id='league-tab-'+league.id;tab.dataset.league=league.id;tab.setAttribute('role','tab');tab.setAttribute('aria-controls',section.id);tab.onclick=()=>selectLeague(league.id);tabs.append(tab);
  const heading=document.createElement('h2');heading.textContent=league.name;
  const count=document.createElement('small');count.textContent=`${league.players.length} Teilnehmer`;heading.append(count);section.append(heading);
  const finalsLink=document.createElement('a');finalsLink.href='/finals';finalsLink.className='finals-link';finalsLink.textContent='War Imperium Finals';section.append(finalsLink);
  const rules=document.createElement('p');rules.className='schedule-note';rules.textContent=league.id===1?'Finals: Plätze 1–4 · Abstieg: letzte 3 Plätze.':league.id===2?'Aufstieg: Plätze 1–3 · Finals: Platz 1 · Abstieg: letzte 3 Plätze.':'Aufstieg: Plätze 1–3 · Finals: Platz 1.';section.append(rules);
  const provisional=document.createElement('p');provisional.className='schedule-note';provisional.textContent='Markierungen zeigen die Plätze nach aktuellem Tabellenstand. Auf- und Abstieg werden nicht automatisch durchgeführt.';
  if(league.id===2&&league.players.length>0&&league.players.length<6)provisional.textContent+=' Bei weniger als 6 Teilnehmern überschneiden sich Aufstiegs- und Abstiegsplätze.';
  section.append(provisional);const standings=document.createElement('details');standings.className='league-standings';standings.open=tableOpen.get(league.id)??true;const standingsTitle=document.createElement('summary');standingsTitle.textContent='Platzierungen · '+league.name;standings.append(standingsTitle);standings.ontoggle=()=>tableOpen.set(league.id,standings.open);section.append(standings);
  if(!league.players.length){const empty=document.createElement('p');empty.className='league-empty';empty.textContent=isAdmin?'Noch keine Teilnehmer. Füge oben den ersten Spieler hinzu.':'Noch keine Teilnehmer für diese Liga eingetragen.';section.append(empty);}
  else{
   const scroll=document.createElement('div');scroll.className='table';const table=document.createElement('table'),thead=document.createElement('thead'),tr=document.createElement('tr');
   ['Platz','Spieler','Spiele','Punkte','Matchverhältnis','Qualifikation',...(isAdmin?['Verwalten']:[])].forEach(value=>{const th=document.createElement('th');th.textContent=value;tr.append(th);});thead.append(tr);table.append(thead);
   const body=document.createElement('tbody');
   leagueStandings(league).forEach((p,index)=>{const row=document.createElement('tr');[index+1,p.name,p.games,p.points,`${p.won}:${p.lost}`].forEach(value=>{const td=document.createElement('td');td.textContent=value;row.append(td);});
    const qualifications=document.createElement('td');qualifications.className='qualification-cell';
    for(const zone of leagueZones(league.id,index+1,league.players.length)){const badge=document.createElement('span');badge.className='qualification-badge '+(zone==='Finalsplatz'?'zone-finals':zone==='Aufstiegsplatz'?'zone-up':'zone-down');badge.textContent=zone;qualifications.append(badge);}
    if(!qualifications.childNodes.length)qualifications.textContent='—';row.append(qualifications);
    const td=document.createElement('td'),button=document.createElement('button');button.type='button';button.className='remove-player';button.textContent='Entfernen';button.setAttribute('aria-label',`${p.name} aus ${league.name} entfernen`);
    button.onclick=()=>{if(!busy&&confirm(`${p.name} aus ${league.name} entfernen? Alle Begegnungen und Ergebnisse dieses Spielers werden dabei gelöscht und die Tabelle neu berechnet.`))mutate({action:'remove',leagueId:league.id,playerId:p.id});};td.append(button);if(isAdmin)row.append(td);body.append(row);
   });table.append(body);scroll.append(table);standings.append(scroll);
  }
  renderSchedule(league,section);$('league-tables').append(section);
 }
 selectLeague(state.leagues.some(l=>l.id===selectedLeague)?selectedLeague:state.leagues[0]?.id);
}
async function load(){
 if(busy)return;toggleBusy(true);
 try{const response=await fetch('/api/leagues');const result=await response.json();if(!response.ok)throw Error(result.error||'Laden fehlgeschlagen');state=result.state;isAdmin=result.role==='admin';currentRole=result.role;canEnterResults=['admin','player','vice'].includes(currentRole);
  document.getElementById('participant-form').hidden=!isAdmin;document.querySelector('.league-menu h2').textContent=isAdmin?'Teilnehmer verwalten':'Ligaübersicht';
  $('clan-player').replaceChildren(new Option('Spieler manuell eingeben',''),...result.members.sort((a,b)=>a.name.localeCompare(b.name,'de')).map(p=>new Option(`${p.name} (${p.tag})`,JSON.stringify(p))));
  render();$('league-status').textContent='Teilnehmerlisten geladen.';
 }catch(e){$('league-status').textContent=`Teilnehmer konnten nicht geladen werden. ${e.message}`;}finally{toggleBusy(false);}
}
async function mutate(input){
 if(busy||!state||!canEnterResults)return;toggleBusy(true);$('league-status').textContent='Wird gespeichert …';
 try{const response=await fetch('/api/leagues',{method:'POST',headers:{'Content-Type':'application/json','X-War-Imperium':'local'},body:JSON.stringify({...input,revision:state.revision})});const result=await response.json();if(!response.ok)throw Error(result.error||'Speichern fehlgeschlagen');state=result.state;isAdmin=result.role==='admin';currentRole=result.role;canEnterResults=['admin','player','vice'].includes(currentRole);
  document.getElementById('participant-form').hidden=!isAdmin;document.querySelector('.league-menu h2').textContent=isAdmin?'Teilnehmer verwalten':'Ligaübersicht';render();
  if(input.action==='add'){$('player-name').value='';$('player-tag').value='';$('clan-player').value='';}
  const messages={add:'Teilnehmer hinzugefügt, Spielplan aktualisiert und gespeichert.',remove:'Teilnehmer entfernt, Tabelle und Spielplan aktualisiert.',result:'Ergebnis gespeichert. Tabelle aktualisiert.',clearResult:'Ergebnis zurückgesetzt. Tabelle aktualisiert.'};
  $('league-status').textContent=messages[input.action];return true;
 }catch(e){$('league-status').textContent=e.message;return false;}finally{toggleBusy(false);}
}
$('participant-form').onsubmit=event=>{event.preventDefault();mutate({action:'add',leagueId:Number($('league').value),name:$('player-name').value,tag:$('player-tag').value});};
$('clan-player').onchange=()=>{if($('clan-player').value){const p=JSON.parse($('clan-player').value);$('player-name').value=p.name;$('player-tag').value=p.tag;}};
document.addEventListener('wi-auth-change',load);load();
