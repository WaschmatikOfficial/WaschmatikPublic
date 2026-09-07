import { createClient } from 'npm:@supabase/supabase-js@2';

const url=Deno.env.get('SUPABASE_URL')!;
const secret=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db=createClient(url,secret);
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};

function hex(b:Uint8Array){return [...b].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function sha256(v:string){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v))))}

Deno.serve(async(req)=>{
  try{
    const internal=req.headers.get('x-wm-internal-secret');
    const auth=req.headers.get('Authorization');
    const internalOk=internal===Deno.env.get('INTERNAL_FUNCTION_SECRET');
    if(!internalOk){
      if(!auth)return Response.json({message:'Not allowed.'},{status:403,headers:cors});
      const {data:u}=await db.auth.getUser(auth.replace('Bearer ',''));
      if(!u.user)return Response.json({message:'Not allowed.'},{status:403,headers:cors});
      const {data:role}=await db.from('user_roles').select('role,business_id').eq('user_id',u.user.id).maybeSingle();
      if(!role)return Response.json({message:'Not allowed.'},{status:403,headers:cors});
      if(role.role==='admin'){
        const {data:ok}=await db.rpc('has_admin_access');
        if(!ok)return Response.json({message:'Admin-Freigabe fehlt oder ist abgelaufen.'},{status:403,headers:cors});
      }
    }
    const cutoff=new Date(Date.now()-2*86400000).toISOString();
    const {data:rows,error}=await db.from('inquiries').select('id,inquiry_id,customer_name,customer_email,status,customer_confirmation_status,business_id,completed_at').eq('status','completed').eq('customer_confirmation_status','pending').lte('completed_at',cutoff).limit(100);
    if(error)throw error;
    const key=Deno.env.get('EMAIL_PROVIDER_API_KEY');const from=Deno.env.get('EMAIL_FROM');
    if((Deno.env.get('EMAIL_PROVIDER')||'RESEND')!=='RESEND'||!key||!from)throw new Error('E-Mail secrets missing');
    const site=(Deno.env.get('PUBLIC_SITE_URL')||'https://waschmatik.de').replace(/\/$/,'');
    let sent=0;
    for(const i of rows||[]){
      await db.from('workflow_tokens').update({used_at:new Date().toISOString()}).eq('inquiry_id',i.id).eq('kind','customer').is('used_at',null);
      const rawDone=hex(crypto.getRandomValues(new Uint8Array(32)));
      const hashDone=await sha256(rawDone);
      const rawNot=hex(crypto.getRandomValues(new Uint8Array(32)));
      const hashNot=await sha256(rawNot);
      const exp=new Date(Date.now()+7*86400000).toISOString();
      await db.from('workflow_tokens').insert([
        {inquiry_id:i.id,kind:'customer',action:'repair_done',token_hash:hashDone,expires_at:exp},
        {inquiry_id:i.id,kind:'customer',action:'repair_not_done',token_hash:hashNot,expires_at:exp}
      ]);
      const doneUrl=`${site}/#customer-action?token=${encodeURIComponent(rawDone)}&action=repair_done`;
      const notUrl=`${site}/#customer-action?token=${encodeURIComponent(rawNot)}&action=repair_not_done`;
      const text=`Hallo ${i.customer_name},

WASCHMATIK möchte kurz prüfen, ob die vermittelten Reparaturarbeiten durchgeführt wurden.

Reparatur wurde durchgeführt:
${doneUrl}

Reparatur wurde nicht durchgeführt:
${notUrl}

Die Links sind 7 Tage gültig.

Vielen Dank
WASCHMATIK`;
      const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[i.customer_email],subject:`WASCHMATIK – Rückmeldung zu ${i.inquiry_id}`,text})});
      if(r.ok)sent++;
    }
    return Response.json({ok:true,sent},{headers:cors});
  }catch(e){console.error(e);return Response.json({message:'Kunden-Follow-up konnte nicht gesendet werden.'},{status:500,headers:cors})}
});
