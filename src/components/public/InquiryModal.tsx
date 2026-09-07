import React, { FormEvent, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib';
import type { Business } from '../../types';
import Field from '../shared/Field';

function InquiryModal({business,problem,zip,close,onToast}:{business:Business;problem:string;zip:string;close:()=>void;onToast:(x:string)=>void}){
 const [sending,setSending]=useState(false);
 const submit=async(e:FormEvent<HTMLFormElement>)=>{
   e.preventDefault();
   const fd=new FormData(e.currentTarget);
   if(!fd.get('terms')){onToast('Bitte den Datenschutzhinweis und die Vermittlung bestätigen.');return}
   if(!supabase){onToast('Die Verbindung zum Service ist momentan nicht verfügbar.');return}
   const firstName=String(fd.get('first_name')||'').trim();
   const lastName=String(fd.get('last_name')||'').trim();
   const email=String(fd.get('email')||'').trim();
   const phone=String(fd.get('phone')||'').trim();
   setSending(true);
   const {data,error}=await supabase.functions.invoke('create-repair-request',{body:{
     first_name:firstName,last_name:lastName,email,phone,
     street:String(fd.get('street')||'').trim(),
     house_number:String(fd.get('house_number')||'').trim(),
     postal_code:zip,city:String(fd.get('city')||'').trim(),
     brand:String(fd.get('brand')||'').trim()||null,
     model:String(fd.get('model')||'').trim()||null,
     partner_id:business?.id || null,
     terms_accepted: true,
     problem:problem,
     description:String(fd.get('description')||'').trim(),
     problem_description:problem+' – '+String(fd.get('description')||'').trim(),
     preferred_date:String(fd.get('preferred_date')||'').trim()||null,
     preferred_time:String(fd.get('preferred_time')||'').trim()||null,
   }});
   setSending(false);
   if(error){onToast(error.message||'Anfrage konnte nicht gesendet werden.');return}
   close();
   alert(`Deine Anfrage wurde erfolgreich über WASCHMATIK übermittelt.\n\nAnfrage-ID: ${data?.request_id||'—'}`);
 };
 return <div className="modal-backdrop"><div className="modal">
   <button className="close" onClick={close} aria-label="Schließen"><X/></button>
   <div className="eyebrow">WASCHMATIK-ANFRAGE</div>
   <h2>Reparaturanfrage senden</h2>
   <p className="muted">Deine Anfrage wird an einen passenden aktiven WASCHMATIK-Partner vermittelt. Die Kontaktdaten werden dafür verarbeitet und weitergegeben.</p>
   <form onSubmit={submit}>
     <div className="form-grid">
       <Field label="Vorname" name="first_name" required/>
       <Field label="Nachname" name="last_name" required/>
       <Field label="Telefonnummer" name="phone" required/>
       <Field label="E-Mail-Adresse" name="email" type="email" required/>
       <Field label="Straße" name="street" required/>
       <Field label="Hausnummer" name="house_number" required/>
       <Field label="Ort" name="city" required/>
       <Field label="Marke" name="brand"/>
       <Field label="Modell" name="model"/>
       <div><label htmlFor="preferred_date">Wunschtermin</label><input id="preferred_date" name="preferred_date" type="date"/></div>
       <div><label htmlFor="preferred_time">Wunschzeit</label><input id="preferred_time" name="preferred_time" placeholder="z. B. vormittags" maxLength={80}/></div>
       <div className="full"><label>Problem</label><input value={problem} readOnly/></div>
       <div className="full"><label htmlFor="description">Problembeschreibung *</label><textarea id="description" name="description" required minLength={2} maxLength={4000} placeholder="Was passiert mit der Waschmaschine?"/></div>
       <div className="full check"><input id="inq-terms" name="terms" type="checkbox" value="yes"/><label htmlFor="inq-terms">Ich akzeptiere den Datenschutzhinweis und die Vermittlung meiner Angaben an einen passenden Reparaturpartner.</label></div>
     </div>
     <button className="primary full" disabled={sending}>{sending?'Wird gesendet …':'Anfrage über WASCHMATIK senden'}</button>
   </form>
 </div></div>
}
export default InquiryModal;
