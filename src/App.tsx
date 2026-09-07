import { useEffect, useState } from 'react';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import Public from './components/public/Public';
import Partner from './components/partner/Partner';
import Admin from './components/admin/Admin';

function currentRoute(){
  const raw=window.location.hash.replace(/^#/,'');
  return raw || 'home';
}

export default function App(){
  const hostname=window.location.hostname;
  const isAdminHost=hostname==='admin.waschmatik.de'||hostname.startsWith('admin.');
  const isAdminMode=(import.meta.env.VITE_SITE_MODE||'public')==='admin'||isAdminHost;
  const [route,setRoute]=useState(()=>currentRoute());
  const [menu,setMenu]=useState(false);
  const [toast,setToast]=useState('');

  useEffect(()=>{
    const handleHashChange=()=>setRoute(currentRoute());
    window.addEventListener('hashchange',handleHashChange);
    return()=>window.removeEventListener('hashchange',handleHashChange);
  },[]);

  useEffect(()=>{if(!toast)return;const timer=window.setTimeout(()=>setToast(''),2800);return()=>window.clearTimeout(timer)},[toast]);

  useEffect(()=>{
    document.title=isAdminMode?'WASCHMATIK Admin':'WASCHMATIK – Reparaturservice';
    let meta=document.querySelector('meta[name="robots"]') as HTMLMetaElement|null;
    if(!meta){meta=document.createElement('meta');meta.name='robots';document.head.appendChild(meta)}
    meta.content=isAdminMode?'noindex,nofollow,noarchive':'index,follow';
  },[isAdminMode]);

  const nav=(nextRoute:string)=>{window.location.hash=nextRoute;setMenu(false)};
  let safeRoute=route;
  if(isAdminMode){
    safeRoute=route.startsWith('admin-approve')?route:(route==='home'||!route.startsWith('admin'))?'admin':route;
  }else if(route.startsWith('admin') && !route.startsWith('admin-approve')){
    safeRoute='home';
  }

  const page=safeRoute.startsWith('admin/')||safeRoute==='admin'
    ? <Admin onToast={setToast}/>
    : safeRoute.startsWith('partner/')||safeRoute==='partner-login'
      ? <Partner onToast={setToast}/>
      : <Public route={safeRoute} nav={nav} onToast={setToast}/>;

  return <>
    {!isAdminMode&&<Header nav={nav} menu={menu} setMenu={setMenu}/>}
    {page}
    {!isAdminMode&&<Footer nav={nav}/>}
    {toast&&<div className="toast" role="status" aria-live="polite">{toast}</div>}
  </>;
}
