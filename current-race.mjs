import {warClan} from './war-clans.mjs';
const num=v=>Number.isFinite(v)&&v>=0?v:null;
export function raceSummary(race,roster,tag,now=new Date()){
 if(race?.clan?.tag!=='#'+tag||!Array.isArray(race.clan.participants)||!Array.isArray(roster?.items))throw Error('API-Flussrennen oder Mitgliederliste unvollständig.');
 const current=race.clan,warDay=race.periodType==='warDay',period=Number.isInteger(race.periodIndex)?race.periodIndex:null;
 const clans=[...new Map([current,...(race.clans??[])].map(c=>[c.tag,c])).values()].map(c=>{
  const ps=Array.isArray(c.participants)?c.participants:null,valid=ps&&ps.every(p=>Number.isInteger(p.decksUsedToday)&&p.decksUsedToday>=0&&p.decksUsedToday<=4);
  const used=valid?ps.reduce((s,p)=>s+p.decksUsedToday,0):null,points=num(c.periodPoints);
  const remaining=used===null?null:Math.max(0,200-used),average=points!==null&&used>0?points/used:null;
  const projected=points===null||remaining===null?null:remaining===0?points:average===null?null:points+remaining*average;
  return {tag:c.tag,name:c.name,points,used,remaining,average,projected};
 }).sort((a,b)=>(b.projected??-1)-(a.projected??-1)||a.tag.localeCompare(b.tag));
 for(const c of clans)c.rank=c.projected===null?null:1+clans.filter(o=>o.projected!==null&&o.projected>c.projected).length;
 const byTag=new Map(current.participants.map(p=>[p.tag,p])),members=[...new Map(roster.items.map(m=>[m.tag,m])).values()],groups={1:[],2:[],3:[],4:[]};let unknown=0;
 for(const m of members){const p=byTag.get(m.tag),used=p?.decksUsedToday??(p?null:0);if(!Number.isInteger(used)||used<0||used>4){unknown++;continue;}if(used<4)groups[4-used].push({tag:m.tag,name:m.name,remaining:4-used});}
 for(const group of Object.values(groups))group.sort((a,b)=>a.name.localeCompare(b.name,'de'));
 return {clan:tag,name:current.name,updatedAt:now.toISOString(),state:race.state,periodType:race.periodType,week:Number.isInteger(race.sectionIndex)?race.sectionIndex+1:null,day:warDay&&period!==null&&period%7>=3?period%7-2:null,warDay,clans,groups,unknown,members:members.length,memberRemaining:unknown?null:Object.entries(groups).reduce((s,[n,rows])=>s+Number(n)*rows.length,0)};
}
export function currentRace(api,configured=()=>true){
 const cache=new Map(),pending=new Map();
 return async tag=>{
  if(!warClan(tag))throw Error('Ungültige Clanauswahl');if(!configured())throw Error('API-Schlüssel fehlt.');
  const saved=cache.get(tag);if(saved&&Date.now()-Date.parse(saved.updatedAt)<60000)return saved;
  if(pending.has(tag))return pending.get(tag);
  const request=Promise.all([api('clans/%23'+tag+'/currentriverrace'),api('clans/%23'+tag+'/members?limit=50')]).then(([race,members])=>{
   if(members.paging?.cursors?.after)throw Error('API-Mitgliederliste unvollständig.');const value=raceSummary(race,members,tag);cache.set(tag,value);return value;
  }).finally(()=>pending.delete(tag));pending.set(tag,request);return request;
 };
}
