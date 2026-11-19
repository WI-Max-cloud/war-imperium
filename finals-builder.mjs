// Sources are seeded league positions or winners/losers of earlier matches.
export function buildFinals(slots,legacyDefinitions){
 const upper=slots.filter(s=>s.leagueId===1),lower=slots.filter(s=>s.leagueId!==1);
 if(upper.length===4&&lower.length===2){const definitions=legacyDefinitions.map(m=>({...m,home:m.home==='L3-1'?lower[1].key:m.home==='L2-1'?lower[0].key:m.home}));return {definitions,finalMatchId:8,resetMatchId:9};}
 const definitions=[];let id=0;
 const match=(home,away,branch,title,round)=>{const definition={id:++id,home,away,branch,title,round};definitions.push(definition);return {winner:'W'+id,loser:'L'+id};};
 let size=1;while(size<upper.length)size*=2;
 let order=[1];while(order.length<size){const sum=order.length*2+1;order=order.flatMap(n=>[n,sum-n]);}
 let upperPool=order.map(rank=>upper[rank-1]?.key??null),lowerPool=lower.map(s=>s.key),round=0,lowerRound=0;
 const reduceLower=target=>{while(lowerPool.length>target){lowerRound++;const next=[];for(let i=0;i<lowerPool.length;i+=2){if(i+1===lowerPool.length)next.push(lowerPool[i]);else next.push(match(lowerPool[i],lowerPool[i+1],'lower','Lower Bracket · Runde '+lowerRound,lowerRound).winner);}lowerPool=next;}};
 while(upperPool.length>1){round++;const next=[],losers=[];for(let i=0;i<upperPool.length;i+=2){const home=upperPool[i],away=upperPool[i+1];if(!home||!away){next.push(home||away);continue;}const result=match(home,away,'upper','Upper Bracket · Runde '+round,round);next.push(result.winner);losers.push(result.loser);}upperPool=next;
  const merged=[];for(let i=0;i<Math.max(lowerPool.length,losers.length);i++){if(lowerPool[i])merged.push(lowerPool[i]);if(losers[i])merged.push(losers[i]);}lowerPool=merged;
  const nextMatches=Math.max(1,Math.floor(upperPool.filter(Boolean).length/2));reduceLower(nextMatches);
 }
 reduceLower(1);
 if(!upperPool[0]||!lowerPool[0])throw Object.assign(Error('Mindestens zwei Finals-Teilnehmer und ein Upper-Bracket-Teilnehmer sind erforderlich.'),{status:400});
 const final=match(upperPool[0],lowerPool[0],'final','Grand Finals',1),finalMatchId=id;
 match(upperPool[0],lowerPool[0],'final','Grand Finals Reset',2);return {definitions,finalMatchId,resetMatchId:id};
}
