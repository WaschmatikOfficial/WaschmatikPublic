import { createClient } from 'npm:@supabase/supabase-js@2';
const url=Deno.env.get('SUPABASE_URL')!;
const secret=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db=createClient(url,secret);
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};
Deno.serve(async(req)=>{
 try{
  const auth=req.headers.get('Authorization'); if(!auth)return Response.json({message:'Nicht authentifiziert.'},{status:401,headers:cors});
  const {data:u}=await db.auth.getUser(auth.replace('Bearer ',''));
  if(!u.user)return Response.json({message:'Nicht authentifiziert.'},{status:401,headers:cors});
  const {data:ok}=await db.rpc('has_admin_access');
  if(!ok)return Response.json({message:'Admin-Freigabe fehlt oder ist abgelaufen.'},{status:403,headers:cors});
  const {inquiry_id,order_value,reason}=await req.json();
  const value=Number(order_value); if(!Number.isFinite(value)||value<0||value>100000)return Response.json({message:'Ungültiger Auftragswert.'},{status:400,headers:cors});
  const {data:i,error:ie}=await db.from('inquiries').select('*').eq('id',inquiry_id).single(); if(ie||!i)throw ie||new Error('not found');
  await db.from('inquiries').update({order_value:Math.round(value*100)/100,commission_amount:i.status==='completed'?Math.round(value*i.commission_percentage/100,2):i.commission_amount,updated_at:new Date().toISOString()}).eq('id',inquiry_id);
  await db.from('orders').update({order_value:Math.round(value*100)/100,updated_at:new Date().toISOString()}).eq('inquiry_id',inquiry_id);
  await db.from('audit_logs').insert({actor_user_id:u.user.id,action:'order_value_changed',entity_type:'inquiry',entity_id:inquiry_id,new_value:{order_value:value,reason:reason||'Admin-Korrektur'}});
  return Response.json({ok:true},{headers:cors});
 }catch(e){console.error(e);return Response.json({message:'Auftragswert konnte nicht geändert werden.'},{status:500,headers:cors})}
})
