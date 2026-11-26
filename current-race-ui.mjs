export function mountCurrentRace(tag){
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
