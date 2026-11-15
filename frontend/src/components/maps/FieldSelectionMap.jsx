import React, {useEffect,useRef,useState} from 'react';
import {CircleMarker, MapContainer, Marker, Polygon, Polyline, TileLayer, ZoomControl, useMap, useMapEvents} from 'react-leaflet';
import L from 'leaflet';
import {Check, Layers3, MapPin, Pencil, Search, Trash2, X, Move, Satellite, Map as MapIcon, LocateFixed, Maximize2} from 'lucide-react';
import {buildRegion} from '../../utils/regionGeometry.js';

const DEFAULT_CENTER=[-33.0501,-71.4570];
const ESRI_WORLD_IMAGERY='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ESRI_CREDIT='Tiles © Esri — Sources: Esri, Maxar, Earthstar Geographics, and the GIS User Community';
const OSM_URL='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const vertexIcon=L.divIcon({className:'field-vertex-icon', html:'<span aria-hidden="true"></span>', iconSize:[18,18], iconAnchor:[9,9]});

function MapFlyTo({target}) {
  const map=useMap();
  useEffect(()=>{if(target)map.flyTo([target.lat,target.lng],target.zoom||13,{duration:0.8});},[target,map]);
  return null;
}
function MapFrame({geometry,allowFit}) {
  const map=useMap();
  // Do not automatically recenter while a polygon is being edited.
  useEffect(()=>{
    const points=geometry?.coordinates?.[0]?.slice(0,-1);
    if(!allowFit||!points?.length)return;
    const bounds=L.latLngBounds(points.map(([lng,lat])=>[lat,lng]));
    if(bounds.isValid())map.fitBounds(bounds.pad(.38),{maxZoom:17,animate:true});
  },[geometry,map,allowFit]);
  return null;
}
function MapClick({drawing,onVertex}) {
  useMapEvents({click:e=>{if(drawing)onVertex([e.latlng.lng,e.latlng.lat]);}});
  return null;
}
function MapFocusButton({region}) {
  const map=useMap();
  return <button type="button" className="croplite-map-recenter" title="Volver al campo o a la ubicación inicial" aria-label="Volver al campo" onClick={()=>{
    const pts=region?.geometry?.coordinates?.[0]?.slice(0,-1);
    if(pts?.length){const bounds=L.latLngBounds(pts.map(([lng,lat])=>[lat,lng]));map.fitBounds(bounds.pad(.38),{maxZoom:17});}
    else map.flyTo(DEFAULT_CENTER,10);
  }}><LocateFixed size={16}/></button>;
}
export default function FieldSelectionMap({region,onRegionChange}) {
  const [mode,setMode]=useState('idle');
  const [basemap,setBasemap]=useState('satellite');
  const [draft,setDraft]=useState([]);
  const [error,setError]=useState('');
  const [query,setQuery]=useState('');
  const [searching,setSearching]=useState(false);
  const [flyTarget,setFlyTarget]=useState(null);
  const searchRef=useRef(null);
  useEffect(()=>()=>searchRef.current?.abort(),[]);
  const vertices=region?.geometry?.coordinates?.[0]?.slice(0,-1)||[];
  const current=mode==='draw'?draft:vertices;
  const positions=current.map(([lng,lat])=>[lat,lng]);

  function commit(points) {
    try {onRegionChange(buildRegion(points));setMode('idle');setDraft([]);setError('');}
    catch(e) {setError(e.message);}
  }
  function updateVertex(index,latlng) {
    const edited=vertices.map((p,i)=>i===index?[latlng.lng,latlng.lat]:p);
    try {onRegionChange(buildRegion(edited));setError('');}
    catch(e) {setError(`No se pudo mover el vértice: ${e.message}`);}
  }
  async function searchLocation(e) {
    e.preventDefault();if(!query.trim())return;
    searchRef.current?.abort();const controller=new AbortController();searchRef.current=controller;
    setSearching(true);setError('');
    try {
      const url=`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query.trim())}`;
      const response=await fetch(url,{signal:controller.signal,headers:{'Accept-Language':'es'}});
      if(!response.ok)throw new Error('El servicio de búsqueda no está disponible. Puedes mover el mapa manualmente.');
      const results=await response.json();
      if(!results.length)throw new Error('No se encontró la ubicación. Prueba con una ciudad o comuna cercana.');
      if(!controller.signal.aborted)setFlyTarget({lat:Number(results[0].lat),lng:Number(results[0].lon),zoom:14});
    } catch(e) {if(e.name!=='AbortError')setError(e.message||'Falló la búsqueda.');}
    finally {if(!controller.signal.aborted)setSearching(false);}
  }
  return <div className="field-map-component croplite-field-map">
    <div className="field-main-map">
      <MapContainer center={DEFAULT_CENTER} zoom={11} zoomControl={false} scrollWheelZoom style={{height:'100%',width:'100%',zIndex:0}}>
        {basemap==='satellite'
          ? <TileLayer key="satellite" url={ESRI_WORLD_IMAGERY} maxZoom={19} attribution={ESRI_CREDIT}/>
          : <TileLayer key="streets" url={OSM_URL} maxZoom={19} attribution='&copy; OpenStreetMap contributors'/>}
        <ZoomControl position="bottomleft"/>
        <MapFlyTo target={flyTarget}/>
        <MapFrame geometry={region?.geometry} allowFit={mode==='idle'}/>
        <MapClick drawing={mode==='draw'} onVertex={p=>setDraft(v=>v.length<40?[...v,p]:v)}/>
        {mode!=='draw'&&positions.length>=3&&<Polygon positions={positions} pathOptions={{color:'#FAF8F3',weight:3,fillColor:'#8FAA5A',fillOpacity:0.28}}/>}
        {mode==='draw'&&<><Polyline positions={positions} pathOptions={{color:'#ffe1a1',weight:3,dashArray:'8 6'}}/>{positions.map((p,i)=><CircleMarker key={i} center={p} radius={5} pathOptions={{color:'#fff',fillColor:'#e59e29',fillOpacity:1}}/>)}</>}
        {mode==='edit'&&vertices.map((p,i)=><Marker key={i} icon={vertexIcon} position={[p[1],p[0]]} draggable eventHandlers={{dragend:e=>updateVertex(i,e.target.getLatLng())}}/>)}
        <MapFocusButton region={region}/>
      </MapContainer>
      <div className="field-map-toolbar">
        <form className="field-location-search" onSubmit={searchLocation}>
          <Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar comuna, ciudad o localidad…" aria-label="Buscar ubicación"/>
          <button type="submit" disabled={searching||!query.trim()}>{searching?'Buscando…':'Buscar'}</button>
        </form>
        <div className="field-map-actions">
          <button type="button" className={mode==='draw'?'active':''} onClick={()=>{setMode('draw');setDraft([]);setError('');}}><Pencil size={15}/> {vertices.length?'Redibujar':'Dibujar campo'}</button>
          <button type="button" className={mode==='edit'?'active':''} disabled={!vertices.length} onClick={()=>{setMode(mode==='edit'?'idle':'edit');setError('');}}><Move size={15}/> {mode==='edit'?'Terminar':'Editar'}</button>
          <button type="button" disabled={!vertices.length} onClick={()=>{onRegionChange(null);setMode('idle');setDraft([]);setError('');}}><Trash2 size={15}/><span>Eliminar</span></button>
        </div>
      </div>
      <div className="croplite-map-switch" role="group" aria-label="Capa base del mapa">
        <button type="button" className={basemap==='satellite'?'active':''} aria-pressed={basemap==='satellite'} onClick={()=>setBasemap('satellite')}><Satellite size={15}/> Satélite</button>
        <button type="button" className={basemap==='streets'?'active':''} aria-pressed={basemap==='streets'} onClick={()=>setBasemap('streets')}><MapIcon size={15}/> Calles</button>
      </div>
      <div className="croplite-map-label"><Layers3 size={14}/>{basemap==='satellite'?'Imagen satelital real · mosaico de distintas fechas':'Mapa cartográfico de OpenStreetMap'}</div>
      {mode==='draw'&&<div className="field-draw-bar"><span>{draft.length} vértices · Haz clic en cada esquina del terreno</span><button type="button" disabled={draft.length<3} onClick={()=>commit(draft)}><Check size={16}/> Confirmar campo</button><button type="button" className="secondary" onClick={()=>{setMode('idle');setDraft([]);setError('');}}><X size={15}/> Cancelar</button></div>}
      {mode==='edit'&&<div className="field-map-help"><Move size={15}/> Arrastra los puntos verdes y luego selecciona «Terminar».</div>}
    </div>
    {error&&<p className="field-map-error" role="alert">{error}</p>}
    <div className="field-map-attribution"><MapPin size={14}/>{vertices.length?'Campo delimitado · revisa el perímetro antes de analizar.':'Sin campo · busca un lugar y dibuja un polígono de al menos 3 puntos.'}<span>La imagen de fondo no es un índice NDVI ni una observación en tiempo real.</span></div>
  </div>;
}
