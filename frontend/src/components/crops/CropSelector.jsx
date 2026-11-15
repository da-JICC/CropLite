import React from 'react';
import cropCatalog from '../../data/cropTemperatureCatalog.json';

export const CROPS = cropCatalog.crops;
export function getCropById(id) {return CROPS.find(crop => crop.id === id) ?? null;}

const temp = value => typeof value === 'number' ? `${Number(value.toFixed(1))} °C` : 'No validado';

/** Visual crop picker; never triggers environmental API calls. */
export function CropSelector({selectedId, onSelect}) {
  const crop = getCropById(selectedId);
  return <div className="crop-picker">
    <div className="crop-picker-heading">
      <div><span className="crop-picker-eyebrow">CULTIVO DE REFERENCIA</span><h3>¿Qué cultivo quieres observar?</h3></div>
      <span className="crop-count">{CROPS.length} disponibles</span>
    </div>
    <div className="crop-picker-grid" role="group" aria-label="Seleccionar cultivo">
      {CROPS.map(item => <button type="button" key={item.id}
        aria-pressed={item.id === selectedId}
        className={`crop-picker-card${item.id === selectedId ? ' selected' : ''}`}
        onClick={() => onSelect(item.id)}>
        <img src={item.image} alt={`Ilustración de ${item.name}`} loading="lazy"/>
        <span className="crop-picker-label">{item.name}</span>
        {item.id === selectedId && <span className="crop-picker-check" aria-hidden="true">✓</span>}
      </button>)}
    </div>
    {crop ? <div className="crop-picker-details" aria-live="polite">
      <div className="crop-picker-selected"><strong>{crop.name}</strong><small>{crop.scientificName}</small></div>
      <div className="crop-thermal-quick">
        <span><small>Base GDD</small><b>{temp(crop.thermal.gddBaseC)}</b></span>
        <span><small>Óptimo climático*</small><b>{crop.thermal.optimumClimateC.min}–{crop.thermal.optimumClimateC.max} °C</b></span>
      </div>
      <p>*Rango climático orientativo; no describe todas las fases del cultivo. Las referencias térmicas completas aparecen en Environment.</p>
    </div> : <p className="crop-picker-prompt">Selecciona un cultivo para ver sus referencias térmicas en la gráfica.</p>}
  </div>;
}
