const $=id=>document.getElementById(id),clan=$('stats-clan'),player=$('stats-player'),status=$('stats-status'),result=$('stats-result');
let requestId=0,controller;
const number=n=>Number.isFinite(n)?n.toLocaleString('de-DE',{maximumFractionDigits:1}):'Nicht verfügbar';
const el=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
function section(title,cls=''){const s=el('section',undefined,'pass-panel '+cls);s.append(el('h2',title));return s;}
function fact(host,label,value){const row=el('div',undefined,'pass-fact');row.append(el('span',label),el('strong',value));host.append(row);}
function render(d){
 result.replaceChildren();result.className='imperium-pass';
 const hero=el('section',undefined,'pass-hero'),crest=el('img');crest.src='/crest.svg';crest.alt='War Imperium Wappen';
 hero.append(el('p','Imperium Spielerpass','pass-ribbon'),crest,el('h2',d.name),el('p',d.tag+' · '+(d.clan?.name??'Kein Clan'),'pass-identity'));
 const a=d.accountAge,age=a?[[a.years,'Jahr','Jahre'],[a.weeks,'Woche','Wochen'],[a.days,'Tag','Tage']].map(([n,s,p])=>n+' '+(n===1?s:p)).join(' · '):'Nicht verfügbar';
 const ageBox=el('div',undefined,'pass-age');ageBox.append(el('span','Account-Alter'),el('strong',age));hero.append(ageBox);result.append(hero);
 const kpis=el('div',undefined,'pass-kpis');
 const ranked=d.rankedBest??{name:'Nicht verfügbar',rank:null};const best=ranked.rank?'Platz '+number(ranked.rank):ranked.name;
 for(const [icon,title,value] of [['🏆','Pokale',number(d.metrics.trophies)],['♛','Ranked-Bestwert',best],['▣','Level-16-Karten',d.cards.count16===null?'Nicht verfügbar':number(d.cards.count16)+' / '+number(d.cards.total)]]){const box=el('article',undefined,'pass-kpi');box.append(el('span',icon,'pass-kpi-icon'),el('h3',title),el('strong',value));if(title==='Ranked-Bestwert'&&ranked.rank)box.append(el('small',ranked.name));kpis.append(box);}result.append(kpis);
 const middle=el('div',undefined,'pass-middle'),deck=section('Aktuelles Deck','pass-deck');
 if(d.currentDeck.length){const grid=el('ul',undefined,'pass-deck-grid');for(const c of d.currentDeck){const li=el('li');if(c.image){const img=el('img');img.src=c.image;img.alt=c.name;img.loading='lazy';li.append(img);}else li.append(el('span',c.name,'pass-card-fallback'));li.append(el('strong',c.level===null?'Level —':'Level '+c.level));li.title=c.name;grid.append(li);}deck.append(grid);if(d.lastBattle){let date=d.lastBattle.time;const m=/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/.exec(date);if(m){const parsed=new Date(m[1]+'-'+m[2]+'-'+m[3]+'T'+m[4]+':'+m[5]+':'+m[6]+'Z');date=parsed.toLocaleString('de-DE');}deck.append(el('p','Zuletzt gespielt · '+d.lastBattle.mode+' · '+date,'pass-note'));}}
 else deck.append(el('p','Das zuletzt gespielte Deck ist im Kampfprotokoll nicht verfügbar.'));
 const collection=section('Kartensammlung','pass-collection'),ring=el('div',undefined,'pass-ring');
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 120 120');svg.setAttribute('aria-hidden','true');for(const [cls,dash] of [['ring-track',null],['ring-fill',d.cards.percent16===null?'0 100':d.cards.percent16+' 100']]){const c=document.createElementNS(svg.namespaceURI,'circle');for(const [k,v] of Object.entries({cx:60,cy:60,r:50,pathLength:100,class:cls}))c.setAttribute(k,v);if(dash)c.setAttribute('stroke-dasharray',dash);svg.append(c);}const percent=el('div');percent.append(el('strong',d.cards.percent16===null?'—':number(d.cards.percent16)+' %'),el('span','Level 16'));ring.append(svg,percent);collection.append(ring);
 const legend=el('div',undefined,'pass-levels');for(const [level,count] of Object.entries(d.cards.distribution).sort((a,b)=>Number(b[0])-Number(a[0])))fact(legend,level==='unknown'?'Level unbekannt':'Level '+level,number(count));fact(legend,'Gesammelt',number(d.cards.owned));if(d.cards.total!==null)fact(legend,'Karten insgesamt',number(d.cards.total));collection.append(legend);middle.append(deck,collection);result.append(middle);
 const bottom=el('div',undefined,'pass-bottom'),battles=section('⚔ Kämpfe'),donations=section('♟ Spenden'),war=section('♛ Clankrieg 2');
 fact(battles,'Siege',number(d.metrics.wins));fact(battles,'Niederlagen',number(d.metrics.losses));const decided=(d.metrics.wins??0)+(d.metrics.losses??0);fact(battles,'Siegesquote',Number.isFinite(d.metrics.wins)&&Number.isFinite(d.metrics.losses)&&decided?number(d.metrics.wins/decided*100)+' %':'Nicht verfügbar');
 fact(donations,'Gespendet insgesamt',number(d.metrics.totalDonations));fact(donations,'Aktuell erhalten',number(d.metrics.donationsReceived));fact(war,'Siege',number(d.clanWar2Wins));bottom.append(battles,donations,war);result.append(bottom);
}
async function get(path,id){const response=await fetch(path,{signal:controller.signal}),data=await response.json();if(id!==requestId)return null;if(!response.ok)throw Error(data.error||'API-Abruf fehlgeschlagen.');return data;}
async function loadMembers(){
 const id=++requestId;controller?.abort();controller=new AbortController();result.replaceChildren();player.replaceChildren(el('option','Mitglieder werden geladen …'));player.disabled=true;status.textContent='Aktuelle Clanmitglieder werden geladen …';
 try{const data=await get('/api/statistics-members?clan='+clan.value,id);if(!data)return;
  const placeholder=el('option',data.members.length?'Spieler auswählen':'Keine Mitglieder verfügbar');placeholder.value='';player.replaceChildren(placeholder,...data.members.map(m=>{const option=el('option',`${m.name} (${m.tag})`);option.value=m.tag;return option;}));player.disabled=!data.members.length;status.textContent=`${data.members.length} Mitglieder · Stand: ${new Date(data.updatedAt).toLocaleString('de-DE')} · Abrufe werden bis zu 5 Minuten zwischengespeichert.`;
 }catch(e){if(id!==requestId||e.name==='AbortError')return;player.replaceChildren(el('option','Nicht verfügbar'));status.textContent=e.message;}
}
async function loadPlayer(){
 const selected=player.value,id=++requestId;controller?.abort();controller=new AbortController();result.replaceChildren();if(!selected){status.textContent='Bitte einen Spieler auswählen.';return;}status.textContent='Spielerstatistiken werden geladen …';
 try{const data=await get('/api/statistics-player?clan='+clan.value+'&player='+encodeURIComponent(selected),id);if(!data)return;render(data);status.textContent='Statistik geladen · Stand: '+new Date(data.updatedAt).toLocaleString('de-DE');}catch(e){if(id!==requestId||e.name==='AbortError')return;status.textContent=e.message;}
}
clan.onchange=loadMembers;player.onchange=loadPlayer;$('stats-refresh').onclick=()=>player.value?loadPlayer():loadMembers();
await loadMembers();
