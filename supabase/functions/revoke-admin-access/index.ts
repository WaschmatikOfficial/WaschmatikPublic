import { createClient } from 'npm:@supabase/supabase-js@2'

const url = Deno.env.get('SUPABASE_URL')!
const secret = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const db = createClient(url, secret)
const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const auth = req.headers.get('Authorization')
    if (!auth) return Response.json({ok:false,message:'Nicht authentifiziert.'},{status:401,headers:cors})
    const {data:u,error:ue} = await db.auth.getUser(auth.replace('Bearer ',''))
    if (ue || !u.user) return Response.json({ok:false,message:'Nicht authentifiziert.'},{status:401,headers:cors})
    await db.from('profiles').update({admin_verified_until:null}).eq('id',u.user.id)
    await db.from('admin_login_requests').update({status:'revoked',revoked_at:new Date().toISOString()}).eq('user_id',u.user.id).in('status',['pending','approved'])
    await db.from('audit_logs').insert({actor_user_id:u.user.id,action:'admin_access_revoked',entity_type:'admin_session',entity_id:u.user.id})
    return Response.json({ok:true},{headers:cors})
  } catch (e) {
    console.error(e)
    return Response.json({ok:false,message:'Adminfreigabe konnte nicht widerrufen werden.'},{status:500,headers:cors})
  }
})
