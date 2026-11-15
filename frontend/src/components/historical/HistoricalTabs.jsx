import React, {useEffect, useMemo, useState} from 'react';
import {CheckCircle2, CircleAlert, Download, Leaf, LoaderCircle, RefreshCcw, ThermometerSun} from 'lucide-react';
import {CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import {CropSelector} from '../crops/CropSelector.jsx';
import {CropTemperatureChart} from '../crops/CropTemperatureChart.jsx';
import {saveDatasetCsv} from '../../services/regionAnalysisService.js';

const fmt = (value, digits = 1) => Number.isFinite(value) ? Number(value).toFixed(digits) : '—';
function DataState({dataset, name}) {
  const okay = dataset?.status === 'success';
  const partial = dataset?.status === 'partial';
  return <div className={`field-dataset-status ${okay?'':'warn'}`}>
    {okay ? <CheckCircle2 size={16}/> : <CircleAlert size={16}/>}
    <span>{name}: {okay?'Disponible':partial?'Datos parciales':dataset?.error || 'No disponible'}</span>
  </div>;
}
function MiniTrend({rows, dataKey, name, color, suffix='', decimals=1}) {
  return <div className="terra-annual-graph" role="img" aria-label={name}>
    <ResponsiveContainer width="100%" height="100%"><LineChart data={rows} margin={{top:10,right:16,left:-13,bottom:1}}>
      <CartesianGrid stroke="#e2ece5" vertical={false} strokeDasharray="3 5"/>
      <XAxis dataKey="year" type="category" tick={{fontSize:11,fill:'#5c7b6c'}}/>
      <YAxis tick={{fontSize:11,fill:'#5c7b6c'}} width={45} domain={['auto','auto']}/>
      <Tooltip formatter={v=>[Number.isFinite(v)?`${fmt(v,decimals)} ${suffix}`:'Sin datos',name]}/>
      <Line name={name} type="linear" dataKey={dataKey} connectNulls={false} stroke={color} strokeWidth={2.8} dot={{r:4}}/>
    </LineChart></ResponsiveContainer>
  </div>;
}
function NDVIPlot({rows}) {
  return <div className="field-chart terra-detailed-graph"><ResponsiveContainer width="100%" height="100%"><LineChart data={rows} margin={{top:14,right:16,bottom:1,left:-15}}>
    <CartesianGrid stroke="#e2ece5" vertical={false} strokeDasharray="3 5"/>
    <XAxis dataKey="date" tick={{fontSize:11,fill:'#5c7b6c'}} minTickGap={35}/>
    <YAxis domain={[-1,1]} tick={{fontSize:11,fill:'#5c7b6c'}} width={48}/>
    <Tooltip labelFormatter={d=>`Intervalo desde ${d}`} formatter={v=>[Number.isFinite(v)?fmt(v,3):'Sin observaciones válidas','NDVI medio']}/>
    <Line type="monotone" name="NDVI medio" dataKey="mean_ndvi" connectNulls={false} stroke="#228c63" strokeWidth={2.8} dot={{r:3}}/>
  </LineChart></ResponsiveContainer></div>;
}

export function HistoricalTabs({region, analysis, loading, selectedCrop, cropId, onCropSelect, onRetry}) {
  const [tab, setTab] = useState('temperature');
  const years = analysis?.period?.years || [];
  const [year, setYear] = useState(null);
  useEffect(() => {if (years.length && !years.includes(year)) setYear(years[years.length-1]);}, [analysis, year]);
  const displayYear = year && years.includes(year) ? year : years[years.length-1];
  const ndvi = analysis?.datasets?.ndvi;
  const climate = analysis?.datasets?.temperature;
  const ndviRows = ndvi?.data?.observations || [];
  const climateRows = climate?.data?.observations || [];
  const ndviYear = useMemo(() => ndviRows.filter(r=>r.date?.startsWith(`${displayYear}-`)), [ndviRows, displayYear]);
  const climateYear = useMemo(() => climateRows.filter(r=>r.date?.startsWith(`${displayYear}-`)), [climateRows, displayYear]);
  const annualNDVI = ndvi?.data?.annual || [];
  const annualTemp = climate?.data?.annual || [];
  const currentAnnual = (tab==='temperature'?annualTemp:annualNDVI).find(item=>item.year===displayYear);
  return <>
    <div className="terra-data-tabs" role="tablist" aria-label="Tipo de análisis">
      <button type="button" role="tab" id="tab-temperature" aria-selected={tab==='temperature'} aria-controls="panel-temperature" className={tab==='temperature'?'active':''} onClick={()=>setTab('temperature')}><ThermometerSun size={18}/> Temperature Intelligence</button>
      <button type="button" role="tab" id="tab-ndvi" aria-selected={tab==='ndvi'} aria-controls="panel-ndvi" className={tab==='ndvi'?'active':''} onClick={()=>setTab('ndvi')}><Leaf size={18}/> NDVI · Vegetation Intelligence</button>
    </div>
    {!region && <div className="terra-state-panel"><Leaf size={32}/><h3>Comienza dibujando un campo en el mapa</h3><p>El histórico ambiental se consulta automáticamente al confirmar el polígono. No necesitas introducir fechas.</p></div>}
    {region && loading && <div className="terra-state-panel" role="status"><LoaderCircle className="ndvi-spin" size={29}/><h3>Recuperando el histórico de seis años…</h3><p>NASA POWER entrega temperaturas diarias; Copernicus procesa estadísticas mensuales por año. La primera consulta puede tardar según las APIs.</p></div>}
    {region && !analysis && !loading && <div className="terra-state-panel"><CircleAlert size={28}/><h3>Sin datos cargados</h3><p>La consulta no ha terminado correctamente. Puedes reintentarla sin cambiar el terreno.</p><button type="button" onClick={onRetry}><RefreshCcw size={15}/> Reintentar análisis</button></div>}
    {analysis && <>
      <div className="terra-year-tools"><div><b>Histórico {analysis.period.years[0]}–{analysis.period.years.at(-1)}</b><span>Elige un año únicamente para visualizarlo; las APIs no se consultan de nuevo.</span></div><div className="terra-year-buttons" role="group" aria-label="Año mostrado">{years.map(y=><button key={y} type="button" aria-pressed={displayYear===y} className={displayYear===y?'active':''} onClick={()=>setYear(y)}>{y}</button>)}</div></div>
      <div className="terra-year-coverage">{currentAnnual && (tab==='temperature' ?
        <>Temperatura {displayYear}: <b>{currentAnnual.valid_days}/{currentAnnual.expected_days} días con T2M</b> · {currentAnnual.coverage_percent}% de cobertura</> :
        <>NDVI {displayYear}: <b>{currentAnnual.valid_intervals}/12 intervalos mensuales válidos</b> · {currentAnnual.coverage_percent}% de cobertura</>)}</div>
      <div role="tabpanel" id={tab==='temperature'?'panel-temperature':'panel-ndvi'} aria-labelledby={tab==='temperature'?'tab-temperature':'tab-ndvi'} className="terra-analysis-content">
        {tab==='temperature' ? <>
          <DataState dataset={climate} name="NASA POWER"/>
          <div className="terra-series-meta"><span>Fuente: NASA POWER Daily API · 2 m sobre el suelo</span><span>Muestreo: punto representativo · horario solar local</span></div>
          <h3>Temperatura media anual · seis años</h3>
          <MiniTrend rows={annualTemp} dataKey="mean_c" name="Temperatura media anual" color="#d78c48" suffix="°C"/>
          <p className="terra-explain">La media anual sirve como contexto histórico; para comparar umbrales térmicos utiliza las temperaturas diarias del año seleccionado, debajo.</p>
          <div className="terra-subsection-title"><h3>Temperaturas diarias · {displayYear}</h3><button type="button" className="terra-export-button" disabled={!climateRows.length} onClick={()=>saveDatasetCsv({dataset:climate,analysis,type:'temperature'})}><Download size={15}/> CSV de seis años</button></div>
          <CropSelector selectedId={cropId} onSelect={onCropSelect}/>
          {climateYear.length ? <CropTemperatureChart rows={climateYear} crop={selectedCrop}/> : <div className="field-no-observations">Sin temperaturas válidas para este año. Las referencias del cultivo siguen disponibles.</div>}
          <p className="terra-explain">Las líneas GDD son umbrales de desarrollo; las referencias críticas y el óptimo climático dependen de la etapa de crecimiento. Cruzarlas no demuestra daños. NASA POWER ofrece estimaciones regionales y no temperaturas medidas dentro del campo.</p>
        </> : <>
          <DataState dataset={ndvi} name="Copernicus Sentinel-2"/>
          <div className="terra-series-meta"><span>Fuente: Sentinel-2 L2A · NDVI (sin unidad)</span><span>Muestreo: polígono seleccionado · mosaicos mensuales, píxeles válidos SCL 4/5</span></div>
          <h3>NDVI medio anual de los intervalos válidos</h3>
          <MiniTrend rows={annualNDVI} dataKey="mean_ndvi" name="NDVI medio anual" color="#228c63" decimals={3}/>
          <p className="terra-explain">Cada promedio anual representa solo los meses con píxeles válidos; no equivale a una media diaria ni se rellenan los meses sin observaciones.</p>
          <div className="terra-subsection-title"><h3>NDVI mensual · {displayYear}</h3><button type="button" className="terra-export-button" disabled={!ndviRows.length} onClick={()=>saveDatasetCsv({dataset:ndvi,analysis,type:'ndvi'})}><Download size={15}/> CSV de seis años</button></div>
          {ndviYear.length ? <NDVIPlot rows={ndviYear}/> : <div className="field-no-observations">Sin estadísticas NDVI para este año.</div>}
          <p className="terra-explain">Un intervalo mensual es un mosaico de imágenes satelitales procesadas, no una captura diaria ni una medición de temperatura. Las nubes y los píxeles inválidos se excluyen antes del cálculo.</p>
          {!!Object.keys(ndvi?.data?.errors_by_year||{}).length && <div className="terra-warning-years"><strong>Años con error de Copernicus:</strong> {Object.entries(ndvi.data.errors_by_year).map(([y,detail])=><p key={y}>{y}: {detail}</p>)}</div>}
        </>}
      </div>
      <div className="field-provenance-note"><Leaf size={18}/><p><b>Cobertura histórica:</b> solo los seis últimos años calendario completos, sin selección manual. Pueden existir años o meses incompletos. Las dos fuentes tienen resoluciones distintas; no se generan estimaciones predictivas ni se inventan mediciones faltantes.</p></div>
    </>}
  </>;
}
