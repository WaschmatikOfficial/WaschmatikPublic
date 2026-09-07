import { useEffect, useState } from 'react';
import { supabase } from '../../lib';
import AdminHeader from './AdminHeader';
function AdminAudit(){const [rows,setRows]=useState<any[]>([]);useEffect(()=>{supabase?.from('audit_logs').select('*').order('created_at',{ascending:false}).limit(200).then(({data})=>setRows(data||[]))},[]);return <><AdminHeader title="Audit-Log"/><div className="card"><div className="table-wrap"><table className="table"><thead><tr><th>Zeit</th><th>Aktion</th><th>Entität</th><th>ID</th><th>User</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{new Date(r.created_at).toLocaleString('de-DE')}</td><td>{r.action}</td><td>{r.entity_type}</td><td>{r.entity_id}</td><td>{r.actor_user_id}</td></tr>)}</tbody></table>{!rows.length&&<div className="empty">Noch keine Audit-Ereignisse.</div>}</div></div></>}

export default AdminAudit;
