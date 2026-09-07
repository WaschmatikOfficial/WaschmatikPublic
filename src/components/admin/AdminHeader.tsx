
function AdminHeader({title,action}:{title:string;action?:React.ReactNode}){return <div className="admin-head"><div><div className="eyebrow">WASCHMATIK ADMIN</div><h1>{title}</h1></div>{action}</div>}

export default AdminHeader;
