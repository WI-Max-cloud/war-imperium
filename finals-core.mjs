import {buildFinals} from './finals-builder.mjs';
import {leagueStandings,scheduleLeague,leagueRules} from './league-core.mjs';
export function finalsPreview(leagues){
 const slots=leagues.leagues.flatMap(league=>Array.from({length:leagueRules(league,leagues.leagues.length).finals},(_,index)=>{const rank=index+1,player=leagueStandings(league)[index];return {key:`L${league.id}-${rank}`,leagueId:league.id,rank,initialLosses:league.id===1?0:1,player:player?{id:player.id,name:player.name,tag:player.tag??''}:null};}));
 const bracket=slots.length>=2?buildFinals(slots,finalsDefinitions):{definitions:[],finalMatchId:null,resetMatchId:null};
 const unfinished=leagues.leagues.some(l=>scheduleLeague(l).matches.some(m=>m.homeScore===null));
 return {slots,...bracket,leagueRevision:leagues.revision,unfinished,ready:slots.length>=2&&slots.every(s=>s.player)};
}
export const finalsDefinitions=[
 {id:1,title:'Upper Semis',branch:'upper',home:'L1-1',away:'L1-4'},
 {id:2,title:'Upper Semis',branch:'upper',home:'L1-2',away:'L1-3'},
 {id:3,title:'Lower Round 2',branch:'lower',home:'L3-1',away:'L1'},
 {id:4,title:'Lower Round 2',branch:'lower',home:'L2-1',away:'L2'},
 {id:5,title:'Lower Semis',branch:'lower',home:'W3',away:'W4'},
 {id:6,title:'Upper Finals',branch:'upper',home:'W1',away:'W2'},
 {id:7,title:'Lower Finals',branch:'lower',home:'W5',away:'L6'},
 {id:8,title:'Grand Finals',branch:'final',home:'W6',away:'W7'},
 {id:9,title:'Grand Finals Reset',branch:'final',home:'W6',away:'W7'}
];
export function resolveFinals(state){
 if(!state)return {matches:[],champion:null,players:[]};
 const byId=new Map(),seeds=new Map(state.seeds.map(s=>[s.key,s]));
 const resolve=source=>source.includes('-')?seeds.get(source)?.player??null:(source[0]==='W'?byId.get(Number(source.slice(1)))?.winner:byId.get(Number(source.slice(1)))?.loser)??null;
 for(const definition of state.definitions??finalsDefinitions){
  const home=resolve(definition.home),away=resolve(definition.away);
  const finalId=state.finalMatchId??8,resetId=state.resetMatchId??9;const active=definition.id!==resetId||!!byId.get(finalId)?.winner&&byId.get(finalId).winner.id===byId.get(finalId).away?.id;
  const result=state.results[definition.id];
  const played=active&&home&&away&&result&&result.home===home.id&&result.away===away.id&&Number.isInteger(result.homeScore)&&Number.isInteger(result.awayScore)&&result.homeScore>=0&&result.awayScore>=0&&result.homeScore!==result.awayScore;
  byId.set(definition.id,{...definition,homeSource:definition.home,awaySource:definition.away,home,away,active,ready:!!(active&&home&&away),homeScore:played?result.homeScore:null,awayScore:played?result.awayScore:null,winner:played?(result.homeScore>result.awayScore?home:away):null,loser:played?(result.homeScore>result.awayScore?away:home):null});
 }
 const eight=byId.get(state.finalMatchId??8),nine=byId.get(state.resetMatchId??9);
 const champion=nine.winner??(eight.winner?.id===eight.home?.id?eight.winner:null);
 const players=state.seeds.map(seed=>({...seed.player,seed:seed.key,initialLosses:seed.initialLosses??(seed.leagueId===1?0:1),losses:(seed.initialLosses??(seed.leagueId===1?0:1))+[...byId.values()].filter(m=>m.loser?.id===seed.player.id).length}));
 return {matches:[...byId.values()],champion,players:players.map(p=>({...p,eliminated:p.losses>=2}))};
}
function descendants(id,state){
 const affected=new Set([id]);
 for(const definition of state.definitions??finalsDefinitions){
  if([definition.home,definition.away].some(source=>!source.includes('-')&&affected.has(Number(source.slice(1))))||(definition.id===(state.resetMatchId??9)&&affected.has(state.finalMatchId??8)))affected.add(definition.id);
 }
 return [...affected];
}
export function updateFinals(current,input,leagues){
 const fail=(message,status=400)=>{const error=Error(message);error.status=status;throw error;};
 if(!input||!['start','result','clearResult'].includes(input.action))fail('Ungültige Finals-Aktion.');
 if(input.revision!==(current?.revision??0))fail('Die Finals wurden inzwischen geändert. Bitte neu laden.',409);
 if(input.action==='start'){
  if(current)fail('Die Finals wurden bereits gestartet.',409);
  const preview=finalsPreview(leagues);
  if(input.leagueRevision!==preview.leagueRevision)fail('Die Ligatabellen wurden geändert. Bitte neu laden.',409);
  if(!preview.ready)fail('Es fehlen Teilnehmer für die eingestellten Finals-Plätze in den Ligen.');
  if(new Set(preview.slots.map(s=>s.player.id)).size!==preview.slots.length)fail('Alle Finalsplätze müssen mit unterschiedlichen Spielern besetzt sein.');
  if(preview.unfinished&&input.allowUnfinished!==true)fail('Es sind noch Ligaspiele offen. Den Start nach aktuellem Tabellenstand ausdrücklich bestätigen.');
  return {revision:1,startedAt:new Date().toISOString(),leagueRevision:preview.leagueRevision,seeds:preview.slots,definitions:preview.definitions,finalMatchId:preview.finalMatchId,resetMatchId:preview.resetMatchId,results:{}};
 }
 if(!current)fail('Bitte zuerst die Finals starten.');
 const next=structuredClone(current),view=resolveFinals(next),match=view.matches.find(m=>m.id===input.matchId);
 if(!match)fail('Ungültige Spielnummer.');
 if(input.action==='clearResult'){
  if(match.homeScore===null)fail('Für dieses Spiel ist kein Ergebnis gespeichert.');
 }else{
  if(!match.ready)fail('Dieses Spiel ist noch nicht freigeschaltet.');
  if(!Number.isInteger(input.homeScore)||!Number.isInteger(input.awayScore)||input.homeScore<0||input.awayScore<0||input.homeScore>99||input.awayScore>99||input.homeScore===input.awayScore)fail('Die KO-Phase benötigt einen Sieger. Ganze Zahlen von 0 bis 99, kein Unentschieden und kein 0:0.');
  if(match.homeScore===input.homeScore&&match.awayScore===input.awayScore)return current;
 }
 const affected=descendants(match.id,next).filter(id=>id!==match.id&&next.results[id]);
 if(affected.length&&input.confirmDownstream!==true)fail('Die Änderung setzt bereits eingetragene Folgeergebnisse zurück. Bitte ausdrücklich bestätigen.',409);
 for(const id of descendants(match.id,next))delete next.results[id];
 if(input.action==='result')next.results[match.id]={home:match.home.id,away:match.away.id,homeScore:input.homeScore,awayScore:input.awayScore};
 next.revision++;return next;
}
