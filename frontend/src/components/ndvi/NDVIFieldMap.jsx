import React, {useEffect, useState} from 'react';
import {CircleMarker, MapContainer, Polygon, Polyline, TileLayer, useMap, useMapEvents} from 'react-leaflet';
import {MapPin, Pencil, Check, RotateCcw} from 'lucide-react';

// A small, illustrative sample polygon. This is NOT a verified field boundary.
export function sampleBoundary(farm) {
  const dLat = 0.0011;
  const dLng = 0.0015;
  return [
    [farm.lng - dLng, farm.lat - dLat],
    [farm.lng + dLng, farm.lat - dLat],
    [farm.lng + dLng, farm.lat + dLat],
    [farm.lng - dLng, farm.lat + dLat],
  ];
}

function MapCenter({farm}) {
  const map = useMap();
  useEffect(() => { map.setView([farm.lat, farm.lng], 15); }, [farm.lat, farm.lng, map]);
  return null;
}

function ClickVertices({drawing, addVertex}) {
  useMapEvents({click: e => {if(drawing) addVertex([e.latlng.lng, e.latlng.lat]);}});
  return null;
}

export default function NDVIFieldMap({farm, polygon, onChange}) {
  const [drawing, setDrawing] = useState(false);
  const [draft, setDraft] = useState([]);
  useEffect(() => {setDrawing(false);setDraft([]);}, [farm.id]);
  function start() {setDraft([]);setDrawing(true);}
  function finish() {if (draft.length < 3) return; onChange(draft);setDrawing(false);setDraft([]);}
  function reset() {setDrawing(false);setDraft([]);onChange(sampleBoundary(farm));}
  const ring = (drawing ? draft : polygon).map(([lng,lat])=>[lat,lng]);
  return <div className="ndvi-map-wrap">
    <div className="ndvi-map-actions">
      <button type="button" onClick={start} className="ndvi-map-btn" disabled={drawing}><Pencil size={14}/> Draw field</button>
      {drawing && <button type="button" onClick={finish} className="ndvi-map-btn primary" disabled={draft.length<3}><Check size={14}/> Finish ({draft.length})</button>}
      <button type="button" onClick={reset} className="ndvi-map-btn"><RotateCcw size={14}/> Sample area</button>
    </div>
    <div className="ndvi-map-canvas">
      <MapContainer center={[farm.lat, farm.lng]} zoom={15} zoomControl={true} scrollWheelZoom={false} style={{width:'100%',height:'100%',zIndex:0}}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
        <MapCenter farm={farm}/>
        <ClickVertices drawing={drawing} addVertex={p=>setDraft(v=>[...v,p])}/>
        {!drawing && ring.length >= 3 && <Polygon positions={ring} pathOptions={{color:'#177b5a',weight:3,fillColor:'#31ba7f',fillOpacity:.21}}/>}
        {drawing && <><Polyline positions={ring} pathOptions={{color:'#e5a02b',weight:3,dashArray:'7 5'}}/>{ring.map((pos,i)=><CircleMarker key={i} center={pos} radius={5} pathOptions={{color:'#fff',fillColor:'#e5a02b',fillOpacity:1}}/>)}</>}
      </MapContainer>
    </div>
    <div className="ndvi-map-note"><MapPin size={14}/>{drawing ? 'Click at least three corners, then Finish.' : 'Boundary is illustrative until you draw the actual field.'}</div>
  </div>;
}
