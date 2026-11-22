import {randomUUID} from 'node:crypto';
export const defaultContent=()=>({revision:0,goals:[{title:'Gemeinsam stärker',text:'Als Clan zusammenhalten.'},{title:'Jeder Angriff zählt',text:'Im Clankrieg füreinander antreten.'},{title:'Fairer Wettbewerb',text:'In Liga und Finals alles geben.'}],news:[],gallery:[]});
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
function text(value,max){if(typeof value!=='string'||!value.trim()||value.trim().length>max)throw fail('Bitte alle Felder ausfüllen und die angegebene Textlänge beachten.');return value.trim();}
export function validateImage(value){
 if(typeof value!=='string'||value.length>1400000)throw fail('Bild zu groß. Bitte ein kleineres Bild wählen.');
 const match=/^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);if(!match)throw fail('Bitte ein gültiges JPG-Bild verwenden.');
 const bytes=Buffer.from(match[1],'base64');if(bytes.length>1000000||bytes.length<4||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255||bytes.at(-2)!==255||bytes.at(-1)!==217)throw fail('Ungültige oder zu große Bilddatei.');
 return match[1];
}
export function updateContent(current,input){
 if(input?.revision!==current.revision)throw fail('Die Seite wurde inzwischen geändert. Bitte neu laden und erneut versuchen.',409);
 const next=structuredClone(current),now=new Date().toISOString();let image;
 if(input.action==='goals'){
  if(!Array.isArray(input.goals)||input.goals.length<1||input.goals.length>8)throw fail('Bitte 1 bis 8 Clan-Ziele angeben.');
  next.goals=input.goals.map(g=>({title:text(g.title,100),text:text(g.text,350)}));
 }else if(input.action==='news-add'){
  if(next.news.length>=100)throw fail('Maximal 100 News. Bitte zuerst einen alten Beitrag löschen.');
  const category=input.category??'clan';if(!['turnier','liga','finals','clan'].includes(category))throw fail('Bitte eine gültige News-Kategorie auswählen.');
  next.news.unshift({id:randomUUID(),title:text(input.title,150),text:text(input.text,10000),category,createdAt:now});
 }else if(input.action==='news-delete'||input.action==='image-delete'){
  const list=input.action==='news-delete'?'news':'gallery';if(!next[list].some(n=>n.id===input.id))throw fail('Eintrag nicht gefunden.',404);next[list]=next[list].filter(n=>n.id!==input.id);
 }else if(input.action==='image-add'){
  if(next.gallery.length>=50)throw fail('Maximal 50 Bilder. Bitte zuerst ein altes Bild löschen.');
  image=validateImage(input.image);next.gallery.unshift({id:randomUUID(),title:text(input.title,150),createdAt:now});
 }else throw fail('Unbekannte Aktion.');
 next.revision++;return {next,image};
}
export function contentHandler(storage){let busy=false;return async(req,res,role,send)=>{
 if(req.url==='/api/content'&&req.method==='GET'){return send(200,{role,...await storage.read('website-content',defaultContent())});}
 if(req.method==='GET'&&/^\/api\/gallery-image\/[a-f0-9-]{36}$/.test(req.url)){
  const id=req.url.split('/').at(-1),content=await storage.read('website-content',defaultContent());if(!content.gallery.some(i=>i.id===id))return send(404,{error:'Bild nicht gefunden'});
  const image=await storage.read('gallery-image-'+id,null);if(!image)return send(404,{error:'Bild nicht gefunden'});
  res.writeHead(200,{'Content-Type':'image/jpeg','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});res.end(Buffer.from(image,'base64'));return;
 }
 if(req.url!=='/api/content'||req.method!=='POST')return false;
 if(role!=='admin')return send(403,{error:'Nur der Admin darf Inhalte bearbeiten.'});
 let body='',size=0;for await(const chunk of req){size+=Buffer.byteLength(chunk);if(size>1500000)return send(413,{error:'Bild oder Inhalt zu groß'});body+=chunk;}
 let input;try{input=JSON.parse(body);}catch{return send(400,{error:'Ungültige Eingabe'});}
 if(busy)return send(409,{error:'Speicherung läuft. Bitte erneut versuchen.'});busy=true;
 try{const {next,image}=updateContent(await storage.read('website-content',defaultContent()),input);
  if(image)await storage.write('gallery-image-'+next.gallery[0].id,image);
  await storage.write('website-content',next);
  if(input.action==='image-delete')await storage.write('gallery-image-'+input.id,null);
  return send(200,{role,...next});
 }catch(e){if(e.status)return send(e.status,{error:e.message});throw e;}finally{busy=false;}
 };}
