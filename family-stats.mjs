export const familyTags=['22QJG0','PRUUQGRQ','L8GLPYRQ','QJJ9QYYQ','RPC9GR9V'];
export function familyStats(storage,api,configured=()=>true){
 let pending,lastAttempt=0;
 return async()=>{
  if(pending)return pending;
  pending=(async()=>{
   const saved=await storage.read('family-stats',[]),now=Date.now();
   if(!configured()||now-lastAttempt<600000||saved.length===5&&saved.every(c=>now-Date.parse(c.updatedAt)<600000))return {clans:saved,configured:configured()};
   lastAttempt=now;const clans=[];
   for(const tag of familyTags){const previous=saved.find(c=>c.tag===tag);
    try{const clan=await api('clans/%23'+tag,true);if(typeof clan.name!=='string'||!Number.isInteger(clan.members)||clan.members<0||clan.members>50||!Number.isInteger(clan.clanWarTrophies)||clan.clanWarTrophies<0)throw Error('Ungültige Clandaten');
     clans.push({tag,name:clan.name,members:clan.members,warTrophies:clan.clanWarTrophies,updatedAt:new Date().toISOString()});
    }catch{clans.push({...previous,tag,members:previous?.members??null,warTrophies:previous?.warTrophies??null,updatedAt:previous?.updatedAt??null,error:true});}
   }
   await storage.write('family-stats',clans);return {clans,configured:true};
  })();try{return await pending;}finally{pending=null;}
 };
}
