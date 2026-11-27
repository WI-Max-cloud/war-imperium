import {familyTags} from './family-stats.mjs';
const fail=(status,message)=>Object.assign(Error(message),{status});
export const crownLeagues=[1333092601,1282759744,1299537363,1383425458,1400203077].map((id,index)=>({id,index,name:"King’s League "+['I','II','III','IV','V'][index]}));
export const boardUrl=id=>'https://www.royaletools.com/leaderboards?view=live&board='+encodeURIComponent('event:784088:league:'+id);
// Read the public server-rendered snapshot as JSON, without executing third-party scripts.
function jsonProperty(text,name){
 const marker=JSON.stringify(name)+':',position=text.indexOf(marker);
 if(position<0)throw Error('Ranglistendaten fehlen');
 const start=position+marker.length;let depth=0,quoted=false,escaped=false;
 if(!['{','['].includes(text[start]))throw Error('Ranglistenformat geändert');
 for(let i=start;i<text.length;i++){
  const c=text[i];if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;}
  else if(c==='"')quoted=true;else if(c==='{'||c==='[')depth++;else if((c==='}'||c===']')&&!--depth)return JSON.parse(text.slice(start,i+1));
 }
 throw Error('Ranglistendaten unvollständig');
}
export function parseCrownPage(html,league){
 let flight='';
 for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)){
  const push=match[1].trim().match(/^self\.__next_f\.push\((\[[\s\S]*\])\);?$/);
  if(push){const part=JSON.parse(push[1]);if(part[0]===1&&typeof part[1]==='string')flight+=part[1];}
 }
 const boards=jsonProperty(flight,'activeLeaderboards'),snapshot=jsonProperty(flight,'selectedSnapshot');
 const ref=typeof snapshot.descriptor==='string'&&snapshot.descriptor.match(/:activeLeaderboards:(\d+)$/);
 const descriptor=ref?boards[Number(ref[1])]:snapshot.descriptor;
 if(descriptor?.key!=='event:784088:league:'+league.id||!Array.isArray(snapshot.entries)||snapshot.entries.length>1000||!Number.isFinite(Date.parse(snapshot.fetchedAt)))throw Error('Falsche oder ungültige Rangliste');
 const seen=new Set();
 const entries=snapshot.entries.map(p=>{
  if(typeof p.name!=='string'||!/^#[0289PYLQGRJCUV]{3,15}$/.test(p.tag)||!Number.isInteger(p.rank)||p.rank<1||p.rank>1000||seen.has(p.tag))throw Error('Ungültiger Ranglisteneintrag');
  seen.add(p.tag);return {tag:p.tag,name:p.name,rank:p.rank};
 });
 return {entries,fetchedAt:new Date(snapshot.fetchedAt).toISOString()};
}
async function fetchPage(url){
 const response=await fetch(url,{headers:{Accept:'text/html'},redirect:'error',signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('Ranglistenquelle nicht erreichbar');
 if(Number(response.headers.get('content-length'))>3000000)throw Error('Ranglistendaten zu groß');
 let bytes=0;const chunks=[];for await(const chunk of response.body){bytes+=chunk.length;if(bytes>3000000)throw Error('Ranglistendaten zu groß');chunks.push(chunk);}
 return Buffer.concat(chunks).toString('utf8');
}
export function crownRankings(storage,members,{loadPage=fetchPage,now=()=>Date.now()}={}){
 let pending,cached,attemptedAt=-Infinity;
 async function boards(){
  if(pending)return pending;if(cached&&now()-attemptedAt<600000)return cached;
  pending=(async()=>{
   attemptedAt=now();let saved=await storage.read('crown-rankings',[]);
   if(!Array.isArray(saved))saved=[];
   const result=[];let cursor=0;
   async function worker(){while(cursor<crownLeagues.length){const league=crownLeagues[cursor++],old=saved.find(b=>b.id===league.id);
    if(old&&now()-Date.parse(old.checkedAt)<600000){result.push(old);continue;}
    try{const snapshot=parseCrownPage(await loadPage(boardUrl(league.id)),league);result.push({...league,...snapshot,checkedAt:new Date(now()).toISOString(),error:false});}
    catch{result.push({...league,entries:old?.entries??[],fetchedAt:old?.fetchedAt??null,checkedAt:old?.checkedAt??null,error:true});}
   }}
   await Promise.all([worker(),worker()]);result.sort((a,b)=>a.index-b.index);
   // Only successful reads advance the persistent cache; failed reads never erase a snapshot.
   await storage.write('crown-rankings',result.filter(b=>b.fetchedAt).map(b=>({...b,error:false})));
   cached=result;return result;
  })();try{return await pending;}finally{pending=null;}
 }
 return async tag=>{
  if(!familyTags.includes(tag))throw fail(400,'Ungültige Clanauswahl');
  const [roster,rankings]=await Promise.all([members(tag),boards()]);
  const current=new Map(roster.members.map(p=>[p.tag,p]));
  const rows=rankings.flatMap(b=>b.entries.filter(p=>current.has(p.tag)).map(p=>({tag:p.tag,name:current.get(p.tag).name,rank:p.rank,league:b.name,leagueIndex:b.index,stale:b.error})));
  rows.sort((a,b)=>b.leagueIndex-a.leagueIndex||a.rank-b.rank||a.name.localeCompare(b.name,'de'));
  return {clan:tag,membersUpdatedAt:roster.updatedAt,rows,boards:rankings.map(b=>({id:b.id,name:b.name,url:boardUrl(b.id),fetchedAt:b.fetchedAt,error:b.error,count:b.entries.length})),source:'RoyaleTools',limit:1000};
 };
}
