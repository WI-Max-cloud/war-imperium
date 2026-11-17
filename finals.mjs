import {resolveFinals,finalsDefinitions} from './finals-core.mjs';
const $=id=>document.getElementById(id);let data=null,busy=false;
const sourceLabel=source=>source.includes('-')?`Liga ${source[1]} · Platz ${source.split('-')[1]}`:`${source[0]==='W'?'Sieger':'Verlierer'} Spiel ${source.slice(1)}`;
function node(tag,className,text){const element=document.createElement(tag);if(className)element.className=className;if(text!==undefined)element.textContent=text;return element;}
function setBusy(value){busy=value;document.querySelectorAll('#finals-bracket button,#finals-bracket .finals-score,#refresh-finals').forEach(b=>b.disabled=value);$('start-finals').disabled=value||data?.role!=='admin'||!!data?.state||!data?.preview?.ready;}
async function load(){
 if(busy)return;setBusy(true);$('finals-status').textContent='Finals werden geladen …';
 try{const response=await fetch('/api/finals');const result=await response.json();if(!response.ok)throw Error(result.error||'Laden fehlgeschlagen');data=result;render();$('finals-status').textContent='Stand geladen. Ergebnisse werden dauerhaft gespeichert.';}
 catch(e){$('finals-status').textContent=e.message;}finally{setBusy(false);}
}
async function mutate(input){
 if(busy||!['admin','player','vice'].includes(data?.role))return false;setBusy(true);$('finals-status').textContent='Wird gespeichert …';
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
 if(!['admin','player','vice'].includes(data.role)){card.append(node('p','read-only-note','Zum Eintragen eines Ergebnisses oben anmelden.'));return card;}
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
 $('start-finals').hidden=!!state||data.role!=='admin';$('finals-bracket').replaceChildren();
 const matches=state?view.matches:finalsDefinitions.map(m=>({...m,home:null,away:null,homeSource:m.home,awaySource:m.away,active:m.id!==9,ready:false,homeScore:null,awayScore:null}));
 const graphSection=node('section','panel finals-graph-section');graphSection.append(node('h2','','War Imperium Finals · Turnierbaum'));
 const legend=node('p','bracket-legend');legend.textContent='Blaue Linie: Sieger weiter · Rote gestrichelte Linie: Verlierer ins Lower Bracket · Spiel 9 nur bei erforderlichem Reset';graphSection.append(legend);
 const graph=node('div','finals-graph');graph.setAttribute('aria-label','Double-Elimination-Turnierbaum');
 for(const id of [1,2,6,3,4,5,7,8,9]){const card=matchCard(matches.find(m=>m.id===id));card.dataset.match=id;graph.append(card);}
 graphSection.append(graph);$('finals-bracket').append(graphSection);observeGraph(graph);
 $('champion').hidden=!view.champion;$('champion').replaceChildren();if(view.champion)$('champion').append(node('h2','','🏆 War Imperium Champion'),node('strong','',view.champion.name));
 $('finals-losses').hidden=!state;$('finals-losses').replaceChildren();if(state){$('finals-losses').append(node('h2','','Turnierstatus'));const list=node('ul');for(const p of view.players)list.append(node('li','',`${p.name} · ${p.losses} Niederlage${p.losses===1?'':'n'}${p.initialLosses?' (davon 1 zum Start angerechnet)':''} · ${view.champion?.id===p.id?'Champion':p.eliminated?'Ausgeschieden':'Im Turnier'}`));$('finals-losses').append(list);}
}

let graphObserver;
function observeGraph(graph){
 graphObserver?.disconnect();const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('bracket-lines');svg.setAttribute('aria-hidden','true');graph.prepend(svg);
 const draw=()=>{if(!graph.isConnected)return;svg.replaceChildren();const bounds=graph.getBoundingClientRect(),mobile=matchMedia('(max-width:700px)').matches;
  const edges=[[1,6,false],[2,6,false],[1,3,true],[2,4,true],[3,5,false],[4,5,false],[5,7,false],[6,7,true],[6,8,false],[7,8,false],[8,9,false]];
  edges.forEach(([from,to,drop],index)=>{const a=graph.querySelector('[data-match="'+from+'"]').getBoundingClientRect(),b=graph.querySelector('[data-match="'+to+'"]').getBoundingClientRect();let d;
   if(mobile){const x=a.left-bounds.left+a.width*.5,y=a.bottom-bounds.top,tx=b.left-bounds.left+b.width*.5,ty=b.top-bounds.top,lane=drop?3:bounds.width-3;d='M '+x+' '+y+' V '+(y+15)+' H '+lane+' V '+(ty-15)+' H '+tx+' V '+ty;}
   else if(b.left>a.right){const x=a.right-bounds.left,y=a.top-bounds.top+a.height*.5,tx=b.left-bounds.left,ty=b.top-bounds.top+b.height*.5,mid=x+(tx-x)*.5;d='M '+x+' '+y+' H '+mid+' V '+ty+' H '+tx;}
   else{const x=a.left-bounds.left+a.width*.65,y=a.bottom-bounds.top,tx=b.left-bounds.left+b.width*.65,ty=b.top-bounds.top;d='M '+x+' '+y+' V '+(ty-18-index%2*6)+' H '+tx+' V '+ty;}
   const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',d);if(drop)path.classList.add('drop-line');svg.append(path);
  });
 };graphObserver=new ResizeObserver(draw);graphObserver.observe(graph);graph.querySelectorAll('.finals-match').forEach(card=>graphObserver.observe(card));requestAnimationFrame(draw);
}

$('start-finals').onclick=()=>{
 if(!data?.preview.ready)return;
 const text=data.preview.unfinished?'Es sind noch Ligaspiele offen. Trotzdem die Finals mit den sechs aktuell angezeigten Teilnehmern starten?':'Die Finals mit den sechs angezeigten Teilnehmern starten?';
 if(confirm(text+' Die Teilnehmer werden festgehalten.'))mutate({action:'start',leagueRevision:data.preview.leagueRevision,allowUnfinished:data.preview.unfinished});
};
$('refresh-finals').onclick=load;document.addEventListener('wi-auth-change',load);load();
