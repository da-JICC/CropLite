import React,{useMemo,useState} from 'react';
import {CalendarDays,Info,Leaf,TriangleAlert,PanelBottomOpen,PanelBottomClose} from 'lucide-react';
import {CROPS} from '../crops/CropSelector.jsx';
import CropIcon from '../crops/CropIcon.jsx';
import phenologyCatalog from '../../data/cropPhenologyCatalog.json';
import {cropIndicators,dayIndex,shiftDay,STAGE_COLORS,timelineFor} from './phenologyEngine.mjs';
import {buildIndicatorComparisonGroups} from './indicatorComparisons.mjs';

const byCrop=Object.fromEntries(phenologyCatalog.crops.map(c=>[c.id,c]));
const numeric=v=>typeof v==='number' && Number.isFinite(v);
const fmt=(v,d=1)=>numeric(v)?v.toLocaleString('en-US',{maximumFractionDigits:d}):'—';
const dateStr=iso=>new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'});

export function CropSelectorBar({cropId,onCropSelect}) {
  return <div className="terra-agro-crop-picker">
    <div className="terra-agro-picker-heading"><strong>01 · Reference crop</strong><span>Choose one of the 20 crops. Its growth stages and references update the analysis without downloading data again.</span></div>
    <div className="terra-phenology-crops" role="group" aria-label="Reference crop">
      {CROPS.map(item=><button type="button" key={item.id} aria-pressed={item.id===cropId}
        className={`terra-phenology-crop${item.id===cropId?' active':''}`} onClick={()=>onCropSelect(item.id)}>
        <CropIcon cropId={item.id} decorative/><span>{item.name}</span>
      </button>)}
    </div>
  </div>;
}

export function PlantingDateControl({sowDate,onSowDateChange}) {
  const index=dayIndex(sowDate);
  return <div className="terra-sowing-under-chart" aria-label="Crop start date selection">
    <div className="terra-planting-controls">
      <div className="terra-planting-copy"><CalendarDays size={18}/><div><strong>02 · Planting date</strong><small>This changes the growth-stage scenario only; the chart still covers all 365 days of 2025.</small></div></div>
      <label className="terra-planting-date">Start date <input aria-label="Planting date in 2025" type="date" min="2025-01-01" max="2025-12-31" value={sowDate} onChange={e=>{if(e.target.value)onSowDateChange(e.target.value)}}/></label>
    </div>
    <div className="terra-planting-slider"><span>01 JAN 2025</span><input type="range" aria-label="Adjust planting date" min="0" max="364" step="1" value={Math.max(0,Math.min(364,index))} onChange={e=>onSowDateChange(shiftDay('2025-01-01',Number(e.target.value)))}/><span>31 DEC 2025</span></div>
  </div>;
}

export function PhenologyTimeline({crop,sowDate,timeline:givenTimeline}) {
  const timeline=givenTimeline ?? timelineFor(crop,sowDate);
  if(!crop || !timeline)return null;
  return <div className="terra-inline-timeline" aria-label="Estimated growth-stage calendar">
    <div className="terra-timeline-head"><div><Leaf size={17}/><strong>03 · Crop growth stages</strong></div><span>{timeline.estimated_cycle_days} days · estimated maturity: <b>{dateStr(timeline.estimated_maturity_date)}</b></span></div>
    <div className="terra-phenology-track" role="img" aria-label={`Estimated growth stages of ${crop.name}, from ${dateStr(sowDate)} to ${dateStr(timeline.estimated_maturity_date)}`}>
      {timeline.stages.map(stage=><div className="terra-phenology-segment" key={stage.id} style={{flex:stage.duration_days,background:STAGE_COLORS[stage.id]}} title={`${stage.label}: ${dateStr(stage.start)} to ${dateStr(stage.end)} · ${stage.duration_days} days`}><span>{stage.duration_days} d</span></div>)}
    </div>
    <div className="terra-phenology-stages">{timeline.stages.map(stage=><div key={stage.id} className="terra-phenology-stage"><span className="terra-phenology-square" style={{background:STAGE_COLORS[stage.id]}}/><div><strong>{stage.label}</strong><span>{dateStr(stage.start)} — {dateStr(stage.end)}</span><small>{stage.duration_days} days · Kc: {fmt(stage.kc,2)}</small></div></div>)}</div>
    <div className="terra-phenology-note"><Info size={16}/><span>FAO/JICA stages are estimated timelines, not satellite-detected crop stages. The chart shading covers only the portion within 2025.</span></div>
    {timeline.beyond_2025&&<div className="terra-phenology-overflow"><TriangleAlert size={17}/><span>Estimated maturity falls in 2026. The timeline shows the complete crop cycle, but <b>the indicators only include observations from 2025</b>.</span></div>}
  </div>;
}

/** Compatibility wrapper for older component consumers; not mounted in the updated one-page view. */
export function CropPhenologyPanel({cropId,onCropSelect,sowDate,onSowDateChange}) {
  const crop=byCrop[cropId];
  return <section className="terra-phenology-panel"><CropSelectorBar cropId={cropId} onCropSelect={onCropSelect}/><PlantingDateControl sowDate={sowDate} onSowDateChange={onSowDateChange}/><PhenologyTimeline crop={crop} sowDate={sowDate}/></section>;
}

const STATUS={
  below:['Below range','below'],within:['Within range','within'],above:['Above range','above'],
  incomplete:['Incomplete data','incomplete'],no_reference:['No comparable reference','unrated'],
};

export function CropIndicatorsTable({analysis,cropId,sowDate,loading}) {
  const crop=byCrop[cropId];
  const [open,setOpen]=useState(false);
  const result=useMemo(()=>cropIndicators(analysis,crop,sowDate),[analysis,crop,sowDate]);
  const comparison=useMemo(()=>buildIndicatorComparisonGroups(result,crop,Boolean(analysis?.datasets)),[result,crop,analysis]);
  const timeline=useMemo(()=>timelineFor(crop,sowDate),[crop,sowDate]);

  if(!crop || !result)return null;

  const summary=[
    {label:'Crop', value:crop.name},
    {label:'Estimated cycle', value:`${timeline?.estimated_cycle_days ?? crop.cycle_days} days`},
    {label:'Stages compared', value:`${comparison.length}`},
    {label:'2025 coverage', value:timeline?.beyond_2025?'Partial':'Complete'},
  ];

  return <div className="terra-crop-indicators terra-indicators-integrated terra-indicators-compact" aria-label="Comparison of indicators and crop requirements">
    <div className="terra-indicators-header terra-indicators-header--compact">
      <div>
        <span className="overline">04 · INDICATOR COMPARISON</span>
        <h2>Indicators by growth stage</h2>
        <p>Open the detailed comparison when needed to keep the main view uncluttered.</p>
      </div>
      <span className="terra-period-tag">{dateStr(result.sow_date)} — {dateStr(result.estimated_maturity_date)}</span>
    </div>

    <div className="terra-indicators-summary-grid">
      {summary.map(item=><div key={item.label} className="terra-indicators-summary-card"><small>{item.label}</small><strong>{item.value}</strong></div>)}
    </div>

    {!analysis?.datasets&&<p className="terra-indicators-empty">{loading?'Retrieving daily observations…':'Select a field on the map to calculate indicators. You can explore the calendar without downloading data.'}</p>}

    <button type="button" className="terra-indicators-toggle" onClick={()=>setOpen(v=>!v)} aria-expanded={open}>
      {open?<><PanelBottomClose size={17}/> Hide detailed comparison</>:<><PanelBottomOpen size={17}/> Open detailed comparison</>}
    </button>

    {open&&<div className="terra-indicators-drawer">
      <div className="terra-comparison-legend" aria-label="Interpreting the comparisons"><span className="terra-compare-status below">Below range</span><span className="terra-compare-status within">Within range</span><span className="terra-compare-status above">Above range</span><span className="terra-compare-status incomplete">Incomplete data</span><span className="terra-compare-status unrated">No comparable reference</span></div>
      <div className="terra-phenology-table-scroll terra-phenology-table-scroll--compact"><table className="terra-phenology-table terra-comparison-table">
        <thead><tr><th>Stage and dates</th><th>Indicator</th><th>Observed/calculated value</th><th>Crop reference</th><th>Comparison</th><th>Coverage</th></tr></thead>
        <tbody>{comparison.map(group=>group.metrics.map((metric,idx)=>{
          const [label,cls]=STATUS[metric.status] ?? STATUS.no_reference;
          const colour=STAGE_COLORS[group.id] ?? '#bed0bd';
          return <tr key={`${group.id}-${idx}`} className={idx===0?'terra-comparison-stage-start':''}>
            {idx===0&&<th rowSpan={group.metrics.length} scope="rowgroup" className="terra-comparison-stage-cell"><span className="terra-table-stage-dot" style={{background:colour}}/><strong>{group.label}</strong><small>{dateStr(group.start)} — {dateStr(group.end)}</small></th>}
            <td>{metric.label}</td><td><b>{fmt(metric.value,metric.unit==='m³/m³'?3:1)}</b> <span>{metric.unit}</span></td><td className="terra-comparison-reference">{metric.reference}</td>
            <td><span className={`terra-compare-status ${cls}`}>{label}</span></td><td>{metric.coverage}</td>
          </tr>;
        }))}</tbody>
      </table></div>
      <div className="terra-indicator-disclaimers"><p><b>How to interpret results:</b> “Within”, “above” and “below” do not automatically imply productivity, survival or damage. GDD and ETc are only compared with full-cycle targets using full-cycle data; there are no validated stage-specific targets.</p>
        <p><b>Cold exposure:</b> CSV references are indicative. The mid-season phase does not prove flowering; crossing a threshold is not confirmation of damage.</p>
        <p><b>Water:</b> P − ETc is a partial climatic balance, not measured water stress. It excludes irrigation, runoff, storage and percolation; flooded rice requires additional considerations.</p>
        <p><b>Data coverage:</b> Incomplete-day totals remain partial. Missing days and 2026 values are never filled in. <b>Rainfall:</b> {result.rainfall_source}. <b>Stage and Kc sources:</b> <a href="https://www.fao.org/4/s2022e/s2022e07.htm" target="_blank" rel="noreferrer">FAO</a>{crop.id==='rice'?<>, <a href="https://openjicareport.jica.go.jp/pdf/12303392_01.pdf" target="_blank" rel="noreferrer">JICA</a></>:null} and TerraAI CSV (reference thresholds and ETc).</p>
      </div>
    </div>}
  </div>;
}
