import { useEffect, useState } from 'react';
import { Building2, FileText, Home as HomeIcon, Wallet } from 'lucide-react';
import { money, supabase } from '../../lib';
import type { Inquiry, Invoice } from '../../types';
import AdminHeader from '../admin/AdminHeader';

export default function PartnerDashboard({onToast}:{onToast:(x:string)=>void}){
  const [biz,setBiz]=useState<any>(null); const [inq,setInq]=useState<Inquiry[]>([]); const [inv,setInv]=useState<Invoice[]>([]);
  const load=async()=>{
    if(!supabase)return;
    const {data:role}=await supabase.from('user_roles').select('business_id').eq('user_id',(await supabase.auth.getUser()).data.user?.id||'').eq('role','partner').maybeSingle();
    if(!role?.business_id)return;
    const {data:b}=await supabase.from('businesses').select('*').eq('id',role.business_id).single(); setBiz(b);
    const a=await supabase.from('inquiries').select('*').eq('business_id',role.business_id).order('created_at',{ascending:false});
    const v=await supabase.from('invoices').select('*').eq('business_id',role.business_id).order('created_at',{ascending:false});
    setInq((a.data||[]) as Inquiry[]); setInv((v.data||[]) as Invoice[]);
  };
  useEffect(()=>{void load()},[]);
  const complete=async(i:Inquiry)=>{
    const raw=window.prompt(`Endgültigen Rechnungsbetrag für ${i.inquiry_id} eingeben:`); if(raw===null)return;
    const value=Number(raw); if(!Number.isFinite(value)||value<0){onToast('Ungültiger Betrag.');return}
    const {data:order,error}=await supabase!.rpc('complete_order',{p_inquiry_id:i.id,p_value:value});
    if(error){onToast(error.message);return}
    const {data:invoice}=await supabase!.from('invoices').select('id').eq('inquiry_id',i.id).maybeSingle();
    if(invoice){const mail=await supabase!.functions.invoke('send-invoice-email',{body:{invoice_id:invoice.id}});if(mail.error)onToast('Auftrag gespeichert, aber Abrechnungs-E-Mail konnte nicht gesendet werden.');}
    void order; onToast('Auftrag abgeschlossen und Abrechnung vorbereitet.'); await load()
  };
  return <main className="admin-page"><div className="admin-shell"><aside className="admin-side">
    <div className="admin-brand">WASCH<span>MATIK</span><small>Partner</small></div>
    <button className="side-btn active"><HomeIcon size={18}/>Dashboard</button>
    <button className="side-btn"><Building2 size={18}/>Betriebsdaten</button>
    <button className="side-btn"><FileText size={18}/>Eigene Anfragen</button>
    <button className="side-btn"><Wallet size={18}/>Eigene Abrechnungen</button>
    <button className="side-btn" onClick={()=>window.location.href='https://waschmatik.de/'}>Website</button>
    <button className="side-btn danger" onClick={()=>void supabase?.auth.signOut()}>Abmelden</button>
  </aside><section className="admin-content"><AdminHeader title={biz?.name||'Partnerdashboard'}/>
    <div className="stats-grid"><div className="stat-card"><span>Eigene Anfragen</span><strong>{inq.length}</strong></div><div className="stat-card"><span>Abgeschlossen</span><strong>{inq.filter(i=>i.status==='completed').length}</strong></div><div className="stat-card"><span>Rechnungen</span><strong>{inv.length}</strong></div><div className="stat-card"><span>Offene Provision</span><strong>{money(inv.filter(i=>i.status!=='bezahlt'&&i.status!=='storniert').reduce((s,i)=>s+Number(i.commission_amount||0),0))}</strong></div></div>
    <div className="card"><h3>Eigene Anfragen</h3>{inq.map(i=><div className="mini-row" key={i.id}><b>{i.inquiry_id}</b><span>{i.problem}</span><span className="badge">{i.status}</span>{i.status==='accepted'&&<button className="small primary" onClick={()=>complete(i)}>Reparatur abgeschlossen</button>}</div>)}{!inq.length&&<div className="empty small">Noch keine Daten vorhanden.</div>}</div>
    <div className="card" style={{marginTop:16}}><h3>Eigene Abrechnungen</h3>{inv.map(i=><div className="mini-row" key={i.id}><b>{i.invoice_number}</b><span>{money(i.commission_amount)}</span><span className="badge">{i.status}</span></div>)}{!inv.length&&<div className="empty small">Noch keine Daten vorhanden.</div>}</div>
  </section></div></main>
}
