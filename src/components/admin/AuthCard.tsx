import { FormEvent, useState } from 'react';
import { supabase } from '../../lib';
function AuthCard({mode,onSession}:{mode:'admin'|'partner';onSession?:(s:any)=>void}){
 const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
 const submit=async(e:FormEvent)=>{e.preventDefault();setError('');if(!supabase)return;setBusy(true);const normalized=email.trim().toLowerCase();const {data,error:loginError}=await supabase.auth.signInWithPassword({email:normalized,password});if(loginError||!data.session){setBusy(false);setError('E-Mail oder Passwort ist nicht korrekt.');return}
   const {data:role}=await supabase.from('user_roles').select('role').eq('user_id',data.session.user.id).maybeSingle();
   if(mode==='admin' && role?.role!=='admin'){await supabase.auth.signOut();setBusy(false);setError('Dieses Konto hat keinen Adminzugriff.');return}
   if(mode==='partner' && role?.role!=='partner'){await supabase.auth.signOut();setBusy(false);setError('Dieses Konto ist keinem WASCHMATIK-Partner zugeordnet.');return}
   onSession?.(data.session);setBusy(false);
 };
 return <main><section className="page-top"><div className="shell"><div className="auth-wrap"><div className="card auth-card"><div className="eyebrow">GESCHÜTZTER BEREICH</div><h1>{mode==='admin'?'Admin-Login':'Partner-Login'}</h1><p>Sicherer Login über Supabase Auth.</p><form onSubmit={submit}><label>E-Mail</label><input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/><label>Passwort</label><input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/>{error&&<div className="form-error">{error}</div>}<button className="primary full" disabled={busy}>{busy?'Wird geprüft …':'Weiter'}</button></form></div></div></div></section></main>
}
export default AuthCard;
