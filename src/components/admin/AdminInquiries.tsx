import { useState } from 'react';
import { supabase, money } from '../../lib';
import type { Inquiry } from '../../types';
import AdminHeader from './AdminHeader';

export default function AdminInquiries({inq,refresh,onToast}:{inq:Inquiry[];refresh:()=>void;onToast:(x:string)=>void}){
  const [open,setOpen]=useState<string|null>(null);
  const setStatus=async(i:Inquiry,status:Inquiry['status'])=>{
    if(!supabase)return;
    const {error}=await supabase.rpc('admin_set_inquiry_status',{p_inquiry_id:i.id,p_status:status});
    if(error){onToast(error.message);return}
    if(status==='completed'&&Number(i.order_value)>0){
      const r=await supabase.functions.invoke('create-invoice',{body:{inquiry_id:i.id}});
      if(r.error)onToast(r.error.message);
    }
    refresh();
  };
  const setValue=async(i:Inquiry,value:number)=>{
    if(!supabase)return;
    const {error}=await supabase.functions.invoke('admin-set-order-value',{body:{inquiry_id:i.id,order_value:value,reason:'Admin-Korrektur'}});
    if(error)onToast(error.message);else refresh();
  };
  return <><AdminHeader title="Kundenanfragen"/><div className="card"><div className="table-wrap"><table className="table">
    <thead><tr><th>Anfrage-ID</th><th>Betrieb</th><th>Kunde</th><th>Problem</th><th>Status</th><th>E-Mail</th><th>Auftragswert</th><th>Provision</th><th></th></tr></thead>
    <tbody>{inq.map(i=><tr key={i.id}>
      <td><b>{i.inquiry_id}</b><div className="small muted">{new Date(i.created_at).toLocaleString('de-DE')}</div></td>
      <td>{i.business_name||i.business_id}</td>
      <td>{i.customer_name}<div className="small">{i.customer_postal_code} {i.customer_city}</div></td>
      <td>{i.problem}<div className="small muted">{i.customer_confirmation_status||'pending'}</div></td>
      <td><select value={i.status} onChange={e=>setStatus(i,e.target.value)}>{['new','contacted','accepted','completed','cancelled'].map(s=><option key={s}>{s}</option>)}</select></td>
      <td><span className={i.email_status==='failed'?'badge red':'badge'}>{i.email_status}</span></td>
      <td><input className="table-input" type="number" min="0" step="0.01" defaultValue={i.order_value} onBlur={e=>setValue(i,Number(e.target.value))}/></td>
      <td>{money(i.commission_amount)}</td>
      <td><button className="small secondary" onClick={()=>setOpen(open===i.id?null:i.id)}>{open===i.id?'Schließen':'Details'}</button>{i.email_status==='failed'&&<button className="small secondary" onClick={async()=>{if(!supabase)return;const r=await supabase.functions.invoke('retry-inquiry-email',{body:{inquiry_id:i.id}});if(r.error)onToast(r.error.message);else onToast('E-Mail erneut angestoßen.')}}>E-Mail erneut</button>}</td>
    </tr>)}</tbody></table>
    {open&&(()=>{const i=inq.find(x=>x.id===open);if(!i)return null;return <div className="card" style={{marginTop:16}}><h3>{i.inquiry_id}</h3><p>{i.customer_name}<br/>{i.customer_phone}<br/>{i.customer_email}</p><p><b>Problem:</b><br/>{i.problem_description}</p><p><b>Kundenbestätigung:</b> {i.customer_confirmation_status||'pending'} {i.customer_invoice_amount!=null?`· Kunde meldet ${money(i.customer_invoice_amount)}`:''}</p></div>})()}
    {!inq.length&&<div className="empty">Noch keine Kundenanfragen vorhanden.</div>}
  </div></div></>;
}
