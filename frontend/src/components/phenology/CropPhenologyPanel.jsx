import React,{useMemo} from 'react';
import {CalendarDays,Info,Leaf,TriangleAlert} from 'lucide-react';
import {CROPS} from '../crops/CropSelector.jsx';
import phenologyCatalog from '../../data/cropPhenologyCatalog.json';
import {cropIndicators,dayIndex,shiftDay,STAGE_COLORS,timelineFor} from './phenologyEngine.mjs';
import {buildIndicatorComparisonGroups} from './indicatorComparisons.mjs';

const byCrop=Object.fromEntries(phenologyCatalog.crops.map(c=>[c.id,c]));
const numeric=v=>typeof v==='number' && Number.isFinite(v);
const fmt=(v,d=1)=>numeric(v)?v.toLocaleString('es-CL',{maximumFractionDigits:d}):'—';
const dateStr=iso=>new Date(iso+'T12:00:00Z').toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'});

export function CropSelectorBar({cropId,onCropSelect}) {
  return <div className="terra-agro-crop-picker">
    <div className="terra-agro-picker-heading"><strong>1 · Selecciona el cultivo</strong><span>Sus cuatro etapas y referencias se aplicarán al gráfico, sin volver a descargar datos.</span></div>
    <div className="terra-phenology-crops" role="group" aria-label="Cultivo de referencia">
      {CROPS.map(item=><button type="button" key={item.id} aria-pressed={item.id===cropId}
        className={`terra-phenology-crop${item.id===cropId?' active':''}`} onClick={()=>onCropSelect(item.id)}>
        <img src={item.image} alt="" loading="lazy"/><span>{item.name}</span>
      </button>)}
    </div>
  </div>;
}

export function PlantingDateControl({sowDate,onSowDateChange}) {
  const index=dayIndex(sowDate);
  return <div className="terra-sowing-under-chart" aria-label="Selección del inicio del cultivo">
    <div className="terra-planting-controls">
      <div className="terra-planting-copy"><CalendarDays size={18}/><div><strong>2 · Mueve la fecha de siembra</strong><small>Solo cambia el escenario fenológico y sus indicadores; el gráfico conserva siempre los 365 días de 2025.</small></div></div>
      <label className="terra-planting-date">Día de inicio <input aria-label="Fecha de siembra en 2025" type="date" min="2025-01-01" max="2025-12-31" value={sowDate} onChange={e=>{if(e.target.value)onSowDateChange(e.target.value)}}/></label>
    </div>
    <div className="terra-planting-slider"><span>01 ENE 2025</span><input type="range" aria-label="Desplazar fecha de siembra" min="0" max="364" step="1" value={Math.max(0,Math.min(364,index))} onChange={e=>onSowDateChange(shiftDay('2025-01-01',Number(e.target.value)))}/><span>31 DIC 2025</span></div>
  </div>;
}

export function PhenologyTimeline({crop,sowDate,timeline:givenTimeline}) {
  const timeline=givenTimeline ?? timelineFor(crop,sowDate);
  if(!crop || !timeline)return null;
  return <div className="terra-inline-timeline" aria-label="Calendario fenológico estimado">
    <div className="terra-timeline-head"><div><Leaf size={17}/><strong>3 · Etapas del cultivo</strong></div><span>{timeline.estimated_cycle_days} días · maduración aproximada: <b>{dateStr(timeline.estimated_maturity_date)}</b></span></div>
    <div className="terra-phenology-track" role="img" aria-label={`Etapas fenológicas estimadas de ${crop.name}, desde ${dateStr(sowDate)} hasta ${dateStr(timeline.estimated_maturity_date)}`}>
      {timeline.stages.map(stage=><div className="terra-phenology-segment" key={stage.id} style={{flex:stage.duration_days,background:STAGE_COLORS[stage.id]}} title={`${stage.label}: ${dateStr(stage.start)} al ${dateStr(stage.end)} · ${stage.duration_days} días`}><span>{stage.duration_days} d</span></div>)}
    </div>
    <div className="terra-phenology-stages">{timeline.stages.map(stage=><div key={stage.id} className="terra-phenology-stage"><span className="terra-phenology-square" style={{background:STAGE_COLORS[stage.id]}}/><div><strong>{stage.label}</strong><span>{dateStr(stage.start)} — {dateStr(stage.end)}</span><small>{stage.duration_days} días · Kc: {fmt(stage.kc,2)}</small></div></div>)}</div>
    <div className="terra-phenology-note"><Info size={16}/><span>Las fases FAO/JICA son escenarios de calendario, no etapas detectadas por satélite. Las franjas del gráfico muestran únicamente el tramo correspondiente a 2025.</span></div>
    {timeline.beyond_2025&&<div className="terra-phenology-overflow"><TriangleAlert size={17}/><span>La maduración estimada ocurre en 2026. La línea de tiempo muestra el ciclo completo, pero <b>los indicadores solo incluyen observaciones de 2025</b>.</span></div>}
  </div>;
}

/** Compatibility wrapper for older component consumers; not mounted in the updated one-page view. */
export function CropPhenologyPanel({cropId,onCropSelect,sowDate,onSowDateChange}) {
  const crop=byCrop[cropId];
  return <section className="terra-phenology-panel"><CropSelectorBar cropId={cropId} onCropSelect={onCropSelect}/><PlantingDateControl sowDate={sowDate} onSowDateChange={onSowDateChange}/><PhenologyTimeline crop={crop} sowDate={sowDate}/></section>;
}

const STATUS={
 below:['Por debajo','below'],within:['Dentro del rango','within'],above:['Por encima','above'],
 incomplete:['Datos incompletos','incomplete'],no_reference:['Sin referencia comparable','unrated'],
};
export function CropIndicatorsTable({analysis,cropId,sowDate,loading}) {
  const crop=byCrop[cropId];
  const result=useMemo(()=>cropIndicators(analysis,crop,sowDate),[analysis,crop,sowDate]);
  const comparison=useMemo(()=>buildIndicatorComparisonGroups(result,crop,Boolean(analysis?.datasets)),[result,crop,analysis]);
  if(!crop || !result)return null;
  return <div className="terra-crop-indicators terra-indicators-integrated" aria-label="Comparación de indicadores y necesidades del cultivo">
    <div className="terra-indicators-header"><div><span className="overline">04 / INDICADORES DEL CULTIVO</span><h2>Indicadores y requisitos por etapa</h2><p>Compara valores observados y calculados con referencias del cultivo, solo cuando son realmente comparables.</p></div><span className="terra-period-tag">{dateStr(result.sow_date)} — {dateStr(result.estimated_maturity_date)}</span></div>
    {!analysis?.datasets&&<p className="terra-indicators-empty">{loading?'Recuperando los datos diarios…':'Selecciona una región en el mapa para calcular los indicadores. El calendario se puede explorar sin descargar datos.'}</p>}
    <div className="terra-comparison-legend" aria-label="Interpretación de las comparaciones"><span className="terra-compare-status below">Por debajo</span><span className="terra-compare-status within">Dentro del rango</span><span className="terra-compare-status above">Por encima</span><span className="terra-compare-status incomplete">Datos incompletos</span><span className="terra-compare-status unrated">Sin referencia comparable</span></div>
    <div className="terra-phenology-table-scroll"><table className="terra-phenology-table terra-comparison-table">
      <thead><tr><th>Etapa y fechas</th><th>Indicador</th><th>Valor obtenido</th><th>Referencia del cultivo</th><th>Comparación</th><th>Cobertura</th></tr></thead>
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
    <div className="terra-indicator-disclaimers"><p><b>Comparación responsable:</b> las etiquetas «dentro», «por encima» y «por debajo» no significan automáticamente productividad, supervivencia o daño. Para GDD y ETc se comparan únicamente objetivos de ciclo completo con los datos de todo el ciclo; no hay objetivos validados por etapa.</p>
      <p><b>Frío:</b> las referencias del CSV son orientativas; la fase media no demuestra floración. La mínima observada y el rango permiten identificar posibles cruces, no daños confirmados.</p>
      <p><b>Agua:</b> P − ETc es un balance climático parcial, no estrés hídrico real. No incorpora riego, escorrentía, reservas ni percolación; el arroz inundado requiere consideraciones adicionales.</p>
      <p><b>Disponibilidad:</b> los totales de días incompletos siguen siendo parciales, nunca se rellenan días faltantes o valores de 2026. <b>Lluvia:</b> {result.rainfall_source}. <b>Fuentes etapas y Kc:</b> <a href="https://www.fao.org/4/s2022e/s2022e07.htm" target="_blank" rel="noreferrer">FAO</a>{crop.id==='rice'?<>, <a href="https://openjicareport.jica.go.jp/pdf/12303392_01.pdf" target="_blank" rel="noreferrer">JICA</a></>:null} y CSV TerraAI (umbrales y ETc referenciales).</p>
    </div>
  </div>;
}
