import { ArrowRight, Building2, MapPin } from 'lucide-react';
import type { Business } from '../../types';
function BusinessCard({b,onSelect}:{b:Business;onSelect:(b:Business)=>void}){return <article className="business-card"><div className="business-main"><div className="business-image"><Building2 size={28}/></div><div><div className="badge">Aktiv</div><h3>{b.name}</h3><div className="meta"><span><MapPin size={15}/>{b.city}</span></div><p>Waschmaschinen-Reparaturpartner von WASCHMATIK.</p></div></div><div className="business-action"><button className="primary" onClick={()=>onSelect(b)}>Anfrage senden <ArrowRight size={18}/></button></div></article>}
export default BusinessCard;
