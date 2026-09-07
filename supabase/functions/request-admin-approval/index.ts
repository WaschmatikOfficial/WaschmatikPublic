import { createClient } from 'npm:@supabase/supabase-js@2'

const url = Deno.env.get('SUPABASE_URL')!
const secret = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const db = createClient(url, secret)
const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'}

function bytesToHex(bytes: Uint8Array){ return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('') }
async function sha256(value:string){ return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))) }

Deno.serve(async (req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors})
  try{
    const auth=req.headers.get('Authorization')
    if(!auth) return Response.json({message:'Nicht authentifiziert.'},{status:401,headers:cors})
    const {data:u,error:ue}=await db.auth.getUser(auth.replace('Bearer ',''))
    if(ue||!u.user) return Response.json({message:'Nicht authentifiziert.'},{status:401,headers:cors})
    const {data:role}=await db.from('user_roles').select('role').eq('user_id',u.user.id).eq('role','admin').maybeSingle()
    if(!role) return Response.json({message:'Nicht autorisiert.'},{status:403,headers:cors})

    const requiredEmail=(Deno.env.get('ADMIN_LOGIN_EMAIL') || 'waschmatik@gmail.com').trim().toLowerCase()
    if ((u.user.email || '').trim().toLowerCase() !== requiredEmail) return Response.json({message:'Dieses Konto ist nicht für den WASCHMATIK-Adminbereich zugelassen.'},{status:403,headers:cors})

    await db.from('profiles').update({admin_verified_until:null}).eq('id',u.user.id)
    await db.from('admin_login_requests').update({status:'revoked',revoked_at:new Date().toISOString()}).eq('user_id',u.user.id).in('status',['pending','approved'])
    await db.from('admin_login_requests').update({status:'expired'}).eq('user_id',u.user.id).eq('status','pending').lt('expires_at',new Date().toISOString())

    const token=bytesToHex(crypto.getRandomValues(new Uint8Array(32)))
    const tokenHash=await sha256(token)
    const expires=new Date(Date.now()+5*60*1000).toISOString()
    const {data:reqRow,error:re}=await db.from('admin_login_requests').insert({user_id:u.user.id,token_hash:tokenHash,status:'pending',expires_at:expires}).select('id').single()
    if(re) throw re

    const approvalEmail=Deno.env.get('ADMIN_APPROVAL_EMAIL') || 'waschmatik@gmail.com'
    const site=(Deno.env.get('ADMIN_SITE_URL')||Deno.env.get('PUBLIC_SITE_URL')||'http://localhost:5173').replace(/\/$/,'')
    const approvalUrl=`${site}/#admin-approve?token=${encodeURIComponent(token)}`
    const provider=Deno.env.get('EMAIL_PROVIDER')||'RESEND'
    const key=Deno.env.get('EMAIL_PROVIDER_API_KEY')
    const from=Deno.env.get('EMAIL_FROM')
    if(provider!=='RESEND'||!key||!from) throw new Error('E-Mail-Versand ist nicht konfiguriert.')
    const text=`WASCHMATIK Admin-Freigabe\n\nFür das WASCHMATIK-Administratorkonto ${u.user.email} wurde gerade ein Admin-Login angefordert.\n\nDie Freigabe ist 5 Minuten gültig.\n\nFREIGABE ERTEILEN:\n${approvalUrl}\n\nWenn du diese Anmeldung nicht ausgelöst hast, nichts anklicken und die Anfrage ignorieren.`
    const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[approvalEmail],subject:'WASCHMATIK – Admin-Login freigeben',text})})
    if(!r.ok) throw new Error(await r.text())
    return Response.json({request_id:reqRow.id,expires_at:expires},{headers:cors})
  }catch(e){
    console.error(e)
    return Response.json({message:'Die Admin-Freigabe konnte nicht angefordert werden.'},{status:500,headers:cors})
  }
})
