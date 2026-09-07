import { createClient } from 'npm:@supabase/supabase-js@2';

const url=Deno.env.get('SUPABASE_URL')!;
const secret=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db=createClient(url,secret);
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};

async function sha256(v:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))].map(b=>b.toString(16).padStart(2,'0')).join('')}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  try{
    const {token,action,invoice_amount}=await req.json();
    if(!token||!['repair_done','repair_not_done','set_invoice_amount'].includes(action))
      return Response.json({message:'Ungültige Aktion.'},{status:400,headers:cors});
    const hash=await sha256(token);
    const {data:r,error:re}=await db.from('workflow_tokens').select('id,inquiry_id,action,expires_at,used_at').eq('token_hash',hash).eq('kind','customer').eq('action',action).maybeSingle();
    if(re)throw re;
    if(!r||r.used_at||new Date(r.expires_at).getTime()<=Date.now())return Response.json({message:'Link ist ungültig, abgelaufen oder bereits verwendet.'},{status:400,headers:cors});

    const {data:i,error:ie}=await db.from('inquiries').select('id,status,order_value,commission_percentage,inquiry_id').eq('id',r.inquiry_id).single();
    if(ie||!i)throw ie||new Error('Anfrage nicht gefunden');

    if(action==='repair_not_done'){
      await db.from('inquiries').update({customer_confirmation_status:'not_completed',customer_confirmation_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',i.id);
      await db.from('orders').update({customer_confirmation_status:'not_completed',updated_at:new Date().toISOString()}).eq('inquiry_id',i.id);
    }else if(action==='repair_done'){
      await db.from('inquiries').update({customer_confirmation_status:'completed',customer_confirmation_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',i.id);
      await db.from('orders').update({customer_confirmation_status:'completed',updated_at:new Date().toISOString()}).eq('inquiry_id',i.id);
      // The same token is kept only long enough to enter the amount.
      await db.from('workflow_tokens').update({used_at:new Date().toISOString()}).eq('id',r.id);
      const amountRaw=Number(invoice_amount);
      if(invoice_amount===undefined||invoice_amount===null||!Number.isFinite(amountRaw)){
        const follow=crypto.getRandomValues(new Uint8Array(32));
        const raw=[...follow].map(b=>b.toString(16).padStart(2,'0')).join('');
        await db.from('workflow_tokens').insert({inquiry_id:i.id,kind:'customer',action:'set_invoice_amount',token_hash:await sha256(raw),expires_at:new Date(Date.now()+7*86400000).toISOString()});
        return Response.json({ok:true,message:'Reparatur bestätigt. Bitte jetzt den Rechnungsbetrag eingeben.',next_token:raw},{headers:cors});
      }
    }else{
      if(i.status!=='completed' && i.status!=='accepted') return Response.json({message:'Für diese Anfrage ist keine Abrechnung möglich.'},{status:400,headers:cors});
      const amount=Number(invoice_amount);
      if(!Number.isFinite(amount)||amount<0||amount>100000)return Response.json({message:'Ungültiger Rechnungsbetrag.'},{status:400,headers:cors});
      await db.from('inquiries').update({customer_invoice_amount:Math.round(amount*100)/100,customer_confirmation_status:'completed',customer_confirmation_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',i.id);
      await db.from('orders').update({customer_reported_value:Math.round(amount*100)/100,customer_confirmation_status:'completed',updated_at:new Date().toISOString()}).eq('inquiry_id',i.id);
      await db.from('audit_logs').insert({action:'customer_invoice_reported',entity_type:'inquiry',entity_id:i.id,new_value:{amount}});
    }
    await db.from('workflow_tokens').update({used_at:new Date().toISOString()}).eq('id',r.id);
    return Response.json({ok:true,message:'Vielen Dank. Die Rückmeldung wurde gespeichert.'},{headers:cors});
  }catch(e){console.error(e);return Response.json({message:'Kundenrückmeldung konnte nicht verarbeitet werden.'},{status:500,headers:cors})}
});
