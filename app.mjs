import {rankings,filterMembers,weeklyTrend,attendanceWeeks,missingAttacks} from './core.mjs';
import {scoreBand} from './export.mjs';
const $=id=>document.getElementById(id);let weeks=[],demo=false,roster=null,appRole='vice';
const activeClan=new URLSearchParams(location.search).get('clan')||'22QJG0';
const clanName=activeClan==='22QJG0'?'War Imperium':'War Imperium II';
const endpoint=path=>path+'?clan='+encodeURIComponent(activeClan);
const clanSelect=$('war-clan');clanSelect.value=activeClan;clanSelect.onchange=()=>location.assign('/clankrieg?clan='+encodeURIComponent(clanSelect.value));
$('war-clan-name').textContent=clanName;
let savedAbsences={},demoAbsences={};
const attendancePanel=document.createElement('section');attendancePanel.className='panel attendance-panel';
const attendanceTitle=document.createElement('h2');attendanceTitle.textContent='Fehlende Angriffe · Abmeldungen';
const attendanceLabel=document.createElement('label');attendanceLabel.textContent='Clankriegswoche';
const attendanceSelect=document.createElement('select');attendanceLabel.append(attendanceSelect);
const attendanceStatus=document.createElement('p');attendanceStatus.setAttribute('role','status');
const attendanceTable=document.createElement('div');attendanceTable.className='table';
attendancePanel.append(attendanceTitle,attendanceLabel,attendanceStatus,attendanceTable);document.querySelector('.panel:not(.live-race-panel)').after(attendancePanel);
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
    if(!isDemo){const response=await fetch(endpoint('/api/absence'),{method:'POST',headers:{'Content-Type':'application/json','X-War-Imperium':'local'},body:JSON.stringify({weekId:week.id,tag:player.tag,excused:value})});const result=await response.json();if(!response.ok)throw Error(result.error||'Speichern fehlgeschlagen');}
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
placementPanel.append(placementTitle,placementButton,placementStatus,placementGrid);attendancePanel.after(placementPanel);
let loadingPlacements=false;
async function loadPlacements(){
 if(demo){placementGrid.replaceChildren();placementStatus.textContent='Im Demo-Modus werden keine echten Platzierungen abgerufen.';return;}
 if(loadingPlacements)return;
 loadingPlacements=true;placementButton.disabled=true;placementStatus.textContent='Aktuelle Ranglisten werden geprüft …';
 try{
  const response=await fetch(endpoint('/api/placements'),appRole==='admin'?{method:'POST',headers:{'X-War-Imperium':'local'}}:{});const result=await response.json();
  if(demo)return;
  if(!response.ok)throw Error(result.error||'Ranglistenabruf fehlgeschlagen.');
  placementGrid.replaceChildren();
  for(const board of result.results){
   const card=document.createElement('article');const title=document.createElement('h3');title.textContent=board.title;
   const rank=document.createElement('strong');rank.textContent=board.error?'Nicht verfügbar':board.rank?`Platz ${board.rank.toLocaleString('de-DE')}`:'Nicht aufgeführt';
   const note=document.createElement('p');note.textContent=board.error|| (board.rank?`${board.score===null?'':board.score.toLocaleString('de-DE')+' Punkte'}${board.previousRank>0?' · Vorheriger API-Rang: '+board.previousRank.toLocaleString('de-DE'):''}`:`In ${board.checked.toLocaleString('de-DE')} abgerufenen Einträgen nicht enthalten.${board.complete?'':' Suche wegen Abrufgrenze unvollständig.'}`);
   card.append(title,rank);if(board.error)card.append(note);
   if(activeClan==='22QJG0'&&(board.title==='Clankrieg · Weltweit'||board.title==='Clankrieg · Germany')){
    const best=document.createElement('p');best.className='best-placement';
    best.textContent=board.title==='Clankrieg · Weltweit'?'Beste Platzierung Weltweit: Platz 144':'Beste Platzierung Germany: Platz 12';
    best.title='Historische Bestplatzierung, vom Nutzer angegeben';card.append(best);
   }
   placementGrid.append(card);
  }
  placementStatus.textContent=result.updatedAt?`Stand: ${new Date(result.updatedAt).toLocaleString('de-DE')} · Clanregion: ${result.location??'Nicht verfügbar'}`:'Noch kein gespeicherter Clanranglistenstand. Ein Admin muss die Platzierungen zuerst aktualisieren.';
 }catch(e){if(!demo)placementStatus.textContent=`${e.message} Bereits angezeigte Werte bleiben vom vorherigen Abruf.`;}
 finally{loadingPlacements=false;placementButton.disabled=demo;}
}
placementButton.onclick=loadPlacements;
const chartPanel=document.createElement('section');chartPanel.className='panel trend-panel';
const chartTitle=document.createElement('h2');chartTitle.textContent='Clanpunkte · Die letzten 10 Kriegswochen';
const chartHost=document.createElement('div');chartHost.className='trend-scroll';
const chartRecord=document.createElement('p');chartRecord.className='chart-record';chartRecord.textContent='Wochenpunkte-Rekord: 140.300 Punkte';chartRecord.hidden=activeClan!=='22QJG0';
chartPanel.append(chartTitle,chartRecord,chartHost);document.querySelector('aside').before(chartPanel);
const clanPrintReport=document.createElement('div');clanPrintReport.id='clan-print-report';document.body.append(clanPrintReport);
function printClanReport(){
 if(appRole!=='admin')return;
 if(!demo&&(attendanceTable.querySelector('input:disabled'))){$('status').textContent='Bitte warten, bis alle Änderungen gespeichert sind.';return;}
 clanPrintReport.replaceChildren();

 const panels=[document.querySelector('.player-points-panel'),chartPanel,attendancePanel,placementPanel];
 for(const [index,panel] of panels.entries()){
  const copy=panel.cloneNode(true);copy.className='clan-print-section';
  // Strip duplicate IDs and all editing controls from the print snapshot.
  copy.removeAttribute('id');copy.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
  copy.querySelectorAll('button,.actions,.filters,.mobile-trend,.print-summary,.report-summary,.join-date-status').forEach(el=>el.remove());
  copy.querySelectorAll('details').forEach(details=>details.open=true);
  if(index===0){const heading=document.createElement('h2');heading.textContent='Spielerpunkte';copy.prepend(heading);}
  if(index===2){copy.querySelector('h2').textContent+=` · Woche ${attendanceSelect.selectedOptions[0]?.textContent??'nicht verfügbar'}`;copy.querySelectorAll(':scope > label').forEach(el=>el.remove());copy.querySelectorAll('.absence-check').forEach(label=>{const checked=label.querySelector('input')?.checked;label.textContent=checked?'Abgemeldet':'Nicht abgemeldet';});}
  copy.querySelectorAll('input,select,summary').forEach(el=>el.remove());
  const masthead=document.createElement('div');masthead.className='report-masthead';
  const crest=document.createElement('img');crest.src='/crest.svg';crest.alt='';crest.width=42;crest.height=52;
  const brand=document.createElement('div'),kicker=document.createElement('p');kicker.className='report-kicker';kicker.textContent=clanName.toUpperCase()+' · CLAN #'+activeClan;
  const reportTitle=document.createElement('strong');reportTitle.textContent='Clankrieg Report';brand.append(kicker,reportTitle);
  const sectionNumber=document.createElement('span');sectionNumber.className='report-number';sectionNumber.textContent=String(index+1).padStart(2,'0');masthead.append(crest,brand,sectionNumber);copy.prepend(masthead);
  const meta=document.createElement('div');meta.className='report-metadata';
  const entries=[['Kriegswoche',$('week').selectedOptions[0]?.textContent??'—'],['Auswertung',$('window').selectedOptions[0]?.textContent??'—'],['Spielerfilter',memberToggle.checked?'Aktuell im Clan':'Alle Teilnehmer'],['Erstellt',new Date().toLocaleString('de-DE')]];
  for(const [label,value] of entries){const entry=document.createElement('div'),caption=document.createElement('span'),text=document.createElement('strong');caption.textContent=label;text.textContent=value;entry.append(caption,text);meta.append(entry);}masthead.after(meta);
  if(index===0){const legend=document.createElement('p');legend.className='report-score-legend';legend.textContent='Punktebewertung: bis 2.500 rot · ab 2.900 grün · auf 16 Angriffe normalisiert';meta.after(legend);}
  const footer=document.createElement('p');footer.className='report-section-footer';footer.textContent='WAR IMPERIUM  /  '+['Spielerpunkte','Clanpunkte','Fehlende Angriffe','Clanplatzierungen'][index]+'  ·  '+String(index+1).padStart(2,'0')+' / 04';copy.append(footer);clanPrintReport.append(copy);
 }
 const originalTitle=document.title;document.title=clanName+' Clanbericht';document.body.classList.add('print-clan-report');
 const restore=()=>{document.body.classList.remove('print-clan-report');document.title=originalTitle;clanPrintReport.replaceChildren();};window.addEventListener('afterprint',restore,{once:true});
 try{window.print();}catch(error){window.removeEventListener('afterprint',restore);restore();throw error;}
}
function renderTrend(){
 const points=weeklyTrend(weeks);chartHost.replaceChildren();if(activeClan!=='22QJG0'){chartRecord.hidden=!points.length;chartRecord.textContent='Höchste gespeicherte Wochenpunkte: '+Math.max(0,...weeks.map(w=>w.players.reduce((sum,p)=>sum+p.points,0))).toLocaleString('de-DE')+' Punkte';}

 chartTitle.textContent=`${demo?'DEMO · ':''}Clanpunkte · Die letzten ${Math.min(10,weeks.length)} Kriegswochen`;
 if(!points.length){chartHost.textContent='Nach dem ersten Abruf erscheint hier die Entwicklung der Clanpunkte.';return;}
 const svgNS='http://www.w3.org/2000/svg';
 function element(tag,attrs,text){const node=document.createElementNS(svgNS,tag);for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);if(text!==undefined)node.textContent=text;return node;}
 const width=1040,height=350,left=82,right=60,top=48,bottom=85,plotWidth=width-left-right,plotHeight=height-top-bottom;
 const min=120000;
 const max=Math.max(min+1000,...points.map(p=>p.points));
 const axisMax=Math.ceil((max+(max-min)*0.15)/1000)*1000;
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
function exportMetadata(){return [demo?'DEMO – Erfundenes Beispiel':clanName+' · Clan #'+activeClan,$('week').selectedOptions[0]?.textContent??'',`Auswertung: ${$('window').selectedOptions[0].textContent}`,`Filter: ${memberToggle.checked?'Nur aktuell im Clan':'Alle historischen Teilnehmer'}`,demo?'Demo-Mitgliederliste':roster?`Mitgliederstand: ${new Date(roster.updatedAt).toLocaleString('de-DE')}`:'Kein Mitgliederstand',`Export: ${new Date().toLocaleString('de-DE')}`];}
pdfButton.onclick=printClanReport;
const playerPointsPanel=document.querySelector('.panel:not(.live-race-panel)');playerPointsPanel.classList.add('player-points-panel');
playerPointsPanel.after(chartPanel,attendancePanel,placementPanel);
function render(){renderAttendance();
 const rows=filterMembers(rankings(weeks,$('week').value,Number($('window').value)),roster?.members,memberToggle.checked);$('rows').replaceChildren();$('empty').hidden=rows.length>0;
 pdfButton.disabled=appRole!=='admin'||(weeks.length===0&&!roster);pdfButton.hidden=appRole!=='admin';$('sync').hidden=appRole!=='admin';placementButton.hidden=appRole!=='admin';
 memberStatus.textContent=demo?'Demo-Mitgliederliste (Beispieldaten).':roster?`Mitgliederliste: ${roster.members.length} Mitglieder · Stand ${new Date(roster.updatedAt).toLocaleString('de-DE')}. Wird beim API-Abruf aktualisiert.`:'Noch keine Mitgliederliste vorhanden. Bitte API-Daten abrufen oder den Filter ausschalten.';
 $('empty').textContent=weeks.length?'Keine passenden Spieler mit gespeicherten Kriegsdaten für diese Auswahl.':'Noch keine gespeicherten Daten. Ein Admin kann die API-Daten abrufen.';
 rows.forEach((r,i)=>{const tr=document.createElement('tr');[i+1,`${r.name} (${r.tag})`,r.value===null?'—':r.value.toLocaleString('de-DE',{maximumFractionDigits:1}),`${r.count} / ${r.available}`].forEach((v,column)=>{const td=document.createElement('td');td.textContent=v;if(column===1){td.replaceChildren();const name=document.createElement('span'),tag=document.createElement('span');tag.className='player-tag';name.textContent=r.name+' ';tag.textContent='('+r.tag+')';td.append(name,tag);}if(column===2)td.className=`score-${scoreBand(r.value)}`;tr.append(td)});$('rows').append(tr)});
}
async function load(isDemo=false){const r=await fetch(isDemo?'/api/demo':endpoint('/api/history'));const d=await r.json();if(!r.ok)throw Error(d.error||'Daten konnten nicht geladen werden.');weeks=d.weeks;demo=isDemo;appRole=d.role??'vice';document.body.dataset.role=appRole;roster=d.roster??null;if(!isDemo){savedAbsences=d.absences??{};}weeks.sort((a,b)=>b.season-a.season||b.section-a.section);$('week').replaceChildren(...weeks.map(w=>{const o=document.createElement('option');o.value=w.id;o.textContent=`${isDemo?'Demo · ':''}Saison ${w.season} · Woche ${w.section+1}`;return o}));$('status').textContent=isDemo?'DEMO · Erfundenes Beispiel, keine echten Clandaten.':`${weeks.length} gespeicherte Wochen. ${d.configured?'API-Schlüssel eingerichtet.':'API-Schlüssel fehlt noch.'}`;render();renderTrend();placementButton.disabled=demo;loadPlacements();return d;}
async function sync(){if(appRole!=='admin')return; $('sync').disabled=true;try{const r=await fetch(endpoint('/api/sync'),{method:'POST',headers:{'X-War-Imperium':'local'}});const d=await r.json();if(!r.ok)throw Error(d.error);await load();$('status').textContent=`Abruf erfolgreich: ${d.imported} verfügbare Wochen geprüft, ${d.total} lokal gespeichert.`;}catch(e){$('status').textContent=e.message;}finally{$('sync').disabled=false;}}
$('sync').onclick=sync;$('week').onchange=render;$('window').onchange=render;
function showError(){ $('status').textContent='Lokaler Server nicht erreichbar.'; }
load().then(d=>{if(d.configured&&appRole==='admin')sync()}).catch(showError);setInterval(()=>{if(!demo&&appRole==='admin')sync()},3600000);

// Keep the live view self-contained so an unavailable extra module cannot block history.
function mountCurrentRace(tag){
 const el=(t,text,cls)=>{const n=document.createElement(t);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;},fmt=n=>Number.isFinite(n)?n.toLocaleString('de-DE',{maximumFractionDigits:2}):'—';
 const panel=el('section',undefined,'panel live-race-panel'),head=el('div',undefined,'live-race-heading'),title=el('h2','Aktuelles Flussrennen'),refresh=el('button','Live-Daten aktualisieren'),status=el('p',undefined,'live-race-status'),body=el('div');status.setAttribute('role','status');head.append(title,refresh);panel.append(head,status,body);document.getElementById('war-clan-name').after(panel);
 let loading=false;
 async function load(){if(loading)return;loading=true;refresh.disabled=true;status.textContent='Laufendes Flussrennen wird geladen …';try{
  const r=await fetch('/api/current-race?clan='+encodeURIComponent(tag)),d=await r.json();if(!r.ok)throw Error(d.error||'Live-Daten konnten nicht geladen werden.');body.replaceChildren();
  title.textContent=d.name+' · Aktuelles Flussrennen';status.textContent=(d.week?'Woche '+d.week+' · ':'')+(d.warDay?'Kampftag'+(d.day?' '+d.day:''):'Trainingsphase / kein Kampftag')+' · Stand '+new Date(d.updatedAt).toLocaleString('de-DE');
  body.append(el('h3','Rangliste nach hochgerechneten Punkten'));
  const board=el('div',undefined,'live-race-table-wrap'),table=el('table',undefined,'live-race-table'),thead=el('thead'),header=el('tr');
  for(const text of ['Clan','Aktuelle Punkte','Offene Clan Angriffe','Punkteschnitt','Hochgerechnete Punkte']){const th=el('th',text);th.scope='col';header.append(th);}thead.append(header);table.append(thead);
  const tbody=el('tbody'),clans=[...d.clans].sort((a,b)=>(b.projected??-1)-(a.projected??-1)||a.tag.localeCompare(b.tag));
  for(const c of clans){const tr=el('tr',undefined,c.tag==='#'+tag?'selected-clan':'');const name=el('th');name.scope='row';const rank=c.projected===null?'—':1+clans.filter(o=>o.projected!==null&&o.projected>c.projected).length;name.append(el('span',rank+'.','live-race-rank'),el('span',c.name));tr.append(name);for(const value of [Number.isFinite(c.points)?c.points.toLocaleString('de-DE',{maximumFractionDigits:0}):'—',fmt(c.remaining),fmt(c.average),Number.isFinite(c.projected)?c.projected.toLocaleString('de-DE',{maximumFractionDigits:0}):'—'])tr.append(el('td',value));tbody.append(tr);}table.append(tbody);board.append(table);body.append(board);
  const attacks=el('section',undefined,'live-race-attacks');attacks.append(el('h3','Heute noch offene Angriffe · Aktuelle Mitglieder'));
  if(!d.warDay)attacks.append(el('p','Aktuell ist laut API kein Kampftag. Die offenen Kriegsangriffe werden am Kampftag angezeigt.'));
  else {attacks.append(el('p',fmt(d.memberRemaining)+' offene Angriffe bei aktuellen Mitgliedern · '+d.members+' Mitglieder'+(d.unknown?' · '+d.unknown+' ohne auswertbaren Tagesstand':'')));const groups=el('div',undefined,'live-attack-groups');let count=0;for(const n of [4,3,2,1]){const rows=d.groups[n]??[];if(!rows.length)continue;count+=rows.length;const group=el('article');group.append(el('h4',n+' '+(n===1?'Angriff':'Angriffe')+' offen ('+rows.length+')'));const list=el('ul');for(const p of rows){const li=el('li',p.name);li.title=p.tag;list.append(li);}group.append(list);groups.append(group);}if(!count)attacks.append(el('p',d.unknown?'Kein offener Angriff sicher erfasst.':'Alle aktuellen Mitglieder haben ihre vier Tagesdecks eingesetzt.'));attacks.append(groups);}
  body.append(attacks);
 }catch(e){status.textContent=e.message+' Bereits angezeigte Daten können veraltet sein.';}finally{loading=false;refresh.disabled=false;}}
 refresh.onclick=load;load();setInterval(()=>{if(!document.hidden)load();},60000);
}

try{mountCurrentRace(activeClan);}catch(error){const note=document.createElement('p');note.setAttribute('role','status');note.textContent='Der Live-Bereich konnte nicht gestartet werden. Die gespeicherten Auswertungen bleiben verfügbar.';document.getElementById('war-clan-name')?.after(note);console.error('Live-Ansicht konnte nicht gestartet werden:',error);}
