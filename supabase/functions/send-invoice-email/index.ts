import { createClient } from 'npm:@supabase/supabase-js@2';

const url=Deno.env.get('SUPABASE_URL')!;
const secret=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db=createClient(url,secret);
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  try{
    const auth=req.headers.get('Authorization'); if(!auth)return Response.json({message:'Nicht authentifiziert.'},{status:401,headers:cors});
    const {data:u}=await db.auth.getUser(auth.replace('Bearer ',''));
    if(!u.user)return Response.json({message:'Nicht authentifiziert.'},{status:401,headers:cors});
    const {data:roles}=await db.from('user_roles').select('role,business_id').eq('user_id',u.user.id);
    const adminRole=roles?.some((r:any)=>r.role==='admin');
    if(adminRole){const {data:ok}=await db.rpc('has_admin_access');if(!ok)return Response.json({message:'Admin-Freigabe fehlt oder ist abgelaufen.'},{status:403,headers:cors});}
    const {invoice_id}=await req.json();
    const {data:inv,error:ie}=await db.from('invoices').select('*').eq('id',invoice_id).single();
    if(ie||!inv)throw ie||new Error('Rechnung nicht gefunden');
    const allowed=roles?.some((r:any)=>(r.role==='admin'&&true)||(r.role==='partner'&&r.business_id===inv.business_id));
    if(!allowed)return Response.json({message:'Nicht autorisiert.'},{status:403,headers:cors});
    const {data:b}=await db.from('businesses').select('name,email').eq('id',inv.business_id).single();
    if(!b?.email)throw new Error('Partner-E-Mail fehlt');
    const key=Deno.env.get('EMAIL_PROVIDER_API_KEY'); const from=Deno.env.get('EMAIL_FROM');
    if((Deno.env.get('EMAIL_PROVIDER')||'RESEND')!=='RESEND'||!key||!from)throw new Error('E-Mail secrets missing');
    const text=`Guten Tag,

hiermit erhalten Sie die WASCHMATIK-Abrechnung.

Rechnung: ${inv.invoice_number}
Auftragswert: ${Number(inv.order_value).toFixed(2)} €
WASCHMATIK-Provision: ${Number(inv.commission_amount).toFixed(2)} €
Fällig am: ${new Date(inv.due_at).toLocaleDateString('de-DE')}

Bitte überweisen Sie den Rechnungsbetrag innerhalb der Zahlungsfrist auf das in den WASCHMATIK-Abrechnungsdaten hinterlegte Konto und geben Sie als Verwendungszweck die Rechnungsnummer an.

Freundliche Grüße
WASCHMATIK`;
    const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[b.email],subject:`WASCHMATIK-Abrechnung ${inv.invoice_number}`,text})});
    if(!r.ok)throw new Error(await r.text());
    await db.from('audit_logs').insert({actor_user_id:u.user.id,action:'invoice_email_sent',entity_type:'invoice',entity_id:inv.id,new_value:{to:b.email}});
    return Response.json({ok:true},{headers:cors});
  }catch(e){console.error(e);return Response.json({message:'Abrechnung konnte nicht per E-Mail versendet werden.'},{status:500,headers:cors})}
});
