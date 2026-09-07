import { supabase } from '../../lib';
import { cls, money } from '../../lib';
import type { Invoice } from '../../types';
import AdminHeader from './AdminHeader';
function AdminInvoices({inv,refresh}:{inv:Invoice[];refresh:()=>void}){return <><AdminHeader title="Abrechnungen"/><div className="card"><div className="table-wrap"><table className="table"><thead><tr><th>Rechnung</th><th>Anfrage</th><th>Auftragswert</th><th>Provision</th><th>Fällig</th><th>Status</th><th></th></tr></thead><tbody>{inv.map(x=><tr key={x.id}><td><b>{x.invoice_number}</b></td><td>{x.inquiry_id}</td><td>{money(x.order_value)}</td><td>{money(x.commission_amount)}</td><td>{new Date(x.due_at).toLocaleDateString('de-DE')}</td><td><span className={cls('badge',x.status==='überfällig'&&'red')}>{x.status}</span></td><td><button className="small secondary" onClick={async()=>{if(!supabase)return;const next=x.status==='bezahlt'?'offen':'bezahlt';const r=await supabase.rpc('admin_set_invoice_status',{p_invoice_id:x.id,p_status:next});if(r.error){alert(r.error.message);return}refresh()}}>{x.status==='bezahlt'?'Als offen markieren':'Als bezahlt markieren'}</button></td></tr>)}</tbody></table>{!inv.length&&<div className="empty">Noch keine Abrechnungen vorhanden.</div>}</div></div></>}

export default AdminInvoices;
