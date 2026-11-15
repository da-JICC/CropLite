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
    <SectionHeading overline="OVERVIEW / MY FARM" title="Tu terreno, bajo observación." description="Delimita una región en el mapa y analiza sus datos de vegetación y temperatura utilizando Copernicus y NASA POWER."/>
    <div className="field-status-row">
      <span className={`field-status-pill ${backendReady?'ok':'warn'}`}><Satellite size={14}/> Copernicus: {backendReady?'configurado':'sin credenciales o backend desconectado'}</span>
      <span className={`field-status-pill ${backend?'ok':'warn'}`}><CloudSun size={14}/> NASA POWER: {backend?'consulta disponible':'inicia el backend para consultar'}</span>
    </div>
    <section className="field-map-panel">
      <div className="field-panel-heading"><div><span className="overline">01 / SELECCIÓN GEOGRÁFICA</span><h2>Mapa del cultivo</h2><p>Busca tu localidad, delimita el campo y confirma el polígono. La región se compartirá con Environment.</p></div><div className="field-map-tag"><MapPin size={15}/> GeoJSON · WGS84</div></div>
      <FieldSelectionMap region={region} onRegionChange={onRegionChange}/>
    </section>
    <div className="field-below-grid">
      <section className="field-config-panel">
        <div className="field-panel-heading"><div><span className="overline">02 / CONFIGURACIÓN</span><h2>Analizar región</h2><p>Selecciona un cultivo y compara sus referencias térmicas con NASA POWER.</p></div></div>
        <div className="field-region-details">
          <div><span>SUPERFICIE</span><strong>{region?n(area,2):'—'} <small>ha</small></strong></div>
          <div><span>LATITUD</span><strong>{point?n(point.latitude,5):'—'}</strong></div>
          <div><span>LONGITUD</span><strong>{point?n(point.longitude,5):'—'}</strong></div>
        </div>
        <CropSelector selectedId={selectedCrop?.id} onSelect={onCropSelect}/>
        <div className="field-form-grid">
          <label>Fecha inicial<input type="date" min="2017-01-01" value={start} max={end} onChange={e=>onDateChange('start',e.target.value)}/></label>
          <label>Fecha final<input type="date" min={start} max={maxDate} value={end} onChange={e=>onDateChange('end',e.target.value)}/></label>
          <label>Intervalos NDVI<select value={interval} onChange={e=>onOptionChange('interval',e.target.value)}><option value="P10D">10 días</option><option value="P1M">Mensual</option></select></label>
        </div>
        {rangeError&&<p className="field-input-error"><CircleAlert size={15}/>{rangeError}</p>}
        <button className="field-analyze-button" onClick={onAnalyze} disabled={!canAnalyze}>{loading?<LoaderCircle size={18} className="ndvi-spin"/>:<Satellite size={18}/>} {loading?'Consultando fuentes satelitales…':'Analizar región'} <ArrowRight size={18}/></button>
        {!region&&<p className="field-input-hint">Primero dibuja o delimita una región de cultivo en el mapa.</p>}
        {!selectedCrop&&<p className="field-input-hint">Selecciona uno de los veinte cultivos para continuar.</p>}
        {error&&<div role="alert" className="field-alert error"><CircleAlert size={18}/>{error}</div>}
        <p className="field-small-note">Los parámetros térmicos del cultivo son referencias orientativas, no diagnósticos automáticos de daños. NDVI: estadística de todo el polígono. NASA POWER: estimación meteorológica regional en el punto representativo del campo; no es una medición in situ.</p>
      </section>
      <section className="field-config-panel field-summary-panel">
        <div className="field-panel-heading"><div><span className="overline">03 / RESULTADO</span><h2>Resumen ambiental</h2><p>{analysis?`${analysis.period.start} — ${analysis.period.end}`:'Los datos aparecerán después de consultar las APIs.'}</p></div></div>
        {!analysis?<div className="field-summary-empty"><Leaf size={33}/><strong>Todo comienza por el mapa</strong><p>{loading?'Esperando respuestas de Copernicus y NASA POWER…':'Selecciona tu campo y presiona «Analizar región» para obtener observaciones reales.'}</p></div>:<>
          <div className="field-results-grid">
            <div><span><Leaf size={15}/> NDVI temporal medio</span><strong>{ndvi?.status==='success'?n(ndviAverage(ndvi),3):'—'}</strong><small>{ndvi?.status==='success'?'Copernicus Sentinel-2':'No disponible'}</small></div>
            <div><span><ThermometerSun size={15}/> Temperatura media</span><strong>{temperature?.status==='success'?`${n(tempSummary?.mean_temperature_c)} °C`:'—'}</strong><small>{temperature?.status==='success'?'NASA POWER':'No disponible'}</small></div>
            <div><span>Máxima diaria</span><strong>{temperature?.status==='success'?`${n(tempSummary?.absolute_max_temperature_c)} °C`:'—'}</strong></div>
            <div><span>Mínima diaria</span><strong>{temperature?.status==='success'?`${n(tempSummary?.absolute_min_temperature_c)} °C`:'—'}</strong></div>
          </div>
          <div className="field-source-states">
            {Object.entries(successful).map(([key,dataset])=><div key={key} className={dataset?.status==='success'?'ok':'warn'}>{dataset?.status==='success'?<CheckCircle2 size={16}/>:<CircleAlert size={16}/>}<div><b>{key==='ndvi'?'Copernicus · NDVI':'NASA POWER · Temperatura'}</b><small>{dataset?.status==='success'?'Datos recibidos':dataset?.error||'Sin datos'}</small></div></div>)}
          </div>
          <button className="field-secondary-button" onClick={()=>navigate('environment')}>Ver gráficos detallados en Environment <ArrowRight size={17}/></button>
        </>}
      </section>
    </div>
  </div>;
}
