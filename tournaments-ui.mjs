import {defaultConfig} from './tournament-config.mjs';
const root=document.getElementById('tournament-list'),management=document.getElementById('tournament-management'),status=document.getElementById('tournament-status');let state,busy=false,filter="all",visible=6;
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
async function load(){try{const r=await fetch('/api/tournaments');const d=await r.json();if(!r.ok)throw Error(d.error||'Laden fehlgeschlagen');state=d;render();}catch(e){status.textContent=e.message;}}
async function mutate(input){if(busy||state.role!=='admin')return;busy=true;status.textContent='Wird gespeichert …';try{const r=await fetch('/api/tournaments',{method:'POST',headers:{'Content-Type':'application/json','X-War-Imperium':'local'},body:JSON.stringify({...input,revision:state.revision})});const d=await r.json();if(!r.ok)throw Error(d.error||'Speichern fehlgeschlagen');state=d;render();status.textContent=input.action==='delete'?'Turnier und seine Daten wurden gelöscht.':'Gespeichert.';}catch(e){status.textContent=e.message;}finally{busy=false;}}
function nameField(form,name='',labelText='Turniername'){const label=el('label',labelText),input=el('input');input.required=true;input.maxLength=100;input.value=name;label.append(input);form.append(label);return input;}
function settingsForm(form){
 const label=el('label','Anzahl an Ligen'),count=el('input');count.type='number';count.min='1';count.max='12';count.value='3';count.required=true;label.append(count);form.append(label);
 const list=el('div');list.className='tournament-settings-grid';form.append(list);let saved=defaultConfig().leagues;
 function rows(){const old=[...list.children].map(row=>Object.fromEntries([...row.querySelectorAll('[data-rule]')].map(i=>[i.dataset.rule,Number(i.value)])));if(old.length)saved=old;list.replaceChildren();const total=Math.max(1,Math.min(12,Number(count.value)||1));
  for(let i=0;i<total;i++){const values=saved[i]??{up:i?3:0,down:i===total-1?0:3,finals:i?1:4},row=el('fieldset');row.append(el('legend','Liga '+(i+1)));
   for(const [key,title,max]of [['up','Aufstiegsplätze',100],['down','Abstiegsplätze',100],['finals','Finals-Plätze',32]]){const label=el('label',title),input=el('input');input.type='number';input.min=key==='finals'&&i===0?'1':'0';input.max=String(max);input.required=true;input.value=String(values[key]);input.dataset.rule=key;input.setAttribute('aria-label',`Liga ${i+1}: ${title}`);label.append(input);row.append(label);}list.append(row);
  }
 }
 count.oninput=()=>{const value=Number(count.value);if(Number.isInteger(value)&&value>=1&&value<=12)rows();};count.onchange=count.oninput;rows();form.append(el('p','1–12 Ligen. Insgesamt 2–32 Finals-Plätze. Liga 1 startet oben, alle anderen Qualifizierten unten. Die Einstellungen gelten für dieses neue Turnier.'));
 return ()=>({leagues:[...list.children].map((row,index)=>({id:index+1,...Object.fromEntries([...row.querySelectorAll('[data-rule]')].map(input=>[input.dataset.rule,Number(input.value)]))}))});
}
function deleteForm(t,details){
 const remove=el('details');remove.className='tournament-delete';remove.append(el('summary','Turnier löschen'));const form=el('form');form.className='tournament-name-form';form.append(el('p','Alle Teilnehmer, Spielpläne, Ergebnisse und Finals dieses Turniers werden endgültig gelöscht. Gib den exakten Turniernamen ein: '+t.name));
 const input=nameField(form,'','Turniername zur Bestätigung'),submit=el('button','Endgültig löschen');submit.type='submit';submit.disabled=true;input.oninput=()=>submit.disabled=input.value!==t.name;form.append(submit);form.onsubmit=e=>{e.preventDefault();if(input.value===t.name)mutate({action:'delete',id:t.id,confirmName:input.value});};remove.append(form);details.append(remove);
}
function render(){root.replaceChildren();management.replaceChildren();
 const select=document.getElementById('tournament-filter');select.value=filter;select.onchange=()=>{filter=select.value;visible=6;render();};
 const featured=document.getElementById('tournament-featured');featured.replaceChildren();const active=state.tournaments.find(t=>!t.archived);featured.hidden=!active;
 if(active){const head=el('div');head.className='news-featured-heading';head.append(el('strong','🏆 Aktuelles Turnier'));const title=el('h2',active.name),info=el('p',(active.config??defaultConfig()).leagues.length+' Ligen · Liga & Finals'),link=el('a','Turnier öffnen');link.className='game-button';link.href='/liga?tournament='+encodeURIComponent(active.id);featured.append(head,title,info,link);}
 const filtered=state.tournaments.filter(t=>filter==='all'||(filter==='archived'?t.archived:!t.archived));
 const more=document.getElementById('tournament-more');more.hidden=filtered.length<=visible;more.onclick=()=>{visible+=6;render();};document.getElementById('tournament-feed-status').textContent=filtered.length?Math.min(visible,filtered.length)+' von '+filtered.length+' Turnieren':'';
management.hidden=state.role!=='admin';
 if(state.role==='admin'){const details=el('details');details.className='panel tournament-admin';details.append(el('summary','Turniere verwalten'));const form=el('form');form.className='tournament-name-form';const input=nameField(form);input.placeholder='Name des neuen Turniers';const config=settingsForm(form),submit=el('button','Neues Turnier anlegen');submit.type='submit';form.append(submit);form.onsubmit=e=>{e.preventDefault();mutate({action:'create',name:input.value,config:config()});};details.append(form);management.append(details);}
 {const list=filtered.slice(0,visible);const section=el('div');section.className='tournament-feed-list';const grid=section;
  for(const t of list){const archived=t.archived,card=el('article');card.className='news-feed-card tournament-feed-card '+(archived?'is-archived':'is-active');const config=t.config??defaultConfig(),badge=el('p',archived?'ARCHIV':'LIGA & FINALS');badge.className='eyebrow';const meta=el('div');meta.className='news-card-meta';const date=el('span',t.createdAt?'Angelegt am '+new Date(t.createdAt).toLocaleDateString('de-DE',{timeZone:'Europe/Berlin'}):'War Imperium Liga');badge.className='news-category';meta.append(date,badge);const body=el('div');body.className='news-card-body';const art=el('div','🏆');art.className='news-card-art';art.setAttribute('aria-hidden','true');const copy=el('div');copy.className='news-card-copy';copy.append(el('h3',t.name),el('p',`${config.leagues.length} Ligen · Jeder gegen jeden · War Imperium Finals`));body.append(art,copy);card.append(meta,body);
   const open=el('a',archived?'Turnier ansehen':'Turnier öffnen');open.className='finals-link';open.href='/liga?tournament='+encodeURIComponent(t.id);copy.append(open);
   if(state.role==='admin'){const details=el('details');details.className='tournament-edit';details.append(el('summary','Verwalten'));const form=el('form');form.className='tournament-name-form';const input=nameField(form,t.name),save=el('button','Name speichern');save.type='submit';form.append(save);form.onsubmit=e=>{e.preventDefault();mutate({action:'rename',id:t.id,name:input.value});};
    const rules=el('ul');rules.className='tournament-rules-summary';for(const league of config.leagues)rules.append(el('li',`Liga ${league.id}: ${league.up} Aufstieg · ${league.down} Abstieg · ${league.finals} Finals`));
    const archive=el('button',archived?'Wieder aktivieren':'Turnier archivieren');archive.type='button';archive.onclick=()=>mutate({action:'archive',id:t.id,archived:!archived});details.append(form,rules,archive,el('p',archived?'Aktivieren ermöglicht wieder Änderungen.':'Archivieren bewahrt alle Ergebnisse und sperrt die Ergebniseingabe.'));if(!archived)deleteForm(t,details);card.append(details);
   }grid.append(card);
  }root.append(section);
 }
 if(!filtered.length)root.append(el('p',state.tournaments.length?'Keine Turniere in dieser Auswahl.':'Noch keine Turniere vorhanden.'));
}
document.addEventListener('wi-auth-change',()=>load());window.addEventListener('pageshow',e=>{if(e.persisted)load();});await load();
