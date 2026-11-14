import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Circle, CircleMarker, Popup, useMap } from 'react-leaflet';

function FlyToFarm({ farm }) {
  const map = useMap();
  useEffect(() => { map.setView([farm.lat, farm.lng], 10, { animate: true }); }, [map, farm.lat, farm.lng]);
  return null;
}

export default function FarmMap({ farm, height = 270, layer = 'moisture', onRegionClick, showTiles = false }) {
  if (!farm) return null;
  const color = layer === 'heat' ? '#de9350' : layer === 'vegetation' ? '#278457' : layer === 'rain' ? '#367db5' : '#398c78';
  return <div className="farm-map" style={{ height }}>
    <MapContainer key="shared-map" center={[farm.lat, farm.lng]} zoom={10} zoomControl={false} attributionControl={false} scrollWheelZoom={false} style={{ width:'100%', height:'100%', zIndex:0 }}>
      {showTiles && <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap contributors" />}
      <FlyToFarm farm={farm} />
      <Circle center={[farm.lat, farm.lng]} radius={3500} pathOptions={{ color, weight: 2, fillColor: color, fillOpacity: .16 }} eventHandlers={{ click: () => onRegionClick?.(farm.id) }}>
        <Popup>{farm.name} — {farm.hectares} ha (illustrative field vicinity)</Popup>
      </Circle>
      <CircleMarker center={[farm.lat, farm.lng]} radius={8} pathOptions={{ color:'#fff', weight: 3, fillColor:color, fillOpacity:1 }} eventHandlers={{ click: () => onRegionClick?.(farm.id) }} />
    </MapContainer>
    <span className="map-overlay-label">ILLUSTRATIVE FARM LOCATION</span>
    <span className="map-compass">N ↑</span>
    <div className="map-credit">Tile-free schematic background · overlay simulated</div>
  </div>;
}
