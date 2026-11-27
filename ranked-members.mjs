import {familyTags} from './family-stats.mjs';
const definitions=[{id:'global',name:'Ranked weltweit',location:'global'},{id:'germany',name:'Ranked Deutschland',location:57000094}];
const fail=(status,message)=>Object.assign(Error(message),{status});
export function rankedMembers(storage,api,members,{now=()=>Date.now()}={}){
 let pending,cached,attempted=-Infinity;
 async function load(){
  if(pending)return pending;if(cached&&now()-attempted<600000)return cached;
  pending=(async()=>{
   attempted=now();let saved=await storage.read('ranked-player-boards',[]);if(!Array.isArray(saved))saved=[];
   const result=await Promise.all(definitions.map(async def=>{
    const old=saved.find(b=>b.id===def.id);
    if(old&&now()-Date.parse(old.updatedAt)<600000)return {...old,error:false,partial:false};
    const entries=[],tags=new Set(),cursors=new Set();let cursor;
    try{
     for(let page=0;page<20;page++){
      const data=await api(`locations/${def.location}/pathoflegend/players?limit=1000`+(cursor?'&after='+encodeURIComponent(cursor):''));
      if(!Array.isArray(data.items))throw Error('Ranglistenformat ungültig');
      for(const p of data.items){
       if(!/^#[0289PYLQGRJCUV]{3,15}$/.test(p.tag)||typeof p.name!=='string'||!Number.isInteger(p.rank)||p.rank<1||!Number.isFinite(p.eloRating)||p.eloRating<0||tags.has(p.tag))throw Error('Ranglisteneintrag ungültig');
       tags.add(p.tag);entries.push({tag:p.tag,name:p.name,rank:p.rank,score:p.eloRating});
      }
      cursor=data.paging?.cursors?.after;
      if(!cursor)return {...def,entries,updatedAt:new Date(now()).toISOString(),error:false,partial:false};
      if(typeof cursor!=='string'||cursors.has(cursor))throw Error('Ranglistenseite wiederholt');cursors.add(cursor);
     }
     throw Error('Rangliste nur teilweise abrufbar');
    }catch{return old?{...old,error:true,partial:false}:{...def,entries,updatedAt:entries.length?new Date(now()).toISOString():null,error:true,partial:entries.length>0};}
   }));
   // A failed or partial read must not replace the last complete snapshot.
   const next=result.filter(b=>!b.error).concat(saved.filter(old=>!result.some(b=>b.id===old.id&&!b.error)));
   await storage.write('ranked-player-boards',next);cached=result;return result;
  })();try{return await pending;}finally{pending=null;}
 }
 return async tag=>{
  if(!familyTags.includes(tag))throw fail(400,'Ungültige Clanauswahl');
  const [roster,boards]=await Promise.all([members(tag),load()]);const current=new Map(roster.members.map(p=>[p.tag,p]));
  return {clan:tag,membersUpdatedAt:roster.updatedAt,boards:boards.map(b=>({id:b.id,name:b.name,updatedAt:b.updatedAt,error:b.error,partial:b.partial,checked:b.entries.length,rows:b.entries.filter(p=>current.has(p.tag)).map(p=>({...p,name:current.get(p.tag).name})).sort((a,b)=>a.rank-b.rank)}))};
 };
}
