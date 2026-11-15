import React, {useEffect, useMemo, useRef, useState} from 'react';
import {AlertTriangle, CalendarDays, Download, ExternalLink, Info, LoaderCircle, MapPin, RefreshCw, Satellite, ThermometerSun} from 'lucide-react';
import {CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import {CircleMarker, MapContainer, Polygon, TileLayer, useMap} from 'react-leaflet';
import {getClimateTemperature} from '../../services/climateService.js';

const iso = date => date.toISOString().slice(0,10);
const daysAgo = days => {const d=new Date(); d.setUTCDate(d.getUTCDate()-days);return iso(d);};
const TODAY = iso(new Date());
const formatValue = (x, digits=1) => typeof x==='number' && Number.isFinite(x) ? x.toFixed(digits) : '—';

// Shoelace centroid of the selected polygon in longitude/latitude degrees;
// appropriate as a map-point approximation for the small AOIs allowed here.
function fieldCenter(polygon, farm) {
  if (!Array.isArray(polygon) || polygon.length<3) return {latitude:farm.lat,longitude:farm.lng};
  let doubleArea=0, x=0, y=0;
  for(let i=0;i<polygon.length;i++){
    const [ax,ay]=polygon[i], [bx,by]=polygon[(i+1)%polygon.length];
    const cross=ax*by-bx*ay;
    doubleArea+=cross;x+=(ax+bx)*cross;y+=(ay+by)*cross;
  }
  if(Math.abs(doubleArea)<1e-9){
    return {longitude:polygon.reduce((acc,p)=>acc+p[0],0)/polygon.length,
      latitude:polygon.reduce((acc,p)=>acc+p[1],0)/polygon.length};
  }
  return {longitude:x/(3*doubleArea),latitude:y/(3*doubleArea)};
}

function MoveMap({latitude,longitude}) {
  const map=useMap();
  useEffect(()=>{map.setView([latitude,longitude],13);},[latitude,longitude,map]);
  return null;
}

function TemperatureFieldMap({farm,polygon,point}) {
  const ring = (polygon||[]).map(([lng,lat])=>[lat,lng]);
  return <div className="climate-map">
    <MapContainer center={[point.latitude,point.longitude]} zoom={13} scrollWheelZoom={false} style={{height:'100%',width:'100%'}}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors"/>
      <MoveMap latitude={point.latitude} longitude={point.longitude}/>
      {ring.length>=3&&<Polygon positions={ring} pathOptions={{color:'#19835e',weight:3,fillColor:'#25a978',fillOpacity:0.2}}/>}
      <CircleMarker center={[point.latitude,point.longitude]} radius={6} pathOptions={{color:'#fff',fillColor:'#ee8e39',fillOpacity:1,weight:2}}/>
    </MapContainer>
    <div className="climate-map-caption"><MapPin size={14}/> NASA POWER point sample at the approximate center of your field. <strong>Not a field-resolution thermal map.</strong></div>
  </div>;
}

function saveCSV(data, point, start, end) {
  if(!data?.observations?.length) return;
  const header=['date','t2m_mean_c','t2m_min_c','t2m_max_c','rh2m_pct','daily_gdd_c_day','cumulative_gdd_c_day',
    'latitude','longitude','source','time_standard','gdd_base_c','gdd_upper_c'];
  const rows=data.observations.map((row,i)=>{
    const gdd=data.gdd.daily[i]||{};
    return [row.date,row.mean_c??'',row.min_c??'',row.max_c??'',row.relative_humidity_pct??'',
      gdd.daily_gdd??'',gdd.cumulative_gdd??'',data.location.latitude,data.location.longitude,
      'NASA POWER Daily API','LST',data.gdd.base_temperature_c,data.gdd.upper_temperature_c];
  });
  const csv='\ufeff'+[header.join(','),...rows.map(r=>r.join(','))].join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download=`terraai-nasa-power-${start}-${end}.csv`;link.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export default function TemperatureExplorer({farm,polygon}) {
  const point=useMemo(()=>fieldCenter(polygon,farm),[polygon,farm]);
  const [start,setStart]=useState(daysAgo(96));
  const [end,setEnd]=useState(daysAgo(7));
  const [heat,setHeat]=useState('35');
  const [cold,setCold]=useState('0');
  const [base,setBase]=useState('10');
  const [upper,setUpper]=useState('30');
  const [data,setData]=useState(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);
  const active=useRef(null);
  const config=useMemo(()=>({
    latitude:Number(point.latitude.toFixed(5)),longitude:Number(point.longitude.toFixed(5)),start,end,
    cold_threshold:Number(cold),heat_threshold:Number(heat),tbase:Number(base),tupper:Number(upper)
  }),[point,start,end,cold,heat,base,upper]);
  const badDates=!start||!end||start>end||end>TODAY||((Date.parse(end)-Date.parse(start))/86400000)>366;
  const badThresholds=[heat,cold,base,upper].some(v=>v.trim()===''||!Number.isFinite(Number(v)))||Number(upper)<=Number(base);
  const invalid=badDates?'Select valid dates (at most one year, not in the future).':badThresholds?'Enter valid thresholds, with upper GDD temperature above the base.':'';
  useEffect(()=>{
    active.current?.abort();setLoading(false);setData(null);setError('');
  },[config]);
  useEffect(()=>()=>active.current?.abort(),[]);
  const run=async()=>{
    if(invalid){setError(invalid);return;}
    active.current?.abort();const controller=new AbortController();active.current=controller;
    setLoading(true);setError('');setData(null);
    try{const result=await getClimateTemperature(config,controller.signal);if(!controller.signal.aborted)setData(result);}
    catch(e){if(!controller.signal.aborted)setError(e.name==='TypeError'?'Could not reach TerraAI backend. Start FastAPI on port 8000.':e.message);}
    finally{if(!controller.signal.aborted)setLoading(false);}
  };
  const summary=data?.summary;
  const rows=data?.observations||[];
  const valid=rows.filter(r=>r.mean_c!==null).length;
  const combined=rows.map((r,i)=>({...r,gdd_cumulative:data?.gdd?.daily?.[i]?.cumulative_gdd??null}));
  return <section className="climate-feature" id="temperature-intelligence">
    <div className="climate-heading"><div><div className="overline">AGROCLIMATE · NASA POWER</div><h2>Temperature Intelligence</h2><p>Daily air-temperature estimates for the currently selected agricultural field.</p></div><span className="climate-badge">{data?'● NASA POWER DATA':'○ LIVE DATA · NOT LOADED'}</span></div>
    <div className="climate-config">
      <label>From<input type="date" value={start} max={end} onChange={e=>setStart(e.target.value)}/></label>
      <label>To<input type="date" value={end} min={start} max={TODAY} onChange={e=>setEnd(e.target.value)}/></label>
      <label>Heat threshold (°C)<input type="number" step="0.5" min="-20" max="70" value={heat} onChange={e=>setHeat(e.target.value)}/></label>
      <label>Cold threshold (°C)<input type="number" step="0.5" min="-70" max="50" value={cold} onChange={e=>setCold(e.target.value)}/></label>
      <label>GDD base (°C)<input type="number" step="0.5" min="-30" max="45" value={base} onChange={e=>setBase(e.target.value)}/></label>
      <label>GDD upper (°C)<input type="number" step="0.5" min="-20" max="70" value={upper} onChange={e=>setUpper(e.target.value)}/></label>
      <button className="climate-run" type="button" onClick={run} disabled={loading||!!invalid}>{loading?<LoaderCircle size={15} className="ndvi-spin"/>:<RefreshCw size={15}/>} {loading?'Loading NASA…':'Analyze temperature'}</button>
    </div>
    {invalid&&<div className="ndvi-error"><Info size={16}/>{invalid}</div>}
    {error&&<div role="alert" className="ndvi-error"><AlertTriangle size={16}/>{error}</div>}
    <div className="climate-context"><Satellite size={16}/><span>Source: <strong>NASA POWER</strong> daily regional air-temperature estimates (2 m). Analysis uses the <strong>field center</strong> ({point.latitude.toFixed(4)}, {point.longitude.toFixed(4)}); not measurements inside the selected polygon. Time standard: local solar time.</span></div>
    <div className="climate-workspace">
      <div className="climate-map-pane"><TemperatureFieldMap farm={farm} polygon={polygon} point={point}/><p className="climate-mini-note">To change the field boundary, use <b>Draw field</b> in the Copernicus NDVI explorer above. Both panels use the same selected polygon.</p></div>
      <div className="climate-results-pane">
        <div className="climate-results-header"><div><h3>Temperature history</h3><span>{data?`${valid} / ${rows.length} days with mean temperature`:'Choose dates and select Analyze temperature'}</span></div><button className="ndvi-export" type="button" onClick={()=>saveCSV(data,point,start,end)} disabled={!data||!rows.length}><Download size={15}/> CSV</button></div>
        {summary ? <>
          <div className="climate-stats">
            <div><span>Average air temp</span><b>{formatValue(summary.mean_temperature_c)} °C</b></div>
            <div><span>Highest daily maximum</span><b>{formatValue(summary.absolute_max_temperature_c)} °C</b></div>
            <div><span>Lowest daily minimum</span><b>{formatValue(summary.absolute_min_temperature_c)} °C</b></div>
            <div><span>Heat exposure days</span><b>{summary.heat_exposure_days}</b></div>
            <div><span>Cold exposure days</span><b>{summary.cold_exposure_days}</b></div>
            <div><span>Accumulated GDD</span><b>{formatValue(data.gdd.total_gdd_c_day,0)} °C·day</b></div>
          </div>
          <div className="climate-plot"><ResponsiveContainer width="100%" height="100%"><LineChart data={rows} margin={{top:12,right:14,left:-20,bottom:4}}><CartesianGrid vertical={false} stroke="#e1ece6" strokeDasharray="3 5"/><XAxis dataKey="date" tick={{fontSize:10,fill:'#769188'}} minTickGap={55}/><YAxis unit="°" tick={{fontSize:10,fill:'#769188'}}/><Tooltip labelFormatter={v=>`Date: ${v}`} formatter={(value,name)=>[`${formatValue(value)} °C`,name]}/><Legend wrapperStyle={{fontSize:11}}/><Line name="Min air temperature" dataKey="min_c" type="monotone" dot={false} connectNulls={false} stroke="#3398bb" strokeWidth={1.6}/><Line name="Mean air temperature" dataKey="mean_c" type="monotone" dot={false} connectNulls={false} stroke="#277e62" strokeWidth={2.3}/><Line name="Max air temperature" dataKey="max_c" type="monotone" dot={false} connectNulls={false} stroke="#da893d" strokeWidth={1.6}/></LineChart></ResponsiveContainer></div>
          <div className="climate-substats"><span>Longest heat run: <b>{summary.max_consecutive_heat_days} days</b></span><span>Longest cold run: <b>{summary.max_consecutive_cold_days} days</b></span><span>Missing mean observations: <b>{summary.missing_mean_days}</b></span></div>
          <div className="climate-gdd-heading"><h4>Accumulated Growing Degree Days</h4><span>Daily mean approximation · Base {base} °C / upper {upper} °C</span></div>
          <div className="climate-gdd-plot"><ResponsiveContainer width="100%" height="100%"><LineChart data={combined} margin={{top:10,right:12,left:-12,bottom:0}}><CartesianGrid vertical={false} stroke="#e1ece6" strokeDasharray="3 5"/><XAxis dataKey="date" tick={{fontSize:9,fill:'#769188'}} minTickGap={55}/><YAxis tick={{fontSize:9,fill:'#769188'}}/><Tooltip labelFormatter={v=>`Date: ${v}`} formatter={v=>[v==null?'No observation':`${formatValue(v,1)} °C·day`,'Accumulated GDD']}/><Line type="monotone" dataKey="gdd_cumulative" stroke="#238d62" strokeWidth={2} dot={false} connectNulls={false}/></LineChart></ResponsiveContainer></div>
        </> : <div className="climate-empty"><ThermometerSun size={32}/><strong>Ready for NASA temperature data</strong><span>Set your dates and click Analyze temperature. Values are not simulated and will only appear after a successful NASA request.</span></div>}
      </div>
    </div>
    <div className="climate-footnote"><Info size={15}/><span>Daily gridded meteorological estimates, not an on-farm thermometer. Heat and cold counts are <strong>exposure screens</strong>, not predictions of plant mortality or yield. GDD upper temperature is not a lethal threshold. Data near today may be missing; gaps are retained. MODIS surface temperature is a separate product and is not yet mapped here. <a href="https://power.larc.nasa.gov/docs/services/api/temporal/daily/" target="_blank" rel="noopener noreferrer">NASA POWER documentation <ExternalLink size={11}/></a></span></div>
  </section>;
}
