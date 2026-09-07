import { createClient } from 'npm:@supabase/supabase-js@2';

const url=Deno.env.get('SUPABASE_URL')!;
const secret=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db=createClient(url,secret);
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};

const allowedProblems=[
  'Waschmaschine startet nicht','Waschmaschine pumpt nicht ab','Waschmaschine läuft aus',
  'Waschmaschine schleudert nicht','Waschmaschine macht ungewöhnliche Geräusche',
  'Waschmaschine wird nicht warm','Waschmaschine zeigt einen Fehlercode',
  'Tür lässt sich nicht öffnen','Waschmaschine vibriert stark','Sonstiges Problem'
];
const text=(v:unknown,max:number)=>String(v??'').trim().slice(0,max);
async function sha256(v:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))].map(b=>b.toString(16).padStart(2,'0')).join('')}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  try{
    const x=await req.json();
    const customer_name=text(x.customer_name,120);
    const customer_phone=text(x.customer_phone,40);
    const customer_email=text(x.customer_email,254).toLowerCase();
    const customer_postal_code=text(x.customer_postal_code,5);
    const customer_city=text(x.customer_city,120);
    const problem=text(x.problem,120);
    const problem_description=text(x.problem_description,4000);
    const preferred_contact=text(x.preferred_contact,20);
    const business_id=text(x.business_id,80);
    if(x.terms_accepted!==true) return Response.json({message:'Bitte den Vermittlungs-/Datenschutzhinweis akzeptieren.'},{status:400,headers:cors});
    if([customer_name,customer_phone,customer_email,customer_postal_code,customer_city,problem,problem_description,preferred_contact,business_id].some(v=>!v))
      return Response.json({message:'Pflichtfelder fehlen.'},{status:400,headers:cors});
    if(customer_name.length<2||customer_email.length<3||customer_phone.length<5||problem_description.length<2)
      return Response.json({message:'Ungültige Eingaben.'},{status:400,headers:cors});
    if(!/^\d{5}$/.test(customer_postal_code)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer_email))
      return Response.json({message:'Ungültige Kontaktdaten.'},{status:400,headers:cors});
    if(!allowedProblems.includes(problem)||!['E-Mail','Telefon'].includes(preferred_contact))
      return Response.json({message:'Ungültige Anfrageangaben.'},{status:400,headers:cors});

    const ip=req.headers.get('cf-connecting-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
    const bucket=await sha256(`${customer_email}|${ip}`);
    const {data:allowed,error:rateError}=await db.rpc('consume_inquiry_rate_limit',{p_bucket_key:bucket});
    if(rateError) throw rateError;
    if(!allowed) return Response.json({message:'Zu viele Anfragen. Bitte später erneut versuchen.'},{status:429,headers:{...cors,'Retry-After':'900'}});

    const {data:b,error:be}=await db.from('businesses').select('id,name,email,active').eq('id',business_id).eq('active',true).single();
    if(be||!b?.email) return Response.json({message:'Betrieb ist nicht verfügbar.'},{status:400,headers:cors});

    const {data:serves,error:serveError}=await db.rpc('business_serves_postal',{p_business_id:b.id,p_postal:customer_postal_code});
    if(serveError) throw serveError;
    if(!serves) return Response.json({message:'Der ausgewählte Betrieb ist für diese PLZ nicht freigeschaltet.'},{status:400,headers:cors});

    const {data:recent}=await db.from('inquiries').select('id,inquiry_id').eq('business_id',b.id).eq('customer_email',customer_email).gte('created_at',new Date(Date.now()-15*60*1000).toISOString()).limit(1);
    if(recent && recent.length) return Response.json({message:'Es wurde vor kurzem bereits eine Anfrage an diesen Betrieb gesendet.'},{status:409,headers:cors});

    const {data:id,error:ie}=await db.rpc('next_inquiry_id');
    if(ie) throw ie;
    const {data:i,error}=await db.from('inquiries').insert({
      inquiry_id:id,business_id:b.id,customer_name,customer_phone,customer_email,
      customer_postal_code,customer_city,problem,problem_description,preferred_contact,
      status:'new',email_status:'pending',commission_percentage:5
    }).select().single();
    if(error) throw error;

    await db.from('audit_logs').insert({action:'inquiry_created',entity_type:'inquiry',entity_id:i.id,new_value:{inquiry_id:i.inquiry_id,business_id:i.business_id,created_at:i.created_at}});

    const emailResp=await fetch(`${url}/functions/v1/send-inquiry-email`,{
      method:'POST',
      headers:{'Content-Type':'application/json','x-wm-internal-secret':Deno.env.get('INTERNAL_FUNCTION_SECRET')||''},
      body:JSON.stringify({inquiry_id:i.id})
    });
    if(!emailResp.ok) await db.from('inquiries').update({email_status:'failed'}).eq('id',i.id);

    return Response.json({inquiry_id:i.inquiry_id},{headers:cors});
  }catch(e){
    console.error(e);
    return Response.json({message:'Anfrage konnte nicht verarbeitet werden.'},{status:500,headers:cors});
  }
});
