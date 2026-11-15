export const berlinToday=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function validJoinedOn(value,today=berlinToday()){
 if(value==='')return true;
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+'T00:00:00Z');
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value&&value>='2016-01-01'&&value<=today;
}
export function membershipRows(weeks,members,profiles={},today=berlinToday()){
 const ordered=[...weeks].sort((a,b)=>a.season-b.season||a.section-b.section);
 return [...members].sort((a,b)=>a.name.localeCompare(b.name,'de')).map(member=>{
  const firstWar=ordered.find(w=>w.players.some(p=>p.tag===member.tag&&p.attacks>0))??null;
  const joinedOn=profiles[member.tag]?.joinedOn??'';
  const days=joinedOn&&validJoinedOn(joinedOn,today)?Math.round((Date.parse(today+'T00:00:00Z')-Date.parse(joinedOn+'T00:00:00Z'))/86400000):null;
  return {...member,joinedOn,days,firstWar};
 });
}
