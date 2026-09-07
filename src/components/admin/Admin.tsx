import { useEffect, useState } from 'react';
import { supabase } from '../../lib';
import BackendRequired from '../shared/BackendRequired';
import AuthCard from './AuthCard';
import AdminDashboard from './AdminDashboard';

function Admin({onToast}:{onToast:(x:string)=>void}){
  const [session,setSession]=useState<any>(null);
  const [checked,setChecked]=useState(false);
  const [allowed,setAllowed]=useState(false);
  useEffect(()=>{
    let alive=true;
    (async()=>{
      if(!supabase){setChecked(true);return}
      const {data}=await supabase.auth.getSession();
      if(!alive)return;
      if(data.session){
        const {data:role}=await supabase.from('user_roles').select('role').eq('user_id',data.session.user.id).eq('role','admin').maybeSingle();
        if(role){setSession(data.session);setAllowed(true)} else {await supabase.auth.signOut();setSession(null);setAllowed(false)}
      }
      setChecked(true);
    })();
    const {data:sub}=supabase?.auth.onAuthStateChange((_event,s)=>{if(alive)setSession(s)})||{data:{subscription:{unsubscribe(){}}}} as any;
    return()=>{alive=false;sub?.subscription?.unsubscribe()};
  },[]);
  if(!supabase)return <BackendRequired title="Admin-Bereich"/>;
  if(!checked)return <main><section className="page-top"><div className="shell"><div className="empty loading">Sicherheit wird geprüft …</div></div></section></main>;
  if(!session||!allowed)return <AuthCard mode="admin" onSession={s=>{setSession(s);setAllowed(true)}}/>;
  return <AdminDashboard onToast={onToast}/>;
}
export default Admin;
