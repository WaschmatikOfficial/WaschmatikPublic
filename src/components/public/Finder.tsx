import React, { useEffect, useState } from 'react';
import { Activity, Search } from 'lucide-react';
import { PROBLEMS, supabase } from '../../lib';
import type { Business } from '../../types';
import BusinessCard from './BusinessCard';
import InquiryModal from './InquiryModal';

function Finder({onToast}:{onToast:(x:string)=>void}){
 const [problem,setProblem]=useState('');
 const [zip,setZip]=useState('');
 const [results,setResults]=useState<Business[]>([]);
 const [loading,setLoading]=useState(false);
 const [searched,setSearched]=useState(false);
 const [selected,setSelected]=useState<Business|null>(null);
 const search=async(p=problem,z=zip)=>{
   if(!/^\d{5}$/.test(z)||!p){onToast('Bitte Problem und gültige fünfstellige PLZ eingeben.');return}
   setLoading(true);setSearched(true);setResults([]);
   if(!supabase){setLoading(false);onToast('Die Verbindung zum Service ist momentan nicht verfügbar.');return}
   const {data,error}=await supabase.rpc('find_matching_partners',{p_postal_code:z});
   if(error){setResults([]);onToast('Die Partnersuche konnte gerade nicht geladen werden.');setLoading(false);return}
   const rows=(data||[]) as Array<{partner_id:string;business_name:string;city:string}>;
   const mapped:Business[]=rows.map(r=>({
     id:r.partner_id, name:r.business_name, city:r.city, email:'', active:true,
     service_area:[], rating:undefined, review_count:0
   }));
   setResults(mapped);setLoading(false);
 };
 useEffect(()=>{
   const h=(e:any)=>{if(e.detail){setProblem(e.detail.problem);setZip(e.detail.zip);setTimeout(()=>search(e.detail.problem,e.detail.zip),0)}};
   addEventListener('waschmatik:search',h);return()=>removeEventListener('waschmatik:search',h)
 },[]);
 let resultContent:React.ReactNode;
 if(loading) resultContent=<div className="empty loading"><Activity className="spin"/> Suche läuft …</div>;
 else if(searched&&results.length===0) resultContent=<div className="empty"><h3>Für diese PLZ ist momentan kein passender Partner verfügbar.</h3><p>Wir erweitern das WASCHMATIK-Partnernetz laufend.</p></div>;
 else if(!searched) resultContent=<div className="empty">Wähle ein Problem und gib deine PLZ ein, um passende Betriebe zu suchen.</div>;
 else resultContent=<div className="result-list">{results.map(b=><BusinessCard b={b} key={b.id} onSelect={setSelected}/>)}</div>;
 return <main>
   <section className="page-top"><div className="shell"><div className="eyebrow">REPARATURSERVICE</div><h1>Passenden WASCHMATIK-Partner finden</h1><p>Wir zeigen dir aktive Reparaturpartner passend zu deiner Postleitzahl.</p>
   <div className="search-panel"><div><label htmlFor="finder-problem">Problem</label><select id="finder-problem" value={problem} onChange={e=>setProblem(e.target.value)}><option value="">Bitte auswählen</option>{PROBLEMS.map(p=><option key={p}>{p}</option>)}</select></div>
   <div><label htmlFor="finder-zip">PLZ</label><input id="finder-zip" inputMode="numeric" maxLength={5} value={zip} onChange={e=>setZip(e.target.value.replace(/\D/g,'').slice(0,5))} placeholder="z. B. 41542"/></div>
   <button className="primary search-button" onClick={()=>search()}>Suchen <Search size={18}/></button></div></div></section>
   <section><div className="shell">{resultContent}</div></section>
   {selected&&<InquiryModal business={selected} problem={problem} zip={zip} close={()=>setSelected(null)} onToast={onToast}/>} 
 </main>;
}

export default Finder;
