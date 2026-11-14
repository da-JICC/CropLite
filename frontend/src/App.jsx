import React, { useState, useEffect, useMemo } from 'react';
import { Bell, Menu, Search, ChevronDown, CircleHelp, ArrowUpRight, FlaskConical, X, CheckCircle2 } from 'lucide-react';
import Sidebar, { NAV } from './components/layout/Sidebar.jsx';
import { dataService } from './services/dataService.js';
import { priorities } from './utils/strategy.js';
import { MockFlag, Disclaimer } from './components/ui/Elements.jsx';
import { Dashboard, MyFarm, Environment, RotationExplorer, Predictive, Comparison, Recommendations, Reports, DataSources } from './pages/index.jsx';

const pages = {
  overview: Dashboard, farm: MyFarm, environment: Environment, explorer: RotationExplorer,
  predictive: Predictive, comparison: Comparison, recommendations: Recommendations,
  reports: Reports, sources: DataSources
};

export default function App() {
  const [active, setActive] = useState('overview');
  const [farmId, setFarmId] = useState('casablanca');
  const [farmList, setFarmList] = useState([]);
  const [cropList, setCropList] = useState([]);
  const [sourceList, setSourceList] = useState([]);
  const [environment, setEnvironment] = useState(null);
  const [rotations, setRotations] = useState([]);
  const [recs, setRecs] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [priority, setPriority] = useState('balanced');
  const [season, setSeason] = useState('all');
  const [layer, setLayer] = useState('moisture');
  const [strategyId, setStrategyId] = useState('B');
  const [horizon, setHorizon] = useState(4);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [notificationOpen, setNotificationOpen] = useState(false);

  useEffect(() => {
    Promise.all([dataService.getFarms(), dataService.getCrops(), dataService.getSources()])
      .then(([farms, crops, sources]) => {setFarmList(farms);setCropList(crops);setSourceList(sources);})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    Promise.all([dataService.getEnvironmentalConditions(farmId),dataService.getRotations(farmId),dataService.getRecommendations(farmId),dataService.getPredictions(farmId)])
      .then(([env, rotation, recommendations, forecast]) => {setEnvironment(env);setRotations(rotation);setRecs(recommendations);setPrediction(forecast);});
  }, [farmId]);

  const farm = farmList.find(f => f.id === farmId) || farmList[0];
  const currentStrategy = rotations.find(r => r.id === strategyId) || rotations[1] || rotations[0];
  const cropById = useMemo(() => Object.fromEntries(cropList.map(c => [c.id, c])), [cropList]);
  const navigate = (id) => {setActive(id);window.scrollTo({top:0,behavior:'smooth'});};
  const showToast = (message) => {setToast(message);window.setTimeout(() => setToast(''),3600);};
  const shared = {farm, farmId, setFarmId, farms:farmList, crops:cropList, cropById, environment, rotations,
    recs, prediction, sources:sourceList, priority, setPriority, season,setSeason,layer,setLayer,strategyId,setStrategyId,
    currentStrategy,horizon,setHorizon,navigate,showToast};
  const Screen = pages[active] || Dashboard;
  return <div className="app-shell">
    <Sidebar active={active} setActive={navigate} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} farm={farm}/>
    <div className="app-main">
      <header className="topbar">
        <div className="topbar-left"><button onClick={()=>setMobileOpen(true)} className="menu-toggle" aria-label="Open menu"><Menu size={21}/></button><span className="breadcrumb">WORKSPACE</span><span className="breadcrumb-sep">/</span><strong>{NAV.find(n=>n.id===active)?.label || 'Overview'}</strong></div>
        <div className="topbar-right"><span className="mode-pill"><span/> PROTOTYPE</span><div className="search-box"><Search size={17}/><input aria-label="Search pages" placeholder="Search pages..." value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){const match=NAV.find(n=>n.label.toLowerCase().includes(query.toLowerCase()));if(match){navigate(match.id);setQuery('');} else showToast('No matching page found');}}}/><kbd>↵</kbd></div><div className="topbar-notice-wrap"><button className="topbar-icon" title="Notifications" aria-label="Notifications" onClick={()=>setNotificationOpen(v=>!v)}><Bell size={19}/><i/></button>{notificationOpen && <div className="notice-popover"><b>Demo notifications</b><p>Your workspace uses illustrative data. No live alerts are connected.</p></div>}</div><div className="top-avatar">T</div></div>
      </header>
      <main className="page-body">{loading || !farm || !environment ? <div className="loading-screen"><div className="loading-mark">✦</div><h2>Preparing the TerraAI demo…</h2><p>Loading locally simulated farm profiles</p></div> : <Screen {...shared}/>}</main>
      <footer className="app-footer"><span>© TerraAI · Agricultural decision-support prototype</span><span>NASA Space Apps Challenge 2026 concept · Other dashboard metrics simulated · Optional live NDVI in Environmental Conditions</span></footer>
    </div>
    {toast && <div role="status" className="toast"><CheckCircle2 size={18}/>{toast}<button onClick={()=>setToast('')} aria-label="Dismiss"><X size={15}/></button></div>}
  </div>;
}
