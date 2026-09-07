import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib';
import BackendRequired from '../shared/BackendRequired';
import AuthCard from './AuthCard';
import AdminDashboard from './AdminDashboard';
function Admin({onToast}:{onToast:(x:string)=>void}){
 const [session,setSession]=useState<any>(null); const [checked,setChecked]=useState(false); const [approved,setApproved]=useState(false);
 useEffect(()=>{
   let alive=true;
   (async()=>{
     if(!supabase){if(alive)setChecked(true);return}
     const {data}=await supabase.auth.getSession();
     if(!alive)return;
     if(data.session){
       // Every visit to /admin starts clean. Revoke any previous server-side approval.
       await supabase.functions.invoke('revoke-admin-access');
       await supabase.auth.signOut();
       if(alive)setSession(null);
     }
     if(alive)setChecked(true);
   })();
   return()=>{ alive=false; if(supabase) void supabase.functions.invoke('revoke-admin-access'); };
 },[]);
 if(!supabase)return <BackendRequired title="Admin-Bereich"/>;
 if(!checked)return <main><section className="page-top"><div className="shell"><div className="empty loading">Sicherheit wird geprüft …</div></div></section></main>;
 if(!session)return <AuthCard mode="admin" onApproved={()=>setApproved(true)} onSession={setSession}/>;
 if(!approved)return <main><section className="page-top"><div className="shell auth-wrap"><div className="card auth-card"><div className="eyebrow">ZWEITER FAKTOR</div><h1>Adminzugriff wartet auf Freigabe</h1><p>Nach E-Mail und Passwort muss der Login jedes Mal zusätzlich über die WASCHMATIK-Freigabe-Mail bestätigt werden.</p><div className="security-box"><ShieldCheck size={22}/><div><b>Freigabe erforderlich</b><span>Ohne bestätigte E-Mail-Freigabe gibt es keinen Zugriff auf Admin-Daten.</span></div></div><div className="row-actions"><button className="secondary" onClick={async()=>{await supabase?.functions.invoke('revoke-admin-access');await supabase?.auth.signOut();setSession(null)}}>Abbrechen</button><button className="primary" onClick={()=>location.reload()}>Erneut prüfen</button></div></div></div></section></main>;
 return <AdminDashboard onToast={onToast}/>;
}

export default Admin;
