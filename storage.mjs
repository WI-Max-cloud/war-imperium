import {readFile,writeFile,mkdir,rename,unlink} from 'node:fs/promises';

export function createStorage({directory,env=process.env,request=fetch}){
 const remote=!!env.SUPABASE_URL||!!env.SUPABASE_SECRET_KEY;
 if(remote&&(!env.SUPABASE_URL||!env.SUPABASE_SECRET_KEY))throw Error('SUPABASE_URL und SUPABASE_SECRET_KEY gemeinsam einrichten.');
 if(env.RENDER==='true'&&!remote)throw Error('Render benötigt dauerhaften Datenbankspeicher. Supabase einrichten.');
 const base=remote?new URL('/rest/v1/war_imperium_state',env.SUPABASE_URL):null;
 if(base&&base.protocol!=='https:')throw Error('Supabase benötigt HTTPS.');
 async function call(url,options={}){
  const key=env.SUPABASE_SECRET_KEY;
  const headers={apikey:key,'Content-Type':'application/json',...options.headers};
  if(!key.startsWith('sb_secret_'))headers.Authorization=`Bearer ${key}`;
  const response=await request(url,{...options,headers,signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error(`Datenbankspeicherung nicht verfügbar (Status ${response.status}).`);
  return response;
 }
 return {
  remote,
  async remove(key){
   if(!/^[a-z0-9-]+$/.test(key))throw Error('Ungültiger Speicherschlüssel');
   if(remote){const url=new URL(base);url.searchParams.set('key','eq.'+key);await call(url,{method:'DELETE',headers:{Prefer:'return=minimal'}});return;}
   try{await unlink(new URL(key+'.json',directory));}catch(error){if(error.code!=='ENOENT')throw error;}
  },
  async read(key,fallback){
   if(!/^[a-z0-9-]+$/.test(key))throw Error('Ungültiger Speicherschlüssel');
   if(remote){const url=new URL(base);url.searchParams.set('key','eq.'+key);url.searchParams.set('select','value');const rows=await (await call(url)).json();if(!Array.isArray(rows))throw Error('Ungültige Datenbankantwort');return rows.length?rows[0].value:fallback;}
   try{return JSON.parse(await readFile(new URL(key+'.json',directory),'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}
  },
  async write(key,value,{onlyNew=false}={}){
   if(!/^[a-z0-9-]+$/.test(key))throw Error('Ungültiger Speicherschlüssel');
   if(remote){const url=new URL(base);url.searchParams.set('on_conflict','key');await call(url,{method:'POST',headers:{Prefer:`resolution=${onlyNew?'ignore':'merge'}-duplicates,return=minimal`},body:JSON.stringify({key,value,updated_at:new Date().toISOString()})});return;}
   await mkdir(directory,{recursive:true});await writeFile(new URL(key+'.tmp',directory),JSON.stringify(value,null,2));await rename(new URL(key+'.tmp',directory),new URL(key+'.json',directory));
  }
 };
}
