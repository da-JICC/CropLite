import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Leaf,Info,AlertTriangle,ChevronDown,ShieldCheck,CalendarDays,CloudRain,Sun,CheckCircle2} from 'lucide-react';
import {ResponsiveContainer,ComposedChart,CartesianGrid,XAxis,YAxis,Tooltip,Line,Bar,ReferenceArea,ReferenceLine} from 'recharts';
import thermalCatalog from '../../data/cropTemperatureCatalog.json';
import phenologyCatalog from '../../data/cropPhenologyCatalog.json';
import {STAGE_COLORS} from '../phenology/phenologyEngine.mjs';
import {loadDecisionHistory,loadDecisionNDVI} from '../../services/decisionsService.js';
import {cropInsights,rotationInsights,numeric} from './decisionInsights.mjs';

const cropImages=Object.fromEntries(thermalCatalog.crops.map(c=>[c.id,c.image]));
const thermalById=Object.fromEntries(thermalCatalog.crops.map(c=>[c.id,c.thermal]));
const stagesByCrop=Object.fromEntries(phenologyCatalog.crops.map(c=>[c.id,c.stages]));
const months=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const prettyDate=iso=>iso?new Date(iso+'T12:00:00Z').toLocaleDateString('es-CL',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}):'—';
const display=(value,digits=1)=>numeric(value)?value.toLocaleString('es-CL',{maximumFractionDigits:digits}):'Sin datos';
const dayOffset=iso=>{if(!iso)return 0;return Math.round((Date.parse(iso+'T00:00:00Z')-Date.parse(iso.slice(0,4)+'-01-01T00:00:00Z'))/86400000);};
const clamp=value=>Math.max(0,Math.min(100,value));

function Hint({label,explanation}) {
  return <details className="terra-ux-hint"><summary aria-label={`Qué significa ${label}`} title={explanation}><Info size={14}/></summary><div className="terra-ux-hint-content">{explanation}</div></details>;
}

function CropDecisionCard({crop,position,selected,onSelect}) {
  const insight=cropInsights(crop);
  const headline=insight.highlights.find(item=>item.key==='temperature') || insight.highlights[0];
  return <button className={`terra-decision-crop terra-ux-crop-card${selected?' selected':''}`} type="button" aria-pressed={selected} onClick={()=>onSelect(crop.crop_id)}>
    <div className="terra-decision-crop-top"><span className="terra-decision-index">{String(position).padStart(2,'0')}</span><img src={cropImages[crop.crop_id]} alt=""/><div><strong>{crop.crop_name}</strong><small>{crop.cycle_days} días aproximados</small></div></div>
    <div className="terra-ux-card-conclusion"><span className={`terra-ux-signal ${headline?.tone||'neutral'}`}/><span>{headline?.title || 'Evaluación disponible'}</span></div>
    <div className="terra-ux-card-meta"><span>Compatibilidad estimada</span><b>{display(crop.score,0)} <small>/100</small></b></div>
    <div className="terra-decision-progress" aria-hidden="true"><span style={{width:`${clamp(crop.score??0)}%`}}/></div>
    <span className="terra-decision-crop-select">{selected?'Viendo razones y gráficos':'Ver por qué'}</span>
  </button>;
}

function planStageBands(crop,year) {
  const steps=stagesByCrop[crop?.crop_id]||[];
  if(!crop?.sow_date || !steps.length)return [];
  const yearStart=Date.parse(`${year}-01-01T00:00:00Z`);
  let elapsed=0;
  return steps.map(stage=>{
    const start=Date.parse(crop.sow_date+'T00:00:00Z')+elapsed*86400000;
    const finish=start+stage.duration_days*86400000;
    elapsed+=stage.duration_days;
    const toMonthPosition=value=>{
      const date=new Date(value);
      const month=date.getUTCMonth();
      const first=Date.UTC(date.getUTCFullYear(),month,1);
      const next=Date.UTC(date.getUTCFullYear(),month+1,1);
      const position=month+1+(value-first)/(next-first);
      return date.getUTCFullYear()===year?position:date.getUTCFullYear()<year?1:13;
    };
    return {id:stage.id,label:stage.label,color:STAGE_COLORS[stage.id]||'#a6c4b0',x1:Math.max(1,toMonthPosition(Math.max(start,yearStart))),x2:Math.min(13,toMonthPosition(finish))};
  }).filter(segment=>segment.x2>segment.x1);
}

function SeasonalEvidence({crop,profile,year}) {
  const [view,setView]=useState('temperature');
  const band=thermalById[crop.crop_id]?.optimumClimateC;
  const hasBand=numeric(band?.min)&&numeric(band?.max);
  const data=(profile||[]).map(row=>({
    month:row.month,
    x:row.month+.5,
    temp:numeric(row.temp_mean_c)?row.temp_mean_c:null,
    rain:numeric(row.rain_median_mm)?row.rain_median_mm:null,
    sample:row.sample_years||0,
  }));
  const bands=planStageBands(crop,year);
  const hasData=data.some(row=>numeric(view==='temperature'?row.temp:row.rain));
  const stageNames=Object.fromEntries((stagesByCrop[crop.crop_id]||[]).map(stage=>[stage.id,stage.label]));
  return <div className="terra-ux-season-card">
    <div className="terra-ux-season-heading"><div><span className="overline">POR QUÉ SE RECOMIENDA</span><h3>Clima y temporada de {crop.crop_name.toLowerCase()}</h3><p>Las curvas muestran condiciones históricas mensuales. Los colores indican cuándo se estima cada etapa del cultivo.</p></div>
      <div className="terra-ux-segment" role="group" aria-label="Variable del gráfico"><button type="button" className={view==='temperature'?'active':''} aria-pressed={view==='temperature'} onClick={()=>setView('temperature')}><Sun size={14}/> Temperatura</button><button type="button" className={view==='rain'?'active':''} aria-pressed={view==='rain'} onClick={()=>setView('rain')}><CloudRain size={14}/> Lluvia</button></div>
    </div>
    {view==='temperature'&&<div className="terra-ux-chart-caption"><span className="terra-ux-legend-chip" style={{background:'#d7eada',borderColor:'#9dccaa'}}/>Rango climático orientativo de {crop.crop_name.toLowerCase()}: {hasBand?`${band.min}–${band.max} °C`:'no disponible'} · Los puntos ámbar están fuera de este rango <Hint label="rango climático" explanation="Intervalo general de referencia del cultivo; no indica por sí solo temperatura ideal durante cada fase, supervivencia ni daño confirmado."/></div>}
    {view==='rain'&&<p className="terra-ux-chart-caption">Lluvia mensual típica (mm). Ayuda a entender la temporada, pero no determina por sí sola el orden de recomendación. <Hint label="lluvia" explanation="La lluvia no equivale a agua disponible: riego, escorrentía y reservas del suelo no están verificados en esta recomendación."/></p>}
    {hasData?<div className="terra-ux-season-plot" role="img" aria-label={`Gráfico histórico mensual de ${view==='temperature'?'temperatura':'lluvia'} y fases estimadas de ${crop.crop_name}`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{top:13,right:18,bottom:5,left:0}}>
          <CartesianGrid stroke="#e6efe9" vertical={false}/>
          <XAxis type="number" dataKey="x" domain={[1,13]} ticks={months.map((_,i)=>i+1.5)} tickFormatter={v=>months[Math.floor(v)-1]||''} tick={{fontSize:11,fill:'#64806b'}} axisLine={false} tickLine={false}/>
          <YAxis tick={{fontSize:11,fill:'#64806b'}} width={46} axisLine={false} tickLine={false} unit={view==='temperature'?'°C':''}/>
          {bands.map(stage=><ReferenceArea key={stage.id} x1={stage.x1} x2={stage.x2} fill={stage.color} fillOpacity={.16} ifOverflow="hidden" stroke="none"/>)}
          {view==='temperature'&&hasBand&&<ReferenceArea x1={1} x2={13} y1={band.min} y2={band.max} fill="#79bd92" fillOpacity={.16} ifOverflow="hidden" stroke="none"/>}
          {view==='temperature'&&hasBand&&[band.min,band.max].map(n=><ReferenceLine key={n} y={n} stroke="#5b9a72" strokeDasharray="4 5" strokeWidth={1} ifOverflow="hidden"/>)}
          <Tooltip formatter={(val)=>[`${display(val,1)} ${view==='temperature'?'°C':'mm'}`,view==='temperature'?'Temperatura histórica':'Lluvia mensual']} labelFormatter={v=>months[Math.floor(v)-1]||'Mes'} contentStyle={{border:'1px solid #dce8dd',borderRadius:10,fontSize:12}}/>
          {view==='temperature'?<Line type="monotone" dataKey="temp" stroke="#287d55" strokeWidth={3} dot={({cx,cy,payload})=>{
            if(!numeric(cx)||!numeric(cy)||!numeric(payload?.temp))return null;
            const outside=hasBand&&(payload.temp<band.min||payload.temp>band.max);
            return <circle cx={cx} cy={cy} r={outside?5:3} fill={outside?'#d89a4b':'#287d55'} stroke="#fff" strokeWidth={outside?1.8:1}/>;
          }} connectNulls={false} name="Temperatura media histórica"/>:<Bar dataKey="rain" fill="#629ab8" radius={[4,4,0,0]} maxBarSize={38} name="Lluvia mensual típica"/>}
        </ComposedChart>
      </ResponsiveContainer>
    </div>:<div className="terra-ux-no-profile">No hay datos mensuales suficientes para dibujar esta variable.</div>}
    <div className="terra-ux-stage-legend" aria-label="Etapas del cultivo">{bands.map(item=><span key={item.id}><i style={{background:item.color}}/>{stageNames[item.id]||item.label}</span>)}</div>
    <p className="terra-ux-plot-source">Histórico NASA POWER · Promedios mensuales de distintos años · Fechas y etapas estimadas para {year}.</p>
  </div>;
}

function DecisionCalendar({plan,year}) {
  return <div className="terra-decision-calendar">
    <div className="terra-decision-months">{months.map(m=><span key={m}>{m}</span>)}</div>
    {plan.crops.map((crop,i)=><div className="terra-decision-calrow" key={`${crop.crop_id}-${i}`}>
      <div className="terra-decision-calname"><img src={cropImages[crop.crop_id]} alt=""/><strong>{crop.crop_name}</strong></div>
      <div className="terra-decision-calbody" aria-label={`${crop.crop_name}: ${prettyDate(crop.sow_date)} a ${prettyDate(crop.harvest_date)}`}>
        {(stagesByCrop[crop.crop_id]||[]).reduce((acc,stage)=>{
          const left=clamp((dayOffset(crop.sow_date)+acc.offset)/365*100);
          acc.parts.push(<span key={stage.id} title={`${stage.label} · ${stage.duration_days} días`} className="terra-decision-calstage" style={{left:`${left}%`,width:`${stage.duration_days/365*100}%`,background:STAGE_COLORS[stage.id]}}/>);
          acc.offset+=stage.duration_days;return acc;
        },{parts:[],offset:0}).parts}
      </div><small>{prettyDate(crop.sow_date)} – {prettyDate(crop.harvest_date)}</small>
    </div>)}
    <div className="terra-decision-calfoot">Calendario de planificación {year}. Los colores muestran las etapas estimadas.</div>
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
  return <section className="terra-decision-section terra-ux-decisions" aria-label="Decisiones agrícolas">
    <div className="terra-decision-header"><div><span className="overline">02 / DECISIONES AGRÍCOLAS</span><h2>Qué sembrar en tu terreno</h2><p>Compara opciones y descubre qué condiciones del clima respaldan cada alternativa.</p></div><span className="terra-decision-header-pill"><ShieldCheck size={15}/> Evaluación basada en reglas</span></div>
    {!region?<div className="terra-decision-empty"><Leaf size={28}/><strong>Selecciona un terreno para empezar</strong><p>TerraAI comparará las condiciones del lugar con las necesidades de los seis cultivos.</p></div>
    :loading?<div className="terra-decision-empty" role="status"><div className="terra-loader"/><strong>Consultando el histórico ambiental</strong><p>Recuperando registros regionales para analizar las opciones de siembra.</p></div>
    :error?<div className="terra-decision-empty" role="alert"><AlertTriangle size={22}/><strong>No fue posible consultar los datos</strong><p>{error}</p><button onClick={()=>{cache.current.delete(key);ndviCache.current.delete(key);setAttempt(x=>x+1);}}>Reintentar</button></div>
    :report?.status!=='evaluated'?<div className="terra-decision-empty"><Info size={24}/><strong>No hay suficientes datos para comparar cultivos</strong><p>El sistema necesita al menos tres temporadas anteriores a 2025 con registros diarios suficientes.</p></div>
    :<>
      <div className="terra-decision-section-head"><div><h3>Cultivos a considerar</h3><p>Selecciona uno para ver las razones y cómo encaja con la temporada.</p></div><Hint label="compatibilidad estimada" explanation="Este orden usa temperatura, calor acumulado durante el ciclo y referencias térmicas disponibles. No predice la cosecha ni representa una probabilidad de supervivencia."/></div>
      <div className="terra-decision-grid">{report.ranked.map((crop,index)=><CropDecisionCard key={crop.crop_id} crop={crop} position={index+1} selected={crop.crop_id===cropId} onSelect={onCropSelect}/>)}</div>
      {chosen&&<>
        <div className="terra-ux-explanation" aria-live="polite">
          <div className="terra-ux-explanation-title"><img src={cropImages[chosen.crop_id]} alt=""/><div><span className="overline">TU SELECCIÓN</span><h3>¿Por qué {chosen.crop_name.toLowerCase()}?</h3><p>Siembra sugerida: {prettyDate(chosen.sow_date)} · Cosecha estimada: {prettyDate(chosen.harvest_date)}</p></div></div>
          <p className="terra-ux-ranking-context">{report.ranked?.[0]?.crop_id===chosen.crop_id
            ? `Es la primera alternativa del análisis. Su diferencia respecto a la siguiente opción es de ${display((chosen.score??0)-(report.ranked?.[1]?.score??chosen.score),1)} puntos de compatibilidad estimada.`
            : `Ocupa el puesto ${report.ranked.findIndex(item=>item.crop_id===chosen.crop_id)+1}. ${report.ranked?.[0]?.crop_name} está ${display((report.ranked?.[0]?.score??0)-(chosen.score??0),1)} puntos por encima en esta evaluación.`}</p>
          <div className="terra-ux-reasons">{chosenInsights.highlights.slice(0,3).map(reason=><div key={reason.key} className="terra-ux-reason"><span className={`terra-ux-signal ${reason.tone}`}/><div><strong>{reason.title}</strong><p>{reason.description}</p></div></div>)}</div>
          <details className="terra-ux-explanation-method"><summary>¿Cómo se obtiene la recomendación?</summary><p>La clasificación compara temperaturas diarias con el rango climático del cultivo, el calor acumulado necesario para desarrollarse y referencias térmicas de etapas sensibles cuando están disponibles. La lluvia se informa como contexto y no afecta la puntuación mientras no conozcamos riego ni reservas del suelo.</p></details>
        </div>
        <SeasonalEvidence crop={chosen} profile={report.seasonal_profile} year={report.planning_year}/>
      </>}
      <div className="terra-decision-section-head"><div><h3>Rotaciones que podrían encajar</h3><p>Planes con dos cultivos y fechas compatibles. El mejor cultivo individual no siempre es el primero de la mejor combinación.</p></div></div>
      {rotations.length?<>
        <div className="terra-decision-rotation-options" role="group" aria-label="Alternativas de rotación">{rotations.map((r,i)=><button key={r.id} className={i===Math.min(activeRotation,rotations.length-1)?'active':''} onClick={()=>setActiveRotation(i)} aria-pressed={i===Math.min(activeRotation,rotations.length-1)}>{i+1}. {r.crops.map(c=>c.crop_name).join(' → ')}</button>)}</div>
        <DecisionCalendar plan={rotation} year={report.planning_year}/>
        {rotationExplanation&&<div className="terra-ux-rotation-why"><div className="terra-ux-rotation-lead"><CheckCircle2 size={18}/><div><strong>¿Por qué este orden?</strong><p>{rotationExplanation.whyOrder}</p></div></div><div className="terra-ux-rotation-evidence">{rotationExplanation.evidence.map(row=><div key={row.key}><small>{row.label}</small><strong>{row.value}</strong></div>)}</div></div>}
      </>:<div className="terra-decision-no-rotations"><Info size={17}/> No se encontraron dos ciclos completos que respeten el calendario y la alternancia de familias.</div>}
      <button className="terra-decision-method-button" type="button" onClick={()=>setDetails(v=>!v)} aria-expanded={details}><ChevronDown size={17}/>{details?'Ocultar metodología y fuentes':'Ver metodología y fuentes'}</button>
      {details&&<div className="terra-decision-method-details"><p><strong>Procedencia:</strong> NASA POWER, registros regionales históricos de temperatura y lluvia. Copernicus NDVI describe la vegetación observada anteriormente, nunca como etiqueta del cultivo futuro.</p><p><strong>Observaciones NDVI:</strong> {ndvi?.status==='unavailable'?'no disponibles por falta de configuración':ndvi?.status==='error'?'no disponibles en esta consulta':ndvi?.annual?`${ndvi.annual.filter(y=>y.status==='observed').length} años con observaciones válidas`:'consultando…'}.</p><p><strong>Evaluación:</strong> el motor considera años históricos representativos, rangos climáticos generales, el calor acumulado necesario y referencias de etapas sensibles. Las rotaciones usan familias diferentes, un intervalo mínimo de 14 días y puntuaciones conjuntas.</p><p><strong>Límite principal:</strong> sin información verificada sobre riego, suelo, variedad y manejo, el orden solo describe compatibilidad ambiental estimada.</p><a href="https://power.larc.nasa.gov/docs/services/api/temporal/daily/" target="_blank" rel="noopener noreferrer">NASA POWER</a> · <a href="https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Statistical.html" target="_blank" rel="noopener noreferrer">Copernicus</a></div>}
    </>}
  </section>;
}
