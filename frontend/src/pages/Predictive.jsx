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
export function Predictive({farm,environment,priority,prediction}) {
  const [horizon,setHorizon] = useState('30');
  const [scenario,setScenario] = useState('dry');
  const a=Number(horizon);
  const baseline=farm.soilMoisture;
  const values=[{day:'Day 0',baseline,dry:baseline}, ...[7,15,30].map((day,i)=>({day:`Day ${day}`,rawDay:day,baseline:prediction?.moistureReference?.[i] ?? Math.max(9,Math.round(baseline-day*.13)),dry:prediction?.moistureDry?.[i] ?? Math.max(6,Math.round(baseline-day*.32))}))].filter(point=>point.rawDay===undefined || point.rawDay<=a);
  return <>
    <SectionHeading overline="HYPOTHETICAL PLANNING" title="Explore future scenarios." description="Contrast possible conditions and uncertainties. No predictive model has been trained or executed." action={<Chip variant="warning">NOT A REAL FORECAST</Chip>}/>
    <div className="prediction-banner"><div className="prediction-art"><Sparkles size={31}/></div><div><b>Scenario explorer — demonstration only</b><p>These curves are mathematically illustrative, not model output, probability estimates or weather forecasts. Historical observations are not connected.</p></div></div>
    <div className="predictive-controls"><div><span className="detail-caption">PLANNING HORIZON</span><div className="segmented">{['7','15','30'].map(n=><button className={horizon===n?'active':''} key={n} onClick={()=>setHorizon(n)}>{n} days</button>)}</div></div><div><span className="detail-caption">ILLUSTRATIVE CONDITION</span><div className="segmented">{[['dry','Drier than usual'],['reference','Reference scenario']].map(([id,label])=><button className={scenario===id?'active':''} key={id} onClick={()=>setScenario(id)}>{label}</button>)}</div></div></div>
    <div className="prediction-grid"><Panel title="Possible soil moisture paths" subtitle={`${farm.name} · Hypothetical ${horizon}-day horizon`}><div className="chart-head-note"><span className="legend-dot green"/> Reference <span className="legend-dot amber"/> Dry scenario</div><ProjectionChart values={values} height={286}/><p className="chart-footnote">Generated from fixed illustrative arithmetic; values are neither observed nor predicted.</p></Panel><Panel title="Potential planning impacts" subtitle="Discussion prompts for a local expert"><div className="impact-list"><div><span className="impact-symbol blue"><Droplets size={19}/></span><div><small>SOIL MOISTURE</small><strong>{scenario==='dry'?'Consider elevated water pressure':'Compare against drier planning case'}</strong><p>Review irrigation allocation and rooting depths.</p></div></div><div><span className="impact-symbol amber"><ThermometerSun size={19}/></span><div><small>TEMPERATURE</small><strong>Monitor sensitive crop stages</strong><p>Climate scenarios can shift growing windows.</p></div></div><div><span className="impact-symbol green"><Sprout size={19}/></span><div><small>CROP SELECTION</small><strong>Compare drought-tolerant alternatives</strong><p>Check region and planting suitability first.</p></div></div></div></Panel></div>
    <div className="scenario-squares"><div><div className="scenario-symbol"><Wind size={23}/></div><small>SHORT TERM</small><strong>7–30 days</strong><p>Hypothetical soil-water stress pathways.</p></div><div><div className="scenario-symbol"><CalendarDays size={23}/></div><small>SEASONAL</small><strong>Growing seasons</strong><p>Explore shifts in typical planting conditions.</p></div><div><div className="scenario-symbol"><ChartNoAxesCombined size={23}/></div><small>LONG TERM</small><strong>Multiple years</strong><p>Discuss resilience of alternative crop sequences.</p></div></div>
    <Disclaimer>Uncertainty cannot be quantified from these mock curves. Replace all illustrative values with validated forecasts and uncertainties only after a documented modelling process.</Disclaimer>
  </>;
}

