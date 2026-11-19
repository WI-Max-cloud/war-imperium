import {tournamentUrl} from './tournament-context.mjs';
import {resolveFinals,finalsDefinitions} from './finals-core.mjs';
const $=id=>document.getElementById(id);let data=null,busy=false;
const sourceLabel=source=>source.includes('-')?`Liga ${source.slice(1).split('-')[0]} · Platz ${source.split('-')[1]}`:`${source[0]==='W'?'Sieger':'Verlierer'} Spiel ${source.slice(1)}`;
function node(tag,className,text){const element=document.createElement(tag);if(className)element.className=className;if(text!==undefined)element.textContent=text;return element;}
function setBusy(value){busy=value;document.querySelectorAll('#finals-bracket button,#finals-bracket .finals-score,#refresh-finals').forEach(b=>b.disabled=value);$('start-finals').disabled=value||data?.role!=='admin'||!!data?.state||!data?.preview?.ready;}
async function load(){
 if(busy)return;setBusy(true);$('finals-status').textContent='Finals werden geladen …';
 try{const response=await fetch(tournamentUrl('/api/finals'));const result=await response.json();if(!response.ok)throw Error(result.error||'Laden fehlgeschlagen');data=result;render();$('finals-status').textContent='Stand geladen. Ergebnisse werden dauerhaft gespeichert.';}
 catch(e){$('finals-status').textContent=e.message;}finally{setBusy(false);}
}
async function mutate(input){
 if(busy||!['admin','player','vice'].includes(data?.role))return false;setBusy(true);$('finals-status').textContent='Wird gespeichert …';
 try{
  const payload={...input,revision:data.state?.revision??0};
  const send=()=>fetch(tournamentUrl('/api/finals'),{method:'POST',headers:{'Content-Type':'application/json','X-War-Imperium':'local'},body:JSON.stringify(payload)});
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
 if(!match.active){card.append(node('p','schedule-note','Nur nötig, wenn der Lower-Bracket-Sieger das Grand Final gewinnt.'));return card;}
 if(!match.ready){card.append(node('p','schedule-note','Wartet auf vorherige Ergebnisse.'));return card;}
 if(data.tournament?.archived||!['admin','player','vice'].includes(data.role)){card.append(node('p','read-only-note',data.tournament?.archived?'Archiviertes Turnier · nur Lesen.':'Zum Eintragen eines Ergebnisses oben anmelden.'));return card;}
 const form=node('form','finals-result'),left=node('label','',match.home.name),right=node('label','',match.away.name);
 const score=side=>{const input=node('input','finals-score');input.type='number';input.min='0';input.max='99';input.step='1';input.inputMode='numeric';input.required=true;input.value=match[side+'Score']??'';input.setAttribute('aria-label',`Spiel ${match.id}: gewonnene Matches von ${match[side].name}`);return input;};
 const home=score('home'),away=score('away');left.append(home);right.append(away);form.append(left,node('span','',':'),right);
 const actions=node('div','finals-result-actions'),save=node('button','',match.winner?'Ergebnis ändern':'Ergebnis speichern');save.type='submit';actions.append(save);
 if(match.winner&&data.role==='admin'){const reset=node('button','','Zurücksetzen');reset.type='button';reset.onclick=()=>{if(confirm(`Ergebnis von Spiel ${match.id} zurücksetzen?`))mutate({action:'clearResult',matchId:match.id});};actions.append(reset);}
 const error=node('p','match-error');error.setAttribute('role','alert');form.append(actions,error);
 form.onsubmit=async event=>{event.preventDefault();if(home.value===''||away.value==='')return;const success=await mutate({action:'result',matchId:match.id,homeScore:Number(home.value),awayScore:Number(away.value)});if(!success)error.textContent=$('finals-status').textContent;};const editor=node('details','finals-editor');editor.append(node('summary','',match.winner?'Ergebnis ändern':'Ergebnis eintragen'),form);card.append(editor);return card;
}
function render(){
 const state=data.state,view=resolveFinals(state);$('finals-slots').replaceChildren();
 $('seeds-title').textContent=state?'Festgelegte Finals-Teilnehmer':'Teilnehmer nach aktuellem Ligastand';
 $('seed-note').textContent=state?`Start: ${new Date(state.startedAt).toLocaleString('de-DE')}. Die Teilnehmer bleiben fest, auch wenn sich die Ligatabellen später ändern.`:'Vor dem Start die eingestellten Finals-Plätze prüfen. Bei vollständiger Gleichheit gilt die bisherige alphabetische Tabellenreihenfolge.';
 for(const seed of state?.seeds??data.preview.slots){const card=node('article','finals-slot');card.append(node('h3','',`Liga ${seed.leagueId} · Platz ${seed.rank}`),node('strong','',seed.player?.name??'Noch nicht besetzt'),node('p','',seed.leagueId===1?'Upper Bracket · 0 Niederlagen zum Start':'Lower Bracket · 1 Niederlage angerechnet'));$('finals-slots').append(card);}
 $('start-finals').hidden=!!state||data.role!=='admin'||data.tournament?.archived;$('finals-bracket').replaceChildren();
 const definitions=state?.definitions??data.preview.definitions??finalsDefinitions;const resetId=state?.resetMatchId??data.preview.resetMatchId??9;const matches=state?view.matches:definitions.map(m=>({...m,home:null,away:null,homeSource:m.home,awaySource:m.away,active:m.id!==resetId,ready:false,homeScore:null,awayScore:null}));
 const graphSection=node('section','panel finals-graph-section');graphSection.append(node('h2','','War Imperium Finals · Turnierbaum'));
 const legend=node('p','bracket-legend');legend.textContent='Blaue Linie: Sieger weiter · Rote gestrichelte Linie: Verlierer ins Lower Bracket · Reset-Finale nur bei Bedarf';graphSection.append(legend);
 const graph=node('div','finals-graph clean-graph');graph.setAttribute('aria-label','Double-Elimination-Turnierbaum');
 const classic=definitions.length===9&&definitions[0]?.title==='Upper Semis';const order=classic?[1,2,6,3,4,5,7,8,9]:definitions.map(m=>m.id);if(!classic)graph.classList.add('dynamic-graph');
 const rowsBySource=new Map(),nextRow={upper:1,lower:1,final:1};
 for(const id of order){const match=matches.find(m=>m.id===id),card=matchCard(match);card.dataset.match=id;if(!classic){const sourceRows=[match.homeSource,match.awaySource].filter(v=>!v.includes('-')).map(v=>rowsBySource.get(Number(v.slice(1)))??0);const row=Math.max(nextRow[match.branch],...sourceRows.map(n=>n+1));nextRow[match.branch]=row+1;rowsBySource.set(id,row);card.classList.add('graph-branch-'+match.branch,'graph-row-'+row);}graph.append(card);}
 const layout=bracketLayout(definitions);graph.style.setProperty('--rounds',layout.columns);
 for(const p of layout.positions){const card=graph.querySelector('[data-match="'+p.id+'"]');card.style.gridArea=`${p.row} / ${p.column}`;card.style.order=layout.lanes.filter(l=>l.row<p.row).at(-1).row*10000+p.column*100+p.row;}
 for(const lane of layout.lanes){const heading=node('h3','bracket-lane '+lane.branch,lane.title);heading.style.gridArea=`${lane.row} / 1 / auto / -1`;heading.style.order=lane.row*10000;graph.append(heading);}
 graph.replaceChildren(...[...graph.children].sort((a,b)=>Number(a.style.order)-Number(b.style.order)));
 const scroll=node('div','finals-scroll');scroll.append(graph);graphSection.append(scroll);
 legend.textContent='Die Runden laufen von links nach rechts. Unter den Spielern steht, aus welchem Spiel sie kommen. Reset-Finale nur bei Bedarf.';
 if(data.role==='admin'){const actions=node('div','actions'),save=node('button','','Turnierbaum als JPG speichern');save.type='button';save.onclick=()=>exportBracket(matches,definitions,view.champion,save);actions.append(save);graphSection.insertBefore(actions,legend);}
 $('finals-bracket').append(graphSection);observeGraph(graph,definitions,resetId);
 $('champion').hidden=!view.champion;$('champion').replaceChildren();if(view.champion)$('champion').append(node('h2','','🏆 War Imperium Champion'),node('strong','',view.champion.name));
 $('finals-losses').hidden=!state;$('finals-losses').replaceChildren();if(state){$('finals-losses').append(node('h2','','Turnierstatus'));const list=node('ul');for(const p of view.players)list.append(node('li','',`${p.name} · ${p.losses} Niederlage${p.losses===1?'':'n'}${p.initialLosses?' (davon 1 zum Start angerechnet)':''} · ${view.champion?.id===p.id?'Champion':p.eliminated?'Ausgeschieden':'Im Turnier'}`));$('finals-losses').append(list);}
}

function bracketLayout(definitions){
 const positions=[],lanes=[],rounds=new Map();let row=1,columns=1;
 for(const [branch,title] of [['upper','Upper Bracket'],['lower','Lower Bracket'],['final','Finale & Entscheidung']]){
  const group=definitions.filter(m=>m.branch===branch);if(!group.length)continue;
  lanes.push({branch,title,row});row++;
  const counts=new Map();
  for(const m of group){const prior=[m.home,m.away].filter(s=>!s.includes('-')).map(s=>rounds.get(Number(s.slice(1)))).filter(p=>p?.branch===branch);const column=m.round??(branch==='final'?group.indexOf(m)+1:1+Math.max(0,...prior.map(p=>p.column)));rounds.set(m.id,{branch,column});const index=counts.get(column)??0;counts.set(column,index+1);positions.push({id:m.id,column,row:row+index});columns=Math.max(columns,column);}
  row+=Math.max(...counts.values());
 }
 return {positions,lanes,columns,rows:row-1};
}
async function exportBracket(matches,definitions,champion,button){
 if(data?.role!=='admin')return;button.disabled=true;let url;
 try{
  const layout=bracketLayout(definitions),cw=380,gap=64,rh=180,pad=48,top=175;
  const canvas=document.createElement('canvas');canvas.width=pad*2+layout.columns*(cw+gap)-gap;canvas.height=top+layout.rows*rh+90;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#031323';ctx.fillRect(0,0,canvas.width,canvas.height);
  const text=(value,x,y,size=22,color='#e8f5ff',max=cw-32)=>{ctx.font=`${size>=26?'800':'600'} ${size}px system-ui`;ctx.fillStyle=color;const full=String(value),chars=Array.from(full);while(chars.length&&ctx.measureText(chars.join('')+(chars.length<Array.from(full).length?'…':'')).width>max)chars.pop();ctx.fillText(chars.join('')+(chars.length<Array.from(full).length?'…':''),x,y);};
  ctx.fillStyle='#ef3046';ctx.fillRect(pad,36,90,5);text('WAR IMPERIUM · FINALS',pad,88,38,'#fff',canvas.width-pad*2);text(data.tournament?.name??'War Imperium Liga',pad,126,24,'#8cdeff',canvas.width-pad*2);text(new Date().toLocaleString('de-DE'),pad,157,18,'#a8bfd2',canvas.width-pad*2);
  const rect=p=>({x:pad+(p.column-1)*(cw+gap),y:top+(p.row-1)*rh});
  for(const p of layout.positions){const target=definitions.find(m=>m.id===p.id);if(target.title.includes('Reset'))continue;for(const [side,source] of [target.home,target.away].entries()){if(source.includes('-'))continue;const origin=definitions.find(m=>m.id===Number(source.slice(1)));if(origin?.branch!==target.branch)continue;const a=rect(layout.positions.find(p=>p.id===origin.id)),b=rect(p),x=a.x+cw,y=a.y+80,tx=b.x,ty=b.y+69+side*52;ctx.strokeStyle='#53ccef';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo((x+tx)/2,y);ctx.lineTo((x+tx)/2,ty);ctx.lineTo(tx,ty);ctx.stroke();}}
  for(const lane of layout.lanes){const y=top+(lane.row-1)*rh;text(lane.title.toUpperCase(),pad,y+90,28,lane.branch==='lower'?'#ff8598':'#8cdeff',canvas.width-pad*2);ctx.strokeStyle='#25475f';ctx.beginPath();ctx.moveTo(pad,y+112);ctx.lineTo(canvas.width-pad,y+112);ctx.stroke();}
  for(const p of layout.positions){const match=matches.find(m=>m.id===p.id),{x,y}=rect(p);ctx.fillStyle='#10283c';ctx.fillRect(x,y,cw,164);ctx.strokeStyle=match.winner?'#53ccef':'#36576e';ctx.strokeRect(x,y,cw,164);text(`SPIEL ${match.id} · ${match.title}`,x+16,y+28,18,'#8cdeff');for(const [i,side] of ['home','away'].entries()){const player=match[side],sy=y+65+i*52;text(player?.name??sourceLabel(match[side+'Source']),x+16,sy,22,player&&match.winner?.id===player.id?'#74dfa1':'#fff',cw-80);text(match[side+'Score']??'–',x+cw-48,sy,24);text(sourceLabel(match[side+'Source']),x+16,sy+20,14,'#9bb7cc',cw-35);}if(!match.active)text('Nur bei Bedarf',x+16,y+155,13,'#a8bfd2');}
  text(champion?'CHAMPION · '+champion.name:'Blaue Linien: Sieger weiter · Herkunft der Spieler jeweils unter dem Namen.',pad,canvas.height-35,22,champion?'#ffd475':'#a8bfd2',canvas.width-pad*2);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.94));canvas.width=canvas.height=1;if(!blob)throw Error('Das Bild konnte nicht erstellt werden.');url=URL.createObjectURL(blob);
  const dialog=node('dialog','finals-jpg-dialog'),close=node('button','','Schließen'),link=node('a','finals-link','JPG herunterladen'),img=node('img');link.href=url;link.download='war-imperium-finals-'+new Date().toISOString().slice(0,10)+'.jpg';img.src=url;img.alt='Turnierbaum War Imperium Finals';close.onclick=()=>dialog.close();dialog.append(close,link,img);dialog.addEventListener('close',()=>{URL.revokeObjectURL(url);dialog.remove();},{once:true});document.body.append(dialog);dialog.showModal();
 }catch(error){if(url)URL.revokeObjectURL(url);$('finals-status').textContent=error.message;}finally{button.disabled=false;}
}
let graphObserver;
function observeGraph(graph,definitions,resetId){
 graphObserver?.disconnect();const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('bracket-lines');svg.setAttribute('aria-hidden','true');graph.prepend(svg);
 const draw=()=>{if(!graph.isConnected)return;svg.replaceChildren();const bounds=graph.getBoundingClientRect(),mobile=matchMedia('(max-width:700px)').matches;
  const edges=[];for(const match of definitions){if(match.id===resetId){const finalId=data.state?.finalMatchId??data.preview.finalMatchId??8;edges.push([finalId,resetId,false]);continue;}for(const source of [match.home,match.away])if(!source.includes('-'))edges.push([Number(source.slice(1)),match.id,source[0]==='L']);}
  edges.forEach(([from,to,drop],index)=>{const a=graph.querySelector('[data-match="'+from+'"]').getBoundingClientRect(),b=graph.querySelector('[data-match="'+to+'"]').getBoundingClientRect();let d;
   const origin=definitions.find(m=>m.id===from),target=definitions.find(m=>m.id===to);if(mobile||origin.branch!==target.branch||to===resetId)return;
   if(mobile){return;}
   else if(b.left>a.right){const x=a.right-bounds.left,y=a.top-bounds.top+a.height*.5,tx=b.left-bounds.left,ty=b.top-bounds.top+b.height*.5,mid=x+(tx-x)*.5;d='M '+x+' '+y+' H '+mid+' V '+ty+' H '+tx;}
   else{const x=a.left-bounds.left+a.width*.65,y=a.bottom-bounds.top,tx=b.left-bounds.left+b.width*.65,ty=b.top-bounds.top;d='M '+x+' '+y+' V '+(ty-18-index%2*6)+' H '+tx+' V '+ty;}
   const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',d);if(drop)path.classList.add('drop-line');svg.append(path);
  });
 };graphObserver=new ResizeObserver(draw);graphObserver.observe(graph);graph.querySelectorAll('.finals-match').forEach(card=>graphObserver.observe(card));requestAnimationFrame(draw);
}

$('start-finals').onclick=()=>{
 if(!data?.preview.ready)return;
 const text=data.preview.unfinished?'Es sind noch Ligaspiele offen. Trotzdem die Finals mit den aktuell angezeigten Teilnehmern starten?':'Die Finals mit den angezeigten Teilnehmern starten?';
 if(confirm(text+' Die Teilnehmer werden festgehalten.'))mutate({action:'start',leagueRevision:data.preview.leagueRevision,allowUnfinished:data.preview.unfinished});
};
$('refresh-finals').onclick=load;document.addEventListener('wi-auth-change',load);load();
