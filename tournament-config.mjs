export const defaultConfig=()=>({leagues:[1,2,3].map(id=>({id,up:id>1?3:0,down:id<3?3:0,finals:id===1?4:1}))});
export function validateConfig(value){
 const fail=message=>{throw Object.assign(Error(message),{status:400});};
 if(!Array.isArray(value?.leagues)||value.leagues.length<1||value.leagues.length>12)fail('Bitte 1 bis 12 Ligen wählen.');
 const leagues=value.leagues.map((row,index)=>{const rule={id:index+1};for(const key of ['up','down','finals']){const limit=key==='finals'?32:100;if(!Number.isInteger(row?.[key])||row[key]<0||row[key]>limit)fail('Auf- und Abstieg: 0 bis 100. Finals-Plätze: 0 bis 32.');rule[key]=row[key];}return rule;});
 const total=leagues.reduce((sum,l)=>sum+l.finals,0);if(total<2||total>32)fail('Insgesamt müssen sich 2 bis 32 Spieler für die Finals qualifizieren.');if(leagues[0].finals<1)fail('Liga 1 benötigt mindestens einen Finals-Platz für das Upper Bracket.');
 return {leagues};
}
