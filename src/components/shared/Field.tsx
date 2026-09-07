
function Field({label,name,type='text',required=false}:{label:string;name:string;type?:string;required?:boolean}){return <div><label>{label}{required?' *':''}</label><input name={name} type={type} required={required}/></div>}

export default Field;
