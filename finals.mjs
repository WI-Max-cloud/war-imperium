import {leagueStandings} from './league-core.mjs';
const status=document.getElementById('finals-status'),slots=document.getElementById('finals-slots'),button=document.getElementById('refresh-finals');
async function load(){
 button.disabled=true;status.textContent='Tabellen werden geladen …';
 try{
  const response=await fetch('/api/leagues');const data=await response.json();if(!response.ok)throw Error(data.error||'Tabellen konnten nicht geladen werden.');
  const fragment=document.createDocumentFragment();
  for(const [leagueId,rank] of [[1,1],[1,2],[1,3],[1,4],[2,1],[3,1]]){
   const league=data.state.leagues.find(l=>l.id===leagueId),player=league?leagueStandings(league)[rank-1]:null;
   const card=document.createElement('article');card.className='finals-slot';const heading=document.createElement('h3');heading.textContent=`Liga ${leagueId} · Platz ${rank}`;
   const name=document.createElement('strong');name.textContent=player?.name??'Noch nicht besetzt';const info=document.createElement('p');info.textContent=player?`${player.points} Punkte · ${player.won}:${player.lost} Matches · ${player.games} Spiele`:'Wird nach dem Tabellenstand der Liga angezeigt.';
   card.append(heading,name,info);fragment.append(card);
  }
  slots.replaceChildren(fragment);status.textContent=`Stand geladen: ${new Date().toLocaleString('de-DE')}`;
 }catch(e){status.textContent=`${e.message} Bitte erneut versuchen.`;}finally{button.disabled=false;}
}
button.onclick=load;load();
