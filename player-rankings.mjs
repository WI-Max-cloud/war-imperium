// Scan only official API player boards, intersecting with a fresh clan roster.
// Keep response pages transient rather than storing all leaderboard players.
export async function scanPlayerRankings(api,onProgress=()=>{}){
 const profile=await api('clans/%2322QJG0');
 if(!Array.isArray(profile.memberList))throw Error('API-Mitgliederliste fehlt.');
 const members=new Map(profile.memberList.map(m=>[m.tag,{tag:m.tag,name:m.name}]));
 if(!members.size)throw Error('Keine aktuellen Clanmitglieder gefunden.');
 const startedAt=new Date().toISOString(),discovery=[],boards=[],hits=new Map();
 const deadline=Date.now()+8*60*1000;
 let requests=1,halt=false;
 const request=async path=>{if(requests>=1800||Date.now()>=deadline){halt=true;throw Error('Abruf- oder Zeitgrenze erreicht');}requests++;return api(path);};
 const collect=async path=>{
  let cursor,seen=new Set(),items=[];
  for(let page=0;page<30;page++){
   const r=await request(path+(path.includes('?')?'&':'?')+'limit=1000'+(cursor?'&after='+encodeURIComponent(cursor):''));
   if(!Array.isArray(r.items))throw Error('API-Listenformat ungültig');items.push(...r.items);cursor=r.paging?.cursors?.after;if(!cursor)return items;
   if(seen.has(cursor))throw Error('Wiederholter API-Cursor');seen.add(cursor);
  }throw Error('API-Listenabruf unvollständig');
 };
 const addLocation=(id,name)=>{
  boards.push({id:`${id}-trophies`,name:'Trophäen',region:name,path:`locations/${id}/rankings/players`,capped:true});
  boards.push({id:`${id}-ranked`,name:'Pfad der Legenden',region:name,path:`locations/${id}/pathoflegend/players`,capped:true});
 };
 addLocation('global','Weltweit');
 for(const [source,load] of [
  ['Länder und Regionen',async()=>{const locations=await collect('locations');const ids=new Set();for(const loc of locations){if(Number.isInteger(loc.id)&&!ids.has(loc.id)){ids.add(loc.id);addLocation(loc.id,loc.name||`Region ${loc.id}`);}}}],
  ['Modusranglisten',async()=>{const modes=await request('leaderboards');if(!Array.isArray(modes.items))throw Error('API-Modusliste ungültig');const ids=new Set();for(const mode of modes.items){if(Number.isInteger(mode.id)&&!ids.has(mode.id)){ids.add(mode.id);boards.push({id:`mode-${mode.id}`,name:`${mode.name||'Modusrangliste'} · ID ${mode.id}`,region:'Weltweit',path:`leaderboard/${mode.id}`,capped:false});}}}],
  ['Globale Turniere',async()=>{const tournaments=await collect('globaltournaments');const tags=new Set();for(const t of tournaments){if(typeof t.tag==='string'&&!tags.has(t.tag)){tags.add(t.tag);boards.push({id:`tournament-${t.tag}`,name:`${t.title||t.name||'Globales Turnier'} · ${t.tag}`,region:'Weltweit',path:`locations/global/rankings/tournaments/${encodeURIComponent(t.tag)}`,capped:false});}}}]
 ]){
  try{await load();}catch(e){discovery.push({source,error:e.message});}
 }
 const coverage=[];let next=0,done=0;
 const progress=()=>onProgress({completed:done,total:boards.length,hits:hits.size,requests});progress();
 async function scan(board){
  let cursor,count=0,seen=new Set();const found=new Map();
  let error=null,finished=false;
  try{
   for(let page=0;page<30;page++){
    if(halt)throw Error('Prüfung nach API-Zugriffs- oder Ratenfehler unterbrochen');
    const response=await request(board.path+'?limit=1000'+(cursor?'&after='+encodeURIComponent(cursor):''));
    if(!Array.isArray(response.items))throw Error('API-Ranglistenformat ungültig');count+=response.items.length;
    for(const row of response.items){
     const member=members.get(row.tag);if(!member)continue;
     if(!Number.isInteger(row.rank)||row.rank<1){error='Ein gefundener Spielereintrag hat keine gültige Platznummer';continue;}
     const score=[row.score,row.eloRating,row.trophies].find(v=>typeof v==='number'&&Number.isFinite(v));
     const hit={...member,boardId:board.id,board:board.name,region:board.region,rank:row.rank,score:score??null};found.set(member.tag,hit);hits.set(`${board.id}:${member.tag}`,hit);
    }
    cursor=response.paging?.cursors?.after;if(!cursor){finished=true;break;}
    if(seen.has(cursor))throw Error('Wiederholter API-Cursor');seen.add(cursor);
   }
   if(!finished&&!error)error='Seitenlimit erreicht; Rangliste nur teilweise geprüft';
  }catch(e){error=e.message;if(/429|403|verweigert|API-Limit/.test(error))halt=true;}
  coverage.push({id:board.id,name:board.name,region:board.region,checked:count,hits:found.size,finished:finished&&!error,capped:board.capped,error});
  done++;progress();
 }
 async function worker(){while(next<boards.length&&!halt){const board=boards[next++];await scan(board);}}
 await Promise.all([worker(),worker()]);
 if(next<boards.length)discovery.push({source:'Weitere Ranglisten',error:`${boards.length-next} Ranglisten wegen API-, Abruf- oder Zeitgrenze nicht geprüft.`});
 return {startedAt,updatedAt:new Date().toISOString(),memberCount:members.size,total:boards.length,completed:done,requests,discovery,coverage,hits:[...hits.values()].sort((a,b)=>a.name.localeCompare(b.name,'de')||a.board.localeCompare(b.board,'de')||a.rank-b.rank),partial:discovery.length>0||coverage.some(b=>!b.finished)||done<boards.length};
}
