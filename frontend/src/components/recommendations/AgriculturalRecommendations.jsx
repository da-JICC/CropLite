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
    aria-pressed={selected} aria-label={`Explorar ${scenario.cropName} en el análisis ambiental`}>
    <div className="terra-rec-card-head"><CropIcon cropId={scenario.cropId} decorative/>
      <span className="terra-rec-rank">{ordinal}º</span><div><strong>{scenario.cropName}</strong><small>{scenario.family} · Escenario 2025</small></div></div>
    <div className="terra-rec-card-dates"><CalendarDays size={13}/>{formatDate(scenario.sowDate)} – {formatDate(scenario.harvestDate)}<span>{scenario.cycleDays} días</span></div>
    <ScenarioBar scenario={scenario}/>
    <div className="terra-rec-context" aria-label="Indicadores ambientales descriptivos">
      <span>VPD: <b>{scenario.context.vpdMeanKpa ?? '—'} kPa</b></span>
      <span>Radiación: <b>{scenario.context.solarRadiationMjM2 ?? '—'} MJ/m²</b></span>
      <span>Humedad radicular: <b>{scenario.context.rootzoneMoistureMean ?? '—'} m³/m³</b></span>
      <span>Lluvia / ETc: <b>{scenario.waterComplete ? `${scenario.rainEtcRatio}×`:'—'}</b></span>
    </div>
    <div className="terra-rec-card-explain"><span className="terra-rec-card-positive"><CheckCircle2 size={14}/>{scenario.positives[0]||'Se pudo evaluar el comportamiento térmico.'}</span>
      {scenario.vulnerabilities[0]&&<span className="terra-rec-card-caution"><AlertTriangle size={14}/>{scenario.vulnerabilities[0]}</span>}</div>
    <span className="terra-rec-card-action">Ver referencias e indicadores <ArrowRight size={14}/></span>
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
    <div className="terra-rec-rotation-foot"><Info size={15}/><span>Transición prevista: al menos {RECOMMENDATION_METHODOLOGY.transition_buffer_days} días. Las cuatro tonalidades indican etapas estimadas; no son observaciones fenológicas.</span></div>
  </div>;
}

/** A transparent, non-ML agronomic screening placed directly after the field map. */
export function AgriculturalRecommendations({region,analysis,loading,cropId,onCropSelect,onRetry}){
  const [activePlan,setActivePlan]=useState(0);
  const [showMethod,setShowMethod]=useState(false);
  const output=useMemo(()=>buildCropRecommendations(analysis,phenologyCatalog.crops,cropThermalCatalog.crops),[analysis]);
  const rotations=output.rotations||[];
  const plan=rotations[Math.min(activePlan,rotations.length-1)]||null;
  return <section className="terra-recommendation-section" aria-label="Recomendación inteligente de cultivos">
    <header className="terra-rec-header"><div><span className="overline">02 / DECISIONES AGRÍCOLAS</span><h2>¿Qué cultivo podría adaptarse mejor?</h2>
      <p>Compara opciones para tu terreno y explora rotaciones posibles con la meteorología de 2025.</p></div>
      <span className="terra-rec-method-pill"><Leaf size={14}/> Evaluación experimental · No ML entrenado</span>
    </header>
    {!region ? <div className="terra-rec-empty"><Sun size={22}/><strong>Selecciona un terreno en el mapa</strong><span>La comparación aparecerá aquí, antes de los gráficos, al disponer de registros meteorológicos válidos.</span></div>
    :loading ? <div className="terra-rec-empty" role="status"><span className="terra-loader"/><strong>Analizando condiciones de tu región</strong><span>Se utilizarán los mismos datos ya solicitados por el explorador ambiental.</span></div>
    :output.status!=='screened' ? <div className="terra-rec-empty" role="status"><ShieldAlert size={22}/><strong>Sin evidencia suficiente para recomendar cultivos</strong><span>{output.coverage||'No fue posible evaluar la serie térmica.'}</span><button onClick={onRetry} type="button"><RefreshCcw size={14}/> Reintentar datos ambientales</button></div>
    : <>
      <div className="terra-rec-warning"><Info size={18}/><span><strong>Comparación histórica, no pronóstico.</strong> Las fechas y las clasificaciones representan escenarios hipotéticos utilizando exclusivamente el clima registrado en 2025. No predicen el clima ni el rendimiento de una temporada futura.</span></div>
      <div className="terra-rec-subheading"><div><h3>Alternativas de cultivo</h3><p>Ordenadas por coincidencia térmica y acumulación GDD en ventanas completas. Agua, VPD, radiación y suelo aparecen como contexto descriptivo, sin umbrales no validados.</p></div><span>{output.ranked.length} / {cropThermalCatalog.crops.length} evaluables</span></div>
      <div className="terra-rec-cards">{output.ranked.map((scenario,index)=><RankingCard key={scenario.cropId} scenario={scenario} ordinal={index+1} selected={scenario.cropId===cropId} onPick={onCropSelect}/>)}</div>
      {output.missingCrops?.length>0&&<p className="terra-rec-missing">Sin cobertura suficiente para: {output.missingCrops.join(', ')}.</p>}
      <div className="terra-rec-rotation-area"><div className="terra-rec-subheading"><div><h3>Rotación anual · escenarios compatibles en calendario</h3><p>Se combinan familias diferentes cuando caben dos ciclos completos en 2025, con un margen para transición. La viabilidad real requiere validar suelo, riego, sanidad y manejo.</p></div></div>
        {rotations.length?<><div className="terra-rec-plan-options" role="group" aria-label="Alternativas de rotación">
          {rotations.map((item,index)=><button key={item.id} type="button" className={index===Math.min(activePlan,rotations.length-1)?'active':''} aria-pressed={index===Math.min(activePlan,rotations.length-1)} onClick={()=>setActivePlan(index)}>{index+1}. {item.label}</button>)}
        </div><RotationDisplay plan={plan}/>
        <div className="terra-rec-rotation-notice"><AlertTriangle size={15}/><span>No se garantiza que el terreno permita esta secuencia. Las rotaciones necesitan planificación plurianual y evaluación de enfermedades, insumos y disponibilidad hídrica.</span></div></>
        :<div className="terra-rec-rotation-none"><Info size={18}/><span>No se identificó una combinación de dos cultivos de familias diferentes que completara ambos ciclos con las condiciones de evaluación de 2025. Se muestran alternativas individuales arriba; no se forzará una rotación.</span></div>}
      </div>
      <button type="button" className="terra-rec-method-toggle" onClick={()=>setShowMethod(v=>!v)} aria-expanded={showMethod}><Info size={15}/>{showMethod?'Ocultar metodología':'Cómo se calculan estas recomendaciones'}</button>
      {showMethod&&<div className="terra-rec-method-details">
        <p><strong>Motor:</strong> reglas agronómicas interpretables, sin red neuronal ni entrenamiento. Evalúa ventanas de siembra cada 14 días de 2025, solo ciclos completos, con al menos 90 % de datos de temperatura. Ordena mediante la proporción de temperaturas medias dentro de la banda climática orientativa y el avance respecto del GDD mínimo del catálogo.</p>
        <p><strong>Otras variables:</strong> se muestran lluvia/ETc, VPD, radiación y humedad radicular como contexto, sin asignarles automáticamente la categoría «favorable». NDVI histórico del terreno no revela qué cultivo debería sembrarse. La familia botánica es un filtro de rotación, no un certificado de sanidad del suelo.</p>
        <p><strong>Para una predicción futura de IA:</strong> se necesitarán varias temporadas, validación temporal y geográfica independiente, datos de rendimiento reales y condiciones de suelo/manejo. No se presenta el puntaje interno como probabilidad de cosecha exitosa.</p>
        <ul>{RECOMMENDATION_METHODOLOGY.limitations.map((limitation,i)=><li key={i}>{limitation}</li>)}</ul>
      </div>}
    </>}
  </section>;
}
