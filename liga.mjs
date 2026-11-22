import {tournamentUrl,tournamentId} from './tournament-context.mjs';
import {leagueStandings,leagueZones,leagueRules} from './league-core.mjs';
const $=id=>document.getElementById(id);
let state=null,busy=false,isAdmin=false,currentRole=null,canEnterResults=false;
let selectedLeague=1;const tableOpen=new Map();
const tabs=document.createElement('div');tabs.className='league-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Liga auswählen');const leagueNavigation=document.createElement('div');leagueNavigation.className='league-navigation';const finalsLink=document.createElement('a');finalsLink.href=tournamentUrl('/finals');finalsLink.className='league-finals-tab';finalsLink.textContent='War Imperium Finals';leagueNavigation.append(tabs,finalsLink);document.getElementById('league-tables').before(leagueNavigation);
function selectLeague(id,focus=false){selectedLeague=id;for(const tab of tabs.children){const active=Number(tab.dataset.league)===id;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;if(active&&focus)tab.focus();}document.querySelectorAll('[data-league-panel]').forEach(panel=>panel.hidden=Number(panel.dataset.leaguePanel)!==id);}
tabs.onkeydown=event=>{const ids=[...tabs.children].map(b=>Number(b.dataset.league)),index=ids.indexOf(selectedLeague);let next;if(event.key==='ArrowRight')next=ids[(index+1)%ids.length];if(event.key==='ArrowLeft')next=ids[(index+ids.length-1)%ids.length];if(event.key==='Home')next=ids[0];if(event.key==='End')next=ids.at(-1);if(next){event.preventDefault();selectLeague(next,true);}};
const openRounds=new Set();
const openOnlyLeagues=new Set();
let jpgExportBusy=false;
const jpgRanges=new Map(),openExportMenus=new Set();
function adminJpgMenu(league){
 const menu=document.createElement('details');menu.className='league-export-menu';menu.open=openExportMenus.has(league.id);menu.ontoggle=()=>{if(menu.open)openExportMenus.add(league.id);else openExportMenus.delete(league.id);};const title=document.createElement('summary');title.textContent='Admin · JPG-Export';menu.append(title);
 const actions=document.createElement('div');actions.className='league-export-actions';
 const table=document.createElement('button');table.type='button';table.textContent='Ligatabelle als JPG';table.disabled=!league.players.length;table.onclick=()=>exportLeagueJpg(league.id,table,{type:'table'});
 const open=document.createElement('button');open.type='button';open.className='open-matches-jpg';open.textContent='Offene Spiele als JPG';open.disabled=!(league.matches??[]).some(m=>m.homeScore==null||m.awayScore==null);open.onclick=()=>exportLeagueJpg(league.id,open);actions.append(table,open);menu.append(actions);
 const range=document.createElement('div');range.className='league-export-range';const from=document.createElement('select'),to=document.createElement('select'),rounds=[...new Set((league.matches??[]).map(m=>m.round))].sort((a,b)=>a-b);
 for(const round of rounds){from.add(new Option('Spieltag '+round,String(round)));to.add(new Option('Spieltag '+round,String(round)));}const saved=jpgRanges.get(league.id);from.value=String(rounds.includes(saved?.from)?saved.from:rounds[0]);to.value=String(rounds.includes(saved?.to)?saved.to:rounds.at(-1));
 for(const [label,input]of [['Von Spieltag',from],['Bis Spieltag',to]]){const field=document.createElement('label');field.textContent=label;input.setAttribute('aria-label',`${league.name}: JPG ${label}`);field.append(input);range.append(field);}
 const change=()=>{if(Number(to.value)<Number(from.value))to.value=from.value;for(const option of to.options)option.disabled=Number(option.value)<Number(from.value);jpgRanges.set(league.id,{from:Number(from.value),to:Number(to.value)});};from.onchange=to.onchange=change;if(rounds.length)change();
 const exportRange=document.createElement('button');exportRange.type='button';exportRange.textContent='Gewählte Spieltage als JPG';exportRange.disabled=from.disabled=to.disabled=!rounds.length;exportRange.onclick=()=>exportLeagueJpg(league.id,exportRange,{type:'rounds',from:Number(from.value),to:Number(to.value)});range.append(exportRange);menu.append(range);return menu;
}
function standingsJpgPages(league,createdAt,tournamentName,leagueCount){
 const rows=leagueStandings(league),pages=[];for(let i=0;i<rows.length;i+=18)pages.push(rows.slice(i,i+18));
 return pages.map((page,index)=>()=>{
  const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=490+page.length*100;const ctx=canvas.getContext('2d');const bg=ctx.createLinearGradient(0,0,1200,canvas.height);bg.addColorStop(0,'#03172d');bg.addColorStop(1,'#020912');ctx.fillStyle=bg;ctx.fillRect(0,0,1200,canvas.height);ctx.fillStyle='#f52d4a';ctx.fillRect(48,42,1104,6);ctx.fillStyle='#94c4df';ctx.font='bold 18px Arial';ctx.fillText('WAR IMPERIUM  /  '+(tournamentName||'LIGA & FINALS'),60,95,1080);ctx.fillStyle='#fff';ctx.font='italic bold 62px Arial';ctx.fillText('LIGATABELLE',58,170);ctx.fillStyle='#ff425d';ctx.font='bold 36px Arial';ctx.fillText(league.name,60,225);ctx.fillStyle='#bdd0e4';ctx.font='22px Arial';ctx.fillText(`${rows.length} Teilnehmer · Sortiert nach Punkten und Matchverhältnis`,60,272);
  ctx.fillStyle='#0b2940';ctx.fillRect(60,305,1080,55);ctx.fillStyle='#8edcf4';ctx.font='bold 17px Arial';for(const [text,x]of [['PLATZ',76],['SPIELER',157],['SPIELE',685],['PUNKTE',818],['MATCHVERHÄLTNIS',941]])ctx.fillText(text,x,340);
  page.forEach((p,i)=>{const top=360+i*100,rank=index*18+i+1;ctx.fillStyle=i%2?'#0b2238':'#071b30';ctx.fillRect(60,top,1080,100);ctx.strokeStyle='#21465e';ctx.beginPath();ctx.moveTo(60,top+100);ctx.lineTo(1140,top+100);ctx.stroke();
   const zones=leagueZones(league.id,rank,rows.length,leagueRules(league,leagueCount));if(zones.length){const colors=zones.map(z=>z==='Finalsplatz'?'#8cdeff':z==='Aufstiegsplatz'?'#74dfa1':'#ff8585');const color=ctx.createLinearGradient(77,top+30,126,top+70);colors.forEach((c,n)=>{color.addColorStop(n/colors.length,c);color.addColorStop((n+1)/colors.length,c);});ctx.fillStyle=color;ctx.fillRect(77,top+30,49,42);}
   ctx.fillStyle=zones.length?'#07182b':'#e9f3fc';ctx.font='bold 23px Arial';ctx.textAlign='center';ctx.fillText(String(rank),101,top+59);ctx.textAlign='left';
   let size=26,lines;for(;size>=14;size--){ctx.font=`bold ${size}px Arial`;lines=[''];for(const word of p.name.split(/\s+/)){let last=lines.length-1;if(ctx.measureText((lines[last]?lines[last]+' ':'')+word).width<=490)lines[last]+=(lines[last]?' ':'')+word;else if(ctx.measureText(word).width<=490)lines.push(word);else{if(lines[last])lines.push('');for(const char of Array.from(word)){last=lines.length-1;if(ctx.measureText(lines[last]+char).width>490)lines.push(char);else lines[last]+=char;}}}if(lines.length<=3)break;}
   ctx.fillStyle='#f1f6fc';lines.forEach((line,n)=>ctx.fillText(line,157,top+35+n*(size+3)));ctx.font='23px Arial';ctx.textAlign='center';ctx.fillText(String(p.games),715,top+59);ctx.fillStyle='#75dfff';ctx.font='bold 26px Arial';ctx.fillText(String(p.points),850,top+59);ctx.fillStyle='#f1f6fc';ctx.font='23px Arial';ctx.fillText(`${p.won}:${p.lost}`,1030,top+59);ctx.textAlign='left';
  });
  const legendY=canvas.height-91;for(const [text,color,x]of [['Finals','#8cdeff',60],['Aufstieg','#74dfa1',220],['Abstieg','#ff8585',400]]){ctx.fillStyle=color;ctx.fillRect(x,legendY-15,16,16);ctx.fillStyle='#b6cadd';ctx.font='18px Arial';ctx.fillText(text,x+26,legendY);}
  ctx.fillStyle='#74ddff';ctx.fillRect(48,canvas.height-46,1104,2);ctx.fillStyle='#a1b7cc';ctx.font='16px Arial';ctx.fillText('Stand: '+createdAt.toLocaleString('de-DE'),60,canvas.height-60);ctx.textAlign='right';ctx.fillText(`SEITE ${index+1} / ${pages.length}`,1140,canvas.height-60);return canvas;
 });
}
function jpgPages(league,createdAt,tournamentName,options={type:"open"}){
 const names=new Map(league.players.map(p=>[p.id,p.name]));
 const matches=(league.matches??[]).filter(m=>options.type==='rounds'?m.round>=options.from&&m.round<=options.to:m.homeScore==null||m.awayScore==null).sort((a,b)=>a.round-b.round);
 const pages=[];for(let i=0;i<matches.length;i+=10)pages.push(matches.slice(i,i+10));
 return pages.map((page,index)=>()=>{
  const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=420+page.length*146;const ctx=canvas.getContext('2d');
  const bg=ctx.createLinearGradient(0,0,1200,canvas.height);bg.addColorStop(0,'#03172d');bg.addColorStop(1,'#020912');ctx.fillStyle=bg;ctx.fillRect(0,0,1200,canvas.height);
  ctx.fillStyle='#f52d4a';ctx.fillRect(48,42,1104,6);ctx.fillStyle='#74ddff';ctx.fillRect(48,canvas.height-46,1104,2);
  ctx.fillStyle='#94c4df';ctx.font='bold 18px Arial';ctx.fillText('WAR IMPERIUM  /  '+(tournamentName||'LIGA & FINALS'),60,95,1080);
  ctx.fillStyle='#fff';ctx.font='italic bold 62px Arial';ctx.fillText(options.type==='rounds'?'SPIELTAGE':'OFFENE SPIELE',58,170);ctx.fillStyle='#ff425d';ctx.font='bold 36px Arial';ctx.fillText(league.name,60,225);
  ctx.fillStyle='#bdd0e4';ctx.font='22px Arial';ctx.fillText(options.type==='rounds'?`Spieltag ${options.from} bis ${options.to} · ${matches.length} Begegnungen`:`${matches.length} offene Begegnungen · Jeder gegen jeden`,60,272);
  ctx.strokeStyle='#2b526e';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(60,300);ctx.lineTo(1140,300);ctx.stroke();
  function player(text,x,y){let lines,size;for(size=26;size>=14;size--){ctx.font=`bold ${size}px Arial`;lines=[''];for(const word of (text??'Unbekannter Spieler').split(/\s+/)){let last=lines.length-1;const combined=lines[last]?lines[last]+' '+word:word;if(ctx.measureText(combined).width<=430)lines[last]=combined;else if(ctx.measureText(word).width<=430)lines.push(word);else{if(lines[last])lines.push('');for(const char of Array.from(word)){last=lines.length-1;if(ctx.measureText(lines[last]+char).width>430)lines.push(char);else lines[last]+=char;}}}if(lines.length<=3)break;}ctx.fillStyle='#f3f7fc';lines.forEach((line,n)=>ctx.fillText(line,x,y+n*(size+5)));}
  page.forEach((match,i)=>{const top=326+i*146;ctx.fillStyle=i%2?'#0b2238':'#071b30';ctx.fillRect(60,top,1080,132);ctx.fillStyle='#f3314c';ctx.fillRect(60,top,4,132);ctx.strokeStyle='#21465e';ctx.strokeRect(60,top,1080,132);
   ctx.fillStyle='#82d8f3';ctx.font='bold 16px Arial';ctx.fillText(`SPIELTAG ${match.round}`,84,top+28);ctx.fillStyle='#91a8bd';ctx.font='16px Arial';ctx.fillText(match.homeScore==null||match.awayScore==null?'NOCH OFFEN':'ERGEBNIS',1000,top+28);
   player(names.get(match.home),84,top+64);player(names.get(match.away),668,top+64);
   ctx.fillStyle='#fa3b55';ctx.font='italic bold 25px Arial';ctx.fillText(match.homeScore==null||match.awayScore==null?'VS':`${match.homeScore}:${match.awayScore}`,581,top+82);
  });
  ctx.fillStyle='#a1b7cc';ctx.font='17px Arial';ctx.fillText('Stand: '+createdAt.toLocaleString('de-DE'),60,canvas.height-79);ctx.textAlign='right';ctx.fillText(`SEITE ${index+1} / ${pages.length}`,1140,canvas.height-79);ctx.textAlign='left';
  return canvas;
 });
}
async function exportLeagueJpg(leagueId,trigger,options={type:"open"}){
 if(currentRole!=='admin'||busy||jpgExportBusy)return;jpgExportBusy=true;trigger.disabled=true;const urls=[];
 try{
  const response=await fetch(tournamentUrl('/api/leagues'));const result=await response.json();if(!response.ok)throw Error(result.error||'Abruf fehlgeschlagen');if(result.role!=='admin')throw Error('Bitte als Admin anmelden.');
  const league=result.state.leagues.find(l=>l.id===leagueId);if(!league)throw Error('Liga nicht gefunden');const createdAt=new Date(),pages=options.type==='table'?standingsJpgPages(league,createdAt,result.tournament?.name,result.state.leagues.length):jpgPages(league,createdAt,result.tournament?.name,options);
  if(!pages.length){$('league-status').textContent='Keine offenen Spiele in dieser Liga.';return;}
  const label=options.type==='table'?'Ligatabelle':options.type==='rounds'?'Spieltage '+options.from+' bis '+options.to:'Offene Spiele';
  const dialog=document.createElement('dialog');dialog.className='jpg-export-dialog';dialog.setAttribute('aria-label',label+' als JPG speichern');
  const title=document.createElement('h2');title.textContent=league.name+' · '+label;const note=document.createElement('p');note.textContent=pages.length===1?'Speichere das Bild über den Button unter der Vorschau.':`${pages.length} Bilder. Speichere die gewünschten Seiten einzeln.`;const close=document.createElement('button');close.type='button';close.textContent='Schließen';close.onclick=()=>dialog.close();dialog.append(title,note,close);
  for(const [index,draw] of pages.entries()){const canvas=draw();
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.94));if(!blob)throw Error('Bild konnte nicht erstellt werden');const url=URL.createObjectURL(blob);urls.push(url);
   const figure=document.createElement('figure'),img=document.createElement('img');img.loading='lazy';img.src=url;img.alt=`${label} · ${league.name} · Seite ${index+1}`;img.width=canvas.width;img.height=canvas.height;canvas.width=canvas.height=1;
   const link=document.createElement('a');link.href=url;link.download=`War-Imperium-${tournamentId}-Liga-${league.id}-${options.type}-${createdAt.toISOString().slice(0,10)}-${index+1}.jpg`;link.className='jpg-download';link.textContent=pages.length===1?'JPG-Bild speichern':`JPG-Bild ${index+1} speichern`;figure.append(img,link);dialog.append(figure);
  }
  dialog.addEventListener('close',()=>{urls.forEach(url=>URL.revokeObjectURL(url));dialog.remove();},{once:true});document.body.append(dialog);dialog.showModal();close.focus();$('league-status').textContent='JPG-Export erstellt. Er enthält den aktuell gespeicherten Stand.';
 }catch(error){urls.forEach(url=>URL.revokeObjectURL(url));$('league-status').textContent=error.message;}finally{jpgExportBusy=false;trigger.disabled=false;}
}
function toggleBusy(value){busy=value;$('add-player').disabled=value||!state||!isAdmin;document.querySelectorAll('.remove-player,.match-reset').forEach(b=>b.disabled=value||!isAdmin);document.querySelectorAll('.match-save,.match-score').forEach(b=>b.disabled=value||!canEnterResults);}
function renderSchedule(league,section){
 const title=document.createElement('h3');title.textContent='Spielplan · Jeder gegen jeden';section.append(title);
 const matches=league.matches??[],note=document.createElement('p');note.className='schedule-note';
 const isOpen=match=>match.homeScore==null||match.awayScore==null;
 const openOnly=openOnlyLeagues.has(league.id),openCount=matches.filter(isOpen).length;
 const filter=document.createElement('button');filter.type='button';filter.className='open-matches-toggle';filter.setAttribute('aria-pressed',String(openOnly));
 filter.textContent=openOnly?'Alle Spiele anzeigen':`Offene Spiele anzeigen (${openCount})`;
 filter.onclick=()=>{if(busy)return;if(openOnly)openOnlyLeagues.delete(league.id);else openOnlyLeagues.add(league.id);render();document.querySelector(`#league-panel-${league.id} .open-matches-toggle`)?.focus();};
 const scheduleActions=document.createElement('div');scheduleActions.className='schedule-actions';scheduleActions.append(filter);section.append(scheduleActions);
 
 note.textContent=matches.length?`${matches.filter(m=>m.homeScore!==null).length} / ${matches.length} Spiele abgeschlossen · Jede Paarung genau einmal.`:'Ab zwei Teilnehmern wird der Spielplan automatisch erstellt.';section.append(note);

 if(openOnly&&openCount===0){const empty=document.createElement('p');empty.className='schedule-note';empty.setAttribute('role','status');empty.textContent=matches.length?'Alle Spiele dieser Liga sind abgeschlossen.':'Für diese Liga gibt es noch keine Spiele.';section.append(empty);return;}
 const names=new Map(league.players.map(p=>[p.id,p.name]));
 for(const round of [...new Set(matches.map(m=>m.round))]){
  const allRoundMatches=matches.filter(m=>m.round===round),roundMatches=openOnly?allRoundMatches.filter(isOpen):allRoundMatches,details=document.createElement('details'),summary=document.createElement('summary'),key=`${league.id}-${round}`;
  if(openOnly&&!roundMatches.length)continue;
  details.className='match-round';details.open=openOnly||openRounds.has(key)||round===1;
  details.ontoggle=()=>{if(details.open)openRounds.add(key);else openRounds.delete(key);};
  summary.textContent=openOnly?`Spieltag ${round} · ${roundMatches.length} offene Spiele`:`Spieltag ${round} · ${roundMatches.filter(m=>m.homeScore!==null).length} / ${roundMatches.length} abgeschlossen`;
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
  if(!openOnly&&league.players.length%2===1){const active=new Set(roundMatches.flatMap(m=>[m.home,m.away])),idle=league.players.find(p=>!active.has(p.id));if(idle){const free=document.createElement('p');free.className='schedule-note';free.textContent=`Spielfrei: ${idle.name}`;details.append(free);}}
  section.append(details);
 }
}
function render(){
 $('league-tables').replaceChildren();tabs.replaceChildren();
 for(const league of state.leagues){
  const section=document.createElement('section');section.className='panel league-table';section.dataset.leaguePanel=league.id;section.id='league-panel-'+league.id;section.setAttribute('role','tabpanel');section.setAttribute('aria-labelledby','league-tab-'+league.id);
 const tab=document.createElement('button');tab.type='button';tab.textContent=league.name;tab.id='league-tab-'+league.id;tab.dataset.league=league.id;tab.setAttribute('role','tab');tab.setAttribute('aria-controls',section.id);tab.onclick=()=>selectLeague(league.id);tabs.append(tab);
  const heading=document.createElement('h2');heading.textContent=league.name;
  const count=document.createElement('small');count.textContent=`${league.players.length} Teilnehmer`;heading.append(count);section.append(heading);if(currentRole==='admin')section.append(adminJpgMenu(league));
  const rules=document.createElement('p');rules.className='schedule-note';const settings=leagueRules(league,state.leagues.length);rules.textContent=`Finals: ${settings.finals} Plätze · Aufstieg: ${settings.up} Plätze · Abstieg: ${settings.down} Plätze`;section.append(rules);
  const standings=document.createElement('details');standings.className='league-standings';standings.open=tableOpen.get(league.id)??true;const standingsTitle=document.createElement('summary');standingsTitle.textContent='Platzierungen · '+league.name;standings.append(standingsTitle);standings.ontoggle=()=>tableOpen.set(league.id,standings.open);section.append(standings);
  if(!league.players.length){const empty=document.createElement('p');empty.className='league-empty';empty.textContent=isAdmin?'Noch keine Teilnehmer. Füge oben den ersten Spieler hinzu.':'Noch keine Teilnehmer für diese Liga eingetragen.';section.append(empty);}
  else{
   const scroll=document.createElement('div');scroll.className='table';const table=document.createElement('table'),thead=document.createElement('thead'),tr=document.createElement('tr');
   ['Platz','Spieler','Spiele','Punkte','Matchverhältnis',...(isAdmin?['Verwalten']:[])].forEach(value=>{const th=document.createElement('th');th.textContent=value;tr.append(th);});thead.append(tr);table.append(thead);
   const body=document.createElement('tbody');
   leagueStandings(league).forEach((p,index)=>{const row=document.createElement('tr');[index+1,p.name,p.games,p.points,`${p.won}:${p.lost}`].forEach(value=>{const td=document.createElement('td');td.textContent=value;row.append(td);});
    const zones=leagueZones(league.id,index+1,league.players.length,leagueRules(league,state.leagues.length)),place=row.firstElementChild;
    if(zones.length){const badge=document.createElement('span');badge.className='rank-badge '+zones.map(zone=>zone==='Finalsplatz'?'rank-finals':zone==='Aufstiegsplatz'?'rank-up':'rank-down').join(' ');badge.textContent=index+1;badge.title=zones.join(' · ');badge.setAttribute('aria-label',`Platz ${index+1}: ${zones.join(', ')}`);place.replaceChildren(badge);}
    const td=document.createElement('td'),button=document.createElement('button');button.type='button';button.className='remove-player';button.textContent='Entfernen';button.setAttribute('aria-label',`${p.name} aus ${league.name} entfernen`);
    button.onclick=()=>{if(!busy&&confirm(`${p.name} aus ${league.name} entfernen? Alle Begegnungen und Ergebnisse dieses Spielers werden dabei gelöscht und die Tabelle neu berechnet.`))mutate({action:'remove',leagueId:league.id,playerId:p.id});};td.append(button);if(isAdmin)row.append(td);body.append(row);
   });table.append(body);scroll.append(table);standings.append(scroll);
   const legend=document.createElement('p');legend.className='rank-legend';
   for(const [label,color] of [['Finalsplatz','finals'],['Aufstiegsplatz','up'],['Abstiegsplatz','down']]){const item=document.createElement('span'),dot=document.createElement('i');dot.className='rank-dot rank-dot-'+color;dot.setAttribute('aria-hidden','true');item.append(dot,document.createTextNode(label));legend.append(item);}standings.append(legend);
  }
  renderSchedule(league,section);$('league-tables').append(section);
 }
 selectLeague(state.leagues.some(l=>l.id===selectedLeague)?selectedLeague:state.leagues[0]?.id);
}
async function load(){
 if(busy)return;toggleBusy(true);
 try{const response=await fetch(tournamentUrl('/api/leagues'));const result=await response.json();if(!response.ok)throw Error(result.error||'Laden fehlgeschlagen');state=result.state;isAdmin=result.role==='admin'&&!result.tournament?.archived;currentRole=result.role;canEnterResults=['admin','player','vice'].includes(currentRole)&&!result.tournament?.archived;
  document.getElementById('participant-form').hidden=!isAdmin;document.getElementById('admin-management').hidden=!isAdmin;const selected=$('league').value;$('league').replaceChildren(...state.leagues.map(l=>new Option(l.name,String(l.id))));if(state.leagues.some(l=>String(l.id)===selected))$('league').value=selected;
  $('clan-player').replaceChildren(new Option('Spieler manuell eingeben',''),...result.members.sort((a,b)=>a.name.localeCompare(b.name,'de')).map(p=>new Option(`${p.name} (${p.tag})`,JSON.stringify(p))));
  render();$('league-status').textContent='';
 }catch(e){$('league-status').textContent=`Teilnehmer konnten nicht geladen werden. ${e.message}`;}finally{toggleBusy(false);}
}
async function mutate(input){
 if(busy||!state||!canEnterResults)return;toggleBusy(true);$('league-status').textContent='Wird gespeichert …';
 try{const response=await fetch(tournamentUrl('/api/leagues'),{method:'POST',headers:{'Content-Type':'application/json','X-War-Imperium':'local'},body:JSON.stringify({...input,revision:state.revision})});const result=await response.json();if(!response.ok)throw Error(result.error||'Speichern fehlgeschlagen');state=result.state;isAdmin=result.role==='admin'&&!result.tournament?.archived;currentRole=result.role;canEnterResults=['admin','player','vice'].includes(currentRole)&&!result.tournament?.archived;
  document.getElementById('participant-form').hidden=!isAdmin;document.getElementById('admin-management').hidden=!isAdmin;const selected=$('league').value;$('league').replaceChildren(...state.leagues.map(l=>new Option(l.name,String(l.id))));if(state.leagues.some(l=>String(l.id)===selected))$('league').value=selected;render();
  if(input.action==='add'){$('player-name').value='';$('player-tag').value='';$('clan-player').value='';}
  const messages={add:'Teilnehmer hinzugefügt, Spielplan aktualisiert und gespeichert.',remove:'Teilnehmer entfernt, Tabelle und Spielplan aktualisiert.',result:'Ergebnis gespeichert. Tabelle aktualisiert.',clearResult:'Ergebnis zurückgesetzt. Tabelle aktualisiert.'};
  $('league-status').textContent=messages[input.action];return true;
 }catch(e){$('league-status').textContent=e.message;return false;}finally{toggleBusy(false);}
}
$('participant-form').onsubmit=event=>{event.preventDefault();mutate({action:'add',leagueId:Number($('league').value),name:$('player-name').value,tag:$('player-tag').value});};
$('clan-player').onchange=()=>{if($('clan-player').value){const p=JSON.parse($('clan-player').value);$('player-name').value=p.name;$('player-tag').value=p.tag;}};
document.addEventListener('wi-auth-change',load);load();
