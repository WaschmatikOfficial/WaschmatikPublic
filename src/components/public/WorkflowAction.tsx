import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib';

export default function WorkflowAction({kind}:{kind:'partner'|'customer'}){
  const params=useMemo(()=>new URLSearchParams(location.hash.includes('?')?location.hash.split('?')[1]:''),[]);
  const originalToken=params.get('token')||'';
  const initialAction=params.get('action')||'';
  const [token,setToken]=useState(originalToken);
  const [state,setState]=useState<'idle'|'busy'|'ok'|'error'>('idle');
  const [message,setMessage]=useState(kind==='partner'
    ? 'Der Link ist nur für diese Anfrage bestimmt und läuft automatisch ab.'
    : 'Bitte bestätige zuerst, ob die Reparatur durchgeführt wurde.');
  const [amount,setAmount]=useState('');
  const [needsAmount,setNeedsAmount]=useState(false);

  const call=async(action:string,invoiceAmount?:number)=>{
    if(!token){setState('error');setMessage('Ungültiger oder fehlender Link.');return}
    if(!supabase){setState('error');setMessage('Backend nicht verbunden.');return}
    setState('busy');
    const fn=kind==='partner'?'partner-workflow-action':'customer-workflow-action';
    const {data,error}=await supabase.functions.invoke(fn,{body:{token,action,invoice_amount:invoiceAmount}});
    if(error||!data?.ok){setState('error');setMessage(error?.message||data?.message||'Aktion konnte nicht verarbeitet werden.');return}
    if(data.next_token){setToken(data.next_token);setNeedsAmount(true);setState('ok');setMessage(data.message||'Bitte Rechnungsbetrag eingeben.');return}
    setState('ok');setMessage(data.message||'Erfolgreich verarbeitet.');
  };

  useEffect(()=>{
    if(kind==='customer' && initialAction==='repair_done' && originalToken){
      void call('repair_done');
    }
  },[]);

  const submitAmount=(e:FormEvent)=>{
    e.preventDefault();
    const n=Number(amount);
    if(!Number.isFinite(n)||n<0){setState('error');setMessage('Bitte einen gültigen Rechnungsbetrag eingeben.');return}
    void call('set_invoice_amount',n);
  };

  return <main><section className="page-top"><div className="shell auth-wrap"><div className="card auth-card">
    <div className="eyebrow">WASCHMATIK SICHERHEIT</div>
    <h1>{kind==='partner'?'Anfrage bearbeiten':'Reparatur bestätigen'}</h1>
    <div className="security-box"><ShieldCheck size={22}/><div><b>{kind==='partner'?'Sicherer Partner-Link':'Sicherer Kunden-Link'}</b><span>Der Zugriff wird serverseitig anhand eines einmaligen Tokens geprüft.</span></div></div>
    <p>{message}</p>
    {kind==='partner' && state==='idle' && <div className="row-actions">
      <button className="primary" onClick={()=>void call('accept')}>Anfrage annehmen</button>
      <button className="secondary" onClick={()=>void call('reject')}>Ablehnen</button>
    </div>}
    {kind==='customer' && needsAmount && state!=='busy' && <form onSubmit={submitAmount}>
      <label>Rechnungsbetrag in €</label><input type="number" min="0" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} required/>
      <button className="primary full" type="submit">Betrag bestätigen</button>
    </form>}
    {state==='busy' && <button className="primary full" disabled>Wird verarbeitet …</button>}
    {state==='ok' && !needsAmount && <div className="security-success"><CheckCircle2 size={26}/><b>{message}</b></div>}
    {state==='error' && <div className="form-error">{message}</div>}
  </div></div></section></main>
}
