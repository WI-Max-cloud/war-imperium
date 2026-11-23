const $=id=>document.getElementById(id),clan=$('stats-clan'),player=$('stats-player'),status=$('stats-status'),result=$('stats-result');
let requestId=0,controller;
const number=n=>Number.isFinite(n)?n.toLocaleString('de-DE',{maximumFractionDigits:1}):'Nicht verfügbar';
const el=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
const labels={collectionLevel:'Sammlungslevel',kingTowerLevel:'Königsturm-Level',currentWinLoseStreak:'Aktuelle Sieg-/Niederlagenserie',starPoints:'Sternpunkte',legacyTrophyRoadHighScore:'Frühere Trophäenstraße · Bestwert',trophies:'Aktuelle Pokale',bestTrophies:'Pokale · Bestwert',expLevel:'Erfahrungslevel',wins:'Siege',losses:'Niederlagen',battleCount:'Gespielte Kämpfe',threeCrownWins:'Drei-Kronen-Siege',challengeMaxWins:'Herausforderung · Beste Siege',challengeCardsWon:'Herausforderung · Gewonnene Karten',tournamentCardsWon:'Turnier · Gewonnene Karten',tournamentBattleCount:'Turnierkämpfe',totalDonations:'Spenden insgesamt',donations:'Aktuelle Spenden',donationsReceived:'Spenden erhalten',warDayWins:'Kriegstag-Siege (API)',clanCardsCollected:'Gesammelte Clankarten (API)',arena:'Arena',leagueStatistics:'Liga-Statistiken',currentSeason:'Aktuelle Saison',previousSeason:'Vorherige Saison',bestSeason:'Beste Saison',currentPathOfLegendSeasonResult:'Pfad der Legenden · Aktuelle Saison',lastPathOfLegendSeasonResult:'Pfad der Legenden · Letzte Saison',bestPathOfLegendSeasonResult:'Pfad der Legenden · Bestwert',leagueNumber:'Liga',rank:'Rang',bestRank:'Bester Rang',bestTrophies:'Pokale · Bestwert',name:'Name',id:'ID',seasonId:'Saison',progress:'Fortschritt',target:'Ziel',value:'Wert',level:'Level',stars:'Sterne'};
function section(title){const s=el('section',undefined,'panel stats-section');s.append(el('h2',title));result.append(s);return s;}
function facts(host,entries){const dl=el('dl',undefined,'stats-facts');for(const [label,value] of entries){const box=el('div');box.append(el('dt',label),el('dd',value));dl.append(box);}host.append(dl);}
function cards(host,items){
 if(!items.length){host.append(el('p','Nicht über die API verfügbar.'));return;}
 const list=el('ul',undefined,'stats-card-list');for(const c of items){const li=el('li');li.append(el('strong',c.name),el('span',c.level===null?'Level nicht verfügbar':'Level '+c.level));if(Number.isFinite(c.elixirCost))li.append(el('small',c.elixirCost+' Elixier'));list.append(li);}host.append(list);
}
function render(d){
 result.replaceChildren();
 const profile=section(d.name);profile.append(el('p',`${d.tag} · ${d.clan?.name??'Kein Clan'} ${d.clan?.tag??''}`));
 const age=d.accountAge;
 const ageText=age?[[age.years,'Jahr','Jahre'],[age.weeks,'Woche','Wochen'],[age.days,'Tag','Tage']].map(([value,singular,plural])=>`${value} ${value===1?singular:plural}`).join(', '):'Nicht über die API verfügbar';
 const createdOn=age?.estimatedCreatedOn?age.estimatedCreatedOn.split('-').reverse().join('.'):null;
 facts(profile,[['Account-Gründungsdatum',createdOn?`ca. ${createdOn} (berechnet)`:'Nicht über die API verfügbar'],['Account-Alter',ageText],['Rolle im Clan',({member:'Mitglied',elder:'Ältester',coLeader:'Vize-Anführer',leader:'Anführer'})[d.role]??d.role??'Nicht verfügbar'],['Datenstand',new Date(d.updatedAt).toLocaleString('de-DE')]]);
 if(age)profile.append(el('p',`${number(age.totalDays)} Tage laut Alters-Abzeichen · Jahre mit 365 Tagen, Rest in Wochen und Tagen. Das Gründungsdatum ist zurückgerechnet; einen exakten Erstellungszeitpunkt liefert die API nicht.`));
 const collection=section('Kartenstatistiken');facts(collection,[['Karten auf Level 16',d.cards.count16===null?`${number(d.cards.knownCount16)} sicher bekannt`:number(d.cards.count16)],['Anteil aller Karten auf Level 16',d.cards.percent16===null?'Nicht verfügbar':number(d.cards.percent16)+' %'],['Freigeschaltete Karten',number(d.cards.owned)],['Karten im API-Katalog',number(d.cards.total)]]);
 collection.append(el('p','Der Anteil bezieht sich auf alle Karten im aktuellen Kartenkatalog, einschließlich noch nicht freigeschalteter Karten. Turmtruppen werden separat aufgeführt.'));
 if(d.cards.unknown)collection.append(el('p',`${d.cards.unknown} Karten ohne auswertbares Level. Eine vollständige Level-16-Quote ist deshalb nicht verfügbar.`));
 const bars=el('div',undefined,'stats-levels');for(const [level,count] of Object.entries(d.cards.distribution).sort((a,b)=>Number(b[0])-Number(a[0]))){const row=el('div'),progress=el('progress');progress.max=d.cards.owned||1;progress.value=count;progress.setAttribute('aria-label',`${level==='unknown'?'Unbekannt':'Level '+level}: ${count} Karten`);row.append(el('span',level==='unknown'?'Unbekannt':'Level '+level),progress,el('strong',number(count)));bars.append(row);}collection.append(bars);
 const full=el('details'),summary=el('summary','Alle freigeschalteten Karten anzeigen');full.append(summary);cards(full,[...d.cards.items].sort((a,b)=>(b.level??0)-(a.level??0)||a.name.localeCompare(b.name,'de')));collection.append(full);
 const stats=section('Pokale & Spielstatistiken');facts(stats,Object.entries(d.metrics).map(([key,value])=>[labels[key]??key,number(value)]));
 if(!Object.keys(d.metrics).length)stats.append(el('p','Nicht über die API verfügbar.'));
 const modes=section('Spielmodi & Bestwerte');
 for(const [key,value] of Object.entries(d.progress)){
  modes.append(el('h3',labels[key]??key));const entries=[];
  function flatten(obj,prefix='',depth=0){if(depth>4||entries.length>=100)return;for(const [k,v] of Object.entries(obj)){if(/icon|url/i.test(k)||v===null||v===undefined)continue;const name=(prefix?prefix+' · ':'')+(labels[k]??k);if(typeof v==='object')flatten(v,name,depth+1);else if(typeof v==='number'||typeof v==='string'&&!v.startsWith('http'))entries.push([name,typeof v==='number'?number(v):v]);}}
  flatten(value);facts(modes,entries);
 }
 if(!Object.keys(d.progress).length)modes.append(el('p','Weitere Spielmodi und Ranglistenwerte sind für diesen Spieler nicht über die API verfügbar.'));
 modes.append(el('p','Angezeigt werden die vom Spielerprofil gelieferten Werte. Nicht jeder Modus liefert eine Platzierung oder einen Pokalstand.'));
 const deck=section('Aktuelles Deck');cards(deck,d.currentDeck);if(d.currentSupportCards.length){deck.append(el('h3','Turmtruppe im Deck'));cards(deck,d.currentSupportCards);}deck.append(el('p','Die API liefert das aktuell ausgewählte Deck, keine vollständige Liste aller gespeicherten Decks.'));
 if(d.supportCards.length){const support=section('Turmtruppen');cards(support,d.supportCards);}
 if(d.favoriteCard){const favorite=section('Lieblingskarte');cards(favorite,[d.favoriteCard]);}
 if(d.badges.length||d.achievements.length){const honors=section('Abzeichen & Erfolge');for(const [heading,items] of [['Abzeichen',d.badges],['Erfolge',d.achievements]]){if(!items.length)continue;const details=el('details');details.append(el('summary',heading+' ('+items.length+')'));const list=el('ul');for(const item of items){const li=el('li');li.append(el('strong',item.name),el('span',' · '+Object.entries(item).filter(([k,v])=>k!=='name'&&Number.isFinite(v)).map(([k,v])=>(labels[k]??k)+': '+number(v)).join(' · ')));list.append(li);}details.append(list);honors.append(details);}}
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
