import {createHash,timingSafeEqual} from 'node:crypto';
const digest=value=>createHash('sha256').update(value).digest();
export function accessRole(header,env=process.env){
 if(!env.APP_PASSWORD)return env.RENDER!=='true'?'admin':null;
 if(typeof header!=='string'||!header.startsWith('Basic '))return null;
 const supplied=Buffer.from(header.slice(6),'base64').toString('utf8');
 if(timingSafeEqual(digest(supplied),digest(`${env.APP_USER||'admin'}:${env.APP_PASSWORD}`)))return 'admin';
 if(env.PLAYER_PASSWORD&&timingSafeEqual(digest(supplied),digest(`${env.PLAYER_USER||'Spieler'}:${env.PLAYER_PASSWORD}`)))return 'player';
 return null;
}
export const authorized=(header,env=process.env)=>!!accessRole(header,env);
export function playerRouteAllowed(method,path){return method==='GET'&&['/','/liga','/liga.html','/finals','/finals.html','/liga.mjs','/finals.mjs','/league-core.mjs','/finals-core.mjs','/style.css','/liga.css','/api/leagues','/api/finals'].includes(path)||method==='POST'&&['/api/leagues','/api/finals'].includes(path);}
export function sameOrigin(req,env=process.env){
 if(!req.headers.origin)return true;
 const expected=env.PUBLIC_ORIGIN||env.RENDER_EXTERNAL_URL||`http://${req.headers.host}`;
 try{return new URL(req.headers.origin).origin===new URL(expected).origin;}catch{return false;}
}
