import {readFile} from 'node:fs/promises';
import {createStorage} from './storage.mjs';
const data=new URL('./data/',import.meta.url);
const storage=createStorage({directory:data});
if(!storage.remote)throw Error('Zuerst SUPABASE_URL und SUPABASE_SECRET_KEY lokal eintragen.');
// Never replace an existing online archive or online attendance decisions.
const values=[];
for(const key of ['history','members','absences']){
 if(await storage.read(key,null)!==null)throw Error('Online-Daten existieren bereits. Import gestoppt; nichts überschrieben.');
 try{values.push([key,JSON.parse(await readFile(new URL(key+'.json',data),'utf8'))]);}catch(e){if(e.code!=='ENOENT')throw e;}
}
if(!values.some(([key,value])=>key==='history'&&Array.isArray(value)&&value.length))throw Error('Kein lokales Wochenarchiv vorhanden.');
for(const [key,value] of values)await storage.write(key,value,{onlyNew:true});
console.log('Lokale Wochen, Mitglieder und vorhandene Abmeldungen übertragen. Lokale Dateien unverändert.');
