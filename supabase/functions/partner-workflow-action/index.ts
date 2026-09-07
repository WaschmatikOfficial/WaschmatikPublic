import { createClient } from 'npm:@supabase/supabase-js@2';

const url=Deno.env.get('SUPABASE_URL')!;
const secret=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db=createClient(url,secret);
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};

async function sha256(v:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))].map(b=>b.toString(16).padStart(2,'0')).join('')}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  try{
    const {token,action}=await req.json();
    if(!token||!['accept','reject'].includes(action))return Response.json({message:'Ungültige Aktion.'},{status:400,headers:cors});
    const hash=await sha256(token);
    const {data:r,error:re}=await db.from('workflow_tokens').select('id,inquiry_id,action,expires_at,used_at').eq('token_hash',hash).eq('kind','partner').eq('action',action).maybeSingle();
    if(re)throw re;
    if(!r||r.used_at||new Date(r.expires_at).getTime()<=Date.now())return Response.json({message:'Link ist ungültig, abgelaufen oder bereits verwendet.'},{status:400,headers:cors});

    const {data:i,error:ie}=await db.from('inquiries').select('id,business_id,status,inquiry_id').eq('id',r.inquiry_id).single();
    if(ie||!i)throw ie||new Error('Anfrage nicht gefunden');
    if(action==='accept'){
      const {error:e}=await db.rpc('ensure_order_for_inquiry',{p_inquiry_id:i.id});
      if(e)throw e;
    }else{
      const {error:e}=await db.from('inquiries').update({status:'cancelled',partner_response_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',i.id).in('status',['new','contacted']);
      if(e)throw e;
    }
    await db.from('workflow_tokens').update({used_at:new Date().toISOString()}).eq('id',r.id);
    await db.from('workflow_tokens').update({used_at:new Date().toISOString()}).eq('inquiry_id',i.id).eq('kind','partner').is('used_at',null);
    await db.from('audit_logs').insert({action:`partner_${action}`,entity_type:'inquiry',entity_id:i.id,new_value:{inquiry_id:i.inquiry_id}});
    return Response.json({ok:true,message:action==='accept'?'Anfrage angenommen. Der Auftrag wurde angelegt.':'Anfrage abgelehnt.'},{headers:cors});
  }catch(e){
    console.error(e);return Response.json({message:'Partneraktion konnte nicht verarbeitet werden.'},{status:500,headers:cors});
  }
});
