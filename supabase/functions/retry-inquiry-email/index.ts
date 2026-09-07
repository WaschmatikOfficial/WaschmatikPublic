import { createClient } from 'npm:@supabase/supabase-js@2'
const url=Deno.env.get('SUPABASE_URL')!
const secret=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const db=createClient(url,secret)
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  try{
    const auth=req.headers.get('Authorization'); if(!auth)return Response.json({message:'Nicht authentifiziert.'},{status:401,headers:cors})
    const {data:u,error:ue}=await db.auth.getUser(auth.replace('Bearer ','')); if(ue||!u.user)return Response.json({message:'Nicht authentifiziert.'},{status:401,headers:cors})
    const {data:r}=await db.from('user_roles').select('role').eq('user_id',u.user.id).eq('role','admin').maybeSingle();const {data:p}=await db.from('profiles').select('admin_verified_until').eq('id',u.user.id).maybeSingle();if(!r||!p?.admin_verified_until||new Date(p.admin_verified_until).getTime()<=Date.now())return Response.json({message:'Admin-Freigabe fehlt oder ist abgelaufen.'},{status:403,headers:cors});
    const {inquiry_id}=await req.json()
    const resp=await fetch(`${url}/functions/v1/send-inquiry-email`,{method:'POST',headers:{'Content-Type':'application/json','x-wm-internal-secret':Deno.env.get('INTERNAL_FUNCTION_SECRET')||''},body:JSON.stringify({inquiry_id})})
    return new Response(await resp.text(),{status:resp.status,headers:{...cors,'Content-Type':'application/json'}})
  }catch(e){console.error(e);return Response.json({message:'Retry fehlgeschlagen.'},{status:500,headers:cors})}
})
