import CropIcon from '../crops/CropIcon.jsx';
import React, {useMemo, useState} from 'react';
import {Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import {CloudRain, Droplets, Leaf, Sun, Wind, ThermometerSun, Waves, Download, AlertCircle, RefreshCcw, CalendarRange} from 'lucide-react';
import {CROPS} from '../crops/CropSelector.jsx';

const SOURCES = [
  {id:'temperature', label:'Temperature', Icon:ThermometerSun, color:'#ce8651', description:'Air temperature at 2 m'},
  {id:'humidity',label:'Humidity',Icon:Droplets,color:'#368cb7', description:'Relative air humidity'},
  {id:'precipitation',label:'Precipitation',Icon:CloudRain,color:'#4198b4',description:'Monthly cumulative rainfall'},
  {id:'radiation',label:'Solar radiation',Icon:Sun,color:'#cd9d3c',description:'Incoming solar radiation'},
  {id:'wind',label:'Wind',Icon:Wind,color:'#738d9b',description:'Wind speed at 2 m'},
  {id:'soil_moisture',label:'Soil moisture',Icon:Waves,color:'#8178b3',description:'Volumetric surface water content'},
  {id:'ndvi',label:'NDVI',Icon:Leaf,color:'#2d966b',description:'Sentinel-2 vegetation index'},
];

function toNumber(value, precision=2) {
  return Number.isFinite(value) ? Number(value).toLocaleString('en-US',{maximumFractionDigits:precision}) : '—';
}

function exportCsv(series, region) {
  if (!series?.monthly?.length) return;
  const keys = ['date','value','min_c','max_c','rootzone_moisture_m3_m3','valid_days','expected_days','valid_pixels','total_pixels'];
  const quote = x => `"${String(x ?? '').replaceAll('"','""')}"`;
  const meta = [
    ['source',series.source],['units',series.unit],['method',series.method],
    ['sampling',series.sampling_method],['latitude',region?.representative_point?.latitude],
    ['longitude',region?.representative_point?.longitude],['start',series.coverage.start],['end',series.coverage.end],
  ];
  const csv = '\ufeff' + meta.map(x=>x.map(quote).join(',')).join('\r\n') + '\r\n' + keys.join(',') + '\r\n' +
    series.monthly.map(r=>keys.map(k=>quote(r[k])).join(',')).join('\r\n');
  const href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=href;a.download=`croplite-${series.source.toLowerCase().includes('copernicus')?'ndvi':'environment'}-${series.coverage.start}.csv`;a.click();
  setTimeout(()=>URL.revokeObjectURL(href),1000);
}

function CompactCropSelector({cropId,onCropSelect}) {
  return <div className="terra-crop-inline">
    <div className="terra-crop-inline-heading"><div><strong>Reference crop</strong><span>Select a crop to view its thermal parameters</span></div></div>
    <div className="terra-crop-inline-items" role="group" aria-label="Select crop">
      {CROPS.map(c=><button type="button" key={c.id} aria-pressed={c.id===cropId} onClick={()=>onCropSelect(c.id)} className={`terra-crop-compact${cropId===c.id?' selected':''}`}>
        <CropIcon cropId={c.id} decorative/><span>{c.name}</span>
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
  const formatValue=v => Number.isFinite(v)?`${toNumber(v, temp?1:3)} ${unit}`:'No data';
  const thermalValues=temp&&t ? [t.optimumClimateC.min,t.optimumClimateC.max,t.gddBaseC,t.gddUpperC,t.coldFloweringReferenceC,t.heatReproductiveReferenceC] : [];
  const allValues=rows.flatMap(r=>[r.value,r.mean,r.min_c,r.max_c,r.p10,r.p90]).filter(Number.isFinite);
  const ymax=temp ? Math.ceil(Math.max(1,...allValues,...thermalValues)+2) : undefined;
  const ymin=temp ? Math.floor(Math.min(...allValues,...thermalValues)-2) : (source.id==='ndvi'?-1:0);
  return <div className="terra-chart-surface" role="img" aria-label={`Chart of ${source.label.toLowerCase()}, ${seasonal?'seasonal profile':'historical monthly series'}`}>
    <ResponsiveContainer width="100%" height="100%"><ComposedChart data={rows} margin={{top:18,right:18,left:0,bottom:12}}>
      <CartesianGrid vertical={false} stroke="#e6eee8" strokeDasharray="4 5"/>
      <XAxis dataKey={xKey} minTickGap={36} tick={{fontSize:11,fill:'#658072'}}/>
      <YAxis width={59} domain={temp?[ymin,ymax]:source.id==='ndvi'?[-1,1]:[0,'auto']} tick={{fontSize:11,fill:'#658072'}} tickFormatter={v=>toNumber(v,1)}/>
      <Tooltip labelFormatter={label=>seasonal?`Month: ${label}`:`Month: ${String(label).slice(0,7)}`}
        formatter={(v,n)=>[formatValue(v),n]}/>
      {temp && t && <>
        <ReferenceArea y1={t.optimumClimateC.min} y2={t.optimumClimateC.max} fill="#6aba83" fillOpacity={0.15} stroke="none"/>
        <ReferenceLine y={t.gddBaseC} stroke="#7661ae" strokeDasharray="3 5"/>
        <ReferenceLine y={t.gddUpperC} stroke="#a17fc2" strokeDasharray="3 6"/>
        <ReferenceLine y={t.coldFloweringReferenceC} stroke="#3d7aab" strokeDasharray="6 4"/>
        <ReferenceLine y={t.heatReproductiveReferenceC} stroke="#c75d4a" strokeDasharray="6 4"/>
      </>}
      {seasonal && <>
        <Line name="10th percentile" type="linear" dataKey="p10" stroke={source.color} strokeWidth={1} strokeOpacity={.45} strokeDasharray="4 5" dot={false} connectNulls={false}/>
        <Line name="90th percentile" type="linear" dataKey="p90" stroke={source.color} strokeWidth={1} strokeOpacity={.45} strokeDasharray="4 5" dot={false} connectNulls={false}/>
      </>}
      {temp && <>
        <Line name="Average daily lows" dataKey="min_c" type="linear" stroke="#458db9" strokeWidth={1.7} dot={false} connectNulls={false}/>
        <Line name="Average daily highs" dataKey="max_c" type="linear" stroke="#e2a050" strokeWidth={1.7} dot={false} connectNulls={false}/>
      </>}
      <Line name={temp?'Mean temperature':source.label} type="linear" dataKey={seasonal?'mean':'value'} stroke={source.color} strokeWidth={3} dot={seasonal?{r:3}:false} activeDot={{r:5}} connectNulls={false}/>
    </ComposedChart></ResponsiveContainer>
  </div>;
}

function ReferenceLegend({crop}) {
  const t=crop?.thermal;
  if(!t)return null;
  return <div className="terra-thermal-legend" aria-label="Crop agronomic references">
    <span><i className="optimal"/> Indicative climate optimum: {t.optimumClimateC.min}–{t.optimumClimateC.max} °C</span>
    <span><i className="basal"/> Growth base (GDD): {t.gddBaseC} °C</span>
    <span><i className="upper"/> GDD calculation upper limit: {t.gddUpperC} °C</span>
    <span><i className="cold"/> Flowering cold reference: {t.coldFloweringReferenceC} °C</span>
    <span><i className="heat"/> Reproductive heat reference: {t.heatReproductiveReferenceC} °C</span>
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
    <div className="terra-parameter-tabs" role="tablist" aria-label="Environmental variable">
      {SOURCES.map(s=><button type="button" key={s.id} role="tab" id={`variable-${s.id}`} aria-selected={tab===s.id} aria-controls="terra-active-parameter" onClick={()=>setTab(s.id)} className={tab===s.id?'selected':''}><s.Icon size={18}/><span>{s.label}</span></button>)}
    </div>
    {!region && <div className="terra-empty-analysis"><Leaf size={29}/><strong>Select your field on the map</strong><span>Environmental information will appear here automatically.</span></div>}
    {region && loading && <div className="terra-empty-analysis" role="status"><span className="terra-loader"/><strong>Retrieving historical environmental data</strong><span>Data sources are processed separately. The first request may take longer.</span></div>}
    {region && !loading && !analysis && <div className="terra-empty-analysis"><AlertCircle size={26}/><strong>Unable to complete the analysis</strong><button type="button" onClick={onRetry}><RefreshCcw size={14}/> Retry</button></div>}
    {analysis && <div id="terra-active-parameter" role="tabpanel" aria-labelledby={`variable-${active.id}`} className="terra-variable-panel">
      <div className="terra-variable-heading"><div><span className="overline">ENVIRONMENTAL EXPLORER</span><h3>{active.label}</h3><p>{active.description}</p></div>
        <div className="terra-plot-view" role="group" aria-label="Chart view">
          <button type="button" className={view==='seasonal'?'selected':''} onClick={()=>setView('seasonal')}>Seasonal profile</button>
          <button type="button" className={view==='monthly'?'selected':''} onClick={()=>setView('monthly')}>Monthly series</button>
        </div>
      </div>
      <div className="terra-source-strip"><span className={`terra-data-dot ${dataset?.status==='error'?'missing':''}`}/><b>{dataset?.source || active.label}</b>
        <span>{dataset?.coverage?.start?.slice(0,4)||'—'}–{dataset?.coverage?.end?.slice(0,4)||'—'} · {valid}/{total} months available</span></div>
      {tab==='temperature' && <CompactCropSelector cropId={cropId} onCropSelect={onCropSelect}/>}
      {tab==='precipitation' && rainOptions && <div className="terra-rain-source-switch" role="group" aria-label="Precipitation source">
        <span>Compare sources without requesting data again:</span>
        <button type="button" className={rainSource==='imerg'?'selected':''} onClick={()=>setRainSource('imerg')}>GPM IMERG</button>
        <button type="button" className={rainSource==='power'?'selected':''} onClick={()=>setRainSource('power')}>Historical POWER</button>
      </div>}
      {dataset?.status==='error' || !valid ? <div className="terra-empty-analysis"><AlertCircle size={24}/><strong>No verifiable data for this variable</strong><span>{dataset?.error || 'The source returned no valid observations.'}</span></div> : <>
        <Chart series={dataset} source={active} crop={selectedCrop} view={view}/>
        {tab==='temperature' && <ReferenceLegend crop={selectedCrop}/>}
        <div className="terra-chart-caption"><span>{view==='seasonal'?'Each point summarizes that month across years with valid data. Dashed lines show the 10th and 90th percentiles.':'Monthly historical series: missing months are not plotted or filled in.'}</span>
          <button type="button" onClick={()=>exportCsv(dataset,analysis.region)}><Download size={14}/> Download CSV</button></div>
      </>}
      <div className="terra-variable-notes"><p><b>Calculation method:</b> {dataset?.method||'Unavailable'}. <b>Unit:</b> {dataset?.unit||'—'}.</p>
        <p><b>Resolution and scope:</b> {dataset?.resolution_note||'Unavailable'}. {tab==='temperature'?'Crop reference lines support comparisons, not predictions of damage or yield.':''}</p>
        {dataset?.metadata?.gpm_imerg_status && <p><b>GPM:</b> {dataset.metadata.gpm_imerg_status}</p>}
        {dataset?.metadata?.failed_years && Object.keys(dataset.metadata.failed_years).length>0 && <p><b>Copernicus:</b> some years could not be retrieved and were not filled in.</p>}
      </div>
      {tab==='soil_moisture' && analysis.soil_chemistry && <p className="terra-soil-fineprint">pH, N, P and K are not available as reliable satellite measurements for this field. Recommendations never use invented values.</p>}
    </div>}
  </>;
}
