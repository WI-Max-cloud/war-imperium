import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
const cookieName='wi_player';
function signature(value,env){return createHmac('sha256',`${env.APP_PASSWORD??''}\0${env.PLAYER_PASSWORD??''}\0${env.VICE_PASSWORD??''}`).update(value).digest('hex');}
export function issueSession(role,env=process.env,now=Date.now()){
 if(!['admin','player','vice','guest'].includes(role))throw Error('Ungültige Rolle');
 const user=role==='admin'?(env.APP_USER||'admin'):role==='player'?(env.PLAYER_USER||'Spieler'):role==='vice'?(env.VICE_USER||'Vize'):'guest';
 const payload=Buffer.from(JSON.stringify({role,user,expires:now+8*3600000,nonce:randomBytes(16).toString('hex')})).toString('base64url');
 return `${payload}.${signature(payload,env)}`;
}
export function issuePlayerSession(env=process.env,now=Date.now()){return issueSession('player',env,now);}
export function sessionRole(cookies,env=process.env,now=Date.now()){
 if(typeof cookies!=='string')return null;
 const token=cookies.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);
 if(!token||token.length>1024)return null;
 const [payload,mac,...extra]=token.split('.');if(extra.length||!payload||!mac||!/^[a-f0-9]{64}$/.test(mac))return null;
 if(!timingSafeEqual(Buffer.from(mac,'hex'),Buffer.from(signature(payload,env),'hex')))return null;
 try{const data=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));const role=data.role||'player';const valid=role==='admin'?env.APP_PASSWORD&&data.user===(env.APP_USER||'admin'):role==='player'?env.PLAYER_PASSWORD&&data.user===(env.PLAYER_USER||'Spieler'):role==='vice'?env.VICE_PASSWORD&&data.user===(env.VICE_USER||'Vize'):role==='guest'&&data.user==='guest';return valid&&Number.isFinite(data.expires)&&data.expires>now&&data.expires<=now+8*3600000?role:null;}catch{return null;}
}
export function sessionCookie(token,secure=false){return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${token?28800:0}${secure?'; Secure':''}`;}
