import Home from './Home';
import AdminApproval from '../admin/AdminApproval';
import Finder from './Finder';
import PartnerApply from './PartnerApply';
import Contact from './Contact';
import Legal from './Legal';
import WorkflowAction from './WorkflowAction';

function Public({route,nav,onToast}:{route:string;nav:(x:string)=>void;onToast:(x:string)=>void}){
  if(route.startsWith('admin-approve')) return <AdminApproval/>;
  if(route.startsWith('partner-action')) return <WorkflowAction kind="partner"/>;
  if(route.startsWith('customer-action')) return <WorkflowAction kind="customer"/>;
  if(route==='finder') return <Finder onToast={onToast}/>;
  if(route==='partner') return <PartnerApply onToast={onToast}/>;
  if(route==='contact') return <Contact/>;
  if(route.startsWith('legal/')) return <Legal kind={route.split('/')[1]}/>;
  return <Home nav={nav}/>;
}
export default Public;
