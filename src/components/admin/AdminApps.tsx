import { useState } from 'react';
import { supabase } from '../../lib';
import { cls } from '../../lib';
import type { AppRow } from '../../types';
import AdminHeader from './AdminHeader';
function AdminApps({apps,refresh}:{apps:AppRow[];refresh:()=>void}){
 const [busy,setBusy]=useState<string|null>(null);
 const setStatus=async(a:AppRow,status:'active'|'inactive')=>{if(!supabase)return;setBusy(a.id);const {error}=await supabase.from('partners').update({status}).eq('id',a.id);setBusy(null);if(error)alert(error.message);else refresh()};
 return <><AdminHeader title="Partneranfragen"/><div className="card"><div className="table-wrap"><table className="table"><thead><tr><th>Betrieb</th><th>Kontakt</th><th>Ort</th><th>Datum</th><th>Status</th><th>Aktionen</th></tr></thead><tbody>{apps.map(a=><tr key={a.id}><td><b>{a.name}</b><div className="small muted">{a.email}</div></td><td>{a.contact_name}</td><td>{a.postal_code} {a.city}</td><td>{new Date(a.created_at).toLocaleDateString('de-DE')}</td><td><span className={cls('badge',a.status!=='active'&&'red')}>{a.status}</span></td><td><button className="small secondary" onClick={()=>alert(`${a.name}\n${a.contact_name||''}\n${a.email||''}\n${a.phone||''}\n${a.city}`)}>Ansehen</button><button className="small secondary" disabled={busy===a.id} onClick={()=>setStatus(a,'active')}>Freigeben</button><button className="small danger-btn" disabled={busy===a.id} onClick={()=>setStatus(a,'inactive')}>Ablehnen</button></td></tr>)}</tbody></table>{!apps.length&&<div className="empty">Noch keine offenen Partneranfragen.</div>}</div></div></>;
}
export default AdminApps;
