import React from 'react';
import {CloudSun, LayoutDashboard, X} from 'lucide-react';
import CropLiteBrand from '../ui/CropLiteBrand.jsx';

export const NAV=[
  {id:'overview',label:'Overview — My Farm',icon:LayoutDashboard},
  {id:'environment',label:'Environment',icon:CloudSun},
];
export default function Sidebar({active,setActive,mobileOpen,setMobileOpen}) {
  return <>
    {mobileOpen&&<div className="mobile-scrim" onClick={()=>setMobileOpen(false)}/>}
    <aside className={`sidebar ${mobileOpen?'open':''}`}>
      <div className="brand-row"><CropLiteBrand inverse tagline/><button className="mobile-close" onClick={()=>setMobileOpen(false)} aria-label="Cerrar menú"><X size={18}/></button></div>
      <div className="sidebar-workspace"><span className="workspace-symbol">T</span><div className="workspace-copy"><b>CropLite Workspace</b><small>Geospatial monitoring · Phase 1</small></div></div>
      <nav className="nav-list" aria-label="Navegación principal">
        <div className="nav-group">WORKSPACE</div>
        {NAV.map(({id,label,icon:Icon})=><button key={id} className={`nav-link ${active===id?'active':''}`} onClick={()=>{setActive(id);setMobileOpen(false);}}><Icon size={18}/><span>{label}</span></button>)}
      </nav>
      <div className="sidebar-bottom"><div className="sidebar-tip"><div className="tip-icon"><img src="/brand/croplite-symbol.svg" alt="" width="26" height="26"/></div><strong>Una región. Dos fuentes.</strong><p>NDVI de Copernicus y temperatura del aire de NASA POWER, sin datos simulados.</p></div><div className="sidebar-user"><div className="user-avatar">T</div><div><b>CropLite</b><small>NASA Space Apps 2026</small></div></div></div>
    </aside>
  </>;
}
