import { useEffect, useState } from 'react';
import { Activity, ArrowRight, Building2, FileText, Home as HomeIcon, Users, Wallet } from 'lucide-react';
import { cls, supabase } from '../../lib';
import type { AppRow, Business, Inquiry, Invoice } from '../../types';
import AdminHome from './AdminHome';
import AdminBusinesses from './AdminBusinesses';
import AdminApps from './AdminApps';
import AdminInquiries from './AdminInquiries';
import AdminInvoices from './AdminInvoices';
import AdminAudit from './AdminAudit';

async function loadAll(){
 if(!supabase) return {biz:[],apps:[],inq:[],inv:[]};
 const {data:partners}=await supabase.from('partners').select('*').order('created_at',{ascending:false});
 const {data:areas}=await supabase.from('partner_service_areas').select('partner_id,postal_code');
 const areaMap=new Map<string,string[]>();(areas||[]).forEach((a:any)=>areaMap.set(a.partner_id,[...(areaMap.get(a.partner_id)||[]),a.postal_code]));
 const biz=(partners||[]).map((p:any)=>({id:p.id,name:p.business_name,contact_name:p.contact_name,email:p.email,phone:p.phone,street:p.street,house_number:p.house_number,postal_code:p.postal_code,city:p.city,website:p.website,description:p.description,status:p.status,commission_percent:Number(p.commission_percent||5),service_area:areaMap.get(p.id)||[]})) as Business[];
 const {data:rows}=await supabase.from('repair_requests').select('id,customer_id,brand,model,problem_description,preferred_date,preferred_time,postal_code,city,status,created_at,updated_at, customers(first_name,last_name,email,phone), request_assignments(partner_id,is_primary), orders(id,partner_id,status,job_value,commission_percent,commission_amount,invoice_number,invoice_status,invoice_due_at,invoice_paid_at,created_at)').order('created_at',{ascending:false});
 const inq:Inquiry[]=(rows||[]).map((r:any)=>{const c=r.customers||{};const ra=(r.request_assignments||[]).find((x:any)=>x.is_primary) || r.request_assignments?.[0];const o=(r.orders||[]).find((x:any)=>x.partner_id===ra?.partner_id) || r.orders?.[0];const p=biz.find(x=>x.id===ra?.partner_id);return {id:r.id,request_id:r.id,request_code:`WM-${r.id.slice(0,8).toUpperCase()}`,partner_id:ra?.partner_id||o?.partner_id||null,business_name:p?.name||null,customer_id:r.customer_id,customer_name:[c.first_name,c.last_name].filter(Boolean).join(' '),customer_phone:c.phone||'',customer_email:c.email||'',customer_postal_code:r.postal_code,customer_city:r.city,brand:r.brand,model:r.model,problem:(r.problem_description||'').split(' – ')[0],problem_description:r.problem_description,status:r.status,order_value:Number(o?.job_value||0),commission_amount:Number(o?.commission_amount||0),commission_percentage:Number(o?.commission_percent||p?.commission_percent||5),invoice_number:o?.invoice_number||null,invoice_status:o?.invoice_status||null,invoice_due_at:o?.invoice_due_at||null,invoice_paid_at:o?.invoice_paid_at||null,preferred_date:r.preferred_date,preferred_time:r.preferred_time,created_at:r.created_at,updated_at:r.updated_at};});
 const now=Date.now();const inv:Invoice[]=inq.filter(x=>x.invoice_number).map(x=>{const due=x.invoice_due_at||x.created_at;const raw=(x.invoice_status||'offen') as any;const status=raw==='offen'&&new Date(due).getTime()<now?'überfällig':raw;return {id:x.request_id,invoice_number:x.invoice_number!,request_id:x.request_id,business_id:x.partner_id||'',business_name:x.business_name,order_value:x.order_value,commission_percentage:x.commission_percentage,commission_amount:x.commission_amount,status,due_at:due,paid_at:x.invoice_paid_at,created_at:x.created_at};});
 return {biz:biz as any,apps:biz.filter((x:any)=>x.status==='pending') as any,inq,inv};
}

function AdminDashboard({onToast}:{onToast:(x:string)=>void}){
 const [tab,setTab]=useState('dashboard');const [biz,setBiz]=useState<Business[]>([]);const [apps,setApps]=useState<AppRow[]>([]);const [inq,setInq]=useState<Inquiry[]>([]);const [inv,setInv]=useState<Invoice[]>([]);const [loading,setLoading]=useState(true);
 const refresh=async()=>{setLoading(true);const all=await loadAll();setBiz(all.biz);setApps(all.apps);setInq(all.inq);setInv(all.inv);setLoading(false)};
 useEffect(()=>{void refresh()},[]);
 if(loading)return <main><section className="page-top"><div className="shell"><div className="empty loading"><Activity className="spin"/> Admin-Daten werden geladen …</div></div></section></main>;
 const completed=inq.filter(x=>x.status==='completed');const volume=completed.reduce((s,x)=>s+x.order_value,0);const commission=completed.reduce((s,x)=>s+x.commission_amount,0);
 return <main className="admin-page"><div className="admin-shell"><aside className="admin-side"><div className="admin-brand">WASCH<span>MATIK</span><small>Administration</small></div>{[['dashboard',HomeIcon,'Dashboard'],['businesses',Building2,'Reparaturbetriebe'],['applications',Users,'Partneranfragen'],['inquiries',FileText,'Kundenanfragen'],['invoices',Wallet,'Abrechnungen'],['audit',Activity,'Audit-Log']].map(([k,I,t])=>{const Icon=I as any;return <button className={cls('side-btn',tab===k&&'active')} onClick={()=>setTab(k as string)} key={k as string}><Icon size={18}/>{t as string}</button>})}<button className="side-btn" onClick={()=>window.location.href='https://waschmatik.de/'}><ArrowRight size={18}/>Öffentliche Website</button><button className="side-btn danger" onClick={()=>void supabase?.auth.signOut()}>Abmelden</button></aside><section className="admin-content">{tab==='dashboard'&&<AdminHome biz={biz} apps={apps} inq={inq} inv={inv} volume={volume} commission={commission}/>} {tab==='businesses'&&<AdminBusinesses biz={biz} refresh={refresh}/>} {tab==='applications'&&<AdminApps apps={apps} refresh={refresh}/>} {tab==='inquiries'&&<AdminInquiries inq={inq} refresh={refresh} onToast={onToast}/>} {tab==='invoices'&&<AdminInvoices inv={inv} refresh={refresh}/>} {tab==='audit'&&<AdminAudit/>}</section></div></main>;
}
export default AdminDashboard;
