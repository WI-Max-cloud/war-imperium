// A Grand Duel is one battle-log entry, even when it contains several rounds.
function battleDate(value){
 const m=typeof value==='string'&&value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})\.(\d{3})Z$/);
 return m?Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.${m[7]}Z`):NaN;
}
export function crownWindow(asOf){
 const d=new Date(asOf);if(!Number.isFinite(d.getTime()))throw Error('Ranglistenzeit fehlt');
 d.setUTCHours(9,0,0,0);d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+2)%7);
 if(d.getTime()>Date.parse(asOf))d.setUTCDate(d.getUTCDate()-7);
 return {start:d.getTime(),end:d.getTime()+72*3600000};
}
export function countCrownGames(log,tag,asOf){
 const {start,end}=crownWindow(asOf);
 if(!Array.isArray(log)||!log.length)throw Error('Kein Kampfprotokoll verfügbar');
 const times=log.map(b=>battleDate(b.battleTime));if(times.some(t=>!Number.isFinite(t)))throw Error('Ungültiges Kampfprotokoll');
 const keys=new Set();
 log.forEach((b,i)=>{if(times[i]>=start&&times[i]<end&&b.type==='competitiveDuel'&&b.isHostedMatch!==true&&b.team?.some(p=>p.tag===tag))keys.add(b.battleTime+'|'+(b.opponent??[]).map(p=>p.tag).join(','));});
 const played=keys.size;if(played>20||played===0&&Math.min(...times)>start)throw Error('Spielanzahl nicht eindeutig');
 return {played,total:20,exact:played===20||Math.min(...times)<=start,weekendStart:new Date(start).toISOString()};
}
export function crownGames(battleLog,now=()=>Date.now()){
 const cache=new Map(),pending=new Map();
 return async(tag,asOf)=>{
  if(!battleLog)return null;
  const key=tag+'|'+crownWindow(asOf).start,old=cache.get(key);
  if(old&&now()-old.at<300000)return old.value;if(pending.has(key))return pending.get(key);
  const request=(async()=>{let value=null;try{value={...countCrownGames(await battleLog(tag),tag,asOf),updatedAt:new Date(now()).toISOString()};}catch{}
   cache.delete(key);cache.set(key,{at:now(),value});while(cache.size>260)cache.delete(cache.keys().next().value);return value;
  })();pending.set(key,request);try{return await request;}finally{pending.delete(key);}
 };
}
