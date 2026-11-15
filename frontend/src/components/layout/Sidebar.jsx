import React from 'react';
import {CloudSun, Leaf, LayoutDashboard, X} from 'lucide-react';

export const NAV=[
  {id:'overview',label:'Overview — My Farm',icon:LayoutDashboard},
  {id:'environment',label:'Environment',icon:CloudSun},
];
export default function Sidebar({active,setActive,mobileOpen,setMobileOpen}) {
  return <>
    {mobileOpen&&<div className="mobile-scrim" onClick={()=>setMobileOpen(false)}/>}
    <aside className={`sidebar ${mobileOpen?'open':''}`}>
      <div className="brand-row"><div className="brand-logo"><Leaf size={23}/></div><div className="brand-word">terra<span>AI</span><small>AGRICULTURAL INTELLIGENCE</small></div><button className="mobile-close" onClick={()=>setMobileOpen(false)} aria-label="Cerrar menú"><X size={18}/></button></div>
      <div className="sidebar-workspace"><span className="workspace-symbol">T</span><div className="workspace-copy"><b>CropLite Workspace</b><small>Geospatial monitoring · Phase 1</small></div></div>
      <nav className="nav-list" aria-label="Navegación principal">
        <div className="nav-group">WORKSPACE</div>
        {NAV.map(({id,label,icon:Icon})=><button key={id} className={`nav-link ${active===id?'active':''}`} onClick={()=>{setActive(id);setMobileOpen(false);}}><Icon size={18}/><span>{label}</span></button>)}
      </nav>
      <div className="sidebar-bottom"><div className="sidebar-tip"><div className="tip-icon"><Leaf size={20}/></div><strong>Una región. Dos fuentes.</strong><p>NDVI de Copernicus y temperatura del aire de NASA POWER, sin datos simulados.</p></div><div className="sidebar-user"><div className="user-avatar">T</div><div><b>CropLite</b><small>NASA Space Apps 2026</small></div></div></div>
    </aside>
  </>;
}
