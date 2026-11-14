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
export function RotationExplorer({farm,farms,farmId,setFarmId,rotations,cropById,crops,priority,setPriority,strategyId,setStrategyId,currentStrategy,horizon,setHorizon,navigate}){
  const [cropCategory,setCropCategory]=useState('All crops');
  const [selectedCrop,setSelectedCrop]=useState('chickpea');
  const cropCategories=['All crops','Cereal','Legume','Cover crop','Drought tolerant','Forage'];
  const filtered=crops.filter(c=>cropCategory==='All crops'||c.category===cropCategory);
  const selected=cropById[selectedCrop] || crops[0];
  return <>
    <SectionHeading overline="DECISION INTELLIGENCE / CORE FEATURE" title="Crop Rotation Explorer" description="Build better questions about your next growing seasons. Compare your current rotation with two alternatives." action={<MockFlag/>}/>
    <div className="explorer-setup"><div className="setup-label"><span className="round-icon"><Settings2 size={19}/></span><div><strong>Set your planning context</strong><p>These controls shape your illustrative comparison.</p></div></div><div className="setup-controls"><FarmChooser farms={farms} farmId={farmId} setFarmId={setFarmId} compact/><label className="chooser"><CalendarDays size={16}/><select value={horizon} onChange={e=>setHorizon(Number(e.target.value))} aria-label="Planning horizon"><option value={2}>2 seasons</option><option value={4}>4 seasons</option><option value={6}>6 seasons</option></select><ChevronDown size={14}/></label></div></div>
    <div className="explorer-priority-heading"><div><div className="overline">STEP 01</div><h2>What matters most to your farm?</h2><p>Priorities influence the transparent weighted fit indicator, not the underlying mock crop traits.</p></div></div><PriorityButtons priority={priority} setPriority={setPriority}/>
    <div className="explorer-priority-heading scenarios-title"><div><div className="overline">STEP 02</div><h2>Explore three possible strategies</h2><p>Scenario A is your baseline. B and C demonstrate alternative goals—not validated recommendations.</p></div><button className="text-link" onClick={()=>navigate('comparison')}>Full comparison <ArrowUpRight size={16}/></button></div>
    <div className="rotation-grid">{rotations.map(r=><RotationCard key={r.id} rotation={r} cropById={cropById} selected={r.id===strategyId} onClick={()=>setStrategyId(r.id)} priority={priority} horizon={horizon}/>)}</div>
    {currentStrategy&&<div className="explorer-detail"><div className="detail-title"><div><span className="round-icon"><Sprout size={21}/></span><div><div className="overline">SELECTED STRATEGY {currentStrategy.id}</div><h3>{currentStrategy.title}</h3></div></div><button className="primary-button" onClick={()=>navigate('comparison')}>Compare all strategies <ArrowRight size={17}/></button></div><div className="detail-columns"><div><span className="detail-caption">FULL ROTATION SEQUENCE</span><Timeline rotation={currentStrategy} cropById={cropById} horizon={horizon}/><div className="benefit-grid"><div className="benefit-card"><CheckCircle2 size={17}/><strong>Potential benefit</strong><p>{currentStrategy.benefit}</p></div><div className="benefit-card caution"><CircleAlert size={17}/><strong>Trade-off to evaluate</strong><p>{currentStrategy.tradeoff}</p></div></div></div><div className="detail-metrics"><span className="detail-caption">ILLUSTRATIVE CHARACTERISTICS</span><ScoreBar label="Soil health potential" value={currentStrategy.soil} color="#368f65"/><ScoreBar label="Drought resilience" value={currentStrategy.drought} color="#488daa"/><ScoreBar label="Water demand" value={currentStrategy.water} color="#cfa251"/></div></div><div className="detail-rationale"><Info size={17}/><span><b>Why this scenario?</b> {currentStrategy.why} Local suitability, planting dates, prices, and crop performance require validation.</span></div></div>}
    <div className="section-mini"><div><h2>Explore crop characteristics</h2><p>A learning library for crops used in illustrative rotations.</p></div></div>
    <div className="crop-library"><div className="crop-library-left"><div className="category-scroll">{cropCategories.map(c=><button key={c} className={`category-button ${cropCategory===c?'active':''}`} onClick={()=>setCropCategory(c)}>{c}</button>)}</div><div className="crop-chip-list">{filtered.map(c=><button onClick={()=>setSelectedCrop(c.id)} className={`library-crop ${selectedCrop===c.id?'active':''}`} key={c.id}><span>{cropEmoji[c.id]||'🌱'}</span><strong>{c.name}</strong><small>{c.category}</small></button>)}</div></div>{selected&&<div className="crop-library-right"><span className="detail-caption">CROP PROFILE · ILLUSTRATIVE</span><h3>{cropEmoji[selected.id]} {selected.name}</h3><p>{selected.category} · {selected.season} · {selected.roots} roots</p><div className="crop-characteristic"><span>Water requirement</span><strong>{selected.waterLabel}</strong><Bar value={selected.water} color="#4b94b6"/></div><div className="crop-characteristic"><span>Drought tolerance</span><strong>{selected.drought}/100</strong><Bar value={selected.drought}/></div><div className="crop-characteristic"><span>Erosion reduction potential</span><strong>{selected.erosion}/100</strong><Bar value={selected.erosion} color="#9eaa59"/></div><div className="crop-fact"><b>Nitrogen:</b> {selected.nitrogen}<br/><b>Pest-cycle note:</b> {selected.pests}</div></div>}</div>
    <Disclaimer>Rotation scenarios, agronomic indicators, weights and crop values are illustrative. A crop's presence in this demo does not establish local agronomic suitability.</Disclaimer>
  </>;
}

