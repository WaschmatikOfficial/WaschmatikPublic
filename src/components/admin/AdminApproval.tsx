import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib';
function AdminApproval(){
 const token=new URLSearchParams(location.hash.includes('?')?location.hash.split('?')[1]:'').get('token')||''; const [state,setState]=useState<'idle'|'busy'|'ok'|'error'>('idle'); const [message,setMessage]=useState('Dieser Link ist 5 Minuten gültig und kann nur einmal verwendet werden.');
 const approve=async()=>{if(!supabase||!token)return;setState('busy');const {data,error}=await supabase.functions.invoke('approve-admin-login',{body:{token}});if(error||!data?.ok){setState('error');setMessage(error?.message||data?.message||'Freigabe fehlgeschlagen.');return}setState('ok');setMessage('Der Admin-Login wurde freigegeben. Das wartende Gerät kann den Adminbereich jetzt öffnen.');};
 return <main><section className="page-top"><div className="shell auth-wrap"><div className="card auth-card"><div className="eyebrow">WASCHMATIK SICHERHEIT</div><h1>Admin-Login freigeben</h1><p>{message}</p>{state==='idle'&&<button className="primary full" onClick={approve}>Adminzugriff freigeben</button>}{state==='busy'&&<button className="primary full" disabled>Freigabe wird verarbeitet …</button>}{state==='ok'&&<div className="security-success"><CheckCircle2 size={26}/><b>Freigabe erfolgreich</b></div>}{state==='error'&&<div className="form-error">{message}</div>}</div></div></section></main>
}

export default AdminApproval;
