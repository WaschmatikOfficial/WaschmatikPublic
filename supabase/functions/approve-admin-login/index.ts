import { createClient } from 'npm:@supabase/supabase-js@2'
const url=Deno.env.get('SUPABASE_URL')!
const secret=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const db=createClient(url,secret)
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'}
function bytesToHex(bytes:Uint8Array){return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('')}
async function sha256(value:string){return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))))}
Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  try{
    const body=await req.json().catch(()=>({}))
    const token=body.token
    if(typeof token!=='string'||token.length<32)return Response.json({message:'Ungültiger Freigabelink.'},{status:400,headers:cors})
    const hash=await sha256(token)
    const {data:r,error}=await db.rpc('consume_admin_login_token',{p_token_hash:hash})
    if(error || !r?.length) return Response.json({message:'Freigabelink ungültig, abgelaufen oder bereits verwendet.'},{status:400,headers:cors})
    const consumed=r[0]
    const userId=consumed.user_id
    const requestId=consumed.request_id
    const {data:role}=await db.from('user_roles').select('role').eq('user_id',userId).eq('role','admin').maybeSingle()
    if(!role){ await db.from('admin_login_requests').update({status:'revoked',revoked_at:new Date().toISOString()}).eq('id',requestId); return Response.json({message:'Administratorkonto nicht gefunden.'},{status:403,headers:cors}) }
    const until=new Date(Date.now()+5*60*1000).toISOString()
    const {error:pe}=await db.from('profiles').update({admin_verified_until:until}).eq('id',userId)
    if(pe)throw pe
    await db.from('audit_logs').insert({actor_user_id:userId,action:'admin_email_2fa_approved',entity_type:'admin_login_request',entity_id:requestId,new_value:{verified_until:until}})
    return Response.json({ok:true,verified_until:until},{headers:cors})
  }catch(e){console.error(e);return Response.json({message:'Freigabe konnte nicht abgeschlossen werden.'},{status:500,headers:cors})}
})
