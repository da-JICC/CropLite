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
import NDVIExplorer from '../components/ndvi/NDVIExplorer.jsx';
import { MockFlag, SectionHeading, Panel, Stat, Bar, SoftButton, Disclaimer, Chip, Explain } from '../components/ui/Elements.jsx';
import { priorities, weightedScore, criteria, strategyPalette } from '../utils/strategy.js';

import { CAT_COLORS, cropEmoji, FARM_LABEL, monthsBySeason, clean, fmt, currentMonth, FarmChooser, PriorityChooser, CropPill, Timeline, ScoreBar, RotationCard, PriorityButtons } from './shared.jsx';
const metricOptions = [ {id:'moisture',label:'Soil moisture',icon:Droplets,unit:'%'},{id:'rain',label:'Rainfall',icon:CloudRain,unit:'mm'},{id:'temp',label:'Temperature',icon:ThermometerSun,unit:'°C'},{id:'ndvi',label:'Vegetation health',icon:Leaf,unit:'NDVI'},{id:'et',label:'Evapotranspiration',icon:Waves,unit:'mm/day'} ];
const definitions=[['Soil moisture anomaly','Difference from a typical soil-water level for the same time of year; negative values may indicate drier-than-normal conditions.'],['NDVI','Normalized Difference Vegetation Index: a vegetation greenness indicator derived from spectral reflectance; not a direct measurement of crop yield.'],['Evapotranspiration','Combined water movement from soil evaporation and plant transpiration.'],['Water balance','Simplified difference between water input, storage and atmospheric demand.'],['Frost risk','Potential for cold temperatures to damage sensitive crop stages.']];
export function Environment({farm,environment,layer,setLayer,season,setSeason}){
  const [metric,setMetric] = useState('moisture');
  const [definition,setDefinition]=useState(0);
  const filtered=useMemo(()=>environment.monthly.filter(row=>!monthsBySeason[season]||monthsBySeason[season].includes(row.month)),[environment,season]);
  return <>
    <SectionHeading overline="ENVIRONMENTAL INTELLIGENCE" title="Understand the conditions." description={`Environmental indicators for ${farm.region}. Explore simulated conditions and optional live Sentinel-2 NDVI.`} action={<MockFlag/>}/>
    <div className="environment-pills">{metricOptions.map(({id,label,icon:Icon})=><button key={id} type="button" className={`environment-pill ${metric===id?'active':''}`} onClick={()=>{setMetric(id);setLayer(id==='temp'?'heat':id==='rain'?'rain':id==='ndvi'?'vegetation':'moisture');}}><Icon size={18}/>{label}</button>)}</div>
    <div className="environment-grid"><Panel title="Spatial context" subtitle="Schematic field vicinity over base map" action={<label className="small-select"><Layers3 size={14}/><select aria-label="Map overlay" value={layer} onChange={e=>setLayer(e.target.value)}><option value="moisture">Moisture</option><option value="rain">Rainfall</option><option value="heat">Heat stress</option><option value="vegetation">Vegetation</option></select></label>}><FarmMap farm={farm} layer={layer} height={332}/><div className="map-legend"><span><i style={{background:layer==='rain'?'#478eb9':layer==='heat'?'#d9903e':'#368d69'}}/> Illustrative field indicator</span><span>Not remote sensing output</span></div></Panel><Panel title="Environmental history" subtitle="Illustrative monthly time series" action={<label className="small-select"><CalendarDays size={15}/><select value={season} onChange={e=>setSeason(e.target.value)} aria-label="Filter season"><option value="all">Full year</option><option value="summer">Summer</option><option value="autumn">Autumn</option><option value="winter">Winter</option><option value="spring">Spring</option></select></label>}><div className="chart-header-unit">{metricOptions.find(m=>m.id===metric)?.label}<span>{filtered.length} simulated months</span></div><TrendChart key={`${metric}-${season}`} data={filtered} metric={metric} height={274}/></Panel></div>
    <NDVIExplorer farm={farm}/>
    <div className="env-summary-grid"><div className="condition-card"><Waves size={22}/><span>WATER BALANCE</span><strong>{environment.summary.waterBalance}</strong><small>Illustrative regional context</small></div><div className="condition-card"><Sun size={22}/><span>HEAT STRESS</span><strong>{environment.summary.heat}</strong><small>Hypothetical seasonal exposure</small></div><div className="condition-card"><ThermometerSun size={22}/><span>FROST RISK</span><strong>{environment.summary.frost}</strong><small>Not a weather alert</small></div><div className="condition-card"><TreePine size={22}/><span>EROSION RISK</span><strong>{environment.summary.erosion}</strong><small>Field survey required</small></div></div>
    <Panel title="Understanding your environmental indicators" subtitle="Agricultural terminology in plain language"><div className="definition-list">{definitions.map(([term,description],i)=><button type="button" key={term} className={`definition ${definition===i?'expanded':''}`} onClick={()=>setDefinition(definition===i?-1:i)}><span><CircleHelp size={17}/><strong>{term}</strong></span><ChevronDown size={17}/>{definition===i&&<p>{description}</p>}</button>)}</div></Panel>
    <Disclaimer>Maps indicate illustrative farm vicinities; indicators and time series were constructed for this prototype. NASA observations are only available in the explicitly labelled Live NDVI field explorer after backend configuration; other dashboard indicators remain simulated.</Disclaimer>
  </>;
}

