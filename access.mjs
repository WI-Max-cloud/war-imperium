import {createHash,timingSafeEqual} from 'node:crypto';
const digest=value=>createHash('sha256').update(value).digest();
export function authorized(header,env=process.env){
 if(!env.APP_PASSWORD)return env.RENDER!=='true';
 if(typeof header!=='string'||!header.startsWith('Basic '))return false;
 const supplied=Buffer.from(header.slice(6),'base64').toString('utf8');
 return timingSafeEqual(digest(supplied),digest(`${env.APP_USER||'admin'}:${env.APP_PASSWORD}`));
}
export function sameOrigin(req,env=process.env){
 if(!req.headers.origin)return true;
 const expected=env.PUBLIC_ORIGIN||env.RENDER_EXTERNAL_URL||`http://${req.headers.host}`;
 try{return new URL(req.headers.origin).origin===new URL(expected).origin;}catch{return false;}
}
