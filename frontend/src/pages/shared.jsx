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

export const CAT_COLORS = { Cereal: 'gold', Legume: 'mint', 'Cover crop': 'violet', 'Drought tolerant': 'sky', Forage: 'olive' };
export const cropEmoji = { wheat:'🌾', barley:'🌾', oats:'🌾', chickpea:'🫘', vetch:'🍃', lupin:'🌱', rye:'🌿', maize:'🌽', faba:'🫘', sorghum:'🌾', alfalfa:'🌱', mustard:'🌼' };
export const FARM_LABEL = 'All farms, figures and polygons in this prototype are simulated.';
export const monthsBySeason = { all: null, summer: ['Dec','Jan','Feb'], autumn: ['Mar','Apr','May'], winter: ['Jun','Jul','Aug'], spring: ['Sep','Oct','Nov'] };
export const clean = (n) => Math.round(n);
export const fmt = (val) => typeof val === 'number' ? val.toLocaleString('en-US') : val;
export const currentMonth = 'Nov'; // Stable mock reference; not a real current observation.
export function FarmChooser({ farms, farmId, setFarmId, compact=false }) { return <label className={`chooser ${compact?'compact':''}`}><MapPin size={16}/><select aria-label="Selected farm" value={farmId} onChange={e=>setFarmId(e.target.value)}>{farms.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select><ChevronDown size={14}/></label>; }
export function PriorityChooser({ priority, setPriority }) { return <label className="chooser"><SlidersHorizontal size={16}/><select value={priority} aria-label="Farmer priority" onChange={e=>setPriority(e.target.value)}>{priorities.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select><ChevronDown size={14}/></label>; }
export function CropPill({ id, cropById, abbreviated=false }) { const c = cropById[id]; return <div title={c ? `${c.name} · ${c.category}` : id} className={`crop-pill ${CAT_COLORS[c?.category]||'neutral'}`}><span>{cropEmoji[id]||'🌱'}</span>{abbreviated ? c?.name : c?.name||id}</div>; }
export function Timeline({ rotation, cropById, horizon=4, compact=false }) { if(!rotation)return null; const sequence=Array.from({length:horizon},(_,i)=>rotation.crops[i%rotation.crops.length]);return <div className={`crop-timeline ${compact?'compact':''}`}>{sequence.map((id,i)=><div className="crop-step" key={`${i}-${id}`}><span className="crop-season">SEASON {i+1}</span><CropPill id={id} cropById={cropById} />{i<horizon-1 && <span className="timeline-link">→</span>}</div>)}</div>; }
export function ScoreBar({ label, value, color, hint }) {return <div className="metric-row"><div><span>{label}</span><b>{value}<small>/100</small></b></div><Bar value={value} color={color}/>{hint&&<small className="metric-hint">{hint}</small>}</div>}
export function RotationCard({ rotation, cropById, selected, onClick, priority, horizon=4 }) { const c=strategyPalette[rotation.id];return <button className={`rotation-card ${selected?'selected':''}`} onClick={onClick} type="button" style={{'--rotation-color':c}} aria-pressed={selected}><div className="rotation-card-top"><span className="rotation-letter" style={{background:c}}>{rotation.id}</span><span className="rotation-focus">{rotation.focus}</span></div><h3>{rotation.title}</h3><p>{rotation.subtitle}</p><Timeline rotation={rotation} cropById={cropById} horizon={Math.min(4,horizon)} compact/><div className="rotation-minis"><div><span>Soil potential</span><b>{rotation.soil}/100</b></div><div><span>Water demand</span><b>{rotation.water}/100</b></div></div><div className="rotation-footer"><span>Priority fit: <b>{weightedScore(rotation,priority)}/100</b></span><span>{selected?'Selected ✓':'Explore →'}</span></div></button> }
export function PriorityButtons({ priority, setPriority }) { return <div className="priority-buttons">{priorities.map(p=><button type="button" onClick={()=>setPriority(p.id)} className={`priority-btn ${priority===p.id?'active':''}`} key={p.id}>{p.label}</button>)}</div>; }

