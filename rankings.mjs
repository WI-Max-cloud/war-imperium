export async function clanPlacements(api) {
 const clan=await api('clans/%2322QJG0');
 const location=clan.location;
 const boards=[['Clanpunkte · Weltweit','global','clans'],['Clankrieg · Weltweit','global','clanwars'],['Clanpunkte · '+(location?.name||'Clanregion'),location?.id,'clans'],['Clankrieg · '+(location?.name||'Clanregion'),location?.id,'clanwars']];
 const results=[];
 for(const [title,id,type] of boards){
  if(!id){results.push({title,error:'Für den Clan ist keine Ranglistenregion verfügbar.'});continue;}
  try{
   let cursor,count=0,found=null,seen=new Set(),complete=false;
   for(let page=0;page<20;page++){
    const response=await api(`locations/${encodeURIComponent(id)}/rankings/${type}?limit=1000`+(cursor?'&after='+encodeURIComponent(cursor):''));
    if(!Array.isArray(response.items))throw Error('API-Ranglistenformat ungültig');
    count+=response.items.length;
    found=response.items.find(c=>c.tag==='#22QJG0');
    if(found){if(!Number.isInteger(found.rank)||found.rank<1)throw Error('API-Platzierung fehlt');break;}
    cursor=response.paging?.cursors?.after;
    if(!cursor){complete=true;break;}
    if(seen.has(cursor))throw Error('API wiederholt Ranglistenseite');seen.add(cursor);
   }
   results.push({title,rank:found?.rank??null,previousRank:found?.previousRank??null,score:found?.clanScore??null,checked:count,complete});
  }catch(e){results.push({title,error:e.message?.startsWith('API')?e.message:'Rangliste momentan nicht abrufbar.'});}
 }
 return {updatedAt:new Date().toISOString(),location:location?.name??null,results};
}
