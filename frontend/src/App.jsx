import React, {useEffect, useRef, useState} from 'react';
import {Satellite, MapPinned, CalendarRange, ChartNoAxesCombined, ChevronRight, CircleHelp, LayoutDashboard, ExternalLink, Menu, X, ArrowUpRight} from 'lucide-react';
import FieldSelectionMap from './components/maps/FieldSelectionMap.jsx';
import CropLiteBrand from './components/ui/CropLiteBrand.jsx';
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
  const [mobileMenu, setMobileMenu] = useState(false);
  const [activeSection, setActiveSection] = useState('mapa');
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

  useEffect(() => {
    if (!mobileMenu) return;
    const onKeyDown = event => {if(event.key==='Escape') setMobileMenu(false);};
    window.addEventListener('keydown',onKeyDown);
    return ()=>window.removeEventListener('keydown',onKeyDown);
  }, [mobileMenu]);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const targets = ['mapa', 'decisiones', 'rotaciones', 'ambiente'].map(id=>document.getElementById(id)).filter(Boolean);
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry=>entry.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top);
      if(visible.length) setActiveSection(visible[0].target.id);
    }, {rootMargin:'-15% 0px -60% 0px',threshold:0});
    targets.forEach(el=>observer.observe(el));
    return () => observer.disconnect();
  }, []);

  function retry() {
    if (!region) return;
    cache.current.delete(JSON.stringify([region.geometry, 'daily-2025-v1']));
    setAttempt(value => value + 1);
  }

  return <div className="croplite-app app-shell">
    <div className="croplite-workspace app-main">
      <header className="croplite-topbar topbar" id="inicio">
        <a className="croplite-brand" href="#inicio" aria-label="CropLite, inicio"><CropLiteBrand tagline/></a>
        <div className="croplite-topbar-center"><span className="croplite-topbar-divider"/><span>Panel de inteligencia agrícola</span><ChevronRight size={13}/><strong>{region?'Campo seleccionado':'Explorar terreno'}</strong></div>
        <div className="croplite-topbar-right"><button className="croplite-mobile-menu" type="button" aria-label={mobileMenu?"Cerrar navegación":"Abrir navegación"} aria-expanded={mobileMenu} aria-controls="croplite-rail-nav" onClick={()=>setMobileMenu(value=>!value)}>{mobileMenu?<X size={21}/>:<Menu size={21}/>}</button><span className="croplite-topbar-year"><CalendarRange size={15}/> Planificación anual</span><span className={`mode-pill ${backend?'':'offline'}`}><span/>{backend?'API conectada':'Sin conexión a API'}</span></div>
      </header>
      <main className="croplite-content page-body">
        <section id="mapa" className="croplite-map-section" aria-label="Mapa satelital del campo">
          <div className="croplite-section-top"><div><span className="overline">01 · TERRITORIO</span><h1>Explora tu campo <span>desde el espacio.</span></h1><p>Ubica y delimita tu parcela sobre imágenes reales para comenzar el análisis.</p></div><div className="croplite-data-pill"><Satellite size={15}/> Mapa satelital · Esri World Imagery</div></div>
          <div className="croplite-map-frame"><FieldSelectionMap region={region} onRegionChange={setRegion}/></div>
          <div className="croplite-context-strip" role="status" aria-live="polite">
            <div className="croplite-context-primary"><span className="croplite-context-icon"><MapPinned size={18}/></span><span><small>PARCELA ACTUAL</small><strong>{region?`${region.areaHectares?.toFixed(2) ?? '—'} hectáreas`:'Sin delimitar'}</strong></span></div>
            <div><small>COORDENADAS</small><strong>{region?`${region.representativePoint.latitude.toFixed(4)}, ${region.representativePoint.longitude.toFixed(4)}`:'Selecciona tu región'}</strong></div>
            <div><small>DATOS AMBIENTALES</small><strong>{loading?'Consultando fuentes…':analysis?(analysis.status==='error'?'Fuentes no disponibles':analysis.status==='partial'?'Datos parciales':'Datos 2025 disponibles'):region?'Pendiente de consulta':'Esperando polígono'}</strong></div>
            <div><small>FUENTES DE INFORMACIÓN</small><strong>{backend?(backend.copernicus_configured?'NASA POWER · Copernicus':'NASA POWER · Copernicus sin configurar'):'Conecta el backend'}</strong></div>
          </div>
        </section>
        <section className="croplite-decision-wrap" id="decisiones"><AgriculturalDecisions region={region} cropId={cropId} onCropSelect={setCropId}/></section>
        <section className="terra-history-panel croplite-environment-section" id="ambiente" aria-label="Histórico ambiental y fenología">
          <div className="terra-history-heading"><span className="overline">03 · OBSERVACIÓN HISTÓRICA</span><h2>Ambiente y desarrollo del cultivo</h2><p>Explora observaciones de 2025 y consulta indicadores por fase de crecimiento. Esta sección no representa un pronóstico.</p></div>
          <CropSelectorBar cropId={cropId} onCropSelect={setCropId}/>
          {message && <div className="field-alert error" role="alert">{message} <button className="terra-text-button" onClick={retry}>Reintentar</button></div>}
          <Daily2025Explorer region={region} analysis={analysis} loading={loading} onRetry={retry} timeline={timeline}/>
          <div className="croplite-phenology-grid">
            <PlantingDateControl sowDate={sowDate} onSowDateChange={setSowDate}/>
            <PhenologyTimeline crop={crop} sowDate={sowDate} timeline={timeline}/>
          </div>
          <CropIndicatorsTable analysis={analysis} cropId={cropId} sowDate={sowDate} loading={loading}/>
        </section>
      </main>
      <footer className="app-footer croplite-footer"><span>CropLite · NASA Space Apps Challenge 2026</span><span>Datos estimados de NASA POWER y Copernicus · Imagen base satelital de Esri (no en tiempo real) · Planes orientativos sin predicción de rendimiento.</span></footer>
    </div>
    {mobileMenu&&<button type="button" className="croplite-mobile-scrim" onClick={()=>setMobileMenu(false)} aria-label="Cerrar menú lateral"/>}
    <aside className={`croplite-rail${mobileMenu?' croplite-rail--open':''}`} aria-label="Navegación de CropLite">
      <div className="croplite-rail-header"><CropLiteBrand inverse tagline/></div>
      <div className="croplite-rail-section-label">ÁREA DE TRABAJO</div>
      <nav id="croplite-rail-nav" className="croplite-rail-nav" aria-label="Secciones de la aplicación">
        <a href="#mapa" aria-current={activeSection==='mapa'?'location':undefined} className={`croplite-rail-link${activeSection==='mapa'?' is-active':''}`} onClick={()=>{setMobileMenu(false);setActiveSection('mapa');}}><MapPinned size={17}/><span>Mapa y parcela</span></a>
        <a href="#decisiones" aria-current={activeSection==='decisiones'?'location':undefined} className={`croplite-rail-link${activeSection==='decisiones'?' is-active':''}`} onClick={()=>{setMobileMenu(false);setActiveSection('decisiones');}}><LayoutDashboard size={17}/><span>Recomendaciones</span></a>
        <a href="#rotaciones" aria-current={activeSection==='rotaciones'?'location':undefined} className={`croplite-rail-link${activeSection==='rotaciones'?' is-active':''}`} onClick={()=>{setMobileMenu(false);setActiveSection('rotaciones');}}><CalendarRange size={17}/><span>Rotación anual</span></a>
        <a href="#ambiente" aria-current={activeSection==='ambiente'?'location':undefined} className={`croplite-rail-link${activeSection==='ambiente'?' is-active':''}`} onClick={()=>{setMobileMenu(false);setActiveSection('ambiente');}}><ChartNoAxesCombined size={17}/><span>Datos ambientales</span></a>
      </nav>
      <div className="croplite-rail-spacer"/>
      <div className="croplite-rail-note"><CircleHelp size={17}/><strong>¿Cómo funciona?</strong><p>Selecciona una parcela, consulta el clima histórico y revisa recomendaciones explicadas.</p><a href="https://www.spaceappschallenge.org/2026/challenges/adapting-farms-with-nasa-data/" target="_blank" rel="noopener noreferrer">Sobre el desafío <ArrowUpRight size={13}/></a></div>
      <div className="croplite-rail-foot"><span className={`croplite-rail-dot${backend?' is-online':''}`}/>{backend?'Servicios conectados':'Revisar conexión de datos'}</div>
    </aside>
  </div>;
}
