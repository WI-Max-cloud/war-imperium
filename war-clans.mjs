export const warClans=[{tag:'22QJG0',name:'War Imperium',record:140300},{tag:'PRUUQGRQ',name:'War Imperium II',record:null}];
export function warClan(tag='22QJG0'){return warClans.find(c=>c.tag===tag);}
export function clanStorage(storage,tag){
 if(!warClan(tag))throw Error('Ungültige Clanauswahl');
 const key=name=>tag==='22QJG0'?name:`clan-${tag.toLowerCase()}-${name}`;
 return {remote:storage.remote,read:(name,fallback)=>storage.read(key(name),fallback),write:(name,value)=>storage.write(key(name),value)};
}
