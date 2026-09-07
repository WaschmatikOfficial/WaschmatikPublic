import { createClient } from 'npm:@supabase/supabase-js@2';

const url=Deno.env.get('SUPABASE_URL')!;
const secret=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db=createClient(url,secret);
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-wm-internal-secret'};

function bytesToHex(bytes:Uint8Array){return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('')}
async function sha256(value:string){return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))))}
async function tokenFor(inquiryId:string,action:'accept'|'reject'){
  const raw=bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  const hash=await sha256(raw);
  await db.from('workflow_tokens').insert({inquiry_id:inquiryId,kind:'partner',action,token_hash:hash,expires_at:new Date(Date.now()+7*86400000).toISOString()});
  return raw;
}

Deno.serve(async(req)=>{
  try{
    if(req.headers.get('x-wm-internal-secret')!==Deno.env.get('INTERNAL_FUNCTION_SECRET'))
      return Response.json({message:'Not allowed.'},{status:403,headers:cors});
    const {inquiry_id}=await req.json();
    const {data:i,error}=await db.from('inquiries').select('*').eq('id',inquiry_id).single();
    if(error||!i) throw error||new Error('not found');
    const {data:b}=await db.from('businesses').select('name,email').eq('id',i.business_id).single();
    if(!b?.email) throw new Error('partner email missing');

    const provider=Deno.env.get('EMAIL_PROVIDER')||'RESEND';
    const key=Deno.env.get('EMAIL_PROVIDER_API_KEY');
    const from=Deno.env.get('EMAIL_FROM');
    if(provider!=='RESEND'||!key||!from) throw new Error('email secrets missing');

    // Invalidate unused older action tokens for this inquiry.
    await db.from('workflow_tokens').update({used_at:new Date().toISOString()}).eq('inquiry_id',i.id).eq('kind','partner').is('used_at',null);
    const accept=await tokenFor(i.id,'accept');
    const reject=await tokenFor(i.id,'reject');
    const site=(Deno.env.get('PUBLIC_SITE_URL')||'https://waschmatik.de').replace(/\/$/,'');
    const acceptUrl=`${site}/#partner-action?token=${encodeURIComponent(accept)}&action=accept`;
    const rejectUrl=`${site}/#partner-action?token=${encodeURIComponent(reject)}&action=reject`;

    const body=`Guten Tag,

über WASCHMATIK ist eine neue Kundenanfrage für ${b.name} eingegangen.

Kunde:
${i.customer_name}
${i.customer_phone}
${i.customer_email}
${i.customer_city} / ${i.customer_postal_code}

Problem:
${i.problem_description}

Anfrage-ID: ${i.inquiry_id}

ANFRAGE ANNEHMEN:
${acceptUrl}

ANFRAGE ABLEHNEN:
${rejectUrl}

Die Links sind zeitlich begrenzt und nur einmal für diese Anfrage verwendbar.

Freundliche Grüße
Ihr WASCHMATIK-Team`;

    const r=await fetch('https://api.resend.com/emails',{
      method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
      body:JSON.stringify({from,to:[b.email],subject:`Neue Kundenanfrage – ${i.inquiry_id}`,text:body})
    });
    if(!r.ok) throw new Error(await r.text());
    await db.from('inquiries').update({email_status:'sent',email_sent_at:new Date().toISOString()}).eq('id',i.id);
    return Response.json({ok:true},{headers:cors});
  }catch(e){
    console.error(e);
    try{const {inquiry_id}=await req.clone().json();if(inquiry_id)await db.from('inquiries').update({email_status:'failed'}).eq('id',inquiry_id)}catch{}
    return Response.json({message:'E-Mail konnte nicht gesendet werden.'},{status:500,headers:cors});
  }
});
