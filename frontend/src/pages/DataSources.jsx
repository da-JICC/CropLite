import React, { useState, useMemo } from 'react';
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
  const categories=['All','NASA observations','Geospatial & climate','Soil & agriculture'];
  const filtered=sources.filter(s=>(filter==='All'||s.category===filter) && (s.name+' '+s.variables+' '+s.institution).toLowerCase().includes(search.toLowerCase()));
  return <>
    <SectionHeading overline="SCIENTIFIC TRANSPARENCY" title="Built to connect with real Earth data." description="A transparent inventory of candidate data sources for future integration." action={<Chip variant="warning">0 SOURCES CONNECTED</Chip>}/>
    <div className="sources-intro"><div className="source-intro-symbol"><Database size={27}/></div><div><b>Integration roadmap, not a live data feed</b><p>These are sources the team may evaluate. "Selected" means a planning preference—not an active integration, completed download or proof of suitability.</p></div></div>
    <div className="sources-tools"><div className="filter-row">{categories.map(c=><button className={`filter-pill ${filter===c?'active':''}`} onClick={()=>setFilter(c)} key={c}>{c}</button>)}</div><label className="source-search"><Search size={17}/><input placeholder="Search a source or variable…" value={search} onChange={e=>setSearch(e.target.value)} /></label></div>
    <div className="source-summary"><span>{filtered.length} of {sources.length} sources</span><span><i/> Integration status: research only</span></div>
    <div className="source-list"><div className="source-list-head"><span>DATA SOURCE</span><span>VARIABLES & PURPOSE</span><span>STATUS</span><span>OFFICIAL LINK</span></div>{filtered.map(s=><div className="source-list-row" key={s.id}><div><div className="source-monogram">{s.name.slice(0,2).toUpperCase()}</div><div><strong>{s.name}</strong><small>{s.institution}</small></div></div><div><strong>{s.variables}</strong><small>{s.application}</small></div><div><Chip variant={s.status==='Selected'?'positive':s.status==='Under evaluation'?'sky':'neutral'}>{s.status}</Chip></div><div><a href={s.url} target="_blank" rel="noreferrer" aria-label={`Open ${s.name} official site`}>Official website <ExternalLink size={15}/></a></div></div>)}{filtered.length===0&&<div className="empty-state">No sources found. Try another filter or search term.</div>}</div>
    <Disclaimer>All data source entries are candidates only. This frontend makes no external requests to NASA, USGS, FAO or any other provider.</Disclaimer>
  </>;
}
