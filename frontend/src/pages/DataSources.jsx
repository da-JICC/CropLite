import React, { useEffect, useState, useMemo } from 'react';
import {getNdviStatus} from '../services/ndviService.js';
import {
  ArrowRight, ArrowUpRight, ArrowDownRight, ArrowLeft, Sprout, Waves, CloudRain, ThermometerSun, Leaf,
  MapPin, Layers3, CircleAlert, ShieldCheck, Lightbulb, TrendingUp, CalendarDays, Droplets, FlaskConical,
  RefreshCw, SlidersHorizontal, Gauge, Sun, CheckCircle2, ChevronDown, ChevronRight, ExternalLink,
  ChartNoAxesCombined, FileDown, FileText, Building2, TreePine, Info, Search, Filter, Clock3,
  CircleDot, CircleCheck, Wind, LandPlot, Tractor, PackageCheck, Target, Database, CircleHelp,
  BadgeCheck, Activity, ShieldAlert, Settings2, Sparkles, Scale, Copy, Download, Printer
} from 'lucide-react';
import { TrendChart, ProjectionChart } from '../components/charts/TrendChart.jsx';
import FarmMap from '../components/maps/FarmMap.jsx';
import { MockFlag, SectionHeading, Panel, Stat, Bar, SoftButton, Disclaimer, Chip, Explain } from '../components/ui/Elements.jsx';
import { priorities, weightedScore, criteria, strategyPalette } from '../utils/strategy.js';

import { CAT_COLORS, cropEmoji, FARM_LABEL, monthsBySeason, clean, fmt, currentMonth, FarmChooser, PriorityChooser, CropPill, Timeline, ScoreBar, RotationCard, PriorityButtons } from './shared.jsx';
export function DataSources({sources}) {
  const [filter,setFilter]=useState('All');
  const [search,setSearch]=useState('');
  const [ndviBackend,setNdviBackend]=useState(null);
  useEffect(()=>{const ctrl=new AbortController();getNdviStatus(ctrl.signal).then(setNdviBackend).catch(()=>setNdviBackend(null));return ()=>ctrl.abort();},[]);
  const categories=['All','NASA observations','Geospatial & climate','Soil & agriculture'];
  const filtered=sources.filter(s=>(filter==='All'||s.category===filter) && (s.name+' '+s.variables+' '+s.institution).toLowerCase().includes(search.toLowerCase()));
  return <>
    <SectionHeading overline="SCIENTIFIC TRANSPARENCY" title="Built to connect with real Earth data." description="A transparent inventory of Earth data sources, with an optional Copernicus NDVI integration." action={<Chip variant={ndviBackend?.copernicus_configured?'positive':'warning'}>{ndviBackend?.copernicus_configured?'COPERNICUS AUTH CONFIGURED':'NDVI API · CONFIGURATION REQUIRED'}</Chip>}/>
    <div className="sources-intro"><div className="source-intro-symbol"><Database size={27}/></div><div><b>Integration roadmap + optional live NDVI</b><p>All sources except Copernicus are planning candidates. The NDVI service is implemented, but real observations require configured credentials and a successful request. "Selected" elsewhere does not mean connected.</p></div></div>
    <div className="sources-tools"><div className="filter-row">{categories.map(c=><button className={`filter-pill ${filter===c?'active':''}`} onClick={()=>setFilter(c)} key={c}>{c}</button>)}</div><label className="source-search"><Search size={17}/><input placeholder="Search a source or variable…" value={search} onChange={e=>setSearch(e.target.value)} /></label></div>
    <div className="source-summary"><span>{filtered.length} of {sources.length} sources</span><span><i/> Copernicus NDVI: {ndviBackend?.copernicus_configured?'OAuth configured':'Setup required'}</span></div>
    <div className="source-list"><div className="source-list-head"><span>DATA SOURCE</span><span>VARIABLES & PURPOSE</span><span>STATUS</span><span>OFFICIAL LINK</span></div>{filtered.map(s=><div className="source-list-row" key={s.id}><div><div className="source-monogram">{s.name.slice(0,2).toUpperCase()}</div><div><strong>{s.name}</strong><small>{s.institution}</small></div></div><div><strong>{s.variables}</strong><small>{s.application}</small></div><div><Chip variant={s.id==='s9' ? (ndviBackend?.copernicus_configured?'positive':'sky') : s.status==='Selected'?'positive':s.status==='Under evaluation'?'sky':'neutral'}>{s.id==='s9' ? (ndviBackend?.copernicus_configured?'OAuth configured':'NDVI API available') : s.status}</Chip></div><div><a href={s.url} target="_blank" rel="noreferrer" aria-label={`Open ${s.name} official site`}>Official website <ExternalLink size={15}/></a></div></div>)}{filtered.length===0&&<div className="empty-state">No sources found. Try another filter or search term.</div>}</div>
    <Disclaimer>NASA, USGS and FAO feeds remain unconnected. A separate TerraAI backend can request actual Sentinel-2 NDVI statistics from Copernicus after OAuth setup. No other agricultural dashboard measurements are live.</Disclaimer>
  </>;
}
