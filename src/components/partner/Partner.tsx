import { useEffect, useState } from 'react';
import { supabase } from '../../lib';
import AuthCard from '../admin/AuthCard';
import BackendRequired from '../shared/BackendRequired';
import PartnerDashboard from './PartnerDashboard';
function Partner({onToast}:{onToast:(x:string)=>void}){
 const [session,setSession]=useState<any>(null); const [checked,setChecked]=useState(false); const [allowed,setAllowed]=useState(false);
 useEffect(()=>{(async()=>{if(!supabase){setChecked(true);return}const {data}=await supabase.auth.getSession();setSession(data.session);if(data.session){const {data:r}=await supabase.from('user_roles').select('role,business_id').eq('user_id',data.session.user.id).eq('role','partner').maybeSingle();setAllowed(!!r?.business_id)}setChecked(true)})()},[]);
 if(!supabase)return <BackendRequired title="Partner-Bereich"/>;
 if(!checked)return <main><section className="page-top"><div className="shell"><div className="empty loading">Zugang wird geprüft …</div></div></section></main>;
 if(!session)return <AuthCard mode="partner" onSession={setSession}/>;
 if(!allowed)return <main><section className="page-top"><div className="shell auth-wrap"><div className="card auth-card"><h2>Kein Partnerzugriff</h2><p>Dieses Konto ist keinem aktiven WASCHMATIK-Partner zugeordnet.</p><button className="secondary" onClick={()=>void supabase.auth.signOut()}>Abmelden</button></div></div></section></main>;
 return <PartnerDashboard onToast={onToast}/>;
}
export default Partner;
