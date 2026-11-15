import React from 'react';
import {ArrowLeft, CheckCircle2, CircleAlert, Download, Leaf, MapPin, Satellite, ThermometerSun} from 'lucide-react';
import {CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import {SectionHeading} from '../components/ui/Elements.jsx';
import {saveDatasetCsv} from '../services/regionAnalysisService.js';

const number=(value,digits=1)=>typeof value==='number'&&Number.isFinite(value)?value.toFixed(digits):'—';
function ChartShell({rows,children}) {return <div className="field-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={rows} margin={{top:12,right:16,bottom:5,left:-22}}><CartesianGrid stroke="#e6eeea" vertical={false} strokeDasharray="3 5"/><XAxis dataKey="date" minTickGap={42} tick={{fontSize:11,fill:'#739087'}}/><YAxis tick={{fontSize:11,fill:'#739087'}}/><Tooltip labelFormatter={d=>`Fecha: ${d}`} formatter={(v,name)=>[v==null?'Sin datos':number(v,2),name]}/><Legend wrapperStyle={{fontSize:12}}/>{children}</LineChart></ResponsiveContainer></div>}
function Metric({name,value,unit='',sub}) {return <div className="field-metric"><span>{name}</span><strong>{value}{value==='—'?'':unit&&<small> {unit}</small>}</strong>{sub&&<small>{sub}</small>}</div>}
function DataStatus({dataset,source}){return <div className={`field-dataset-status ${dataset?.status==='success'?'ok':'warn'}`}>{dataset?.status==='success'?<CheckCircle2 size={16}/>:<CircleAlert size={16}/>} {dataset?.status==='success'?`${source} · Datos disponibles`:dataset?.error||`${source} · Sin resultados`}</div>}
export function Environment({region,start,end,analysis,loading,navigate}) {
  const ndvi=analysis?.datasets?.ndvi;
  const temperature=analysis?.datasets?.temperature;
  const ndviRows=ndvi?.data?.observations||[];
  const validNDVI=ndviRows.filter(r=>typeof r.mean_ndvi==='number');
  const meanNDVI=validNDVI.length?validNDVI.reduce((s,r)=>s+r.mean_ndvi,0)/validNDVI.length:null;
  const latest=validNDVI.at(-1);
  const validShare=ndviRows.length?ndviRows.reduce((s,r)=>s+(Number(r.valid_percent)||0),0)/ndviRows.length:null;
  const tempRows=temperature?.data?.observations||[];
  const tempSummary=temperature?.data?.summary;
  const representativePoint=analysis?.region?.representative_point||region?.representativePoint;
  return <div className="field-environment-page">
    <SectionHeading overline="ENVIRONMENT / OBSERVATIONS" title="Environmental Intelligence" description="Datos históricos para la región seleccionada en My Farm. Cada fuente conserva su método de medición y sus límites de resolución." action={<button className="field-back-button" onClick={()=>navigate('overview')}><ArrowLeft size={16}/> Cambiar región</button>}/>
    <div className="field-environment-context"><div><MapPin size={18}/><span><b>{analysis?'Región analizada':'Región seleccionada'}</b><small>{representativePoint?`${number(representativePoint.latitude,5)}, ${number(representativePoint.longitude,5)} · ${number(analysis?.region?.area_hectares??region?.areaHectares,2)} ha`:'No has seleccionado un terreno'}</small></span></div><span>{analysis?`${analysis.period.start} — ${analysis.period.end}`:`Período configurado: ${start} — ${end}`}</span></div>
    {!analysis&&<div className="field-environment-empty"><Satellite size={38}/><h2>{loading?'Analizando el campo…':'Todavía no hay observaciones cargadas'}</h2><p>Abre «Overview — My Farm», delimita tu campo en el mapa y selecciona «Analizar región». Los resultados NDVI y temperatura aparecerán aquí.</p><button onClick={()=>navigate('overview')}>Ir al mapa <ArrowLeft size={16}/></button></div>}
    {analysis&&<div className="field-environment-stack">
      <section className="field-data-card">
        <div className="field-dataset-heading"><div><span className="overline">01 / VEGETATION INTELLIGENCE</span><h2><Leaf size={23}/> NDVI · Copernicus Sentinel-2</h2><p>NDVI calculado sobre el polígono completo utilizando observaciones Sentinel-2 L2A y enmascaramiento de píxeles inválidos.</p></div><button type="button" disabled={ndvi?.status!=='success'||!ndviRows.length} onClick={()=>saveDatasetCsv({dataset:ndvi,analysis,type:'ndvi'})}><Download size={16}/> Exportar CSV</button></div>
        <DataStatus dataset={ndvi} source="Copernicus"/>
        {ndvi?.status==='success'&&<><div className="field-metrics-row"><Metric name="NDVI temporal medio" value={number(meanNDVI,3)}/><Metric name="Último NDVI válido" value={number(latest?.mean_ndvi,3)} sub={latest?.date||''}/><Metric name="Píxeles válidos (media)" value={number(validShare,0)} unit="%"/><Metric name="Intervalos con datos" value={String(validNDVI.length)}/></div>
          {ndviRows.length?<><ChartShell rows={ndviRows}><Line name="NDVI medio" dataKey="mean_ndvi" type="monotone" stroke="#238d62" strokeWidth={2.5} connectNulls={false} dot={{r:2}}/></ChartShell><div className="field-data-note">NDVI es un índice de verdor vegetal, no una estimación directa de rendimiento. Los huecos del gráfico representan intervalos sin píxeles válidos.</div></>:<div className="field-no-observations">La API respondió correctamente, pero no entregó observaciones para este período.</div>}
        </>}
      </section>
      <section className="field-data-card">
        <div className="field-dataset-heading"><div><span className="overline">02 / TEMPERATURE INTELLIGENCE</span><h2><ThermometerSun size={23}/> Temperatura · NASA POWER</h2><p>Estimaciones diarias de temperatura del aire a 2 metros para un punto representativo del terreno, no una media espacial del polígono.</p></div><button type="button" disabled={temperature?.status!=='success'||!tempRows.length} onClick={()=>saveDatasetCsv({dataset:temperature,analysis,type:'temperature'})}><Download size={16}/> Exportar CSV</button></div>
        <DataStatus dataset={temperature} source="NASA POWER"/>
        {temperature?.status==='success'&&<><div className="field-metrics-row"><Metric name="Temperatura media" value={number(tempSummary?.mean_temperature_c)} unit="°C"/><Metric name="Máxima diaria" value={number(tempSummary?.absolute_max_temperature_c)} unit="°C"/><Metric name="Mínima diaria" value={number(tempSummary?.absolute_min_temperature_c)} unit="°C"/><Metric name="Días con datos" value={String(tempSummary?.valid_mean_days??'—')}/></div>
          {tempRows.length?<><ChartShell rows={tempRows}><Line name="Mínima (°C)" dataKey="min_c" type="monotone" stroke="#3292b9" strokeWidth={1.8} connectNulls={false} dot={false}/><Line name="Media (°C)" dataKey="mean_c" type="monotone" stroke="#288b6b" strokeWidth={2.4} connectNulls={false} dot={false}/><Line name="Máxima (°C)" dataKey="max_c" type="monotone" stroke="#dc923f" strokeWidth={1.8} connectNulls={false} dot={false}/></ChartShell><div className="field-temp-exposures"><div>Exposición a calor ({number(tempSummary?.heat_threshold_c)} °C): <b>{tempSummary?.heat_exposure_days??'—'} días</b></div><div>Exposición a frío ({number(tempSummary?.cold_threshold_c)} °C): <b>{tempSummary?.cold_exposure_days??'—'} días</b></div></div><div className="field-data-note">Fuente: NASA POWER Daily API · Horario solar local (LST). Los umbrales cuantifican exposición y no diagnostican daño de cultivos.</div></>:<div className="field-no-observations">No existen observaciones válidas para el intervalo solicitado.</div>}
        </>}
      </section>
      <div className="field-provenance-note"><Satellite size={18}/><p><b>Interpretación espacial:</b> Copernicus calcula estadísticas del polígono delimitado. NASA POWER utiliza un punto representativo y suministra estimaciones meteorológicas regionales. Ambas series pueden tener distinta resolución espacial, observaciones ausentes y temporalidad distinta. Los resultados presentados no son predicciones.</p></div>
    </div>}
  </div>;
}
