import React, {useEffect, useRef, useState} from 'react';
import {Leaf, Satellite} from 'lucide-react';
import FieldSelectionMap from './components/maps/FieldSelectionMap.jsx';
import {Daily2025Explorer} from './components/historical/Daily2025Explorer.jsx';
import {AgriculturalDecisions} from './components/recommendations/AgriculturalDecisions.jsx';
import {CropSelectorBar,PlantingDateControl,PhenologyTimeline,CropIndicatorsTable} from './components/phenology/CropPhenologyPanel.jsx';
import {timelineFor} from './components/phenology/phenologyEngine.mjs';
import cropPhenologyCatalog from './data/cropPhenologyCatalog.json';
import {getBackendStatus, getEnvironmentalRegion} from './services/regionAnalysisService.js';

/** The map is intentionally the exact same FieldSelectionMap component as Fase 1.
 *  Region changes fetch observations once, irrespective of crop/tab/year view.
 */
export default function App() {
  const [region, setRegion] = useState(null);
  const [cropId, setCropId] = useState('wheat');
  const [sowDate, setSowDate] = useState('2025-03-01');
  const crop = cropPhenologyCatalog.crops.find(c => c.id === cropId);
  const timeline = timelineFor(crop, sowDate);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [backend, setBackend] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const cache = useRef(new Map());
  const requestSerial = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    getBackendStatus(controller.signal).then(setBackend).catch(() => setBackend(null));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const current = ++requestSerial.current;
    const controller = new AbortController();
    if (!region?.geometry) {
      setAnalysis(null); setLoading(false); setMessage('');
      return () => controller.abort();
    }
    // Year in key prevents stale data surviving a New Year rollover in a long-lived tab.
    const key = JSON.stringify([region.geometry, 'daily-2025-v1']);
    const existing = cache.current.get(key);
    if (existing) {
      setAnalysis(existing); setLoading(false); setMessage('');
      return () => controller.abort();
    }
    setAnalysis(null);
    setLoading(true);
    setMessage('');
    // A short debounce prevents a series of polygon edits from launching many queries.
    const timer = setTimeout(async () => {
      try {
        const result = await getEnvironmentalRegion(region.geometry, controller.signal);
        if (!controller.signal.aborted && requestSerial.current === current) {
          if (result.status !== 'error') {
            cache.current.set(key, result);
            if (cache.current.size > 6) cache.current.delete(cache.current.keys().next().value);
          }
          setAnalysis(result);
        }
      } catch (error) {
        if (!controller.signal.aborted && requestSerial.current === current) {
          setMessage(error instanceof TypeError ?
            'No se pudo conectar con FastAPI. Comprueba que el backend esté funcionando en el puerto 8000.' :
            (error.message || 'No se pudieron recuperar los datos históricos.'));
        }
      } finally {
        if (!controller.signal.aborted && requestSerial.current === current) setLoading(false);
      }
    }, 700);
    return () => {clearTimeout(timer); controller.abort();};
  }, [region, attempt]);

  function retry() {
    if (!region) return;
    cache.current.delete(JSON.stringify([region.geometry, 'daily-2025-v1']));
    setAttempt(value => value + 1);
  }

  return <div className="app-shell terra-one-page-shell">
    <div className="app-main terra-one-page-main">
      <header className="topbar terra-unified-header">
        <div className="terra-brand"><span className="terra-brand-mark"><Leaf size={23}/></span><div><strong>Terra<span>AI</span></strong><small>INTELIGENCIA AMBIENTAL AGRÍCOLA</small></div></div>
        <div className="topbar-right"><span className={`mode-pill ${backend?'':'offline'}`}><span/>{backend?'BACKEND CONECTADO':'BACKEND DESCONECTADO'}</span></div>
      </header>
      <main className="page-body terra-one-page-content">
        <div className="terra-hero-copy"><span className="overline">OBSERVACIÓN TERRESTRE · TERRAAI</span><h1>Tu campo, sus condiciones ambientales.</h1><p>Delimita tu terreno, explora decisiones agrícolas basadas en temporadas históricas y revisa los indicadores diarios de 2025.</p></div>
        <div className="field-status-row">
          <span className={`field-status-pill ${backend?.copernicus_configured?'ok':'warn'}`}><Satellite size={14}/> Copernicus: {backend?.copernicus_configured?'configurado':'sin credenciales o backend desconectado'}</span>
          <span className={`field-status-pill ${backend?'ok':'warn'}`}>NASA POWER: {backend?'disponible para consulta':'requiere backend'}</span>
        </div>
        <section className="field-map-panel" aria-label="Selección geográfica">
          <div className="field-panel-heading"><div><span className="overline">01 / ÁREA DE ESTUDIO</span><h2>Selecciona tu región de cultivo</h2><p>Dibuja o modifica el polígono. Al confirmarlo se consultan automáticamente las fuentes ambientales.</p></div><div className="field-map-tag">GeoJSON · WGS84</div></div>
          <FieldSelectionMap region={region} onRegionChange={setRegion}/>
        </section>
        <div className="terra-region-strip">
          <div><small>REGIÓN</small><b>{region ? `${region.areaHectares?.toFixed(2) ?? '—'} ha` : 'Sin terreno seleccionado'}</b></div>
          <div><small>UBICACIÓN REPRESENTATIVA</small><b>{region ? `${region.representativePoint.latitude.toFixed(5)}, ${region.representativePoint.longitude.toFixed(5)}` : '—'}</b></div>
          <div><small>PERÍODO</small><b>{analysis ? '2025 · 365 días' : 'Consulta automática'}</b></div>
          <div className="terra-region-activity"><small>RECUPERACIÓN</small><b>{loading?'Consultando NASA y Copernicus…':analysis?(analysis.status==='error'?'Fuentes no disponibles':analysis.status==='partial'?'Datos parciales disponibles':'Datos 2025 disponibles'):region?'Sin consulta activa':'Selecciona un campo'}</b></div>
        </div>
        <AgriculturalDecisions region={region} cropId={cropId} onCropSelect={setCropId}/>
        <section className="terra-history-panel" aria-label="Análisis ambiental histórico">
          <div className="terra-history-heading"><div><span className="overline">02 / AMBIENTE Y DESARROLLO</span><h2>Ambiente y calendario del cultivo</h2><p>Explora un año completo de datos diarios. Elige un cultivo y desplaza la fecha de siembra para ver sus cuatro etapas sobre cada gráfica y compararlas con los indicadores por fase.</p></div></div>
          <CropSelectorBar cropId={cropId} onCropSelect={setCropId}/>
          {message && <div className="field-alert error" role="alert">{message} <button className="terra-text-button" onClick={retry}>Reintentar</button></div>}
          <Daily2025Explorer region={region} analysis={analysis} loading={loading} onRetry={retry} timeline={timeline}/>
          <PlantingDateControl sowDate={sowDate} onSowDateChange={setSowDate}/>
          <PhenologyTimeline crop={crop} sowDate={sowDate} timeline={timeline}/>
          <CropIndicatorsTable analysis={analysis} cropId={cropId} sowDate={sowDate} loading={loading}/>
        </section>
      </main>
      <footer className="app-footer"><span>TerraAI · NASA Space Apps Challenge 2026</span><span>NASA POWER: estimaciones regionales diarias de 2025 · Copernicus sigue disponible en el backend · Desarrollo fenológico y ETc son estimaciones condicionadas.</span></footer>
    </div>
  </div>;
}
