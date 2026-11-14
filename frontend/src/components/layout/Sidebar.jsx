import React from 'react';
import { LayoutDashboard, MapPinned, CloudSun, Sprout, BrainCircuit, ChartNoAxesCombined, Lightbulb, FileText, Database, Leaf, ChevronsUpDown, HelpCircle, PanelLeftClose, X, Github } from 'lucide-react';

export const NAV = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, group: 'WORKSPACE' },
  { id: 'farm', label: 'My Farm', icon: MapPinned },
  { id: 'environment', label: 'Environment', icon: CloudSun },
  { id: 'explorer', label: 'Rotation Explorer', icon: Sprout, group: 'DECISION INTELLIGENCE' },
  { id: 'predictive', label: 'Predictive Intelligence', icon: BrainCircuit },
  { id: 'comparison', label: 'Strategy Comparison', icon: ChartNoAxesCombined },
  { id: 'recommendations', label: 'Recommendations', icon: Lightbulb },
  { id: 'reports', label: 'Reports', icon: FileText, group: 'RESOURCES' },
  { id: 'sources', label: 'Data Sources', icon: Database },
];

export default function Sidebar({ active, setActive, mobileOpen, setMobileOpen, farm }) {
  return <>
    {mobileOpen && <div className="mobile-scrim" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
      <div className="brand-row"><div className="brand-logo"><Leaf size={23} strokeWidth={2.2} /></div><div className="brand-word">terra<span>AI</span><small>AGRICULTURAL INTELLIGENCE</small></div><button className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={18}/></button></div>
      <div className="sidebar-workspace"><span className="workspace-symbol">S</span><div className="workspace-copy"><b>TerraAI Workspace</b><small>Hackathon prototype</small></div><ChevronsUpDown size={15} color="#7895a0"/></div>
      <nav className="nav-list" aria-label="Main navigation">{NAV.map(({id,label,icon:Icon,group}) => <React.Fragment key={id}>{group && <div className="nav-group">{group}</div>}<button className={`nav-link ${active===id?'active':''}`} onClick={() => {setActive(id);setMobileOpen(false);}}><Icon size={18} strokeWidth={1.8}/><span>{label}</span>{id==='explorer' && <span className="nav-new">CORE</span>}</button></React.Fragment>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-tip"><div className="tip-icon"><Sprout size={20}/></div><strong>Grow smarter, together.</strong><p>Explore decisions with transparent, comparable scenarios.</p></div><div className="sidebar-user"><div className="user-avatar">T</div><div><b>TerraAI Demo</b><small>{farm?.region ?? 'Prototype workspace'}</small></div><HelpCircle size={17}/></div></div>
    </aside>
  </>;
}
