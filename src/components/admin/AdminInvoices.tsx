import { useState } from 'react';
import { supabase, cls, money } from '../../lib';
import type { Invoice } from '../../types';
import AdminHeader from './AdminHeader';
function AdminInvoices({inv,refresh}:{inv:Invoice[];refresh:()=>void}){
 const [busy,setBusy]=useState<string|null>(null);
 const toggle=async(x:Invoice)=>{if(!supabase)return;setBusy(x.id);const next=x.status==='bezahlt'?'offen':'bezahlt';const patch:any={invoice_status:next,invoice_paid_at:next==='bezahlt'?new Date().toISOString():null};const {error}=await supabase.from('orders').update(patch).eq('request_id',x.request_id).eq('partner_id',x.business_id);setBusy(null);if(error)alert(error.message);else refresh()};
 return <><AdminHeader title="Abrechnungen"/><div className="card"><div className="table-wrap"><table className="table"><thead><tr><th>Rechnung</th><th>Betrieb</th><th>Anfrage</th><th>Auftragswert</th><th>Provision</th><th>Fällig</th><th>Status</th><th></th></tr></thead><tbody>{inv.map(x=><tr key={x.id}><td><b>{x.invoice_number}</b></td><td>{x.business_name||x.business_id}</td><td>{x.request_id.slice(0,8).toUpperCase()}</td><td>{money(x.order_value)}</td><td>{money(x.commission_amount)}</td><td>{new Date(x.due_at).toLocaleDateString('de-DE')}</td><td><span className={cls('badge',x.status==='überfällig'&&'red')}>{x.status}</span></td><td><button className="small secondary" disabled={busy===x.id} onClick={()=>toggle(x)}>{x.status==='bezahlt'?'Als offen markieren':'Als bezahlt markieren'}</button></td></tr>)}</tbody></table>{!inv.length&&<div className="empty">Noch keine Abrechnungen vorhanden.</div>}</div></div></>}
export default AdminInvoices;
