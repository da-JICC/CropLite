import CropIcon from '../components/crops/CropIcon.jsx';
import React from 'react';
import {ArrowLeft, CheckCircle2, CircleAlert, Download, Leaf, MapPin, Satellite, ThermometerSun} from 'lucide-react';
import {CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import {SectionHeading} from '../components/ui/Elements.jsx';
import {saveDatasetCsv} from '../services/regionAnalysisService.js';
import {CropTemperatureChart} from '../components/crops/CropTemperatureChart.jsx';

const number=(value,digits=1)=>typeof value==='number'&&Number.isFinite(value)?value.toFixed(digits):'—';
function ChartShell({rows,children}) {return <div className="field-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={rows} margin={{top:12,right:16,bottom:5,left:-22}}><CartesianGrid stroke="#e6eeea" vertical={false} strokeDasharray="3 5"/><XAxis dataKey="date" minTickGap={42} tick={{fontSize:11,fill:'#739087'}}/><YAxis tick={{fontSize:11,fill:'#739087'}}/><Tooltip labelFormatter={d=>`Date: ${d}`} formatter={(v,name)=>[v==null?'No data':number(v,2),name]}/><Legend wrapperStyle={{fontSize:12}}/>{children}</LineChart></ResponsiveContainer></div>}
function Metric({name,value,unit='',sub}) {return <div className="field-metric"><span>{name}</span><strong>{value}{value==='—'?'':unit&&<small> {unit}</small>}</strong>{sub&&<small>{sub}</small>}</div>}
function DataStatus({dataset,source}){return <div className={`field-dataset-status ${dataset?.status==='success'?'ok':'warn'}`}>{dataset?.status==='success'?<CheckCircle2 size={16}/>:<CircleAlert size={16}/>} {dataset?.status==='success'?`${source} · Data available`:dataset?.error||`${source} · No results`}</div>}
export function Environment({region,start,end,analysis,loading,navigate,selectedCrop}) {
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
    <SectionHeading overline="ENVIRONMENT / OBSERVATIONS" title="Environmental Intelligence" description="Historical observations for the field selected in My Farm. Each source retains its own measurement method and resolution limits." action={<button className="field-back-button" onClick={()=>navigate('overview')}><ArrowLeft size={16}/> Change field</button>}/>
    <div className="field-environment-context"><div><MapPin size={18}/><span><b>{analysis?'Field analyzed':'Field selected'}</b><small>{representativePoint?`${number(representativePoint.latitude,5)}, ${number(representativePoint.longitude,5)} · ${number(analysis?.region?.area_hectares??region?.areaHectares,2)} ha`:'No field selected'}</small></span></div><span>{analysis?`${analysis.period.start} — ${analysis.period.end}`:`Selected period: ${start} — ${end}`}</span></div>
    {!analysis&&<div className="field-environment-empty"><Satellite size={38}/><h2>{loading?'Analyzing field…':'No observations have been loaded yet'}</h2><p>Open “Overview — My Farm”, outline your field on the map and click “Analyze field”. NDVI and temperature results will appear here.</p><button onClick={()=>navigate('overview')}>Go to map <ArrowLeft size={16}/></button></div>}
    {analysis&&<div className="field-environment-stack">
      <section className="field-data-card">
        <div className="field-dataset-heading"><div><span className="overline">01 / VEGETATION INTELLIGENCE</span><h2><Leaf size={23}/> NDVI · Copernicus Sentinel-2</h2><p>NDVI is calculated across the complete polygon using Sentinel-2 L2A observations with invalid pixels masked out.</p></div><button type="button" disabled={ndvi?.status!=='success'||!ndviRows.length} onClick={()=>saveDatasetCsv({dataset:ndvi,analysis,type:'ndvi'})}><Download size={16}/> Export CSV</button></div>
        <DataStatus dataset={ndvi} source="Copernicus"/>
        {ndvi?.status==='success'&&<><div className="field-metrics-row"><Metric name="Mean NDVI over time" value={number(meanNDVI,3)}/><Metric name="Latest valid NDVI" value={number(latest?.mean_ndvi,3)} sub={latest?.date||''}/><Metric name="Mean valid pixels" value={number(validShare,0)} unit="%"/><Metric name="Intervals with data" value={String(validNDVI.length)}/></div>
          {ndviRows.length?<><ChartShell rows={ndviRows}><Line name="Mean NDVI" dataKey="mean_ndvi" type="monotone" stroke="#238d62" strokeWidth={2.5} connectNulls={false} dot={{r:2}}/></ChartShell><div className="field-data-note">NDVI measures vegetation greenness, not yield directly. Gaps indicate periods without valid pixels.</div></>:<div className="field-no-observations">The API responded but returned no observations for this period.</div>}
        </>}
      </section>
      <section className="field-data-card">
        <div className="field-dataset-heading"><div><span className="overline">02 / TEMPERATURE INTELLIGENCE</span><h2><ThermometerSun size={23}/> Temperature · NASA POWER</h2><p>Daily air-temperature estimates at 2 m for a representative point, not a spatial average over the polygon.</p></div><button type="button" disabled={temperature?.status!=='success'||!tempRows.length} onClick={()=>saveDatasetCsv({dataset:temperature,analysis,type:'temperature'})}><Download size={16}/> Export CSV</button></div>
        <DataStatus dataset={temperature} source="NASA POWER"/>
        {selectedCrop && <div className="crop-environment-context">
          <CropIcon cropId={selectedCrop.id} name={selectedCrop.name}/>
          <div><span className="crop-picker-eyebrow">THERMAL REFERENCES · SELECTED CROP</span><h3>{selectedCrop.name} <small>{selectedCrop.scientificName}</small></h3>
            <p>Climatic optimum {selectedCrop.thermal.optimumClimateC.min}–{selectedCrop.thermal.optimumClimateC.max} °C · Base GDD {selectedCrop.thermal.gddBaseC} °C · GDD upper bound {selectedCrop.thermal.gddUpperC} °C.</p>
            <p className="crop-source-links">Sources: <a href={selectedCrop.thermal.optimumClimateC.sourceUrl} target="_blank" rel="noreferrer">Climatic optimum</a> · <a href={selectedCrop.thermal.heatReproductiveSourceUrl} target="_blank" rel="noreferrer">Reproductive heat</a> · <a href={selectedCrop.thermal.coldFloweringSourceUrl} target="_blank" rel="noreferrer">Flowering cold (FAO)</a>, consistent with the project CSV.</p>
          </div>
        </div>}
        {!selectedCrop && <p className="field-data-note">Select a crop in “My Farm” to overlay thermal references.</p>}
        {temperature?.status==='success'&&<><div className="field-metrics-row"><Metric name="Mean temperature" value={number(tempSummary?.mean_temperature_c)} unit="°C"/><Metric name="Daily maximum" value={number(tempSummary?.absolute_max_temperature_c)} unit="°C"/><Metric name="Daily minimum" value={number(tempSummary?.absolute_min_temperature_c)} unit="°C"/><Metric name="Days with data" value={String(tempSummary?.valid_mean_days??'—')}/></div>
          {tempRows.length?<><CropTemperatureChart rows={tempRows} crop={selectedCrop}/>
          <div className="field-data-note">Source: NASA POWER Daily API · Local solar time (LST). The visual comparison does not establish crop stress or damage; actual growth stage and exposure are unknown.</div></>:<div className="field-no-observations">No valid observations are available for the selected period.</div>}
        </>}
      </section>
      <div className="field-provenance-note"><Satellite size={18}/><p><b>Spatial interpretation:</b> Copernicus calculates statistics over the outlined polygon. NASA POWER uses a representative point for regional weather estimates. Spatial and temporal resolutions differ and some observations may be missing. These results are not forecasts.</p></div>
    </div>}
  </div>;
}
