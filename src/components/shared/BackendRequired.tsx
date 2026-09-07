
function BackendRequired({title}:{title:string}){return <main><section className="page-top"><div className="shell auth-wrap"><div className="card auth-card"><div className="eyebrow">BACKEND BENÖTIGT</div><h1>{title}</h1><p>Dieser Bereich verwendet den echten WASCHMATIK-Server mit Supabase Auth, Datenbank, RLS und serverseitigen Funktionen. Die lokale Vorschau öffnet keine Demo-Verwaltung mehr.</p></div></div></section></main>}

export default BackendRequired;
