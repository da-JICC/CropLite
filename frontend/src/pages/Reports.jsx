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
function downloadableHtml(farm, rotations, priority, environment, recommendations, cropById) {
  const esc = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  const rows=rotations.map(r=>`<tr><td>${r.id} — ${esc(r.title)}</td><td>${r.crops.map(id=>esc(cropById[id]?.name||id)).join(' → ')}</td><td>${r.soil}/100</td><td>${r.water}/100</td><td>${r.drought}/100</td></tr>`).join('');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>CropLite · ${esc(farm.name)} report</title><style>body{font-family:Arial,sans-serif;max-width:900px;margin:40px auto;color:#153640;line-height:1.5}h1{color:#247656}table{border-collapse:collapse;width:100%;margin:16px 0}th,td{text-align:left;border:1px solid #ddd;padding:12px}th{background:#eef5ef}.warning{padding:14px;border-left:4px solid #c19b48;background:#fbf8ec}small{color:#567}@media print{body{margin:18mm}}</style><small>TERRAAI / SIMULATED REPORT</small><h1>${esc(farm.name)} — Rotation assessment</h1><p><b>Location:</b> ${esc(farm.region)}, Chile · ${farm.hectares} ha · <b>Priority:</b> ${esc(priority)}</p><p><b>Soil:</b> ${esc(farm.soil)} · pH ${farm.ph} · organic matter ${farm.organicMatter}%</p><p><b>Simulated soil moisture:</b> ${farm.soilMoisture}% · <b>Simulated rainfall:</b> ${farm.precipitation} mm · <b>NDVI:</b> ${farm.ndvi}</p><h2>Rotation comparison</h2><table><tr><th>Strategy</th><th>Sequence</th><th>Soil potential</th><th>Water demand</th><th>Drought resilience</th></tr>${rows}</table><h2>Options to investigate</h2><ul>${recommendations.map(r=>`<li><b>${esc(r.title)}</b> — ${esc(r.reason)} <i>Risk: ${esc(r.risk)}</i></li>`).join('')}</ul><h2>Information gaps</h2><p>Verified soil tests, site suitability, yield estimates, crop economics, water allocation and scientific validation are not included.</p><div class="warning"><b>Prototype only:</b> All values, scenarios and recommendations are simulated. No real NASA datasets or predictive model were used. Seek local agronomic review before field decisions.</div><script>/* No remote calls */</script></html>`;
}
export function Reports({farm,rotations,priority,environment,recs,cropById,showToast}){
  const [sections,setSections]=useState({profile:true,conditions:true,rotations:true,recs:true,risks:true});
  const toggle = key => setSections(v=>({...v,[key]:!v[key]}));
  const fileName=`CropLite_${farm.id}_demo_report.html`;
  const download=()=>{const html=downloadableHtml(farm,rotations,priority,environment,recs,cropById);const blob=new Blob([html],{type:'text/html;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=fileName;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);showToast('Illustrative HTML report exported');};
  return <>
    <SectionHeading overline="DOCUMENTATION / EXPORTS" title="Turn insights into a report." description="Prepare a transparent handoff for your next conversation with an agricultural expert." action={<MockFlag/>}/>
    <div className="report-grid"><Panel title="Prepare your report" subtitle="Choose sections and export an offline-readable summary"><div className="report-choice-list">{[['profile','Farm profile & soil context'],['conditions','Environmental conditions'],['rotations','Rotation scenarios & criteria'],['recs','Recommendations & trade-offs'],['risks','Information gaps & limitations']].map(([id,label])=><label className="report-choice" key={id}><input type="checkbox" checked={sections[id]} onChange={()=>toggle(id)}/><span>{label}</span><CheckCircle2 size={17}/></label>)}</div><div className="report-actions"><button className="primary-button" onClick={download}><FileDown size={17}/> Export HTML report</button><button className="secondary-button" onClick={()=>{window.print();showToast('Browser print dialog opened — choose Save as PDF');}}><Printer size={17}/> Print / save as PDF</button></div><p className="chart-footnote">HTML export includes the complete core assessment to preserve context. The section checkboxes are preview preferences only; section-specific export is planned for a future iteration.</p></Panel><div className="report-preview"><div className="report-preview-top"><span>TERRAAI <b>REPORT</b></span><span>DEMO / 2026</span></div><div className="report-preview-body"><div className="overline">AGRICULTURAL DECISION SUPPORT</div><h2>Farm strategy assessment</h2><p>{farm.name}<br/>{farm.region}, Chile</p><div className="report-preview-line"/><div className="report-preview-metrics"><span>{farm.hectares} ha<small>AREA</small></span><span>{rotations.length}<small>STRATEGIES</small></span><span>{recs.length}<small>INSIGHTS</small></span></div><h3>What this report contains</h3><ul><li>Farm and environment context</li><li>Comparative crop rotations</li><li>Trade-offs and local review needs</li></ul><div className="report-stamp">ALL CONTENT SIMULATED</div></div></div></div>
    <Disclaimer>Exported material is illustrative. Report users must be able to distinguish demonstrations from validated agricultural guidance.</Disclaimer>
  </>;
}

