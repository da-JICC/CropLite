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
export function Comparison({farm,rotations,cropById,priority,setPriority,navigate}) {
  const [metric,setMetric]=useState('soil');
  const weights={balanced:'Soil 20% · Low water demand 20% · Drought resilience 20% · Market fit 20% · Ease of adoption 20%',soil:'Soil 38% · Nutrient cycling 26% · Erosion reduction 22% · Drought resilience 14%',water:'Low water demand 58% · Drought resilience 24% · Soil 18%',climate:'Drought resilience 46% · Low water demand 23% · Erosion reduction 20% · Soil 11%',market:'Market fit 62% · Ease of adoption 22% · Low water demand 16%'};
  const selectedCriterion=criteria.find(c=>c.key===metric) || criteria[0];
  return <>
    <SectionHeading overline="TRADE-OFF ANALYSIS" title="Compare before you decide." description="Three rotation pathways, one consistent set of illustrative criteria. Your current rotation stays in the comparison." action={<MockFlag/>}/>
    <div className="comparison-toolbar"><div><b>Evaluation priority</b><p>Weighted fit indicators update when your objective changes.</p></div><PriorityChooser priority={priority} setPriority={setPriority}/></div>
    <div className="comparison-cards">{rotations.map(r=><div className="comparison-top-card" key={r.id} style={{'--rotation-color':strategyPalette[r.id]}}><div className="compare-letter">{r.id}</div><div><small>STRATEGY {r.id} · {r.focus.toUpperCase()}</small><h3>{r.title}</h3><p>{r.subtitle}</p></div><div className="priority-fit"><strong>{weightedScore(r,priority)}</strong><small>/100 weighted fit</small></div><Timeline rotation={r} cropById={cropById} compact/></div>)}</div>
    <div className="comparison-table-wrap"><table className="comparison-table"><thead><tr><th>CRITERION</th>{rotations.map(r=><th key={r.id}><span className="compare-dot" style={{background:strategyPalette[r.id]}}/> STRATEGY {r.id}</th>)}</tr></thead><tbody>{criteria.map(({key,label,higher})=><tr key={key}><td><strong>{label}</strong><span>{key==='water'?'Lower demand is preferable':'Higher potential is preferable'}</span></td>{rotations.map(r=><td key={r.id}><div className="table-metric"><strong>{r[key]}<small>/100</small></strong><Bar value={r[key]} color={strategyPalette[r.id]}/></div></td>)}</tr>)}</tbody></table></div>
    <div className="comparison-charts"><Panel title="Explore one criterion" subtitle="See the trade-off without collapsing dimensions" action={<label className="small-select"><select value={metric} aria-label="Comparison criterion" onChange={e=>setMetric(e.target.value)}>{criteria.map(c=><option value={c.key} key={c.key}>{c.label}</option>)}</select><ChevronDown size={14}/></label>}><div className="horizontal-bars">{rotations.map(r=><div className="horizontal-bar-item" key={r.id}><div><strong>{r.title}</strong><span>{r[metric]}/100</span></div><Bar value={r[metric]} color={strategyPalette[r.id]}/></div>)}</div><p className="chart-footnote">{selectedCriterion.label}: {selectedCriterion.higher?'higher value indicates more modelled potential':'lower value indicates less modelled demand'}. Scores are illustrative, not measured.</p></Panel><Panel title="How the fit indicator works" subtitle="Transparent weights, no hidden optimization"><div className="weight-notes"><div className="weight-notes-icon"><Scale size={22}/></div><h3>{priorities.find(p=>p.id===priority)?.label}</h3><p>{weights[priority]}</p><span>All values start on an illustrative 0–100 scale. <b>Water demand is inverted (100 − demand)</b> when calculating fit. This is a teaching aid, not a scientifically validated aggregate.</span></div></Panel></div>
    <Panel title="Benefits, risks and information gaps" subtitle="Every scenario requires context before implementation"><div className="tradeoffs-grid">{rotations.map(r=><div className="tradeoff" key={r.id}><b><span className="compare-dot" style={{background:strategyPalette[r.id]}}/> Strategy {r.id} · {r.title}</b><div className="tradeoff-line"><CheckCircle2 size={17}/><p>{r.benefit}</p></div><div className="tradeoff-line caution"><CircleAlert size={17}/><p>{r.tradeoff}</p></div><div className="tradeoff-line muted"><Info size={17}/><p>Missing: verified soil tests, local planting suitability, yield and market-price data.</p></div></div>)}</div></Panel>
    <Disclaimer>Do not treat comparison scores as experimental evidence. Local soil testing, crop advice, economics, equipment constraints and climate validation are necessary.</Disclaimer>
  </>;
}

