export const normalized = (points, attacks) => attacks > 0 ? Math.trunc(points / attacks * 16) : null;
export function attendanceWeeks(weeks){return weeks.filter(w=>w.season>137||(w.season===137&&w.section>=2)).sort((a,b)=>b.season-a.season||b.section-a.section);}
export function missingAttacks(week,members,onlyMembers){return filterMembers(week?.players??[],members,onlyMembers).filter(p=>p.attacks>0&&p.attacks<16).sort((a,b)=>a.attacks-b.attacks||a.name.localeCompare(b.name,'de'));}
export function weeklyTrend(weeks) {
  return [...weeks].sort((a,b)=>b.season-a.season||b.section-a.section).slice(0,10).reverse().map(w=>({
    id:w.id,season:w.season,section:w.section,
    date:typeof w.date==='string' && /^\d{8}T/.test(w.date)?`${w.date.slice(6,8)}.${w.date.slice(4,6)}.${w.date.slice(0,4)}`:null,
    points:w.players.reduce((sum,p)=>sum+p.points,0)
  }));
}
export function filterMembers(rows, members, enabled) {
  if (!enabled) return rows;
  const tags = new Set((members || []).map(m => m.tag));
  return rows.filter(row => tags.has(row.tag));
}
export function parseLog(items,clanTag='#22QJG0') {
  return items.map(item => {
    if (!Number.isInteger(item.seasonId) || !Number.isInteger(item.sectionIndex)) throw Error('Unbekanntes Wochenformat');
    const clan = item.standings?.find(s => s.clan?.tag === clanTag)?.clan;
    if (!Array.isArray(clan?.participants)) throw Error('Clan oder Teilnehmer fehlen im API-Ergebnis');
    return {id: `${item.seasonId}-${item.sectionIndex}`, season: item.seasonId, section: item.sectionIndex, date: item.createdDate, players: clan.participants.map(p => {
      if (typeof p.tag !== 'string' || typeof p.name !== 'string' || !Number.isInteger(p.fame) || p.fame < 0 || !Number.isInteger(p.decksUsed) || p.decksUsed < 0) throw Error('Punkte oder decksUsed fehlen/ungültig');
      return {tag:p.tag,name:p.name,points:p.fame,attacks:p.decksUsed};
    })};
  });
}
export function rankings(weeks, selected, window) {
  const ordered = [...weeks].sort((a,b)=>b.season-a.season || b.section-a.section);
  const index = ordered.findIndex(w=>w.id===selected);
  const slice = ordered.slice(index,index+window);
  const players = new Map();
  for (const week of slice) for (const p of week.players) {
    if (!players.has(p.tag)) players.set(p.tag,{...p,values:[],recorded:0});
    const row=players.get(p.tag); row.recorded++;
    const n=normalized(p.points,p.attacks); if(n!==null) row.values.push(n);
  }
  return [...players.values()].map(p=>({...p,value:p.values.length ? p.values.reduce((a,b)=>a+b,0)/p.values.length : null, count:p.values.length,available:slice.length})).sort((a,b)=>(b.value??-1)-(a.value??-1)||a.tag.localeCompare(b.tag));
}
export function demo() {
 return Array.from({length:20},(_,i)=>({id:`demo-${i}`,season:140-Math.floor(i/4),section:3-i%4,date:'Demo',players:['König Max','Imperium','Drachenherz','Turmwache','Royal'].map((name,j)=>({tag:`#DEMO${j}`,name,points:1200+((i*137+j*331)%2000),attacks:j===4?0:8+((i+j)%9)}))}));
}
