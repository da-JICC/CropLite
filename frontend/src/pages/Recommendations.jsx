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
export function Recommendations({farm,recs,rotations,navigate}) {
  const [filter,setFilter]=useState('All');
  const opts=['All','Soil health','Water','Erosion'];
  const filtered=recs.filter(r=>filter==='All'||r.kind===filter);
  return <>
    <SectionHeading overline="ACTIONABLE DECISION SUPPORT" title="Recommendations with reasons." description={`Transparent suggestions shaped by the illustrative profile of ${farm.name}.`} action={<MockFlag/>}/>
    <div className="rec-header"><div><span className="rec-header-icon"><Lightbulb size={25}/></span><div><b>Explore opportunities, not prescriptions</b><p>Each suggestion includes the evidence considered, potential benefits, risks, and what still needs expert review.</p></div></div></div>
    <div className="filter-row">{opts.map(opt=><button key={opt} className={`filter-pill ${filter===opt?'active':''}`} onClick={()=>setFilter(opt)}>{opt}</button>)}</div>
    <div className="recommendation-stack">{filtered.length===0?<div className="panel empty-state">No {filter.toLowerCase()} suggestions in this mock farm. Try another category.</div>:filtered.map((r,i)=><article className="recommendation-card" key={r.id}><div className="rec-number">0{i+1}</div><div className="rec-main"><div className="rec-top"><Chip variant={r.severity==='Attention'?'warning':'positive'}>{r.severity}</Chip><span className="rec-kind">{r.kind}</span></div><h3>{r.title}</h3><p>{r.reason}</p><div className="rec-facts"><div><strong><CheckCircle2 size={15}/> Potential benefit</strong><span>{r.benefit}</span></div><div><strong><CircleAlert size={15}/> What to validate</strong><span>{r.risk}</span></div></div><div className="rec-bottom"><span><Info size={14}/> {r.uncertainty}</span><button className="text-link" onClick={()=>navigate('comparison')}>Explore strategy {r.strategy} <ArrowRight size={16}/></button></div></div></article>)}</div>
    <Disclaimer>Suggestions are illustrative decision-support options and cannot substitute for on-site assessment and agricultural expertise.</Disclaimer>
  </>;
}

