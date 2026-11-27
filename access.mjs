import {createHash,timingSafeEqual} from 'node:crypto';
const digest=value=>createHash('sha256').update(value).digest();
export function accessRole(header,env=process.env){
 if(!env.APP_PASSWORD)return env.RENDER!=='true'?'admin':null;
 if(typeof header!=='string'||!header.startsWith('Basic '))return null;
 const supplied=Buffer.from(header.slice(6),'base64').toString('utf8');
 if(timingSafeEqual(digest(supplied),digest(`${env.APP_USER||'admin'}:${env.APP_PASSWORD}`)))return 'admin';
 if(env.PLAYER_PASSWORD&&timingSafeEqual(digest(supplied),digest(`${env.PLAYER_USER||'Spieler'}:${env.PLAYER_PASSWORD}`)))return 'player';
 if(env.VICE_PASSWORD&&timingSafeEqual(digest(supplied),digest(`${env.VICE_USER||'Vize'}:${env.VICE_PASSWORD}`)))return 'vice';
 return null;
}
export const authorized=(header,env=process.env)=>!!accessRole(header,env);
export const canScore=role=>['admin','player','vice'].includes(role);
export function viceRouteAllowed(method,path){return method==='GET'&&['/current-race-ui.mjs','/api/current-race','/clankrieg','/clankrieg/','/app.mjs','/core.mjs','/export.mjs','/api/history','/api/placements'].includes(path)||method==='POST'&&path==='/api/absence';}
export function publicRoute(method,path){return method==='GET'&&(/^\/api\/gallery-image\/[a-f0-9-]{36}$/.test(path)||['/clan-ranglisten','/clan-rankings-ui.mjs','/api/crown-rankings','/spielerstatistiken','/spielerstatistiken.html','/player-stats-ui.mjs','/api/statistics-members','/api/statistics-player','/tournament-config.mjs','/finals-builder.mjs','/turniere','/turniere.html','/tournaments-ui.mjs','/tournament-context.mjs','/api/tournaments','/api/family-stats','/menu-login.mjs','/navigation-update.css','/api/content','/api/clan-public','/content-ui.mjs','/content.css','/membership.mjs','/news','/news.html','/clans','/clans.html','/clan','/clan.html','/galerie','/galerie.html','/admin-auth.mjs','/','/index.html','/home.css','/home.mjs','/clan-portraits.png','/home-hero.png','/crest.svg','/site-auth.mjs','/site-auth.css','/liga','/liga.html','/finals','/finals.html','/liga.mjs','/finals.mjs','/league-core.mjs','/finals-core.mjs','/style.css','/liga.css','/responsive.mjs','/api/leagues','/api/finals','/api/session','/api/public-clan'].includes(path));}
export function sameOrigin(req,env=process.env){
 if(!req.headers.origin)return true;
 const expected=env.PUBLIC_ORIGIN||env.RENDER_EXTERNAL_URL||`http://${req.headers.host}`;
 try{return new URL(req.headers.origin).origin===new URL(expected).origin;}catch{return false;}
}
