import React, {useEffect,useRef,useState} from 'react';
import {CircleMarker, MapContainer, Marker, Polygon, Polyline, TileLayer, useMap, useMapEvents} from 'react-leaflet';
import L from 'leaflet';
import {Check, LocateFixed, MapPin, Pencil, Search, Trash2, X, Move} from 'lucide-react';
import {buildRegion} from '../../utils/regionGeometry.js';

const DEFAULT_CENTER=[-33.0501,-71.4570];
const vertexIcon=L.divIcon({className:'field-vertex-icon', html:'<span aria-hidden="true"></span>', iconSize:[18,18], iconAnchor:[9,9]});
function MapFlyTo({target}) {
  const map=useMap();
  useEffect(()=>{if(target) map.flyTo([target.lat,target.lng],target.zoom||13,{duration:0.8});},[target,map]);
  return null;
}
function MapClick({drawing,onVertex}) {
  useMapEvents({click:e=>{if(drawing)onVertex([e.latlng.lng,e.latlng.lat]);}});
  return null;
}
export default function FieldSelectionMap({region,onRegionChange}) {
  const [mode,setMode]=useState('idle');
  const [draft,setDraft]=useState([]);
  const [error,setError]=useState('');
  const [query,setQuery]=useState('');
  const [searching,setSearching]=useState(false);
  const [flyTarget,setFlyTarget]=useState(null);
  const searchRef=useRef(null);
  useEffect(()=>()=>searchRef.current?.abort(),[]);
  const vertices=region?.geometry?.coordinates?.[0]?.slice(0,-1)||[];
  const current=(mode==='draw'?draft:vertices);
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
      if(!controller.signal.aborted)setFlyTarget({lat:Number(results[0].lat),lng:Number(results[0].lon),zoom:13});
    } catch(e) {if(e.name!=='AbortError')setError(e.message||'Falló la búsqueda.');}
    finally {if(!controller.signal.aborted)setSearching(false);}
  }
  return <div className="field-map-component">
    <div className="field-map-toolbar">
      <form className="field-location-search" onSubmit={searchLocation}>
        <Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Busca ciudad, comuna o localidad…" aria-label="Buscar ubicación"/>
        <button type="submit" disabled={searching||!query.trim()}>{searching?'Buscando…':'Buscar'}</button>
      </form>
      <div className="field-map-actions">
        <button type="button" className={mode==='draw'?'active':''} onClick={()=>{setMode('draw');setDraft([]);setError('');}}><Pencil size={16}/> {vertices.length?'Redibujar':'Dibujar campo'}</button>
        <button type="button" className={mode==='edit'?'active':''} disabled={!vertices.length} onClick={()=>{setMode(mode==='edit'?'idle':'edit');setError('');}}><Move size={16}/> {mode==='edit'?'Finalizar edición':'Editar'}</button>
        <button type="button" disabled={!vertices.length} onClick={()=>{onRegionChange(null);setMode('idle');setDraft([]);setError('');}}><Trash2 size={16}/> Eliminar</button>
      </div>
    </div>
    <div className="field-main-map">
      <MapContainer center={DEFAULT_CENTER} zoom={10} zoomControl scrollWheelZoom style={{height:'100%',width:'100%',zIndex:0}}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors'/>
        <MapFlyTo target={flyTarget}/>
        <MapClick drawing={mode==='draw'} onVertex={p=>setDraft(v=>v.length<40?[...v,p]:v)}/>
        {mode!=='draw'&&positions.length>=3&&<Polygon positions={positions} pathOptions={{color:'#147b5c',weight:3,fillColor:'#32bf89',fillOpacity:0.22}}/>}
        {mode==='draw'&&<><Polyline positions={positions} pathOptions={{color:'#e59e29',weight:3,dashArray:'8 6'}}/>{positions.map((p,i)=><CircleMarker key={i} center={p} radius={5} pathOptions={{color:'#fff',fillColor:'#e59e29',fillOpacity:1}}/>)}</>}
        {mode==='edit'&&vertices.map((p,i)=><Marker key={i} icon={vertexIcon} position={[p[1],p[0]]} draggable eventHandlers={{dragend:e=>updateVertex(i,e.target.getLatLng())}}/>)}
      </MapContainer>
      {mode==='draw'&&<div className="field-draw-bar"><span>{draft.length} vértices · Haz clic en las esquinas del terreno</span><button type="button" disabled={draft.length<3} onClick={()=>commit(draft)}><Check size={16}/> Confirmar polígono</button><button type="button" className="secondary" onClick={()=>{setMode('idle');setDraft([]);setError('');}}><X size={15}/> Cancelar</button></div>}
      {mode==='edit'&&<div className="field-map-help"><Move size={15}/> Arrastra los puntos verdes para ajustar el campo y luego selecciona «Finalizar edición».</div>}
    </div>
    {error&&<p className="field-map-error" role="alert">{error}</p>}
    <div className="field-map-attribution"><MapPin size={14}/>{vertices.length?'Polígono definido por el usuario; comprueba su perímetro antes de analizar.':'Sin campo seleccionado. Acércate y dibuja al menos tres esquinas.'}<span>Ubicaciones: © OpenStreetMap / Nominatim</span></div>
  </div>;
}
