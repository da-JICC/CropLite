import CropIcon from '../crops/CropIcon.jsx';
import React,{useMemo,useState} from 'react';
import {ArrowRight,CheckCircle2,CalendarDays,Info,Leaf,AlertTriangle,RefreshCcw,ShieldAlert,Sun} from 'lucide-react';
import phenologyCatalog from '../../data/cropPhenologyCatalog.json';
import cropThermalCatalog from '../../data/cropTemperatureCatalog.json';
import {buildCropRecommendations,RECOMMENDATION_METHODOLOGY} from './cropRecommendationEngine.mjs';
import {dayIndex,STAGE_COLORS} from '../phenology/phenologyEngine.mjs';

const pictures=Object.fromEntries(cropThermalCatalog.crops.map(c=>[c.id,c.image]));
const formatDate=iso=>new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-CL',{day:'2-digit',month:'short',timeZone:'UTC'});
const pos=iso=>Math.max(0,Math.min(100,dayIndex(iso)/365*100));

function ScenarioBar({scenario}){
  if(!scenario)return null;
  return <div className="terra-rec-calendar-track" title={`${formatDate(scenario.sowDate)} al ${formatDate(scenario.harvestDate)}`}>
    {scenario.timeline.stages.map(stage=><span key={stage.id}
      title={`${stage.label}: ${formatDate(stage.start)} — ${formatDate(stage.end)}`}
      className="terra-rec-calendar-segment" style={{left:`${pos(stage.start)}%`,width:`${Math.max(.4,(stage.duration_days/365)*100)}%`,background:STAGE_COLORS[stage.id]}} />)}
  </div>;
}
function RankingCard({scenario,ordinal,selected,onPick}){
  return <button className={`terra-rec-card${selected?' active':''}`} type="button" onClick={()=>onPick(scenario.cropId)}
    aria-pressed={selected} aria-label={`Explore ${scenario.cropName} in the environmental analysis`}>
    <div className="terra-rec-card-head"><CropIcon cropId={scenario.cropId} decorative/>
      <span className="terra-rec-rank">{ordinal}º</span><div><strong>{scenario.cropName}</strong><small>{scenario.family} · Escenario 2025</small></div></div>
    <div className="terra-rec-card-dates"><CalendarDays size={13}/>{formatDate(scenario.sowDate)} – {formatDate(scenario.harvestDate)}<span>{scenario.cycleDays} days</span></div>
    <ScenarioBar scenario={scenario}/>
    <div className="terra-rec-context" aria-label="Indicadores ambientales descriptivos">
      <span>VPD: <b>{scenario.context.vpdMeanKpa ?? '—'} kPa</b></span>
      <span>Radiation: <b>{scenario.context.solarRadiationMjM2 ?? '—'} MJ/m²</b></span>
      <span>Root-zone moisture: <b>{scenario.context.rootzoneMoistureMean ?? '—'} m³/m³</b></span>
      <span>Rainfall / ETc: <b>{scenario.waterComplete ? `${scenario.rainEtcRatio}×`:'—'}</b></span>
    </div>
    <div className="terra-rec-card-explain"><span className="terra-rec-card-positive"><CheckCircle2 size={14}/>{scenario.positives[0]||'Thermal conditions could be assessed.'}</span>
      {scenario.vulnerabilities[0]&&<span className="terra-rec-card-caution"><AlertTriangle size={14}/>{scenario.vulnerabilities[0]}</span>}</div>
    <span className="terra-rec-card-action">View references and indicators <ArrowRight size={14}/></span>
  </button>;
}
function RotationDisplay({plan}){
  if(!plan)return null;
  return <div className="terra-rec-rotation-display">
    <div className="terra-rec-year-axis"><span>ENE</span><span>MAR</span><span>MAY</span><span>JUL</span><span>SEP</span><span>NOV</span><span>DIC</span></div>
    {plan.crops.map(crop=><div className="terra-rec-year-row" key={crop.cropId}>
      <div className="terra-rec-year-name"><CropIcon cropId={crop.cropId} decorative/><span>{crop.cropName}</span></div>
      <div className="terra-rec-year-body"><ScenarioBar scenario={crop}/></div>
      <span className="terra-rec-year-dates">{formatDate(crop.sowDate)} – {formatDate(crop.harvestDate)}</span>
    </div>)}
    <div className="terra-rec-rotation-foot"><Info size={15}/><span>Planned transition: at least {RECOMMENDATION_METHODOLOGY.transition_buffer_days} days. The four colors indicate estimated stages, not observed growth stages.</span></div>
  </div>;
}

/** A transparent, non-ML agronomic screening placed directly after the field map. */
export function AgriculturalRecommendations({region,analysis,loading,cropId,onCropSelect,onRetry}){
  const [activePlan,setActivePlan]=useState(0);
  const [showMethod,setShowMethod]=useState(false);
  const output=useMemo(()=>buildCropRecommendations(analysis,phenologyCatalog.crops,cropThermalCatalog.crops),[analysis]);
  const rotations=output.rotations||[];
  const plan=rotations[Math.min(activePlan,rotations.length-1)]||null;
  return <section className="terra-recommendation-section" aria-label="Intelligent crop recommendations">
    <header className="terra-rec-header"><div><span className="overline">02 / AGRICULTURAL DECISIONS</span><h2>Which crops might fit this field?</h2>
      <p>Compare crop options and potential rotations using observed 2025 weather data.</p></div>
      <span className="terra-rec-method-pill"><Leaf size={14}/> Experimental assessment · No trained ML</span>
    </header>
    {!region ? <div className="terra-rec-empty"><Sun size={22}/><strong>Select a field on the map</strong><span>Results will appear here when valid weather records are available.</span></div>
    :loading ? <div className="terra-rec-empty" role="status"><span className="terra-loader"/><strong>Analyzing local conditions</strong><span>This uses environmental data already retrieved for the selected field.</span></div>
    :output.status!=='screened' ? <div className="terra-rec-empty" role="status"><ShieldAlert size={22}/><strong>Insufficient evidence for crop recommendations</strong><span>{output.coverage||'The temperature series could not be evaluated.'}</span><button onClick={onRetry} type="button"><RefreshCcw size={14}/> Retry environmental data</button></div>
    : <>
      <div className="terra-rec-warning"><Info size={18}/><span><strong>Historical comparison, not a forecast.</strong> Dates and rankings are hypothetical scenarios based only on observed 2025 weather. They do not predict future weather or yield.</span></div>
      <div className="terra-rec-subheading"><div><h3>Crop options</h3><p>Ranked using thermal suitability and accumulated GDD in complete planting windows. Water, VPD, radiation and soil data provide context without using unvalidated thresholds.</p></div><span>{output.ranked.length} / {cropThermalCatalog.crops.length} assessable</span></div>
      <div className="terra-rec-cards">{output.ranked.map((scenario,index)=><RankingCard key={scenario.cropId} scenario={scenario} ordinal={index+1} selected={scenario.cropId===cropId} onPick={onCropSelect}/>)}</div>
      {output.missingCrops?.length>0&&<p className="terra-rec-missing">Insufficient coverage for: {output.missingCrops.join(', ')}.</p>}
      <div className="terra-rec-rotation-area"><div className="terra-rec-subheading"><div><h3>Annual rotation · compatible calendar scenarios</h3><p>Different botanical families are paired when two full cycles fit within 2025, with a transition gap. Field feasibility requires validating soils, irrigation, plant health and management.</p></div></div>
        {rotations.length?<><div className="terra-rec-plan-options" role="group" aria-label="Rotation options">
          {rotations.map((item,index)=><button key={item.id} type="button" className={index===Math.min(activePlan,rotations.length-1)?'active':''} aria-pressed={index===Math.min(activePlan,rotations.length-1)} onClick={()=>setActivePlan(index)}>{index+1}. {item.label}</button>)}
        </div><RotationDisplay plan={plan}/>
        <div className="terra-rec-rotation-notice"><AlertTriangle size={15}/><span>A calendar fit does not guarantee field feasibility. Crop rotation also requires evaluating diseases, inputs, water supply and longer-term management.</span></div></>
        :<div className="terra-rec-rotation-none"><Info size={18}/><span>No combination of crops from different families can complete both cycles under the evaluated 2025 conditions. Individual crop options are shown instead.</span></div>}
      </div>
      <button type="button" className="terra-rec-method-toggle" onClick={()=>setShowMethod(v=>!v)} aria-expanded={showMethod}><Info size={15}/>{showMethod?'Hide methodology':'How these recommendations are calculated'}</button>
      {showMethod&&<div className="terra-rec-method-details">
        <p><strong>Engine:</strong> interpretable agronomic rules, without a trained neural network. Planting windows are evaluated every 14 days in 2025, only for complete cycles with at least 90% temperature coverage. Ranking uses the share of mean temperatures within the indicative climatic band and progress toward the minimum catalog GDD.</p>
        <p><strong>Other variables:</strong> rainfall/ETc, VPD, radiation and root-zone moisture are presented as context without automatically classifying them as favourable. Historical NDVI does not reveal which crop should be planted. Botanical family is a rotation filter, not a soil health certificate.</p>
        <p><strong>For future AI-based forecasting:</strong> multiple seasons, independent temporal and geographic validation, real yield data and soil/management information would be needed. The internal score is not a probability of harvest success.</p>
        <ul>{RECOMMENDATION_METHODOLOGY.limitations.map((limitation,i)=><li key={i}>{limitation}</li>)}</ul>
      </div>}
    </>}
  </section>;
}
