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
    <span>{name}: {okay?'Available':partial?'Partial data':dataset?.error || 'Unavailable'}</span>
  </div>;
}
function MiniTrend({rows, dataKey, name, color, suffix='', decimals=1}) {
  return <div className="terra-annual-graph" role="img" aria-label={name}>
    <ResponsiveContainer width="100%" height="100%"><LineChart data={rows} margin={{top:10,right:16,left:-13,bottom:1}}>
      <CartesianGrid stroke="#e2ece5" vertical={false} strokeDasharray="3 5"/>
      <XAxis dataKey="year" type="category" tick={{fontSize:11,fill:'#5c7b6c'}}/>
      <YAxis tick={{fontSize:11,fill:'#5c7b6c'}} width={45} domain={['auto','auto']}/>
      <Tooltip formatter={v=>[Number.isFinite(v)?`${fmt(v,decimals)} ${suffix}`:'No data',name]}/>
      <Line name={name} type="linear" dataKey={dataKey} connectNulls={false} stroke={color} strokeWidth={2.8} dot={{r:4}}/>
    </LineChart></ResponsiveContainer>
  </div>;
}
function NDVIPlot({rows}) {
  return <div className="field-chart terra-detailed-graph"><ResponsiveContainer width="100%" height="100%"><LineChart data={rows} margin={{top:14,right:16,bottom:1,left:-15}}>
    <CartesianGrid stroke="#e2ece5" vertical={false} strokeDasharray="3 5"/>
    <XAxis dataKey="date" tick={{fontSize:11,fill:'#5c7b6c'}} minTickGap={35}/>
    <YAxis domain={[-1,1]} tick={{fontSize:11,fill:'#5c7b6c'}} width={48}/>
    <Tooltip labelFormatter={d=>`Interval starting ${d}`} formatter={v=>[Number.isFinite(v)?fmt(v,3):'No valid observations','Mean NDVI']}/>
    <Line type="monotone" name="Mean NDVI" dataKey="mean_ndvi" connectNulls={false} stroke="#228c63" strokeWidth={2.8} dot={{r:3}}/>
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
    <div className="terra-data-tabs" role="tablist" aria-label="Analysis type">
      <button type="button" role="tab" id="tab-temperature" aria-selected={tab==='temperature'} aria-controls="panel-temperature" className={tab==='temperature'?'active':''} onClick={()=>setTab('temperature')}><ThermometerSun size={18}/> Temperature Intelligence</button>
      <button type="button" role="tab" id="tab-ndvi" aria-selected={tab==='ndvi'} aria-controls="panel-ndvi" className={tab==='ndvi'?'active':''} onClick={()=>setTab('ndvi')}><Leaf size={18}/> NDVI · Vegetation Intelligence</button>
    </div>
    {!region && <div className="terra-state-panel"><Leaf size={32}/><h3>Start by outlining a field on the map</h3><p>Historical environmental data is retrieved automatically once the field is confirmed. No date entry is required.</p></div>}
    {region && loading && <div className="terra-state-panel" role="status"><LoaderCircle className="ndvi-spin" size={29}/><h3>Retrieving six years of historical data…</h3><p>NASA POWER provides daily temperatures and Copernicus supplies monthly statistics. The first request may take longer depending on API response times.</p></div>}
    {region && !analysis && !loading && <div className="terra-state-panel"><CircleAlert size={28}/><h3>No data loaded</h3><p>The request did not complete successfully. You can retry without changing the field.</p><button type="button" onClick={onRetry}><RefreshCcw size={15}/> Retry analysis</button></div>}
    {analysis && <>
      <div className="terra-year-tools"><div><b>Historical record {analysis.period.years[0]}–{analysis.period.years.at(-1)}</b><span>Select a year to display. The APIs are not queried again.</span></div><div className="terra-year-buttons" role="group" aria-label="Displayed year">{years.map(y=><button key={y} type="button" aria-pressed={displayYear===y} className={displayYear===y?'active':''} onClick={()=>setYear(y)}>{y}</button>)}</div></div>
      <div className="terra-year-coverage">{currentAnnual && (tab==='temperature' ?
        <>Temperature {displayYear}: <b>{currentAnnual.valid_days}/{currentAnnual.expected_days} days with T2M</b> · {currentAnnual.coverage_percent}% coverage</> :
        <>NDVI {displayYear}: <b>{currentAnnual.valid_intervals}/12 valid monthly intervals</b> · {currentAnnual.coverage_percent}% coverage</>)}</div>
      <div role="tabpanel" id={tab==='temperature'?'panel-temperature':'panel-ndvi'} aria-labelledby={tab==='temperature'?'tab-temperature':'tab-ndvi'} className="terra-analysis-content">
        {tab==='temperature' ? <>
          <DataState dataset={climate} name="NASA POWER"/>
          <div className="terra-series-meta"><span>Source: NASA POWER Daily API · 2 m above ground</span><span>Sampling: representative point · local solar time</span></div>
          <h3>Annual mean temperature · six years</h3>
          <MiniTrend rows={annualTemp} dataKey="mean_c" name="Annual mean temperature" color="#d78c48" suffix="°C"/>
          <p className="terra-explain">The annual mean provides historical context. Use the selected year’s daily temperatures below to compare thermal thresholds.</p>
          <div className="terra-subsection-title"><h3>Daily temperatures · {displayYear}</h3><button type="button" className="terra-export-button" disabled={!climateRows.length} onClick={()=>saveDatasetCsv({dataset:climate,analysis,type:'temperature'})}><Download size={15}/> Six-year CSV</button></div>
          <CropSelector selectedId={cropId} onSelect={onCropSelect}/>
          {climateYear.length ? <CropTemperatureChart rows={climateYear} crop={selectedCrop}/> : <div className="field-no-observations">No valid temperatures for this year. Crop reference information remains available.</div>}
          <p className="terra-explain">GDD lines represent growth thresholds. Critical references and climatic optimum vary by growth stage; threshold crossings do not prove damage. NASA POWER provides regional estimates, not in-field measurements.</p>
        </> : <>
          <DataState dataset={ndvi} name="Copernicus Sentinel-2"/>
          <div className="terra-series-meta"><span>Source: Sentinel-2 L2A · NDVI (unitless)</span><span>Sampling: selected polygon · monthly mosaics with valid SCL 4/5 pixels</span></div>
          <h3>Annual mean NDVI for valid intervals</h3>
          <MiniTrend rows={annualNDVI} dataKey="mean_ndvi" name="Mean NDVI anual" color="#228c63" decimals={3}/>
          <p className="terra-explain">Annual means include only months with valid pixels. They are not daily means, and missing months are not filled in.</p>
          <div className="terra-subsection-title"><h3>Monthly NDVI · {displayYear}</h3><button type="button" className="terra-export-button" disabled={!ndviRows.length} onClick={()=>saveDatasetCsv({dataset:ndvi,analysis,type:'ndvi'})}><Download size={15}/> Six-year CSV</button></div>
          {ndviYear.length ? <NDVIPlot rows={ndviYear}/> : <div className="field-no-observations">No NDVI statistics for this year.</div>}
          <p className="terra-explain">Each monthly interval is a mosaic of processed satellite images, not a daily image or a temperature measurement. Clouds and invalid pixels are excluded before calculation.</p>
          {!!Object.keys(ndvi?.data?.errors_by_year||{}).length && <div className="terra-warning-years"><strong>Copernicus errors by year:</strong> {Object.entries(ndvi.data.errors_by_year).map(([y,detail])=><p key={y}>{y}: {detail}</p>)}</div>}
        </>}
      </div>
      <div className="field-provenance-note"><Leaf size={18}/><p><b>Historical coverage:</b> the six most recent complete calendar years, with no manual date selection. Some years or months may have missing data. Source resolutions differ; no forecasts or missing observations are fabricated.</p></div>
    </>}
  </>;
}
