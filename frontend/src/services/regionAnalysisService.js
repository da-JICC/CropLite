export async function analyzeSelectedRegion({geometry,start,end,interval='P10D'},signal) {
  const res=await fetch('/api/regions/analyze',{
    method:'POST', headers:{'Content-Type':'application/json'}, signal,
    body:JSON.stringify({polygon:geometry,start,end,interval})
  });
  const data=await res.json().catch(()=>null);
  if(!res.ok) {
    const detail=data?.detail;
    const message=typeof detail==='string'?detail:Array.isArray(detail)?detail.map(x=>x.msg).join('; '):`El servidor devolvió HTTP ${res.status}`;
    throw new Error(message);
  }
  if(!data?.datasets||!data?.region)throw new Error('El servidor entregó una respuesta incompleta.');
  return data;
}
export async function getBackendStatus(signal) {
  const res=await fetch('/api/status',{signal});
  if(!res.ok)throw new Error('Backend unavailable');
  return res.json();
}
export function saveDatasetCsv({dataset,analysis,type}) {
  const rows=dataset?.data?.observations||[];
  if(!rows.length)return;
  const point=analysis.region.representative_point;
  const header=type==='ndvi'?['date','end','mean_ndvi','min_ndvi','max_ndvi','valid_pixels','total_pixels','valid_percent','source','polygon_geojson','start','end_requested']:
    ['date','mean_c','min_c','max_c','source','sample_latitude','sample_longitude','sampling_method','start','end_requested'];
  const values=rows.map(r=>type==='ndvi'?[r.date,r.end||'',r.mean_ndvi??'',r.min_ndvi??'',r.max_ndvi??'',r.valid_pixels??'',r.total_pixels??'',r.valid_percent??'',dataset.source,JSON.stringify(analysis.region.geometry),analysis.period.start,analysis.period.end]:
    [r.date,r.mean_c??'',r.min_c??'',r.max_c??'',dataset.source,point.latitude,point.longitude,'representative_point',analysis.period.start,analysis.period.end]);
  const quote=v=>`"${String(v??'').replaceAll('"','""')}"`;
  const csv='\ufeff'+[header,...values].map(row=>row.map(quote).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=`croplite-${type}-${analysis.period.start}-${analysis.period.end}.csv`;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

/** Six complete years, selected by the backend clock; no manual date parameters. */
export async function getHistoricalRegion(polygon, signal) {
  const response = await fetch('/api/regions/history', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({polygon}),
    signal,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload?.detail;
    throw new Error(typeof detail === 'string' ? detail : `Error del servidor (HTTP ${response.status})`);
  }
  if (!payload?.region || !payload?.datasets || !payload?.period?.years) {
    throw new Error('La respuesta histórica del backend está incompleta.');
  }
  return payload;
}

/** Unified historical environment: one fetch per region, shared across tabs and crops. */
export async function getEnvironmentalRegion(polygon, signal) {
  const response = await fetch('/api/regions/environment/daily-2025', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({polygon}), signal,
  });
  const payload=await response.json().catch(()=>null);
  if(!response.ok) throw new Error(typeof payload?.detail==='string'?payload.detail:`El servidor respondió HTTP ${response.status}`);
  if(!payload?.datasets || !payload?.region) throw new Error('El backend devolvió una respuesta ambiental incompleta.');
  return payload;
}
