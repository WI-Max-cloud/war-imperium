import {familyTags} from './family-stats.mjs';
const offsets={common:0,rare:2,epic:5,legendary:8,champion:10};
const fail=(status,message)=>Object.assign(Error(message),{status});
// API levels start at one within each rarity; in-game starting levels are 1/3/6/9/11.
export function cardLevel(card,catalog=[]){
 const rarity=card.rarity??catalog.find(c=>c.id===card.id)?.rarity;
 if(!Number.isInteger(card.level)||card.level<1||offsets[rarity]===undefined)return null;
 return card.level+offsets[rarity];
}
export function accountAgeFromBadges(badges,now=new Date()){
 const totalDays=badges?.find(b=>b.name==='YearsPlayed')?.progress;
 if(!Number.isInteger(totalDays)||totalDays<=0||totalDays>20000)return null;
 // Interpret the day counter on a calendar date, without inventing an exact creation time.
 const asOf=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const estimatedCreatedOn=new Date(Date.parse(asOf+'T00:00:00Z')-totalDays*86400000).toISOString().slice(0,10);
 return {totalDays,years:Math.floor(totalDays/365),weeks:Math.floor(totalDays%365/7),days:totalDays%365%7,estimatedCreatedOn,asOf,source:'YearsPlayed'};
}
export function summarizePlayer(p,catalog=null,now=new Date()){
 const items=Array.isArray(catalog?.items)?catalog.items:[];
 const card=c=>({id:c.id,name:c.name??'Karte',level:cardLevel(c,items),rarity:c.rarity??items.find(i=>i.id===c.id)?.rarity??null,evolutionLevel:c.evolutionLevel??null,starLevel:c.starLevel??null,elixirCost:c.elixirCost??null});
 const cards=[...new Map((p.cards??[]).map(c=>[c.id,card(c)])).values()];
 const normalIds=new Set(items.map(c=>c.id)),count16=cards.filter(c=>c.level===16&&(!items.length||normalIds.has(c.id))).length;
 const unknown=cards.filter(c=>c.level===null).length,distribution={};
 for(const c of cards)distribution[c.level??'unknown']=(distribution[c.level??'unknown']??0)+1;
 const metrics={};for(const key of ['collectionLevel','kingTowerLevel','currentWinLoseStreak','starPoints','legacyTrophyRoadHighScore','trophies','bestTrophies','expLevel','wins','losses','battleCount','threeCrownWins','challengeMaxWins','challengeCardsWon','tournamentCardsWon','tournamentBattleCount','totalDonations','donations','donationsReceived','warDayWins','clanCardsCollected'])if(Number.isFinite(p[key]))metrics[key]=p[key];
 const progress={};for(const key of ['arena','leagueStatistics','currentPathOfLegendSeasonResult','lastPathOfLegendSeasonResult','bestPathOfLegendSeasonResult','progress'])if(p[key]&&typeof p[key]==='object')progress[key]=p[key];
 return {name:p.name,tag:p.tag,clan:p.clan?{name:p.clan.name,tag:p.clan.tag}:null,role:p.role??null,metrics,progress,
  cards:{items:cards,count16:unknown?null:count16,knownCount16:count16,total:items.length||null,owned:cards.length,unknown,percent16:items.length&&!unknown?count16/items.length*100:null,distribution},
  currentDeck:(p.currentDeck??[]).map(card),supportCards:(p.supportCards??[]).map(card),currentSupportCards:(p.currentDeckSupportCards??[]).map(card),favoriteCard:p.currentFavouriteCard?card(p.currentFavouriteCard):null,
  badges:(p.badges??[]).map(b=>({name:b.name,level:b.level,progress:b.progress,target:b.target})),achievements:(p.achievements??[]).map(a=>({name:a.name,value:a.value,target:a.target,stars:a.stars})),
  accountCreatedAt:null,accountAge:accountAgeFromBadges(p.badges,now),updatedAt:now.toISOString()};
}
export function playerStatistics(storage,api,configured=()=>true){
 const cache=new Map(),pending=new Map();
 async function cached(key,ttl,load){
  const value=cache.get(key);if(value&&Date.now()-value.at<ttl)return value.data;
  if(pending.has(key))return pending.get(key);
  if(pending.size>=8)throw fail(429,'Viele Statistikabrufe laufen. Bitte kurz warten.');
  const request=Promise.resolve().then(load).then(data=>{cache.delete(key);cache.set(key,{at:Date.now(),data});while(cache.size>260)cache.delete(cache.keys().next().value);return data;}).finally(()=>pending.delete(key));pending.set(key,request);return request;
 }
 function validate(tag){if(!familyTags.includes(tag))throw fail(400,'Ungültige Clanauswahl');if(!configured())throw fail(503,'Spielerstatistiken sind verfügbar, sobald der API-Zugang eingerichtet ist.');}
 async function members(tag){
  validate(tag);return cached('members-'+tag,300000,async()=>{
   const all=[];let cursor;const seen=new Set();
   for(let page=0;page<3;page++){
    const data=await api('clans/%23'+tag+'/members?limit=50'+(cursor?'&after='+encodeURIComponent(cursor):''));
    if(!Array.isArray(data.items)||data.items.some(m=>typeof m.name!=='string'||!/^#[0289PYLQGRJCUV]+$/.test(m.tag)))throw fail(502,'API-Mitgliederliste ungültig.');
    all.push(...data.items.map(m=>({tag:m.tag,name:m.name})));cursor=data.paging?.cursors?.after;
    if(!cursor)break;if(seen.has(cursor)||page===2)throw fail(502,'API-Mitgliederliste unvollständig.');seen.add(cursor);
   }
   return {clan:tag,members:[...new Map(all.map(m=>[m.tag,m])).values()].sort((a,b)=>a.name.localeCompare(b.name,'de')),updatedAt:new Date().toISOString()};
  });
 }
 async function player(tag,playerTag){
  validate(tag);if(typeof playerTag!=='string'||!/^#[0289PYLQGRJCUV]{3,15}$/.test(playerTag))throw fail(400,'Ungültiger Spielertag.');
  const list=await members(tag);if(!list.members.some(m=>m.tag===playerTag))throw fail(404,'Spieler ist nicht in der aktuellen Mitgliederliste dieses Clans.');
  return cached('player-'+tag+'-'+playerTag,300000,async()=>{
   const p=await api('players/'+encodeURIComponent(playerTag));
   if(p.tag!==playerTag||typeof p.name!=='string')throw fail(502,'API-Spielerprofil ungültig.');
   if(p.clan?.tag!=='#'+tag){cache.delete('members-'+tag);throw fail(409,'Der Spieler hat inzwischen den Clan gewechselt. Bitte die Mitgliederliste aktualisieren.');}
   let catalog;try{catalog=await cached('catalog',3600000,()=>api('cards'));}catch{catalog=null;}
   return summarizePlayer(p,catalog);
  });
 }
 return {members,player};
}
