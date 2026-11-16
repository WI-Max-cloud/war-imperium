const trigger=document.getElementById('admin-login');
if(trigger){
 const dialog=document.createElement('dialog');dialog.className='auth-dialog';dialog.setAttribute('aria-labelledby','admin-dialog-title');
 dialog.innerHTML='<h2 id="admin-dialog-title">Admin-login</h2><p>Mit deinem bestehenden Admin-Zugang erhältst du vollen Zugriff auf Clankrieg und Turnierverwaltung.</p><form><label>Benutzername<input name="username" autocomplete="username" required></label><label>Passwort<input name="password" type="password" autocomplete="current-password" required></label><p class="auth-error" role="alert"></p><div class="auth-dialog-actions"><button type="submit">Anmelden</button><button type="button" data-cancel>Abbrechen</button></div></form>';
 document.body.append(dialog);
 const form=dialog.querySelector('form'),username=form.elements.username,password=form.elements.password,error=dialog.querySelector('.auth-error'),submit=form.querySelector('[type=submit]');
 let role='guest';
 function showRole(value){role=value;trigger.textContent=role==='admin'?'Admin abmelden':'Admin-login';trigger.setAttribute('aria-label',trigger.textContent);}
 async function refresh(){try{const r=await fetch('/api/session');if(!r.ok)throw Error();const d=await r.json();showRole(d.role);username.value=d.adminUser||'admin';}catch{trigger.textContent='Admin-login';}}
 async function request(path,body){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-War-Imperium':'local'},body:body?JSON.stringify(body):undefined});const d=await r.json();if(!r.ok)throw Error(d.error||'Anfrage fehlgeschlagen');return d;}
 trigger.onclick=async()=>{
  if(role==='admin'){trigger.disabled=true;try{await request('/api/logout');showRole('guest');document.dispatchEvent(new CustomEvent('wi-auth-change',{detail:{role:'guest'}}));}catch{trigger.textContent='Abmelden erneut versuchen';}finally{trigger.disabled=false;}return;}
  error.textContent='';password.value='';dialog.showModal();username.focus();
 };
 dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>password.value='');
 form.onsubmit=async event=>{event.preventDefault();submit.disabled=true;error.textContent='';try{const d=await request('/api/login',{username:username.value.trim(),password:password.value,admin:true});password.value='';showRole(d.role);dialog.close();document.dispatchEvent(new CustomEvent('wi-auth-change',{detail:{role:d.role}}));}catch(e){error.textContent=e.message;password.value='';}finally{submit.disabled=false;}};
 await refresh();
 if(location.hash==='#admin-login'&&role!=='admin')trigger.click();
 window.addEventListener('hashchange',()=>{if(location.hash==='#admin-login'&&role!=='admin'&&!dialog.open)trigger.click();});
 window.addEventListener('pageshow',()=>refresh());
}
