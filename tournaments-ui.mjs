import {defaultConfig} from './tournament-config.mjs';
const root=document.getElementById('tournament-list'),management=document.getElementById('tournament-management'),status=document.getElementById('tournament-status');let state,busy=false;
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
function render(){root.replaceChildren();management.replaceChildren();management.hidden=state.role!=='admin';
 if(state.role==='admin'){const details=el('details');details.className='panel tournament-admin';details.append(el('summary','Turniere verwalten'));const form=el('form');form.className='tournament-name-form';const input=nameField(form);input.placeholder='Name des neuen Turniers';const config=settingsForm(form),submit=el('button','Neues Turnier anlegen');submit.type='submit';form.append(submit);form.onsubmit=e=>{e.preventDefault();mutate({action:'create',name:input.value,config:config()});};details.append(form);management.append(details);}
 for(const archived of [false,true]){const list=state.tournaments.filter(t=>t.archived===archived);if(!list.length)continue;const section=el('section');section.className='tournament-group';section.append(el('h2',archived?'Archivierte Turniere':'Aktuelle Turniere'));const grid=el('div');grid.className='tournament-grid';
  for(const t of list){const card=el('article');card.className='panel tournament-card';const config=t.config??defaultConfig(),badge=el('p',archived?'ARCHIV':'LIGA & FINALS');badge.className='eyebrow';card.append(badge,el('h3',t.name),el('p',`${config.leagues.length} Ligen · Jeder gegen jeden · War Imperium Finals`));
   const open=el('a',archived?'Turnier ansehen →':'Turnier öffnen →');open.className='finals-link';open.href='/liga?tournament='+encodeURIComponent(t.id);card.append(open);
   if(state.role==='admin'){const details=el('details');details.className='tournament-edit';details.append(el('summary','Verwalten'));const form=el('form');form.className='tournament-name-form';const input=nameField(form,t.name),save=el('button','Name speichern');save.type='submit';form.append(save);form.onsubmit=e=>{e.preventDefault();mutate({action:'rename',id:t.id,name:input.value});};
    const rules=el('ul');rules.className='tournament-rules-summary';for(const league of config.leagues)rules.append(el('li',`Liga ${league.id}: ${league.up} Aufstieg · ${league.down} Abstieg · ${league.finals} Finals`));
    const archive=el('button',archived?'Wieder aktivieren':'Turnier archivieren');archive.type='button';archive.onclick=()=>mutate({action:'archive',id:t.id,archived:!archived});details.append(form,rules,archive,el('p',archived?'Aktivieren ermöglicht wieder Änderungen.':'Archivieren bewahrt alle Ergebnisse und sperrt die Ergebniseingabe.'));if(!archived)deleteForm(t,details);card.append(details);
   }grid.append(card);
  }section.append(grid);root.append(section);
 }
 if(!state.tournaments.length)root.append(el('p','Noch keine Turniere vorhanden.'));
}
document.addEventListener('wi-auth-change',()=>load());window.addEventListener('pageshow',e=>{if(e.persisted)load();});await load();
