import {resolveFinals,finalsDefinitions} from './finals-core.mjs';
const $=id=>document.getElementById(id);let data=null,busy=false;
const sourceLabel=source=>source.includes('-')?`Liga ${source[1]} · Platz ${source.split('-')[1]}`:`${source[0]==='W'?'Sieger':'Verlierer'} Spiel ${source.slice(1)}`;
function node(tag,className,text){const element=document.createElement(tag);if(className)element.className=className;if(text!==undefined)element.textContent=text;return element;}
function setBusy(value){busy=value;document.querySelectorAll('button,.finals-score').forEach(b=>b.disabled=value);$('start-finals').disabled=value||data?.role!=='admin'||!!data?.state||!data?.preview?.ready;}
async function load(){
 if(busy)return;setBusy(true);$('finals-status').textContent='Finals werden geladen …';
 try{const response=await fetch('/api/finals');const result=await response.json();if(!response.ok)throw Error(result.error||'Laden fehlgeschlagen');data=result;render();$('finals-status').textContent='Stand geladen. Ergebnisse werden dauerhaft gespeichert.';}
 catch(e){$('finals-status').textContent=e.message;}finally{setBusy(false);}
}
async function mutate(input){
 if(busy)return false;setBusy(true);$('finals-status').textContent='Wird gespeichert …';
 try{
  const payload={...input,revision:data.state?.revision??0};
  const send=()=>fetch('/api/finals',{method:'POST',headers:{'Content-Type':'application/json','X-War-Imperium':'local'},body:JSON.stringify(payload)});
  let response=await send(),result=await response.json();
  if(response.status===409&&result.error?.includes('Folgeergebnisse')){
   if(!confirm(result.error+' Fortfahren?')){$('finals-status').textContent='Änderung abgebrochen.';return false;}
   payload.confirmDownstream=true;response=await send();result=await response.json();
  }
  if(!response.ok)throw Error(result.error||'Speichern fehlgeschlagen');data={...data,...result};render();$('finals-status').textContent='Gespeichert. Turnierbaum aktualisiert.';return true;
 }catch(e){$('finals-status').textContent=e.message;return false;}finally{setBusy(false);}
}
function matchCard(match){
 const card=node('article','finals-match'+(!match.active?' inactive':''));card.append(node('h4','',`Spiel ${match.id} · ${match.title}`));
 for(const side of ['home','away']){
  const player=match[side],row=node('div','finals-player'+(player&&match.winner?.id===player.id?' match-winner':''));
  const label=node('div');label.append(node('strong','',player?.name??sourceLabel(match[side+'Source'])),node('small','',sourceLabel(match[side+'Source'])));
  row.append(label,node('span','match-number',match[side+'Score']??'–'));card.append(row);
 }
 if(!match.active){card.append(node('p','schedule-note','Nur nötig, wenn der Lower-Bracket-Sieger Spiel 8 gewinnt.'));return card;}
 if(!match.ready){card.append(node('p','schedule-note','Wartet auf vorherige Ergebnisse.'));return card;}
 const form=node('form','finals-result'),left=node('label','',match.home.name),right=node('label','',match.away.name);
 const score=side=>{const input=node('input','finals-score');input.type='number';input.min='0';input.max='99';input.step='1';input.inputMode='numeric';input.required=true;input.value=match[side+'Score']??'';input.setAttribute('aria-label',`Spiel ${match.id}: gewonnene Matches von ${match[side].name}`);return input;};
 const home=score('home'),away=score('away');left.append(home);right.append(away);form.append(left,node('span','',':'),right);
 const actions=node('div','finals-result-actions'),save=node('button','',match.winner?'Ergebnis ändern':'Ergebnis speichern');save.type='submit';actions.append(save);
 if(match.winner&&data.role==='admin'){const reset=node('button','','Zurücksetzen');reset.type='button';reset.onclick=()=>{if(confirm(`Ergebnis von Spiel ${match.id} zurücksetzen?`))mutate({action:'clearResult',matchId:match.id});};actions.append(reset);}
 const error=node('p','match-error');error.setAttribute('role','alert');form.append(actions,error);
 form.onsubmit=async event=>{event.preventDefault();if(home.value===''||away.value==='')return;const success=await mutate({action:'result',matchId:match.id,homeScore:Number(home.value),awayScore:Number(away.value)});if(!success)error.textContent=$('finals-status').textContent;};card.append(form);return card;
}
function render(){
 const state=data.state,view=resolveFinals(state);$('finals-slots').replaceChildren();
 $('seeds-title').textContent=state?'Festgelegte Finals-Teilnehmer':'Teilnehmer nach aktuellem Ligastand';
 $('seed-note').textContent=state?`Start: ${new Date(state.startedAt).toLocaleString('de-DE')}. Die Teilnehmer bleiben fest, auch wenn sich die Ligatabellen später ändern.`:'Vor dem Start die sechs Plätze prüfen. Bei vollständiger Gleichheit gilt die bisherige alphabetische Tabellenreihenfolge.';
 for(const seed of state?.seeds??data.preview.slots){const card=node('article','finals-slot');card.append(node('h3','',`Liga ${seed.leagueId} · Platz ${seed.rank}`),node('strong','',seed.player?.name??'Noch nicht besetzt'),node('p','',seed.leagueId===1?'Upper Bracket · 0 Niederlagen zum Start':'Lower Bracket · 1 Niederlage angerechnet'));$('finals-slots').append(card);}
 $('start-finals').hidden=!!state||data.role!=='admin';document.querySelectorAll('header a[href="/"]').forEach(a=>a.hidden=data.role==='player');$('finals-bracket').replaceChildren();
 const matches=state?view.matches:finalsDefinitions.map(m=>({...m,home:null,away:null,homeSource:m.home,awaySource:m.away,active:m.id!==9,ready:false,homeScore:null,awayScore:null}));
 for(const group of [
  {title:'Upper Bracket',stages:[['Halbfinale',[1,2]],['Upper Final',[6]]]},
  {title:'Lower Bracket',stages:[['Einstieg',[3,4]],['Lower Semis',[5]],['Lower Final',[7]]]},
  {title:'Grand Finals',stages:[['Finale',[8]],['Reset · falls nötig',[9]]]}
 ]){
  const section=node('section','panel finals-bracket-section');section.append(node('h2','',group.title));const columns=node('div','finals-stages');
  for(const [label,ids] of group.stages){const stage=node('div','finals-stage');stage.append(node('h3','',label));for(const id of ids)stage.append(matchCard(matches.find(m=>m.id===id)));columns.append(stage);}section.append(columns);$('finals-bracket').append(section);
 }
 $('champion').hidden=!view.champion;$('champion').replaceChildren();if(view.champion)$('champion').append(node('h2','','🏆 War Imperium Champion'),node('strong','',view.champion.name));
 $('finals-losses').hidden=!state;$('finals-losses').replaceChildren();if(state){$('finals-losses').append(node('h2','','Turnierstatus'));const list=node('ul');for(const p of view.players)list.append(node('li','',`${p.name} · ${p.losses} Niederlage${p.losses===1?'':'n'}${p.initialLosses?' (davon 1 zum Start angerechnet)':''} · ${view.champion?.id===p.id?'Champion':p.eliminated?'Ausgeschieden':'Im Turnier'}`));$('finals-losses').append(list);}
}
$('start-finals').onclick=()=>{
 if(!data?.preview.ready)return;
 const text=data.preview.unfinished?'Es sind noch Ligaspiele offen. Trotzdem die Finals mit den sechs aktuell angezeigten Teilnehmern starten?':'Die Finals mit den sechs angezeigten Teilnehmern starten?';
 if(confirm(text+' Die Teilnehmer werden festgehalten.'))mutate({action:'start',leagueRevision:data.preview.leagueRevision,allowUnfinished:data.preview.unfinished});
};
$('refresh-finals').onclick=load;load();
