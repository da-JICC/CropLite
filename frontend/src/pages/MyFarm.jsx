import React from 'react';
import {ArrowRight, CalendarDays, CheckCircle2, CircleAlert, CloudSun, Crosshair, Database, Leaf, LoaderCircle, MapPin, Satellite, ThermometerSun} from 'lucide-react';
import FieldSelectionMap from '../components/maps/FieldSelectionMap.jsx';
import {Panel, SectionHeading} from '../components/ui/Elements.jsx';
import {CropSelector} from '../components/crops/CropSelector.jsx';

const n=(x,d=1)=>typeof x==='number'&&Number.isFinite(x)?x.toFixed(d):'—';
function ndviAverage(dataset){const rows=dataset?.data?.observations||[];const valid=rows.filter(r=>typeof r.mean_ndvi==='number');return valid.length?valid.reduce((s,r)=>s+r.mean_ndvi,0)/valid.length:null;}
export function MyFarm({region,onRegionChange,start,end,interval,selectedCrop,onCropSelect,onDateChange,onOptionChange,onAnalyze,canAnalyze,rangeError,analysis,loading,error,backend,navigate,maxDate}) {
  const point=region?.representativePoint;
  const successful=analysis?.datasets||{};
  const ndvi=successful.ndvi;
  const temperature=successful.temperature;
  const tempSummary=temperature?.data?.summary;
  const area=analysis?.region?.area_hectares??region?.areaHectares;
  const backendReady=backend?.copernicus_configured;
  return <div className="field-overview-page">
    <SectionHeading overline="OVERVIEW / MY FARM" title="Your field, under observation." description="Outline a field on the map and analyze vegetation and temperature data from Copernicus and NASA POWER."/>
    <div className="field-status-row">
      <span className={`field-status-pill ${backendReady?'ok':'warn'}`}><Satellite size={14}/> Copernicus: {backendReady?'configured':'credentials missing or backend offline'}</span>
      <span className={`field-status-pill ${backend?'ok':'warn'}`}><CloudSun size={14}/> NASA POWER: {backend?'API available':'start the backend to enable requests'}</span>
    </div>
    <section className="field-map-panel">
      <div className="field-panel-heading"><div><span className="overline">01 / FIELD SELECTION</span><h2>Field map</h2><p>Find your location, outline the field and confirm the polygon. The selected area is shared with Environment.</p></div><div className="field-map-tag"><MapPin size={15}/> GeoJSON · WGS84</div></div>
      <FieldSelectionMap region={region} onRegionChange={onRegionChange}/>
    </section>
    <div className="field-below-grid">
      <section className="field-config-panel">
        <div className="field-panel-heading"><div><span className="overline">02 / ANALYSIS SETTINGS</span><h2>Analyze field</h2><p>Select a crop and compare its thermal references with NASA POWER.</p></div></div>
        <div className="field-region-details">
          <div><span>AREA</span><strong>{region?n(area,2):'—'} <small>ha</small></strong></div>
          <div><span>LATITUDE</span><strong>{point?n(point.latitude,5):'—'}</strong></div>
          <div><span>LONGITUDE</span><strong>{point?n(point.longitude,5):'—'}</strong></div>
        </div>
        <CropSelector selectedId={selectedCrop?.id} onSelect={onCropSelect}/>
        <div className="field-form-grid">
          <label>Start date<input type="date" min="2017-01-01" value={start} max={end} onChange={e=>onDateChange('start',e.target.value)}/></label>
          <label>End date<input type="date" min={start} max={maxDate} value={end} onChange={e=>onDateChange('end',e.target.value)}/></label>
          <label>NDVI intervals<select value={interval} onChange={e=>onOptionChange('interval',e.target.value)}><option value="P10D">10 days</option><option value="P1M">Monthly</option></select></label>
        </div>
        {rangeError&&<p className="field-input-error"><CircleAlert size={15}/>{rangeError}</p>}
        <button className="field-analyze-button" onClick={onAnalyze} disabled={!canAnalyze}>{loading?<LoaderCircle size={18} className="ndvi-spin"/>:<Satellite size={18}/>} {loading?'Fetching satellite data…':'Analyze field'} <ArrowRight size={18}/></button>
        {!region&&<p className="field-input-hint">First outline a field on the map.</p>}
        {!selectedCrop&&<p className="field-input-hint">Select one of the 20 crops to continue.</p>}
        {error&&<div role="alert" className="field-alert error"><CircleAlert size={18}/>{error}</div>}
        <p className="field-small-note">Crop thermal parameters are indicative references, not automatic damage diagnoses. NDVI summarizes the full polygon; NASA POWER estimates regional weather at a representative point, not an on-site measurement.</p>
      </section>
      <section className="field-config-panel field-summary-panel">
        <div className="field-panel-heading"><div><span className="overline">03 / RESULTS</span><h2>Environmental summary</h2><p>{analysis?`${analysis.period.start} — ${analysis.period.end}`:'Data will appear after the API requests finish.'}</p></div></div>
        {!analysis?<div className="field-summary-empty"><Leaf size={33}/><strong>Start with the map</strong><p>{loading?'Waiting for Copernicus and NASA POWER responses…':'Select a field and click “Analyze field” to retrieve observations.'}</p></div>:<>
          <div className="field-results-grid">
            <div><span><Leaf size={15}/> Mean NDVI over time</span><strong>{ndvi?.status==='success'?n(ndviAverage(ndvi),3):'—'}</strong><small>{ndvi?.status==='success'?'Copernicus Sentinel-2':'Unavailable'}</small></div>
            <div><span><ThermometerSun size={15}/> Mean temperature</span><strong>{temperature?.status==='success'?`${n(tempSummary?.mean_temperature_c)} °C`:'—'}</strong><small>{temperature?.status==='success'?'NASA POWER':'Unavailable'}</small></div>
            <div><span>Daily maximum</span><strong>{temperature?.status==='success'?`${n(tempSummary?.absolute_max_temperature_c)} °C`:'—'}</strong></div>
            <div><span>Daily minimum</span><strong>{temperature?.status==='success'?`${n(tempSummary?.absolute_min_temperature_c)} °C`:'—'}</strong></div>
          </div>
          <div className="field-source-states">
            {Object.entries(successful).map(([key,dataset])=><div key={key} className={dataset?.status==='success'?'ok':'warn'}>{dataset?.status==='success'?<CheckCircle2 size={16}/>:<CircleAlert size={16}/>}<div><b>{key==='ndvi'?'Copernicus · NDVI':'NASA POWER · Temperature'}</b><small>{dataset?.status==='success'?'Data received':dataset?.error||'No data'}</small></div></div>)}
          </div>
          <button className="field-secondary-button" onClick={()=>navigate('environment')}>View detailed charts in Environment <ArrowRight size={17}/></button>
        </>}
      </section>
    </div>
  </div>;
}
