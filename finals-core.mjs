import {leagueStandings,scheduleLeague} from './league-core.mjs';
export function finalsPreview(leagues){
 const slots=[[1,1],[1,2],[1,3],[1,4],[2,1],[3,1]].map(([leagueId,rank])=>{
  const league=leagues.leagues.find(l=>l.id===leagueId),player=league?leagueStandings(league)[rank-1]:null;
  return {key:`L${leagueId}-${rank}`,leagueId,rank,player:player?{id:player.id,name:player.name,tag:player.tag??''}:null};
 });
 const unfinished=leagues.leagues.some(l=>scheduleLeague(l).matches.some(m=>m.homeScore===null));
 return {slots,leagueRevision:leagues.revision,unfinished,ready:slots.every(s=>s.player)};
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
 for(const definition of finalsDefinitions){
  const home=resolve(definition.home),away=resolve(definition.away);
  const active=definition.id!==9||!!byId.get(8)?.winner&&byId.get(8).winner.id===byId.get(8).away?.id;
  const result=state.results[definition.id];
  const played=active&&home&&away&&result&&result.home===home.id&&result.away===away.id&&Number.isInteger(result.homeScore)&&Number.isInteger(result.awayScore)&&result.homeScore>=0&&result.awayScore>=0&&result.homeScore!==result.awayScore;
  byId.set(definition.id,{...definition,homeSource:definition.home,awaySource:definition.away,home,away,active,ready:!!(active&&home&&away),homeScore:played?result.homeScore:null,awayScore:played?result.awayScore:null,winner:played?(result.homeScore>result.awayScore?home:away):null,loser:played?(result.homeScore>result.awayScore?away:home):null});
 }
 const eight=byId.get(8),nine=byId.get(9);
 const champion=nine.winner??(eight.winner?.id===eight.home?.id?eight.winner:null);
 const players=state.seeds.map(seed=>({...seed.player,seed:seed.key,initialLosses:seed.leagueId===1?0:1,losses:(seed.leagueId===1?0:1)+[...byId.values()].filter(m=>m.loser?.id===seed.player.id).length}));
 return {matches:[...byId.values()],champion,players:players.map(p=>({...p,eliminated:p.losses>=2}))};
}
function descendants(id){
 const affected=new Set([id]);
 for(const definition of finalsDefinitions){
  if([definition.home,definition.away].some(source=>!source.includes('-')&&affected.has(Number(source.slice(1))))||(definition.id===9&&affected.has(8)))affected.add(definition.id);
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
  if(!preview.ready)fail('Es fehlen Teilnehmer: vier in Liga 1 und jeweils einer in Liga 2 und 3 erforderlich.');
  if(new Set(preview.slots.map(s=>s.player.id)).size!==6)fail('Die sechs Finalsplätze müssen mit unterschiedlichen Spielern besetzt sein.');
  if(preview.unfinished&&input.allowUnfinished!==true)fail('Es sind noch Ligaspiele offen. Den Start nach aktuellem Tabellenstand ausdrücklich bestätigen.');
  return {revision:1,startedAt:new Date().toISOString(),leagueRevision:preview.leagueRevision,seeds:preview.slots,results:{}};
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
 const affected=descendants(match.id).filter(id=>id!==match.id&&next.results[id]);
 if(affected.length&&input.confirmDownstream!==true)fail('Die Änderung setzt bereits eingetragene Folgeergebnisse zurück. Bitte ausdrücklich bestätigen.',409);
 for(const id of descendants(match.id))delete next.results[id];
 if(input.action==='result')next.results[match.id]={home:match.home.id,away:match.away.id,homeScore:input.homeScore,awayScore:input.awayScore};
 next.revision++;return next;
}
