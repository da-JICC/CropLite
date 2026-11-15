import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Leaf,Info,AlertTriangle,ChevronDown,ShieldCheck,CheckCircle2} from 'lucide-react';
import CropIcon from '../crops/CropIcon.jsx';
import phenologyCatalog from '../../data/cropPhenologyCatalog.json';
import {STAGE_COLORS} from '../phenology/phenologyEngine.mjs';
import {loadDecisionHistory,loadDecisionNDVI} from '../../services/decisionsService.js';
import {cropInsights,rotationInsights,numeric} from './decisionInsights.mjs';

const stagesByCrop=Object.fromEntries(phenologyCatalog.crops.map(c=>[c.id,c.stages]));
const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const prettyDate=iso=>iso?new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}):'—';
const display=(value,digits=1)=>numeric(value)?value.toLocaleString('en-US',{maximumFractionDigits:digits}):'No data';
const clamp=value=>Math.max(0,Math.min(100,value));

function Hint({label,explanation}) {
  return <details className="terra-ux-hint"><summary aria-label={`What does ${label} mean?`} title={explanation}><Info size={14}/></summary><div className="terra-ux-hint-content">{explanation}</div></details>;
}

function CropDecisionCard({crop,position,selected,onSelect}) {
  const insight=cropInsights(crop);
  const headline=insight.highlights.find(item=>item.key==='irrigation') || insight.highlights.find(item=>item.key==='water' && item.tone==='caution') || insight.highlights.find(item=>item.key==='temperature') || insight.highlights[0];
  return <button className={`terra-decision-crop terra-ux-crop-card${selected?' selected':''}`} type="button" aria-pressed={selected} onClick={()=>onSelect(crop.crop_id)}>
    <div className="terra-decision-crop-top"><span className="terra-decision-index">{String(position).padStart(2,'0')}</span><CropIcon cropId={crop.crop_id} decorative/><div><strong>{crop.crop_name}</strong><small>{crop.cycle_days} approx. days</small></div></div>
    <div className="terra-ux-card-conclusion"><span className={`terra-ux-signal ${headline?.tone||'neutral'}`}/><span>{headline?.title || 'Assessment available'}</span></div>
    <div className="terra-ux-card-meta"><span>Estimated suitability</span><b>{display(crop.score,0)} <small>/100</small></b></div>
    <div className="terra-decision-progress" aria-hidden="true"><span style={{width:`${clamp(crop.score??0)}%`}}/></div>
    <span className="terra-decision-crop-select">{selected?'Crop selected':'View details'}</span>
  </button>;
}

function DecisionCalendar({plan,year}) {
  if(!plan?.crops?.length)return null;
  const begin=Date.UTC(year,0,1);
  const total=Date.UTC(year+1,0,1)-begin;
  return <div className="terra-decision-calendar croplite-calendar" aria-label={`Crop rotation calendar for ${year}`}>
    <div className="croplite-calendar-year">Growing year {year} <span>Planting → harvest</span></div>
    <div className="terra-decision-months">{months.map(m=><span key={m}>{m}</span>)}</div>
    {plan.crops.map((crop,i)=><div className="terra-decision-calrow" key={`${crop.crop_id}-${i}`}>
      <div className="terra-decision-calname"><CropIcon cropId={crop.crop_id} decorative/><strong>{crop.crop_name}</strong></div>
      <div className="terra-decision-calbody" aria-label={`${crop.crop_name}: ${prettyDate(crop.sow_date)} to ${prettyDate(crop.harvest_date)}`}>
        {(stagesByCrop[crop.crop_id]||[]).reduce((acc,stage)=>{
          const start=Date.parse(`${crop.sow_date}T00:00:00Z`)+acc.offset*86400000;
          const left=Math.max(0,100*(start-begin)/total);
          const right=Math.min(100,100*(start+stage.duration_days*86400000-begin)/total);
          if(right>left)acc.parts.push(<span key={stage.id} className="terra-decision-calstage" title={`${stage.label} · ${stage.duration_days} days`} style={{left:`${left}%`,width:`${right-left}%`,background:STAGE_COLORS[stage.id]}}/>);
          acc.offset+=stage.duration_days;
          return acc;
        },{parts:[],offset:0}).parts}
      </div>
      <small>{prettyDate(crop.sow_date)} – {prettyDate(crop.harvest_date)}</small>
    </div>)}
    <div className="terra-decision-calfoot">Two successive crops within {year}. Illustrative dates based on historical analogues; not forecasts or guaranteed harvests.</div>
  </div>;
}

/** The history request is keyed ONLY by the selected geometry; crop and chart changes are local. */
export function AgriculturalDecisions({region,cropId,onCropSelect}) {
  const [report,setReport]=useState(null);
  const [ndvi,setNdvi]=useState(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [activeRotation,setActiveRotation]=useState(0);
  const [details,setDetails]=useState(false);
  const [showAllCrops,setShowAllCrops]=useState(false);
  const [attempt,setAttempt]=useState(0);
  const cache=useRef(new Map());
  const ndviCache=useRef(new Map());
  const key=region?.geometry?JSON.stringify(region.geometry):null;

  useEffect(()=>{
    const controller=new AbortController();
    let mounted=true;
    if(!key){setReport(null);setNdvi(null);setLoading(false);setError('');return ()=>controller.abort();}
    const saved=cache.current.get(key);
    if(saved && attempt===0){setReport(saved);setNdvi(ndviCache.current.get(key)||null);setLoading(false);setError('');return ()=>controller.abort();}
    setLoading(true);setReport(null);setNdvi(null);setError('');
    const timeout=setTimeout(async()=>{
      loadDecisionNDVI(region.geometry,controller.signal).then(value=>{if(mounted&&!controller.signal.aborted){ndviCache.current.set(key,value);setNdvi(value);}}).catch(()=>{if(mounted&&!controller.signal.aborted)setNdvi({status:'error',annual:[]});});
      try{
        const result=await loadDecisionHistory(region.geometry,controller.signal);
        if(mounted&&!controller.signal.aborted){cache.current.set(key,result);setReport(result);}
      }catch(exc){if(mounted&&!controller.signal.aborted)setError(exc.message||'Error retrieving historical data.');}
      finally{if(mounted&&!controller.signal.aborted)setLoading(false);}
    },800);
    return ()=>{mounted=false;clearTimeout(timeout);controller.abort();};
  },[key,attempt]);

  const rotations=report?.rotations||[];
  const rotation=rotations[Math.min(activeRotation,rotations.length-1)]||null;
  const chosen=report?.ranked?.find(c=>c.crop_id===cropId)||report?.ranked?.[0];
  const chosenInsights=useMemo(()=>cropInsights(chosen),[chosen]);
  const rotationExplanation=useMemo(()=>rotationInsights(rotation,report?.ranked||[]),[rotation,report]);

  return <section className="terra-decision-section terra-ux-decisions" aria-label="Agricultural decisions"><span id="rotaciones" className="croplite-anchor"/>
    <div className="terra-decision-header">
      <div>
        <span className="overline">02 · CROP RECOMMENDATIONS</span>
        <h2>Plan your next growing season</h2>
        <p>Explore crop suitability and annual rotations based on observed past seasons—not forecasts.</p>
      </div>
      <span className="terra-decision-header-pill"><ShieldCheck size={15}/> Rule-based assessment</span>
    </div>

    {!region?<div className="terra-decision-empty"><Leaf size={28}/><strong>Select a field to get started</strong><p>CropLite compares local conditions with the requirements of all 20 crops in the catalog.</p></div>
    :loading?<div className="terra-decision-empty" role="status"><img className="croplite-loading-emblem" src="/brand/croplite-symbol.svg" alt=""/><div className="terra-loader"/><strong>Retrieving historical environmental data</strong><p>Retrieving regional observations to assess planting options.</p></div>
    :error?<div className="terra-decision-empty" role="alert"><AlertTriangle size={22}/><strong>Unable to retrieve data</strong><p>{error}</p><button onClick={()=>{cache.current.delete(key);ndviCache.current.delete(key);setAttempt(x=>x+1);}}>Retry</button></div>
    :report?.status!=='evaluated'?<div className="terra-decision-empty"><Info size={24}/><strong>Not enough data to compare crops</strong><p>At least three complete historical seasons with sufficient daily records are required.</p></div>
    :<>
      <div className="croplite-decision-layout croplite-decision-layout--single">
        <div className="croplite-crop-panel croplite-crop-panel--expanded">
          <div className="terra-decision-section-head">
            <div>
              <h3>Crops best suited to this field</h3>
              <p>Select a crop to review its suitability and timing within the growing year.</p>
            </div>
            <Hint label="estimated suitability" explanation="The ranking combines temperature, accumulated heat, potential thermal exposure and rainfall versus estimated rainfed water demand. It does not predict yield."/>
          </div>

          <div className="terra-decision-grid">{(showAllCrops?report.ranked:report.ranked.slice(0,8)).map((crop,index)=><CropDecisionCard key={crop.crop_id} crop={crop} position={index+1} selected={crop.crop_id===cropId} onSelect={onCropSelect}/> )}</div>
          {report.ranked.length>8&&<button type="button" className="croplite-all-crops" onClick={()=>setShowAllCrops(v=>!v)} aria-expanded={showAllCrops}>{showAllCrops?'Show fewer crops':`View all ${report.ranked.length} crops`}</button>}

          {chosen&&<div className="terra-ux-explanation" aria-live="polite">
            <div className="terra-ux-explanation-title">
              <CropIcon cropId={chosen.crop_id} decorative/>
              <div>
                <span className="overline">SELECTED CROP</span>
                <h3>Why {chosen.crop_name.toLowerCase()}?</h3>
                <p>Suggested planting: {prettyDate(chosen.sow_date)} · Estimated harvest: {prettyDate(chosen.harvest_date)}</p>
              </div>
            </div>
            <p className="terra-ux-ranking-context">{report.ranked?.[0]?.crop_id===chosen.crop_id
              ? `This is the highest-ranked option. Its lead over the next crop is ${display((chosen.score??0)-(report.ranked?.[1]?.score??chosen.score),1)} estimated suitability points.`
              : `Ranked #${report.ranked.findIndex(item=>item.crop_id===chosen.crop_id)+1}. ${report.ranked?.[0]?.crop_name} is ${display((report.ranked?.[0]?.score??0)-(chosen.score??0),1)} points ahead in this assessment.`}</p>
            <div className="terra-ux-reasons">{chosenInsights.highlights.slice(0,3).map(reason=><div key={reason.key} className="terra-ux-reason"><span className={`terra-ux-signal ${reason.tone}`}/><div><strong>{reason.title}</strong><p>{reason.description}</p></div></div>)}</div>
            <details className="terra-ux-explanation-method"><summary>How is this recommendation calculated?</summary><p>We compare temperature, accumulated heat, thermal exposure and rainfall against estimated crop water demand. The water assessment assumes rainfed farming and does not measure water available at the roots.</p>{numeric(chosen.historical_p10_score)&&numeric(chosen.historical_p90_score)&&<p>Historical variation for this planting window: {display(chosen.historical_p10_score,0)}–{display(chosen.historical_p90_score,0)} points (10th–90th percentiles across {chosen.history_sample_years} evaluated seasons). This is a descriptive range, not a probability or forecast.</p>}</details>
          </div>}

          <div className="terra-decision-rotation-card">
            <div className="terra-decision-section-head">
              <div>
                <h3>Suggested annual crop rotation</h3>
                <p>Compare two consecutive crops scheduled within the same growing year.</p>
              </div>
            </div>
            {rotations.length? <>
              <div className="terra-decision-rotation-options" role="group" aria-label="Rotation alternatives">{rotations.map((r,i)=><button key={r.id} className={i===Math.min(activeRotation,rotations.length-1)?'active':''} onClick={()=>setActiveRotation(i)} aria-pressed={i===Math.min(activeRotation,rotations.length-1)}>{i+1}. {r.crops.map(c=>c.crop_name).join(' → ')}</button>)}</div>
              <DecisionCalendar plan={rotation} year={report.planning_year}/>
              {rotationExplanation&&<div className="terra-ux-rotation-why"><div className="terra-ux-rotation-lead"><CheckCircle2 size={18}/><div><strong>Why this sequence?</strong><p>{rotationExplanation.whyOrder}</p></div></div><div className="terra-ux-rotation-evidence">{rotationExplanation.evidence.map(row=><div key={row.key}><small>{row.label}</small><strong>{row.value}</strong></div>)}</div>{rotationExplanation.reasons?.length>0&&<ul className="terra-decision-plan-reasons">{rotationExplanation.reasons.slice(0,3).map(text=><li key={text}>{text}</li>)}</ul>}</div>}
            </> : <div className="terra-decision-no-rotations"><Info size={17}/> No two complete crop cycles from different botanical families fit within this year with a 14-day transition.</div>}
          </div>
        </div>
      </div>

      <button className="terra-decision-method-button" type="button" onClick={()=>setDetails(v=>!v)} aria-expanded={details}><ChevronDown size={17}/>{details?'Hide methods and sources':'View methods and sources'}</button>
      {details&&<div className="terra-decision-method-details"><p><strong>Data sources:</strong> NASA POWER, historical regional temperature and rainfall records. Copernicus NDVI describes previously observed vegetation, not the identity of a future crop.</p><p><strong>NDVI observations:</strong> {ndvi?.status==='unavailable'?'unavailable (not configured)':ndvi?.status==='error'?'unavailable for this request':ndvi?.annual?`${ndvi.annual.filter(y=>y.status==='observed').length} years with valid observations`:'loading…'}.</p><p><strong>Assessment:</strong> the engine compares up to twelve historical seasons using temperature, accumulated heat, thermal references and rainfall relative to theoretical rainfed water demand. Rotations schedule two successive crops in a single year, alternate botanical families and require at least 14 days between cycles.</p><p><strong>Key limitation:</strong> observed rainfall does not equal root-zone water storage. Without soil and irrigation data, scores are only indicative for rainfed production.</p><a href="https://power.larc.nasa.gov/docs/services/api/temporal/daily/" target="_blank" rel="noopener noreferrer">NASA POWER</a> · <a href="https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Statistical.html" target="_blank" rel="noopener noreferrer">Copernicus</a></div>}
    </>}
  </section>;
}
