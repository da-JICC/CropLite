import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Activity, BarChart3, Download, ExternalLink, Info, Leaf, LoaderCircle, RefreshCw, Satellite, ShieldAlert} from 'lucide-react';
import {CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import {Panel} from '../ui/Elements.jsx';
import NDVIFieldMap, {sampleBoundary} from './NDVIFieldMap.jsx';
import {getDemoNdvi, getLiveNdvi, getNdviStatus} from '../../services/ndviService.js';

const iso = d => d.toISOString().slice(0,10);
const now = new Date();
const defaultEnd = iso(now);
const defaultStart = iso(new Date(Date.UTC(now.getUTCFullYear()-1,now.getUTCMonth(),1)));
const number = n => n == null || !Number.isFinite(n) ? '—' : n.toFixed(3);

function formatCSV(rows, source) {
  const header = 'date,end,mean_ndvi,min_ndvi,max_ndvi,valid_pixels,total_pixels,valid_percent,source';
  const values = rows.map(r => [r.date,r.end||'',r.mean_ndvi??'',r.min_ndvi??'',r.max_ndvi??'',r.valid_pixels??'',r.total_pixels??'',r.valid_percent??'',source].join(','));
  return [header,...values].join('\n');
}

export default function NDVIExplorer({farm, polygon, onPolygonChange}) {
  const setPolygon = onPolygonChange;
  const [mode,setMode] = useState('demo');
  const [start,setStart] = useState(defaultStart);
  const [end,setEnd] = useState(defaultEnd);
  const [interval,setInterval] = useState('P10D');
  const [result,setResult] = useState(null);
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(false);
  const [backend,setBackend] = useState(null);
  const abortRef = useRef(null);

  useEffect(()=>{
    const controller = new AbortController();
    getNdviStatus(controller.signal).then(setBackend).catch(()=>setBackend(null));
    return ()=>controller.abort();
  },[]);

  useEffect(()=>{
    abortRef.current?.abort();
    setLoading(false);setError('');setResult(null);
  },[farm.id]);

  useEffect(()=>()=>abortRef.current?.abort(),[]);

  const change = (set, value) => {abortRef.current?.abort();setLoading(false);setResult(null);setError('');set(value);};
  const polygonGeoJSON = useMemo(()=> polygon?.length >= 3 ? {type:'Polygon',coordinates:[[...polygon, polygon[0]]]} : null,[polygon]);
  const inputError = !start || !end || start > end ? 'Choose a valid date range.' :
    (Date.parse(end) - Date.parse(start))/(86400000)>366 ? 'Analyze one year at a time.' :
    end > defaultEnd ? 'End date cannot be in the future.' :
    !polygonGeoJSON ? 'Draw or select a field boundary.' : '';

  const run = async () => {
    if (inputError) {setError(inputError);return;}
    abortRef.current?.abort();
    setLoading(true);setError('');setResult(null);
    const controller = new AbortController();abortRef.current = controller;
    try {
      if(mode==='demo') {
        const data = getDemoNdvi(farm.id,start,end);
        if(!controller.signal.aborted) setResult(data);
      } else {
        const data = await getLiveNdvi({polygon:polygonGeoJSON,start,end,interval},controller.signal);
        if(!controller.signal.aborted) setResult(data);
      }
    } catch(e) {
      if(e.name!=='AbortError' && !controller.signal.aborted) {
        setError(e instanceof TypeError ? 'Cannot reach the CropLite backend. Start FastAPI on port 8000.' : e.message);
      }
    } finally {if(!controller.signal.aborted) setLoading(false);}
  };

  const rows = result?.observations || [];
  const valid = rows.filter(o=>o.mean_ndvi!=null);
  const mean = valid.length ? valid.reduce((acc,o)=>acc+o.mean_ndvi,0)/valid.length : null;
  const latest = valid.at(-1);
  const validPct = rows.length ? rows.reduce((acc,o)=>acc+(o.valid_percent||0),0)/rows.length : null;

  function exportCSV() {
    if(!rows.length) return;
    const csv = formatCSV(rows, result.source);
    const url = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const a = document.createElement('a');a.href=url;a.download=`croplite-ndvi-${farm.id}-${start}-${end}.csv`;a.click();
    URL.revokeObjectURL(url);
  }

  return <section className="ndvi-feature">
    <div className="ndvi-heading">
      <div><div className="overline">FIELD VEGETATION · SENTINEL-2</div><h2>NDVI field explorer</h2><p>Draw a field, select a period, and inspect vegetation-index observations.</p></div>
      <span className={`ndvi-source-badge ${result?.status==='observed'?'observed':'simulated'}`}>{result?.status==='observed'?'● REAL COPERNICUS DATA':mode==='live'?'○ LIVE SOURCE · NOT LOADED':'○ DEMO / NOT OBSERVED'}</span>
    </div>
    <div className="ndvi-config">
      <label>Data source<select value={mode} onChange={e=>change(setMode,e.target.value)}><option value="demo">Simulated example</option><option value="live">Live Copernicus API</option></select></label>
      <label>From<input type="date" value={start} max={end} onChange={e=>change(setStart,e.target.value)}/></label>
      <label>To<input type="date" value={end} min={start} max={defaultEnd} onChange={e=>change(setEnd,e.target.value)}/></label>
      <label>Time window<select value={interval} onChange={e=>change(setInterval,e.target.value)}><option value="P10D">10 days</option><option value="P1M">1 month</option></select></label>
      <button type="button" className="ndvi-run" onClick={run} disabled={loading||!!inputError}>{loading?<LoaderCircle size={15} className="ndvi-spin"/>:<RefreshCw size={15}/>} {loading?'Requesting…':'Analyze NDVI'}</button>
    </div>
    {mode==='live' && <div className={`ndvi-live-notice ${backend?.copernicus_configured?'ready':''}`}><Satellite size={16}/>{backend?.copernicus_configured ? 'Backend connected and credentials configured. Live requests may count toward your Copernicus quota.' : backend ? 'Backend is running, but Copernicus credentials are missing. Add them to backend/.env.' : 'Backend offline or not configured. Start FastAPI; see README.'}</div>}
    {inputError && <div className="ndvi-error"><Info size={16}/>{inputError}</div>}
    {error && <div className="ndvi-error" role="alert"><ShieldAlert size={16}/>{error}</div>}
    <div className="ndvi-workspace">
      <div className="ndvi-map-col"><NDVIFieldMap farm={farm} polygon={polygon} onChange={p=>change(setPolygon,p)}/></div>
      <div className="ndvi-chart-col">
        <div className="ndvi-chart-top"><div><h3>NDVI over time</h3><span>{result ? `${result.source} · ${rows.length} intervals` : 'Select a field and analyze to see results'}</span></div><button className="ndvi-export" type="button" onClick={exportCSV} disabled={!rows.length}><Download size={15}/> CSV</button></div>
        {result ? rows.length ? <>
          <div className="ndvi-mini-metrics"><div><span>Mean of intervals</span><b>{number(mean)}</b></div><div><span>Latest valid NDVI</span><b>{number(latest?.mean_ndvi)}</b></div><div><span>Mean valid pixels</span><b>{validPct==null?'—':`${validPct.toFixed(0)}%`}</b></div></div>
          <div className="ndvi-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={rows} margin={{top:12,right:12,left:-22,bottom:4}}><CartesianGrid vertical={false} stroke="#e7eee9" strokeDasharray="3 5"/><XAxis dataKey="date" tick={{fontSize:10,fill:'#75928a'}} minTickGap={35}/><YAxis domain={[0,1]} ticks={[0,.25,.5,.75,1]} tick={{fontSize:10,fill:'#75928a'}}/><Tooltip formatter={v=>v==null?'No valid pixels':Number(v).toFixed(3)} labelFormatter={label=>`Period starting ${label}`}/><Line type="monotone" dataKey="mean_ndvi" name="Mean NDVI" stroke="#238d62" strokeWidth={3} dot={{r:2}} connectNulls={false}/></LineChart></ResponsiveContainer></div>
          <div className="ndvi-table-wrapper"><table className="ndvi-table"><thead><tr><th>Period begins</th><th>Mean NDVI</th><th>Valid pixels</th></tr></thead><tbody>{rows.slice(-6).map(r=><tr key={r.date}><td>{r.date}</td><td>{number(r.mean_ndvi)}</td><td>{r.valid_pixels??'—'}</td></tr>)}</tbody></table></div>
        </> : <div className="ndvi-empty"><BarChart3 size={26}/><b>No observations in this range</b><span>Change the period or use the live service when configured.</span></div> : <div className="ndvi-empty"><Activity size={28}/><b>No analysis loaded yet</b><span>Use “Analyze NDVI”. Demo readings are simulated; live observations require the backend.</span></div>}
      </div>
    </div>
    <div className="ndvi-footnote"><Info size={15}/><span>{result?.status==='observed'?'Actual Sentinel-2 L2A reflectance, 10 m sampling. Cloud, shadow, water and snow pixels are masked; intervals are not forecasts.':'All NDVI values shown in demo mode are fabricated for interface testing. They are NOT measurements at this farm.'} Existing crop comparisons and other dashboards remain simulated. <a href="https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Statistical.html" target="_blank" rel="noopener noreferrer">Copernicus documentation <ExternalLink size={11}/></a></span></div>
  </section>;
}
