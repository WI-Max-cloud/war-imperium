const pairingId=(a,b)=>[a,b].sort().join(':');
export function leagueRules(league,count=3){return league.rules??{up:league.id>1?3:0,down:league.id<count?3:0,finals:league.id===1?4:1};}
export function leagueZones(leagueId,rank,total,rules){
 if(!Number.isInteger(leagueId)||leagueId<1||rank<1||rank>total)return [];
 const settings=rules??leagueRules({id:leagueId});
 const zones=[];
 if(rank<=settings.finals)zones.push('Finalsplatz');
 if(rank<=settings.up)zones.push('Aufstiegsplatz');
 if(rank>total-settings.down)zones.push('Abstiegsplatz');
 return zones;
}
export function scheduleLeague(league){
 const players=league.players,results=new Map((league.matches??[]).map(m=>[m.id,m]));
 const ring=players.map(p=>p.id);if(ring.length<2)return {...league,matches:[]};
 if(ring.length%2)ring.push(null);
 const matches=[];
 for(let round=1;round<ring.length;round++){
  for(let i=0;i<ring.length/2;i++){
   const first=ring[i],second=ring[ring.length-1-i];if(!first||!second)continue;
   const [home,away]=[first,second].sort(),id=pairingId(home,away),old=results.get(id);
   const played=old&&Number.isInteger(old.homeScore)&&Number.isInteger(old.awayScore)&&old.homeScore>=0&&old.awayScore>=0&&(old.homeScore!==old.awayScore||old.homeScore===0);
   matches.push({id,round,home,away,homeScore:played?old.homeScore:null,awayScore:played?old.awayScore:null});
  }
  ring.splice(1,0,ring.pop());
 }
 return {...league,matches};
}
export function prepareLeagues(state){return {...state,leagues:state.leagues.map(scheduleLeague)};}
export function leagueStandings(league){
 const rows=new Map(league.players.map(p=>[p.id,{...p,games:0,points:0,won:0,lost:0,difference:0}]));
 for(const match of scheduleLeague(league).matches){
  if(match.homeScore===null||match.awayScore===null)continue;
  const home=rows.get(match.home),away=rows.get(match.away);home.games++;away.games++;
  home.won+=match.homeScore;home.lost+=match.awayScore;away.won+=match.awayScore;away.lost+=match.homeScore;
  if(match.homeScore!==match.awayScore)(match.homeScore>match.awayScore?home:away).points+=3;
 }
 return [...rows.values()].map(row=>({...row,difference:row.won-row.lost})).sort((a,b)=>b.points-a.points||b.difference-a.difference||b.won-a.won||a.name.localeCompare(b.name,'de')||a.id.localeCompare(b.id));
}
