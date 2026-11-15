import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Leaf,Info,AlertTriangle,ChevronDown,ShieldCheck,CheckCircle2} from 'lucide-react';
import CropIcon from '../crops/CropIcon.jsx';
import phenologyCatalog from '../../data/cropPhenologyCatalog.json';
import {STAGE_COLORS} from '../phenology/phenologyEngine.mjs';
import {loadDecisionHistory,loadDecisionNDVI} from '../../services/decisionsService.js';
import {cropInsights,rotationInsights,numeric} from './decisionInsights.mjs';

const stagesByCrop=Object.fromEntries(phenologyCatalog.crops.map(c=>[c.id,c.stages]));
const months=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const prettyDate=iso=>iso?new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-CL',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}):'—';
const display=(value,digits=1)=>numeric(value)?value.toLocaleString('es-CL',{maximumFractionDigits:digits}):'Sin datos';
const clamp=value=>Math.max(0,Math.min(100,value));

function Hint({label,explanation}) {
  return <details className="terra-ux-hint"><summary aria-label={`Qué significa ${label}`} title={explanation}><Info size={14}/></summary><div className="terra-ux-hint-content">{explanation}</div></details>;
}

function CropDecisionCard({crop,position,selected,onSelect}) {
  const insight=cropInsights(crop);
  const headline=insight.highlights.find(item=>item.key==='irrigation') || insight.highlights.find(item=>item.key==='water' && item.tone==='caution') || insight.highlights.find(item=>item.key==='temperature') || insight.highlights[0];
  return <button className={`terra-decision-crop terra-ux-crop-card${selected?' selected':''}`} type="button" aria-pressed={selected} onClick={()=>onSelect(crop.crop_id)}>
    <div className="terra-decision-crop-top"><span className="terra-decision-index">{String(position).padStart(2,'0')}</span><CropIcon cropId={crop.crop_id} decorative/><div><strong>{crop.crop_name}</strong><small>{crop.cycle_days} días aproximados</small></div></div>
    <div className="terra-ux-card-conclusion"><span className={`terra-ux-signal ${headline?.tone||'neutral'}`}/><span>{headline?.title || 'Evaluación disponible'}</span></div>
    <div className="terra-ux-card-meta"><span>Compatibilidad estimada</span><b>{display(crop.score,0)} <small>/100</small></b></div>
    <div className="terra-decision-progress" aria-hidden="true"><span style={{width:`${clamp(crop.score??0)}%`}}/></div>
    <span className="terra-decision-crop-select">{selected?'Cultivo seleccionado':'Ver detalles'}</span>
  </button>;
}

function DecisionCalendar({plan,year}) {
  if(!plan?.crops?.length)return null;
  const begin=Date.UTC(year,0,1);
  const total=Date.UTC(year+1,0,1)-begin;
  return <div className="terra-decision-calendar croplite-calendar" aria-label={`Calendario de rotación de ${year}`}>
    <div className="croplite-calendar-year">Año agrícola {year} <span>Siembra → cosecha</span></div>
    <div className="terra-decision-months">{months.map(m=><span key={m}>{m}</span>)}</div>
    {plan.crops.map((crop,i)=><div className="terra-decision-calrow" key={`${crop.crop_id}-${i}`}>
      <div className="terra-decision-calname"><CropIcon cropId={crop.crop_id} decorative/><strong>{crop.crop_name}</strong></div>
      <div className="terra-decision-calbody" aria-label={`${crop.crop_name}: ${prettyDate(crop.sow_date)} a ${prettyDate(crop.harvest_date)}`}>
        {(stagesByCrop[crop.crop_id]||[]).reduce((acc,stage)=>{
          const start=Date.parse(`${crop.sow_date}T00:00:00Z`)+acc.offset*86400000;
          const left=Math.max(0,100*(start-begin)/total);
          const right=Math.min(100,100*(start+stage.duration_days*86400000-begin)/total);
          if(right>left)acc.parts.push(<span key={stage.id} className="terra-decision-calstage" title={`${stage.label} · ${stage.duration_days} días`} style={{left:`${left}%`,width:`${right-left}%`,background:STAGE_COLORS[stage.id]}}/>);
          acc.offset+=stage.duration_days;
          return acc;
        },{parts:[],offset:0}).parts}
      </div>
      <small>{prettyDate(crop.sow_date)} – {prettyDate(crop.harvest_date)}</small>
    </div>)}
    <div className="terra-decision-calfoot">Dos cultivos sucesivos dentro de {year}. Fechas hipotéticas basadas en analogías históricas; no son pronósticos ni garantías de cosecha.</div>
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
      }catch(exc){if(mounted&&!controller.signal.aborted)setError(exc.message||'Error consultando el histórico.');}
      finally{if(mounted&&!controller.signal.aborted)setLoading(false);}
    },800);
    return ()=>{mounted=false;clearTimeout(timeout);controller.abort();};
  },[key,attempt]);

  const rotations=report?.rotations||[];
  const rotation=rotations[Math.min(activeRotation,rotations.length-1)]||null;
  const chosen=report?.ranked?.find(c=>c.crop_id===cropId)||report?.ranked?.[0];
  const chosenInsights=useMemo(()=>cropInsights(chosen),[chosen]);
  const rotationExplanation=useMemo(()=>rotationInsights(rotation,report?.ranked||[]),[rotation,report]);

  return <section className="terra-decision-section terra-ux-decisions" aria-label="Decisiones agrícolas"><span id="rotaciones" className="croplite-anchor"/>
    <div className="terra-decision-header">
      <div>
        <span className="overline">02 · RECOMENDACIÓN DE CULTIVOS</span>
        <h2>Decisiones para la próxima temporada</h2>
        <p>Ranking de cultivos y secuencias anuales explicadas con temporadas observadas, sin tratarlo como un pronóstico.</p>
      </div>
      <span className="terra-decision-header-pill"><ShieldCheck size={15}/> Evaluación basada en reglas</span>
    </div>

    {!region?<div className="terra-decision-empty"><Leaf size={28}/><strong>Selecciona un terreno para empezar</strong><p>CropLite comparará las condiciones del lugar con las necesidades de los veinte cultivos del catálogo.</p></div>
    :loading?<div className="terra-decision-empty" role="status"><img className="croplite-loading-emblem" src="/brand/croplite-symbol.svg" alt=""/><div className="terra-loader"/><strong>Consultando el histórico ambiental</strong><p>Recuperando registros regionales para analizar las opciones de siembra.</p></div>
    :error?<div className="terra-decision-empty" role="alert"><AlertTriangle size={22}/><strong>No fue posible consultar los datos</strong><p>{error}</p><button onClick={()=>{cache.current.delete(key);ndviCache.current.delete(key);setAttempt(x=>x+1);}}>Reintentar</button></div>
    :report?.status!=='evaluated'?<div className="terra-decision-empty"><Info size={24}/><strong>No hay suficientes datos para comparar cultivos</strong><p>El sistema necesita al menos tres temporadas históricas completas con registros diarios suficientes.</p></div>
    :<>
      <div className="croplite-decision-layout croplite-decision-layout--single">
        <div className="croplite-crop-panel croplite-crop-panel--expanded">
          <div className="terra-decision-section-head">
            <div>
              <h3>Cultivos con mejor ajuste al terreno</h3>
              <p>Selecciona uno para ver el resumen de compatibilidad y su encaje dentro del año agrícola.</p>
            </div>
            <Hint label="compatibilidad estimada" explanation="El ranking combina temperatura, calor acumulado, exposición a referencias térmicas y lluvia frente a demanda hídrica teórica en secano. No predice el rendimiento."/>
          </div>

          <div className="terra-decision-grid">{(showAllCrops?report.ranked:report.ranked.slice(0,8)).map((crop,index)=><CropDecisionCard key={crop.crop_id} crop={crop} position={index+1} selected={crop.crop_id===cropId} onSelect={onCropSelect}/> )}</div>
          {report.ranked.length>8&&<button type="button" className="croplite-all-crops" onClick={()=>setShowAllCrops(v=>!v)} aria-expanded={showAllCrops}>{showAllCrops?'Mostrar menos cultivos':`Ver los ${report.ranked.length} cultivos`}</button>}

          {chosen&&<div className="terra-ux-explanation" aria-live="polite">
            <div className="terra-ux-explanation-title">
              <CropIcon cropId={chosen.crop_id} decorative/>
              <div>
                <span className="overline">CULTIVO ELEGIDO</span>
                <h3>¿Por qué {chosen.crop_name.toLowerCase()}?</h3>
                <p>Siembra sugerida: {prettyDate(chosen.sow_date)} · Cosecha estimada: {prettyDate(chosen.harvest_date)}</p>
              </div>
            </div>
            <p className="terra-ux-ranking-context">{report.ranked?.[0]?.crop_id===chosen.crop_id
              ? `Es la primera alternativa del análisis. Su diferencia respecto a la siguiente opción es de ${display((chosen.score??0)-(report.ranked?.[1]?.score??chosen.score),1)} puntos de compatibilidad estimada.`
              : `Ocupa el puesto ${report.ranked.findIndex(item=>item.crop_id===chosen.crop_id)+1}. ${report.ranked?.[0]?.crop_name} está ${display((report.ranked?.[0]?.score??0)-(chosen.score??0),1)} puntos por encima en esta evaluación.`}</p>
            <div className="terra-ux-reasons">{chosenInsights.highlights.slice(0,3).map(reason=><div key={reason.key} className="terra-ux-reason"><span className={`terra-ux-signal ${reason.tone}`}/><div><strong>{reason.title}</strong><p>{reason.description}</p></div></div>)}</div>
            <details className="terra-ux-explanation-method"><summary>¿Cómo se obtiene la recomendación?</summary><p>Comparamos temperatura, calor acumulado, exposición térmica y lluvia frente a demanda hídrica estimada. La evaluación hídrica supone secano y no equivale a medir el agua disponible en las raíces.</p>{numeric(chosen.historical_p10_score)&&numeric(chosen.historical_p90_score)&&<p>Variación histórica para esta ventana: {display(chosen.historical_p10_score,0)}–{display(chosen.historical_p90_score,0)} puntos (percentiles 10–90 de {chosen.history_sample_years} temporadas evaluadas). Es una banda descriptiva, no una probabilidad ni una predicción.</p>}</details>
          </div>}

          <div className="terra-decision-rotation-card">
            <div className="terra-decision-section-head">
              <div>
                <h3>Secuencia anual sugerida</h3>
                <p>La rotación se mantiene, pero ahora aparece debajo del ranking para no ocupar un panel lateral.</p>
              </div>
            </div>
            {rotations.length? <>
              <div className="terra-decision-rotation-options" role="group" aria-label="Alternativas de rotación">{rotations.map((r,i)=><button key={r.id} className={i===Math.min(activeRotation,rotations.length-1)?'active':''} onClick={()=>setActiveRotation(i)} aria-pressed={i===Math.min(activeRotation,rotations.length-1)}>{i+1}. {r.crops.map(c=>c.crop_name).join(' → ')}</button>)}</div>
              <DecisionCalendar plan={rotation} year={report.planning_year}/>
              {rotationExplanation&&<div className="terra-ux-rotation-why"><div className="terra-ux-rotation-lead"><CheckCircle2 size={18}/><div><strong>¿Por qué este orden?</strong><p>{rotationExplanation.whyOrder}</p></div></div><div className="terra-ux-rotation-evidence">{rotationExplanation.evidence.map(row=><div key={row.key}><small>{row.label}</small><strong>{row.value}</strong></div>)}</div>{rotationExplanation.reasons?.length>0&&<ul className="terra-decision-plan-reasons">{rotationExplanation.reasons.slice(0,3).map(text=><li key={text}>{text}</li>)}</ul>}</div>}
            </> : <div className="terra-decision-no-rotations"><Info size={17}/> No se encontraron dos ciclos completos en el mismo año con familias distintas y 14 días de transición.</div>}
          </div>
        </div>
      </div>

      <button className="terra-decision-method-button" type="button" onClick={()=>setDetails(v=>!v)} aria-expanded={details}><ChevronDown size={17}/>{details?'Ocultar metodología y fuentes':'Ver metodología y fuentes'}</button>
      {details&&<div className="terra-decision-method-details"><p><strong>Procedencia:</strong> NASA POWER, registros regionales históricos de temperatura y lluvia. Copernicus NDVI describe la vegetación observada anteriormente, nunca como etiqueta del cultivo futuro.</p><p><strong>Observaciones NDVI:</strong> {ndvi?.status==='unavailable'?'no disponibles por falta de configuración':ndvi?.status==='error'?'no disponibles en esta consulta':ndvi?.annual?`${ndvi.annual.filter(y=>y.status==='observed').length} años con observaciones válidas`:'consultando…'}.</p><p><strong>Evaluación:</strong> el motor contrasta hasta doce temporadas reales, temperatura, calor acumulado, referencias térmicas y lluvia frente a demanda teórica en secano. Las rotaciones planifican dos cultivos sucesivos dentro de un mismo año, alternan familias y respetan un mínimo de 14 días de transición.</p><p><strong>Límite principal:</strong> la lluvia observada no equivale al agua almacenada en las raíces; sin datos de suelo o riego, el ranking es una evaluación orientativa para secano.</p><a href="https://power.larc.nasa.gov/docs/services/api/temporal/daily/" target="_blank" rel="noopener noreferrer">NASA POWER</a> · <a href="https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Statistical.html" target="_blank" rel="noopener noreferrer">Copernicus</a></div>}
    </>}
  </section>;
}
