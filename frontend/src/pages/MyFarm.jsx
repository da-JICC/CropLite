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
export function MyFarm({farm,farms,farmId,setFarmId,setLayer,layer,showToast}) {
  const [selected, setSelected] = useState('profile');
  const [notes,setNotes] = useState({});
  const [water,setWater] = useState({});
  const [market,setMarket] = useState({});
  return <>
    <SectionHeading overline="YOUR FARM / PROFILE" title="Know your land." description="Select a representative farm, review its conditions and capture practical constraints." action={<FarmChooser farms={farms} farmId={farmId} setFarmId={setFarmId}/>}/>
    <div className="farm-top-grid"><Panel title="Farm location" subtitle="Click the field marker for the illustrative farm vicinity" action={<Chip variant="neutral">DEMO AREA</Chip>}><FarmMap farm={farm} layer={layer} height={300}/><div className="farm-map-switch"><button className="tiny-btn active">Farm vicinity</button><span>{farm.coordinates} · Not a cadastral boundary</span></div></Panel><Panel title="Field profile" subtitle="Representative farm attributes"><div className="profile-list">{[['FARM NAME',farm.name],['REGION',`${farm.region}, ${farm.country}`],['CULTIVATED AREA',`${farm.hectares} hectares`],['SOIL TEXTURE',farm.soil],['SOIL COMPOSITION',farm.texture],['SOIL pH',farm.ph],['ORGANIC MATTER',`${farm.organicMatter}%`],['CURRENT CROP',farm.crop],['ROTATION STAGE',farm.rotationStage]].map(([k,v])=><div key={k}><small>{k}</small><strong>{v}</strong></div>)}</div></Panel></div>
    <div className="farm-bottom-grid"><Panel title="Operational constraints" subtitle="Capture decisions that impact feasibility"><div className="form-grid"><label>Water and irrigation<select value={water[farmId]??farm.irrigation} onChange={e=>setWater(v=>({...v,[farmId]:e.target.value}))}><option>{farm.irrigation}</option><option>Rainfed only</option><option>Limited drip irrigation</option><option>Canal irrigation</option><option>Full irrigation access</option></select></label><label>Market focus<select value={market[farmId]??'Current regional outlets'} onChange={e=>setMarket(v=>({...v,[farmId]:e.target.value}))}><option>Current regional outlets</option><option>Prioritize local market</option><option>Explore forage buyers</option><option>Diversify crops</option></select></label><label className="full">Field notes<textarea rows="4" placeholder="Equipment limitations, crop preferences, growing windows…" value={notes[farmId]??''} onChange={e=>setNotes(v=>({...v,[farmId]:e.target.value}))}/></label></div><div className="form-actions"><span><Info size={14}/> Changes are session-only draft inputs.</span><button className="primary-button" onClick={()=>showToast('Farm planning notes saved for this session')}>Save draft notes <CheckCircle2 size={16}/></button></div></Panel><Panel title="Current crop history" subtitle="Previous four illustrative seasons"><div className="history-rail">{farm.history.map((crop,i)=><div className="history-node" key={i}><span>YEAR {i+1}</span><strong>{crop}</strong><small>{i===farm.history.length-1?'Most recent':'Recorded crop'}</small></div>)}</div><div className="surface-note"><Sprout size={19}/><div><strong>Why history matters</strong><p>A repeated crop can affect nutrient cycling, erosion, and pest pressure. Rotations should consider the full seasonal sequence.</p></div></div></Panel></div>
    <Disclaimer>Farm details are representative examples, not surveyed parcels. Field notes and selections are not stored remotely.</Disclaimer>
  </>;
}

