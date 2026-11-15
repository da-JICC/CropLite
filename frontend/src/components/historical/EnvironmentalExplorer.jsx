import React, {useMemo, useState} from 'react';
import {Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import {CloudRain, Droplets, Leaf, Sun, Wind, ThermometerSun, Waves, Download, AlertCircle, RefreshCcw, CalendarRange} from 'lucide-react';
import {CROPS} from '../crops/CropSelector.jsx';

const SOURCES = [
  {id:'temperature', label:'Temperatura', Icon:ThermometerSun, color:'#ce8651', description:'Temperatura del aire a 2 m'},
  {id:'humidity',label:'Humedad',Icon:Droplets,color:'#368cb7', description:'Humedad relativa del aire'},
  {id:'precipitation',label:'Precipitación',Icon:CloudRain,color:'#4198b4',description:'Lluvia acumulada por mes'},
  {id:'radiation',label:'Radiación solar',Icon:Sun,color:'#cd9d3c',description:'Radiación solar recibida'},
  {id:'wind',label:'Viento',Icon:Wind,color:'#738d9b',description:'Velocidad del viento a 2 m'},
  {id:'soil_moisture',label:'Humedad del suelo',Icon:Waves,color:'#8178b3',description:'Contenido volumétrico superficial'},
  {id:'ndvi',label:'NDVI',Icon:Leaf,color:'#2d966b',description:'Índice de vegetación Sentinel-2'},
];

function toNumber(value, precision=2) {
  return Number.isFinite(value) ? Number(value).toLocaleString('es-CL',{maximumFractionDigits:precision}) : '—';
}

function exportCsv(series, region) {
  if (!series?.monthly?.length) return;
  const keys = ['date','value','min_c','max_c','rootzone_moisture_m3_m3','valid_days','expected_days','valid_pixels','total_pixels'];
  const quote = x => `"${String(x ?? '').replaceAll('"','""')}"`;
  const meta = [
    ['fuente',series.source],['unidades',series.unit],['método',series.method],
    ['muestreo',series.sampling_method],['latitud',region?.representative_point?.latitude],
    ['longitud',region?.representative_point?.longitude],['inicio',series.coverage.start],['fin',series.coverage.end],
  ];
  const csv = '\ufeff' + meta.map(x=>x.map(quote).join(',')).join('\r\n') + '\r\n' + keys.join(',') + '\r\n' +
    series.monthly.map(r=>keys.map(k=>quote(r[k])).join(',')).join('\r\n');
  const href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=href;a.download=`croplite-${series.source.toLowerCase().includes('copernicus')?'ndvi':'ambiental'}-${series.coverage.start}.csv`;a.click();
  setTimeout(()=>URL.revokeObjectURL(href),1000);
}

function CompactCropSelector({cropId,onCropSelect}) {
  return <div className="terra-crop-inline">
    <div className="terra-crop-inline-heading"><div><strong>Cultivo de referencia</strong><span>Selecciona un cultivo para ver sus parámetros térmicos</span></div></div>
    <div className="terra-crop-inline-items" role="group" aria-label="Seleccionar cultivo">
      {CROPS.map(c=><button type="button" key={c.id} aria-pressed={c.id===cropId} onClick={()=>onCropSelect(c.id)} className={`terra-crop-compact${cropId===c.id?' selected':''}`}>
        <img src={c.image} alt="" loading="lazy"/><span>{c.name}</span>
      </button>)}
    </div>
  </div>;
}

function Chart({series,source,crop,view}) {
  const seasonal=view==='seasonal';
  const rows=seasonal ? series.seasonal : series.monthly;
  const temp=source.id==='temperature';
  const t=crop?.thermal;
  const xKey=seasonal?'label':'date';
  const unit=series.unit;
  const formatValue=v => Number.isFinite(v)?`${toNumber(v, temp?1:3)} ${unit}`:'Sin dato';
  const thermalValues=temp&&t ? [t.optimumClimateC.min,t.optimumClimateC.max,t.gddBaseC,t.gddUpperC,t.coldFloweringReferenceC,t.heatReproductiveReferenceC] : [];
  const allValues=rows.flatMap(r=>[r.value,r.mean,r.min_c,r.max_c,r.p10,r.p90]).filter(Number.isFinite);
  const ymax=temp ? Math.ceil(Math.max(1,...allValues,...thermalValues)+2) : undefined;
  const ymin=temp ? Math.floor(Math.min(...allValues,...thermalValues)-2) : (source.id==='ndvi'?-1:0);
  return <div className="terra-chart-surface" role="img" aria-label={`Gráfico de ${source.label.toLowerCase()}, ${seasonal?'perfil estacional':'serie mensual histórica'}`}>
    <ResponsiveContainer width="100%" height="100%"><ComposedChart data={rows} margin={{top:18,right:18,left:0,bottom:12}}>
      <CartesianGrid vertical={false} stroke="#e6eee8" strokeDasharray="4 5"/>
      <XAxis dataKey={xKey} minTickGap={36} tick={{fontSize:11,fill:'#658072'}}/>
      <YAxis width={59} domain={temp?[ymin,ymax]:source.id==='ndvi'?[-1,1]:[0,'auto']} tick={{fontSize:11,fill:'#658072'}} tickFormatter={v=>toNumber(v,1)}/>
      <Tooltip labelFormatter={label=>seasonal?`Mes: ${label}`:`Mes: ${String(label).slice(0,7)}`}
        formatter={(v,n)=>[formatValue(v),n]}/>
      {temp && t && <>
        <ReferenceArea y1={t.optimumClimateC.min} y2={t.optimumClimateC.max} fill="#6aba83" fillOpacity={0.15} stroke="none"/>
        <ReferenceLine y={t.gddBaseC} stroke="#7661ae" strokeDasharray="3 5"/>
        <ReferenceLine y={t.gddUpperC} stroke="#a17fc2" strokeDasharray="3 6"/>
        <ReferenceLine y={t.coldFloweringReferenceC} stroke="#3d7aab" strokeDasharray="6 4"/>
        <ReferenceLine y={t.heatReproductiveReferenceC} stroke="#c75d4a" strokeDasharray="6 4"/>
      </>}
      {seasonal && <>
        <Line name="Percentil 10" type="linear" dataKey="p10" stroke={source.color} strokeWidth={1} strokeOpacity={.45} strokeDasharray="4 5" dot={false} connectNulls={false}/>
        <Line name="Percentil 90" type="linear" dataKey="p90" stroke={source.color} strokeWidth={1} strokeOpacity={.45} strokeDasharray="4 5" dot={false} connectNulls={false}/>
      </>}
      {temp && <>
        <Line name="Media de mínimas diarias" dataKey="min_c" type="linear" stroke="#458db9" strokeWidth={1.7} dot={false} connectNulls={false}/>
        <Line name="Media de máximas diarias" dataKey="max_c" type="linear" stroke="#e2a050" strokeWidth={1.7} dot={false} connectNulls={false}/>
      </>}
      <Line name={temp?'Temperatura media':source.label} type="linear" dataKey={seasonal?'mean':'value'} stroke={source.color} strokeWidth={3} dot={seasonal?{r:3}:false} activeDot={{r:5}} connectNulls={false}/>
    </ComposedChart></ResponsiveContainer>
  </div>;
}

function ReferenceLegend({crop}) {
  const t=crop?.thermal;
  if(!t)return null;
  return <div className="terra-thermal-legend" aria-label="Referencias agronómicas del cultivo">
    <span><i className="optimal"/> Óptimo climático orientativo: {t.optimumClimateC.min}–{t.optimumClimateC.max} °C</span>
    <span><i className="basal"/> Base para desarrollo (GDD): {t.gddBaseC} °C</span>
    <span><i className="upper"/> Tope de cálculo GDD: {t.gddUpperC} °C</span>
    <span><i className="cold"/> Referencia de frío en floración: {t.coldFloweringReferenceC} °C</span>
    <span><i className="heat"/> Referencia de calor reproductivo: {t.heatReproductiveReferenceC} °C</span>
  </div>;
}

export function EnvironmentalExplorer({region,analysis,loading,cropId,onCropSelect,onRetry,selectedCrop}) {
  const [tab,setTab]=useState('temperature');
  const [view,setView]=useState('seasonal');
  const [rainSource,setRainSource]=useState('imerg');
  const active=SOURCES.find(s=>s.id===tab)||SOURCES[0];
  const rainOptions=Boolean(analysis?.datasets?.precipitation_power?.coverage?.valid_months &&
    analysis?.datasets?.precipitation?.source?.includes('IMERG'));
  const dataset=tab==='precipitation' && rainOptions && rainSource==='power'
    ? analysis.datasets.precipitation_power : analysis?.datasets?.[tab];
  const valid=dataset?.coverage?.valid_months || 0;
  const total=dataset?.coverage?.months || 0;
  return <>
    <div className="terra-parameter-tabs" role="tablist" aria-label="Variable ambiental">
      {SOURCES.map(s=><button type="button" key={s.id} role="tab" id={`variable-${s.id}`} aria-selected={tab===s.id} aria-controls="terra-active-parameter" onClick={()=>setTab(s.id)} className={tab===s.id?'selected':''}><s.Icon size={18}/><span>{s.label}</span></button>)}
    </div>
    {!region && <div className="terra-empty-analysis"><Leaf size={29}/><strong>Selecciona tu terreno en el mapa</strong><span>La información ambiental aparecerá aquí automáticamente.</span></div>}
    {region && loading && <div className="terra-empty-analysis" role="status"><span className="terra-loader"/><strong>Consultando el histórico ambiental</strong><span>Las fuentes se procesan por separado. La primera solicitud puede tardar.</span></div>}
    {region && !loading && !analysis && <div className="terra-empty-analysis"><AlertCircle size={26}/><strong>No fue posible completar el análisis</strong><button type="button" onClick={onRetry}><RefreshCcw size={14}/> Reintentar</button></div>}
    {analysis && <div id="terra-active-parameter" role="tabpanel" aria-labelledby={`variable-${active.id}`} className="terra-variable-panel">
      <div className="terra-variable-heading"><div><span className="overline">EXPLORACIÓN AMBIENTAL</span><h3>{active.label}</h3><p>{active.description}</p></div>
        <div className="terra-plot-view" role="group" aria-label="Modo de gráfica">
          <button type="button" className={view==='seasonal'?'selected':''} onClick={()=>setView('seasonal')}>Ciclo estacional</button>
          <button type="button" className={view==='monthly'?'selected':''} onClick={()=>setView('monthly')}>Serie mensual</button>
        </div>
      </div>
      <div className="terra-source-strip"><span className={`terra-data-dot ${dataset?.status==='error'?'missing':''}`}/><b>{dataset?.source || active.label}</b>
        <span>{dataset?.coverage?.start?.slice(0,4)||'—'}–{dataset?.coverage?.end?.slice(0,4)||'—'} · {valid}/{total} meses disponibles</span></div>
      {tab==='temperature' && <CompactCropSelector cropId={cropId} onCropSelect={onCropSelect}/>}
      {tab==='precipitation' && rainOptions && <div className="terra-rain-source-switch" role="group" aria-label="Fuente de precipitación">
        <span>Comparar fuentes sin volver a consultar:</span>
        <button type="button" className={rainSource==='imerg'?'selected':''} onClick={()=>setRainSource('imerg')}>GPM IMERG</button>
        <button type="button" className={rainSource==='power'?'selected':''} onClick={()=>setRainSource('power')}>POWER histórico</button>
      </div>}
      {dataset?.status==='error' || !valid ? <div className="terra-empty-analysis"><AlertCircle size={24}/><strong>Sin datos verificables de esta variable</strong><span>{dataset?.error || 'La fuente no devolvió observaciones válidas.'}</span></div> : <>
        <Chart series={dataset} source={active} crop={selectedCrop} view={view}/>
        {tab==='temperature' && <ReferenceLegend crop={selectedCrop}/>}
        <div className="terra-chart-caption"><span>{view==='seasonal'?'Cada punto resume el mismo mes de los años con datos válidos; las líneas discontinuas señalan los percentiles 10 y 90.':'Serie histórica mensual: no se dibujan meses faltantes ni se rellenan observaciones.'}</span>
          <button type="button" onClick={()=>exportCsv(dataset,analysis.region)}><Download size={14}/> Descargar CSV</button></div>
      </>}
      <div className="terra-variable-notes"><p><b>Cómo se calculó:</b> {dataset?.method||'No disponible'}. <b>Unidad:</b> {dataset?.unit||'—'}.</p>
        <p><b>Resolución y alcance:</b> {dataset?.resolution_note||'No disponible'}. {tab==='temperature'?'Las líneas de cultivos orientan la comparación; no predicen daño ni rendimiento.':''}</p>
        {dataset?.metadata?.gpm_imerg_status && <p><b>GPM:</b> {dataset.metadata.gpm_imerg_status}</p>}
        {dataset?.metadata?.failed_years && Object.keys(dataset.metadata.failed_years).length>0 && <p><b>Copernicus:</b> algunos años no pudieron recuperarse; no se rellenaron.</p>}
      </div>
      {tab==='soil_moisture' && analysis.soil_chemistry && <p className="terra-soil-fineprint">pH, N, P y K: no disponibles como mediciones satelitales fiables para este terreno. No se utilizan valores inventados en recomendaciones.</p>}
    </div>}
  </>;
}
