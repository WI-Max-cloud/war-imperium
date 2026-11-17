const toggle=document.querySelector('.nav-toggle'),nav=document.getElementById('main-nav');toggle.onclick=()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));nav.classList.toggle('open',open);};nav.querySelectorAll('a').forEach(link=>link.onclick=()=>{nav.classList.remove('open');toggle.setAttribute('aria-expanded','false');});
if(document.querySelector('[data-clan-members]'))try{const response=await fetch('/api/public-clan');if(!response.ok)throw Error();const clan=await response.json();document.querySelectorAll('[data-clan-trophies]').forEach(el=>el.textContent=clan.warTrophies===null?'—':clan.warTrophies.toLocaleString('de-DE'));document.querySelectorAll('[data-clan-members]').forEach(el=>el.textContent=`${clan.members??'—'} / 50`);document.getElementById('stats-date').textContent=clan.updatedAt?`Gespeicherter Stand: ${new Date(clan.updatedAt).toLocaleString('de-DE')}`:'Clandaten werden beim nächsten Admin-Abruf aktualisiert.';}catch{document.getElementById('stats-date').textContent='Clandaten momentan nicht verfügbar.';}

if(document.querySelector('[data-family-tag]')){
 try{const response=await fetch('/api/family-stats');if(!response.ok)throw Error();const data=await response.json();
  document.querySelectorAll('[data-family-tag]').forEach(card=>{const clan=data.clans.find(c=>c.tag===card.dataset.familyTag),status=card.querySelector('.family-stats-date');
   card.querySelector('[data-family-trophies]').textContent=Number.isFinite(clan?.warTrophies)?clan.warTrophies.toLocaleString('de-DE'):'—';
   card.querySelector('[data-family-members]').textContent=(clan?.members??'—')+' / 50';
   status.textContent=clan?.updatedAt?(clan.error?'Letzter verfügbarer Stand: ':'Stand: ')+new Date(clan.updatedAt).toLocaleString('de-DE'):data.configured?'Clandaten momentan nicht verfügbar.':'Clandaten sind noch nicht eingerichtet.';
  });
 }catch{document.querySelectorAll('.family-stats-date').forEach(el=>el.textContent='Clandaten momentan nicht verfügbar.');}
}
