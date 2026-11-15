import React, {useEffect, useRef, useState} from 'react';
import {Satellite, MapPinned, CalendarRange, ChevronRight} from 'lucide-react';
import FieldSelectionMap from './components/maps/FieldSelectionMap.jsx';
import CropLiteBrand from './components/ui/CropLiteBrand.jsx';
import {Daily2025Explorer} from './components/historical/Daily2025Explorer.jsx';
import {AgriculturalDecisions} from './components/recommendations/AgriculturalDecisions.jsx';
import {CropSelectorBar,PlantingDateControl,PhenologyTimeline,CropIndicatorsTable} from './components/phenology/CropPhenologyPanel.jsx';
import {timelineFor} from './components/phenology/phenologyEngine.mjs';
import cropPhenologyCatalog from './data/cropPhenologyCatalog.json';
import {getBackendStatus, getEnvironmentalRegion} from './services/regionAnalysisService.js';

/** The map is intentionally the exact same FieldSelectionMap component as Phase 1.
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
            'Could not connect to FastAPI. Make sure the backend is running on port 8000.' :
            (error.message || 'Historical data could not be retrieved.'));
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

  return <div className="croplite-app app-shell">
    <div className="croplite-workspace app-main">
      <header className="croplite-topbar topbar" id="inicio">
        <a className="croplite-brand" href="#inicio" aria-label="CropLite, home"><CropLiteBrand tagline/></a>
        <div className="croplite-topbar-center"><span className="croplite-topbar-divider"/><span>Agricultural intelligence dashboard</span><ChevronRight size={13}/><strong>{region?'Field selected':'Explore field'}</strong></div>
        <div className="croplite-topbar-right"><span className="croplite-topbar-year"><CalendarRange size={15}/> Annual planning</span><span className={`mode-pill ${backend?'':'offline'}`}><span/>{backend?'API connected':'API disconnected'}</span></div>
      </header>
      <main className="croplite-content page-body">
        <section id="mapa" className="croplite-map-section" aria-label="Satellite field map">
          <div className="croplite-section-top"><div><span className="overline">01 · FIELD SELECTION</span><h1>Define your field <span>from space.</span></h1><p>Locate and outline your field on satellite imagery to begin the agricultural analysis.</p></div><div className="croplite-data-pill"><Satellite size={15}/> Satellite map · Esri World Imagery</div></div>
          <div className="croplite-map-frame"><FieldSelectionMap region={region} onRegionChange={setRegion}/></div>
          <div className="croplite-context-strip" role="status" aria-live="polite">
            <div className="croplite-context-primary"><span className="croplite-context-icon"><MapPinned size={18}/></span><span><small>CURRENT FIELD</small><strong>{region?`${region.areaHectares?.toFixed(2) ?? '—'} hectares`:'Not outlined'}</strong></span></div>
            <div><small>COORDINATES</small><strong>{region?`${region.representativePoint.latitude.toFixed(4)}, ${region.representativePoint.longitude.toFixed(4)}`:'Select a region'}</strong></div>
            <div><small>ENVIRONMENTAL DATA</small><strong>{loading?'Fetching observations…':analysis?(analysis.status==='error'?'Sources unavailable':analysis.status==='partial'?'Partial data':'2025 data available'):region?'Awaiting request':'Waiting for field outline'}</strong></div>
            <div><small>DATA SOURCES</small><strong>{backend?(backend.copernicus_configured?'NASA POWER · Copernicus':'NASA POWER · Copernicus not configured'):'Connect the backend'}</strong></div>
          </div>
        </section>
        <section className="croplite-decision-wrap" id="decisiones"><AgriculturalDecisions region={region} cropId={cropId} onCropSelect={setCropId}/></section>
        <section className="terra-history-panel croplite-environment-section" id="ambiente" aria-label="Historical environment and crop stages">
          <div className="terra-history-heading"><span className="overline">03 · ENVIRONMENT & CROP GROWTH</span><h2>Environmental conditions and crop growth stages</h2><p>Explore 2025 observations and open the stage-by-stage indicator table when needed. This is not a forecast.</p></div>
          <CropSelectorBar cropId={cropId} onCropSelect={setCropId}/>
          {message && <div className="field-alert error" role="alert">{message} <button className="terra-text-button" onClick={retry}>Retry</button></div>}
          <Daily2025Explorer region={region} analysis={analysis} loading={loading} onRetry={retry} timeline={timeline}/>
          <div className="croplite-phenology-grid">
            <PlantingDateControl sowDate={sowDate} onSowDateChange={setSowDate}/>
            <PhenologyTimeline crop={crop} sowDate={sowDate} timeline={timeline}/>
          </div>
          <CropIndicatorsTable analysis={analysis} cropId={cropId} sowDate={sowDate} loading={loading}/>
        </section>
      </main>
      <footer className="app-footer croplite-footer"><span>CropLite · NASA Space Apps Challenge 2026</span><span>NASA POWER and Copernicus estimates · Esri satellite basemap (not live imagery) · Planning guidance, not yield predictions.</span></footer>
    </div>
  </div>;
}
