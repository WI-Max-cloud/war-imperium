import {rankings,filterMembers,weeklyTrend,attendanceWeeks,missingAttacks} from './core.mjs';
import {scoreBand} from './export.mjs';
import {membershipRows,berlinToday} from './membership.mjs';
const $=id=>document.getElementById(id);let weeks=[],demo=false,roster=null;
const playerRankingPanel=document.createElement('section');playerRankingPanel.className='panel player-ranking-panel';
const playerRankingTitle=document.createElement('h2');playerRankingTitle.textContent='War Imperium · Spieler in Ranglisten';
const playerRankingNote=document.createElement('p');playerRankingNote.textContent='Prüft aktuelle Clanmitglieder in den weltweiten Trophäen-/Pfad-der-Legenden-Ranglisten, allen von der API gelieferten Ländern und Regionen sowie den angebotenen Modus- und globalen Turnierranglisten. Die Prüfung kann mehrere Minuten dauern. API-Listen sind begrenzt; fehlende Treffer beweisen keine fehlende Platzierung. Modusvarianten können frühere Saisons enthalten, wenn die API keinen Zeitraum ausweist.';
const playerRankingButton=document.createElement('button');playerRankingButton.textContent='Alle Spieler-Ranglisten prüfen';
const playerRankingStatus=document.createElement('p');playerRankingStatus.setAttribute('role','status');
const playerRankingTable=document.createElement('div');playerRankingTable.className='table';
const playerRankingDetails=document.createElement('details'),playerRankingDetailsTitle=document.createElement('summary');playerRankingDetailsTitle.textContent='Geprüfte Ranglisten und Einschränkungen';playerRankingDetails.append(playerRankingDetailsTitle);
playerRankingPanel.append(playerRankingTitle,playerRankingNote,playerRankingButton,playerRankingStatus,playerRankingTable,playerRankingDetails);document.querySelector('aside').before(playerRankingPanel);
let playerRankingTimer=null;
function showPlayerRankingResult(result){
 playerRankingTable.replaceChildren();playerRankingDetails.replaceChildren(playerRankingDetailsTitle);
 if(!result){playerRankingTable.textContent='Noch keine Auswertung. Starte die Prüfung mit dem Knopf oben.';return;}
 const note=document.createElement('p');note.textContent=`Stand: ${new Date(result.updatedAt).toLocaleString('de-DE')} · ${result.memberCount} Clanmitglieder zum Prüfstart · ${result.completed} / ${result.total} Ranglisten geprüft${result.partial?' · Unvollständige Prüfung (siehe Einschränkungen)':''}.`;
 playerRankingTable.append(note);
 const currentTags=roster?new Set(roster.members.map(m=>m.tag)):null;
 const hits=result.hits.filter(hit=>!currentTags||currentTags.has(hit.tag));
 if(hits.length){
  const table=document.createElement('table'),thead=document.createElement('thead'),head=document.createElement('tr');
  ['Spieler','Rangliste','Region','Platz','Punkte / Wert'].forEach(text=>{const th=document.createElement('th');th.textContent=text;head.append(th);});thead.append(head);table.append(thead);
  const tbody=document.createElement('tbody');for(const hit of hits){const tr=document.createElement('tr');[`${hit.name} (${hit.tag})`,hit.board,hit.region,hit.rank.toLocaleString('de-DE'),hit.score===null?'—':hit.score.toLocaleString('de-DE')].forEach(text=>{const td=document.createElement('td');td.textContent=text;tr.append(td);});tbody.append(tr);}table.append(tbody);playerRankingTable.append(table);
 }else{const empty=document.createElement('p');empty.textContent='Keine Treffer für die aktuell gespeicherte Mitgliederliste in den abgerufenen Ranglisteneinträgen gefunden.';playerRankingTable.append(empty);}
 const limitations=document.createElement('p');limitations.textContent='Die API kann Ranglisten abschneiden (bei Regionslisten häufig auf 1.000 Plätze). Historische Saison-Endranglisten und private Turniere werden nicht durchsucht. Modusranglisten werden anhand ihrer API-ID unterschieden; ein aktueller Zeitraum ist nicht immer erkennbar.';playerRankingDetails.append(limitations);
 const list=document.createElement('ul');for(const issue of result.discovery){const li=document.createElement('li');li.textContent=`${issue.source}: ${issue.error}`;list.append(li);}
 for(const board of result.coverage){const li=document.createElement('li');li.textContent=`${board.name} · ${board.region}: ${board.checked.toLocaleString('de-DE')} Einträge, ${board.hits} Treffer${board.error?' · '+board.error:board.checked===0?' · API-Liste leer':board.capped?' · API-begrenzte Regionsliste':''}`;list.append(li);}playerRankingDetails.append(list);
}
async function refreshPlayerRankings(start=false){
 clearTimeout(playerRankingTimer);
 if(demo){playerRankingButton.disabled=true;playerRankingStatus.textContent='Im Demo-Modus werden keine echten Spieler-Ranglisten abgefragt.';showPlayerRankingResult(null);return;}
 playerRankingButton.disabled=true;
 try{
  const response=await fetch('/api/player-rankings',start?{method:'POST',headers:{'X-War-Imperium':'local'}}:{});const result=await response.json();if(demo)return;if(!response.ok)throw Error(result.error||'Abruf fehlgeschlagen');
  showPlayerRankingResult(result.result);
  if(result.running){const p=result.progress;playerRankingStatus.textContent=p?.total?`Prüfung läuft: ${p.completed} / ${p.total} Ranglisten · ${p.hits} Treffer. Vorherige gespeicherte Auswertung bleibt darunter sichtbar.`:'Mitglieder und verfügbare Ranglisten werden geladen …';playerRankingTimer=setTimeout(()=>refreshPlayerRankings(),2500);}
  else{playerRankingStatus.textContent=result.error||(result.cached?'Die letzte Prüfung liegt weniger als 10 Minuten zurück. Gespeicherter Stand wird angezeigt.':result.result?'Prüfung abgeschlossen. Details zum Umfang stehen unten.':'Bereit für die erste Ranglistenprüfung.');playerRankingButton.disabled=false;}
 }catch(e){playerRankingStatus.textContent=e.message;playerRankingButton.disabled=false;}
}
playerRankingButton.onclick=()=>refreshPlayerRankings(true);
let memberProfiles={};
const membershipPanel=document.createElement('section');membershipPanel.className='panel member-tenure-panel';
const membershipTitle=document.createElement('h2');membershipTitle.textContent='Mitglieder · Erster Clankrieg für War Imperium';
const membershipNote=document.createElement('p');membershipNote.textContent='Nur aktuelle Mitglieder laut letztem API-Abruf. Das Datum des ersten Clankriegs für War Imperium wird manuell eingetragen. Sortierung: ältestes Datum zuerst, Mitglieder ohne Datum zuletzt. Die Zeitangabe wird ab diesem Datum berechnet und ist keine Angabe zur ununterbrochenen Clanmitgliedschaft.';
const membershipStatus=document.createElement('p');membershipStatus.setAttribute('role','status');
const membershipTable=document.createElement('div');membershipTable.className='table';membershipPanel.append(membershipTitle,membershipNote,membershipStatus,membershipTable);document.querySelector('aside').before(membershipPanel);
function renderMembership(){
 membershipTable.replaceChildren();
 if(!roster){membershipStatus.textContent='Bitte API-Daten abrufen, um die aktuelle Mitgliederliste zu laden.';return;}
 membershipStatus.textContent=demo?'DEMO · Beitrittsdaten können hier nicht gespeichert werden.':`${roster.members.length} Mitglieder · Stand der Clanliste: ${new Date(roster.updatedAt).toLocaleString('de-DE')}`;
 const table=document.createElement('table'),thead=document.createElement('thead'),head=document.createElement('tr');
 ['Spieler','Erster Clankrieg für War Imperium','Zeit seit erstem Clankrieg'].forEach(text=>{const th=document.createElement('th');th.textContent=text;head.append(th);});thead.append(head);table.append(thead);
 const tbody=document.createElement('tbody'),memberRowMap=new Map();
 for(const member of membershipRows(weeks,roster.members,demo?{}:memberProfiles)){
  const tr=document.createElement('tr'),name=document.createElement('td');name.textContent=`${member.name} (${member.tag})`;tr.append(name);
  const joined=document.createElement('td'),form=document.createElement('form');form.className='join-date-form';const input=document.createElement('input');input.type='date';input.min='2016-01-01';input.max=berlinToday();input.value=member.joinedOn;input.disabled=demo;input.setAttribute('aria-label',`Erster Clankrieg für War Imperium von ${member.name}`);
  const save=document.createElement('button');save.type='submit';save.textContent='Speichern';save.disabled=demo;const feedback=document.createElement('span');feedback.className='join-date-status';feedback.setAttribute('role','status');
  form.append(input,save,feedback);joined.append(form);tr.append(joined);
  const duration=document.createElement('td');duration.textContent=member.days===null?'Unbekannt':`${member.days.toLocaleString('de-DE')} Tage`;tr.append(duration);
  tbody.append(tr);memberRowMap.set(member.tag,tr);
  form.onsubmit=async event=>{
   event.preventDefault();if(demo)return;input.disabled=save.disabled=true;feedback.textContent='Wird gespeichert …';
   try{const response=await fetch('/api/member-profile',{method:'POST',headers:{'Content-Type':'application/json','X-War-Imperium':'local'},body:JSON.stringify({tag:member.tag,joinedOn:input.value})});const result=await response.json();if(!response.ok)throw Error(result.error||'Speichern fehlgeschlagen');memberProfiles[member.tag]=result.profile;
    const updated=membershipRows(weeks,[member],memberProfiles)[0];duration.textContent=updated.days===null?'Unbekannt':`${updated.days.toLocaleString('de-DE')} Tage`;feedback.textContent=input.value?'Gespeichert':'Datum entfernt';
    for(const sorted of membershipRows(weeks,roster.members,memberProfiles))tbody.append(memberRowMap.get(sorted.tag));
   }catch(e){feedback.textContent=e.message;}finally{input.disabled=save.disabled=false;}
  };
 }
 table.append(tbody);membershipTable.append(table);
}
let savedAbsences={},demoAbsences={};
const attendancePanel=document.createElement('section');attendancePanel.className='panel attendance-panel';
const attendanceTitle=document.createElement('h2');attendanceTitle.textContent='Fehlende Angriffe · Abmeldungen';
const attendanceNote=document.createElement('p');attendanceNote.textContent='Ab Saison 137, Woche 3 (137/3). 1 bis 15 eingesetzte Kriegsdecks; Spieler mit 0 Angriffen werden ausgeblendet. „Abgemeldet“ gilt jeweils nur für diesen Spieler in dieser Woche. Der Filter „Nur aktuell im Clan“ aus der Spielerübersicht gilt auch hier. Nicht im API-Wochenprotokoll erfasste Spieler können nicht rückwirkend als 0 Angriffe ergänzt werden.';
const attendanceLabel=document.createElement('label');attendanceLabel.textContent='Clankriegswoche';
const attendanceSelect=document.createElement('select');attendanceLabel.append(attendanceSelect);
const attendanceStatus=document.createElement('p');attendanceStatus.setAttribute('role','status');
const attendanceTable=document.createElement('div');attendanceTable.className='table';
attendancePanel.append(attendanceTitle,attendanceNote,attendanceLabel,attendanceStatus,attendanceTable);document.querySelector('.panel').after(attendancePanel);
attendanceSelect.onchange=renderAttendance;
function renderAttendance(){
 const eligible=attendanceWeeks(weeks),previous=attendanceSelect.value;
 attendanceSelect.replaceChildren(...eligible.map(w=>{const o=document.createElement('option');o.value=w.id;o.textContent=`${demo?'Demo · ':''}${w.season}/${w.section+1}`;return o;}));
 if(eligible.some(w=>w.id===previous))attendanceSelect.value=previous;
 attendanceSelect.disabled=!eligible.length;
 const week=eligible.find(w=>w.id===attendanceSelect.value),players=missingAttacks(week,roster?.members,memberToggle.checked);
 attendanceStatus.textContent=!week?'Noch keine gespeicherte Woche ab 137/3 verfügbar.':!demo&&memberToggle.checked&&!roster?'Bitte zuerst die Mitgliederliste über den API-Abruf laden oder den Mitgliederfilter ausschalten.':`${demo?'DEMO · Änderungen nur für diese Vorschau. ':''}${players.length} Spieler mit 1 bis 15 Angriffen · ${week.season}/${week.section+1}`;
 attendanceTable.replaceChildren();if(!week)return;
 const table=document.createElement('table'),thead=document.createElement('thead'),head=document.createElement('tr');
 ['Spieler','Angriffe','Fehlend','Abgemeldet'].forEach(v=>{const th=document.createElement('th');th.textContent=v;head.append(th);});thead.append(head);table.append(thead);
 const tbody=document.createElement('tbody');
 for(const player of players){const tr=document.createElement('tr');[`${player.name} (${player.tag})`,`${player.attacks} / 16`,16-player.attacks].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td);});
  const td=document.createElement('td'),label=document.createElement('label'),checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=!!(demo?demoAbsences:savedAbsences)[week.id]?.[player.tag];checkbox.setAttribute('aria-label',`${player.name} in ${week.season}/${week.section+1} abgemeldet`);
  const feedback=document.createElement('span');feedback.textContent=checkbox.checked?'Abgemeldet':'Nicht abgemeldet';label.className='absence-check';label.append(checkbox,feedback);td.append(label);tr.append(td);tbody.append(tr);
  checkbox.onchange=async()=>{
   const value=checkbox.checked,isDemo=demo;checkbox.disabled=true;feedback.textContent='Wird gespeichert …';
   try{
    if(!isDemo){const response=await fetch('/api/absence',{method:'POST',headers:{'Content-Type':'application/json','X-War-Imperium':'local'},body:JSON.stringify({weekId:week.id,tag:player.tag,excused:value})});const result=await response.json();if(!response.ok)throw Error(result.error||'Speichern fehlgeschlagen');}
    const target=isDemo?demoAbsences:savedAbsences;target[week.id]??={};target[week.id][player.tag]=value;feedback.textContent=value?'Abgemeldet':'Nicht abgemeldet';
   }catch(e){checkbox.checked=!value;feedback.textContent=`Nicht gespeichert: ${e.message}`;}finally{checkbox.disabled=false;}
  };
 }
 table.append(tbody);attendanceTable.append(table);
}
const placementPanel=document.createElement('section');placementPanel.className='panel placement-panel';
const placementTitle=document.createElement('h2');placementTitle.textContent='Aktuelle Clanplatzierungen';
const placementButton=document.createElement('button');placementButton.textContent='Platzierungen aktualisieren';
const placementStatus=document.createElement('p');placementStatus.setAttribute('role','status');
const placementGrid=document.createElement('div');placementGrid.className='placement-grid';
const placementNote=document.createElement('p');placementNote.textContent='Weltweit und in der eingestellten Clanregion. API-Ranglisten können auf die vorderen Plätze begrenzt sein. Nicht aufgeführt bedeutet keine verfügbare Platznummer. Abrufe werden für 10 Minuten zwischengespeichert.';
placementPanel.append(placementTitle,placementButton,placementStatus,placementGrid,placementNote);attendancePanel.after(placementPanel);placementPanel.after(playerRankingPanel);
let loadingPlacements=false;
async function loadPlacements(){
 if(demo){placementGrid.replaceChildren();placementStatus.textContent='Im Demo-Modus werden keine echten Platzierungen abgerufen.';return;}
 if(loadingPlacements)return;
 loadingPlacements=true;placementButton.disabled=true;placementStatus.textContent='Aktuelle Ranglisten werden geprüft …';
 try{
  const response=await fetch('/api/placements',{method:'POST',headers:{'X-War-Imperium':'local'}});const result=await response.json();
  if(demo)return;
  if(!response.ok)throw Error(result.error||'Ranglistenabruf fehlgeschlagen.');
  placementGrid.replaceChildren();
  for(const board of result.results){
   const card=document.createElement('article');const title=document.createElement('h3');title.textContent=board.title;
   const rank=document.createElement('strong');rank.textContent=board.error?'Nicht verfügbar':board.rank?`Platz ${board.rank.toLocaleString('de-DE')}`:'Nicht aufgeführt';
   const note=document.createElement('p');note.textContent=board.error|| (board.rank?`${board.score===null?'':board.score.toLocaleString('de-DE')+' Punkte'}${board.previousRank>0?' · Vorheriger API-Rang: '+board.previousRank.toLocaleString('de-DE'):''}`:`In ${board.checked.toLocaleString('de-DE')} abgerufenen Einträgen nicht enthalten.${board.complete?'':' Suche wegen Abrufgrenze unvollständig.'}`);
   card.append(title,rank);if(board.error)card.append(note);
   if(board.title==='Clankrieg · Weltweit'||board.title==='Clankrieg · Germany'){
    const best=document.createElement('p');best.className='best-placement';
    best.textContent=board.title==='Clankrieg · Weltweit'?'Beste Platzierung Weltweit: Platz 144':'Beste Platzierung Germany: Platz 12';
    best.title='Historische Bestplatzierung, vom Nutzer angegeben';card.append(best);
   }
   placementGrid.append(card);
  }
  placementStatus.textContent=`Stand: ${new Date(result.updatedAt).toLocaleString('de-DE')} · Clanregion: ${result.location??'Nicht verfügbar'}`;
 }catch(e){if(!demo)placementStatus.textContent=`${e.message} Bereits angezeigte Werte bleiben vom vorherigen Abruf.`;}
 finally{loadingPlacements=false;placementButton.disabled=demo;}
}
placementButton.onclick=loadPlacements;
const chartPanel=document.createElement('section');chartPanel.className='panel trend-panel';
const chartTitle=document.createElement('h2');chartTitle.textContent='Clanpunkte · Die letzten 10 Kriegswochen';
const chartNote=document.createElement('p');chartNote.textContent='Summe der tatsächlich erzielten Spielerpunkte aller damaligen Teilnehmer, ohne 16er-Normalisierung. Unabhängig vom Mitgliederfilter und der Ranglistenauswahl. Datum = Abschlussdatum laut API-Kriegsprotokoll.';
const chartHost=document.createElement('div');chartHost.className='trend-scroll';
const chartRecord=document.createElement('p');chartRecord.className='chart-record';chartRecord.textContent='Wochenpunkte-Rekord: 140.300 Punkte';
chartPanel.append(chartTitle,chartRecord,chartNote,chartHost);document.querySelector('aside').before(chartPanel);chartPanel.after(membershipPanel);
const clanPrintReport=document.createElement('div');clanPrintReport.id='clan-print-report';document.body.append(clanPrintReport);
function printClanReport(){
 if(!demo&&(attendanceTable.querySelector('input:disabled')||membershipTable.querySelector('button:disabled'))){$('status').textContent='Bitte warten, bis alle Änderungen gespeichert sind.';return;}
 clanPrintReport.replaceChildren();
 const title=document.createElement('h2');title.textContent='War Imperium · Clanbericht';
 const summary=document.createElement('p');summary.textContent=exportMetadata().join(' · ');clanPrintReport.append(title,summary);
 const panels=[document.querySelector('.player-points-panel'),chartPanel,attendancePanel,placementPanel,membershipPanel];
 for(const [index,panel] of panels.entries()){
  const copy=panel.cloneNode(true);copy.className='clan-print-section';
  // Strip duplicate IDs and all editing controls from the print snapshot.
  copy.removeAttribute('id');copy.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
  copy.querySelectorAll('button,.actions,.filters,.mobile-trend,.print-summary,.report-summary,.join-date-status').forEach(el=>el.remove());
  copy.querySelectorAll('details').forEach(details=>details.open=true);
  if(index===0){const heading=document.createElement('h2');heading.textContent='Spielerpunkte';copy.prepend(heading);}
  if(index===2){copy.querySelector('h2').textContent+=` · Woche ${attendanceSelect.selectedOptions[0]?.textContent??'nicht verfügbar'}`;copy.querySelectorAll(':scope > label').forEach(el=>el.remove());copy.querySelectorAll('.absence-check').forEach(label=>{const checked=label.querySelector('input')?.checked;label.textContent=checked?'Abgemeldet':'Nicht abgemeldet';});}
  if(index===4){
   const members=membershipRows(weeks,roster?.members??[],demo?{}:memberProfiles);
   copy.querySelectorAll('tbody tr').forEach((row,i)=>{const form=row.querySelector('.join-date-form'),value=members[i]?.joinedOn;if(form)form.replaceWith(document.createTextNode(value?value.split('-').reverse().join('.'):'Unbekannt'));});
  }
  copy.querySelectorAll('input,select,summary').forEach(el=>el.remove());clanPrintReport.append(copy);
 }
 const originalTitle=document.title;document.title='War Imperium Clanbericht';document.body.classList.add('print-clan-report');
 const restore=()=>{document.body.classList.remove('print-clan-report');document.title=originalTitle;clanPrintReport.replaceChildren();};window.addEventListener('afterprint',restore,{once:true});
 try{window.print();}catch(error){window.removeEventListener('afterprint',restore);restore();throw error;}
}
function renderTrend(){
 const points=weeklyTrend(weeks);chartHost.replaceChildren();

 chartTitle.textContent=`${demo?'DEMO · ':''}Clanpunkte · Die letzten ${Math.min(10,weeks.length)} Kriegswochen`;
 if(!points.length){chartHost.textContent='Nach dem ersten Abruf erscheint hier die Entwicklung der Clanpunkte.';return;}
 const svgNS='http://www.w3.org/2000/svg';
 function element(tag,attrs,text){const node=document.createElementNS(svgNS,tag);for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);if(text!==undefined)node.textContent=text;return node;}
 const width=1040,height=350,left=82,right=60,top=48,bottom=85,plotWidth=width-left-right,plotHeight=height-top-bottom;
 const min=120000;
 const max=Math.max(min+1000,...points.map(p=>p.points));
 const axisMax=Math.ceil((max+(max-min)*0.15)/1000)*1000;
 chartNote.textContent='Punkteachse ab 120.000. Werte darunter sind am unteren Rand mit ↓ markiert. Summe der Originalpunkte aller damaligen Teilnehmer, ohne Normalisierung und unabhängig vom Mitgliederfilter. Datum = Abschlussdatum laut API-Kriegsprotokoll.';
 const svg=element('svg',{viewBox:`0 0 ${width} ${height}`,role:'img','aria-label':'Entwicklung der wöchentlichen Clanpunkte. Exakte Werte und Datumsangaben stehen auch in der Tabelle darunter.'});
 for(let i=0;i<=4;i++){const y=top+plotHeight-i*plotHeight/4;svg.append(element('line',{x1:left,y1:y,x2:width-right,y2:y,stroke:'#405361'}),element('text',{x:left-12,y:y+5,'text-anchor':'end',class:'chart-axis'},Math.round(min+(axisMax-min)*i/4).toLocaleString('de-DE')));}
 const coords=points.map((p,i)=>({x:points.length===1?left+plotWidth/2:left+i*plotWidth/(points.length-1),y:top+plotHeight-(Math.max(min,p.points)-min)/(axisMax-min)*plotHeight}));
 svg.append(element('polyline',{points:coords.map(p=>`${p.x},${p.y}`).join(' '),fill:'none',stroke:'#edc97a','stroke-width':3}));
 points.forEach((p,i)=>{const {x,y}=coords[i];const circle=element('circle',{cx:x,cy:y,r:6,fill:'#edc97a',tabindex:0});circle.append(element('title',{},`${p.date??'Datum nicht verfügbar'}: ${p.points.toLocaleString('de-DE')} Punkte`));svg.append(circle,element('text',{x,y:y-15,'text-anchor':'middle',class:'chart-value'},(p.points<min?'↓ ':'')+p.points.toLocaleString('de-DE')),element('text',{x,y:height-52,'text-anchor':'middle',class:'chart-axis'},p.date??(demo?'Demo': 'Ohne Datum')),element('text',{x,y:height-30,'text-anchor':'middle',class:'chart-axis'},`S${p.season} / W${p.section+1}`));});
 chartHost.append(svg);
 const mobileChart=document.createElement('div');mobileChart.className='mobile-trend';mobileChart.setAttribute('aria-label','Clanpunkte nach Woche');
 for(const point of points){
  const row=document.createElement('div');row.className='mobile-trend-row';
  const date=document.createElement('span');date.textContent=point.date??(demo?'Demo':'Ohne Datum');
  const value=document.createElement('strong');value.textContent=`${point.points.toLocaleString('de-DE')} Punkte`;
  const week=document.createElement('small');week.textContent=`Saison ${point.season} · Woche ${point.section+1}${point.points<min?' · Unter 120.000':''}`;
  const bar=document.createElement('progress');bar.max=axisMax-min;bar.value=Math.max(0,point.points-min);bar.setAttribute('aria-label',`${point.points.toLocaleString('de-DE')} Punkte, Achse ab 120.000`);
  row.append(date,value,week,bar);mobileChart.append(row);
 }
 chartHost.append(mobileChart);
 const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Alle Wochenpunkte als Tabelle anzeigen';details.append(summary);
 const table=document.createElement('table');const head=document.createElement('thead'),headRow=document.createElement('tr');['Abschlussdatum','Kriegswoche','Clanpunkte'].forEach(v=>{const th=document.createElement('th');th.textContent=v;headRow.append(th)});head.append(headRow);table.append(head);
 const body=document.createElement('tbody');for(const p of points){const tr=document.createElement('tr');[p.date??(demo?'Demo':'Nicht verfügbar'),`Saison ${p.season} · Woche ${p.section+1}`,p.points.toLocaleString('de-DE')].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td)});body.append(tr);}table.append(body);details.append(table);chartHost.append(details);
}
const memberLabel=document.createElement('label');
const memberToggle=document.createElement('input');memberToggle.type='checkbox';memberToggle.id='membersOnly';memberToggle.checked=true;
memberLabel.append(memberToggle,document.createTextNode('Nur aktuell im Clan'));document.querySelector('.filters').append(memberLabel);
const memberStatus=document.createElement('p');memberStatus.setAttribute('role','status');document.querySelector('.filters').after(memberStatus);
memberToggle.onchange=render;
const exportBar=document.createElement('div');exportBar.className='actions export-actions';
const pdfButton=document.createElement('button');pdfButton.textContent='Als PDF speichern';

exportBar.append(pdfButton);document.querySelector('.filters').before(exportBar);
const printSummary=document.createElement('p');printSummary.className='print-summary';exportBar.after(printSummary);
function selectedRows(){return filterMembers(rankings(weeks,$('week').value,Number($('window').value)),roster?.members,memberToggle.checked);}
function exportMetadata(){return [demo?'DEMO – Erfundenes Beispiel':'War Imperium · Clan #22QJG0',$('week').selectedOptions[0]?.textContent??'',`Auswertung: ${$('window').selectedOptions[0].textContent}`,`Filter: ${memberToggle.checked?'Nur aktuell im Clan':'Alle historischen Teilnehmer'}`,demo?'Demo-Mitgliederliste':roster?`Mitgliederstand: ${new Date(roster.updatedAt).toLocaleString('de-DE')}`:'Kein Mitgliederstand',`Export: ${new Date().toLocaleString('de-DE')}`];}
pdfButton.onclick=printClanReport;
const playerPointsPanel=document.querySelector('.panel');playerPointsPanel.classList.add('player-points-panel');
playerPointsPanel.after(chartPanel,attendancePanel,placementPanel,membershipPanel,playerRankingPanel);
function render(){renderAttendance();
 const rows=filterMembers(rankings(weeks,$('week').value,Number($('window').value)),roster?.members,memberToggle.checked);$('rows').replaceChildren();$('empty').hidden=rows.length>0;
 pdfButton.disabled=weeks.length===0&&!roster;
 memberStatus.textContent=demo?'Demo-Mitgliederliste (Beispieldaten).':roster?`Mitgliederliste: ${roster.members.length} Mitglieder · Stand ${new Date(roster.updatedAt).toLocaleString('de-DE')}. Wird beim API-Abruf aktualisiert.`:'Noch keine Mitgliederliste vorhanden. Bitte API-Daten abrufen oder den Filter ausschalten.';
 $('empty').textContent=weeks.length?'Keine passenden Spieler mit gespeicherten Kriegsdaten für diese Auswahl.':'Noch keine Daten. Starte mit der Demo oder richte den API-Schlüssel ein.';
 rows.forEach((r,i)=>{const tr=document.createElement('tr');[i+1,`${r.name} (${r.tag})`,r.value===null?'—':r.value.toLocaleString('de-DE',{maximumFractionDigits:1}),`${r.count} / ${r.available}`].forEach((v,column)=>{const td=document.createElement('td');td.textContent=v;if(column===2)td.className=`score-${scoreBand(r.value)}`;tr.append(td)});$('rows').append(tr)});
}
async function load(isDemo=false){const r=await fetch(isDemo?'/api/demo':'/api/history');const d=await r.json();weeks=d.weeks;demo=isDemo;roster=d.roster??null;if(!isDemo){savedAbsences=d.absences??{};memberProfiles=d.memberProfiles??{};}weeks.sort((a,b)=>b.season-a.season||b.section-a.section);$('week').replaceChildren(...weeks.map(w=>{const o=document.createElement('option');o.value=w.id;o.textContent=`${isDemo?'Demo · ':''}Saison ${w.season} · Woche ${w.section+1}`;return o}));$('status').textContent=isDemo?'DEMO · Erfundenes Beispiel, keine echten Clandaten.':`${weeks.length} gespeicherte Wochen. ${d.configured?'API-Schlüssel eingerichtet.':'API-Schlüssel fehlt noch.'}`;render();renderTrend();renderMembership();placementButton.disabled=demo;loadPlacements();refreshPlayerRankings();return d;}
async function sync(){ $('sync').disabled=true;try{const r=await fetch('/api/sync',{method:'POST',headers:{'X-War-Imperium':'local'}});const d=await r.json();if(!r.ok)throw Error(d.error);await load();$('status').textContent=`Abruf erfolgreich: ${d.imported} verfügbare Wochen geprüft, ${d.total} lokal gespeichert.`;}catch(e){$('status').textContent=e.message;}finally{$('sync').disabled=false;}}
$('demo').onclick=()=>load(true).catch(showError);$('real').onclick=()=>load().catch(showError);$('sync').onclick=sync;$('week').onchange=render;$('window').onchange=render;
function showError(){ $('status').textContent='Lokaler Server nicht erreichbar.'; }
load().then(d=>{if(d.configured)sync()}).catch(showError);setInterval(()=>{if(!demo)sync()},3600000);
