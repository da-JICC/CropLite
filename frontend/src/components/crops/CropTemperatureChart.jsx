import React from 'react';
import {CartesianGrid, Legend, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';

const fmt = (value) => typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(1)} °C` : 'Sin datos';
function axisDomain(rows, crop) {
  const valid = rows.flatMap(row => [row.min_c, row.mean_c, row.max_c]).filter(value => typeof value === 'number' && Number.isFinite(value));
  if (!valid.length) return ['auto', 'auto'];
  const thermal = crop?.thermal;
  if (thermal) valid.push(thermal.optimumClimateC.min, thermal.optimumClimateC.max,
    thermal.gddBaseC, thermal.gddUpperC, thermal.heatReproductiveReferenceC, thermal.coldFloweringReferenceC);
  return [Math.floor(Math.min(...valid) - 2), Math.ceil(Math.max(...valid) + 2)];
}

function emphasisDot(valueKey, predicate, color) {
  return function Dot({cx, cy, payload}) {
    if (!Number.isFinite(cx) || !Number.isFinite(cy) ||
      typeof payload?.[valueKey] !== 'number' || !predicate(payload[valueKey])) return <g/>;
    return <circle cx={cx} cy={cy} r={5} fill={color} stroke="white" strokeWidth={1.5}/>;
  };
}

/** Shows only the climate observations and independently sourced crop reference lines.
 *  No suitability, damage prediction or derived climate exposure counts are calculated.
 */
export function CropTemperatureChart({rows, crop}) {
  const t = crop?.thermal;
  const overHeat = emphasisDot('max_c', x => t != null && x >= t.heatReproductiveReferenceC, '#d4634c');
  const underCold = emphasisDot('min_c', x => t != null && x <= t.coldFloweringReferenceC, '#547eb2');
  const outsideOptimum = emphasisDot('mean_c', x => t != null &&
    (x < t.optimumClimateC.min || x > t.optimumClimateC.max), '#ddaa3d');

  return <>
    <div className="field-chart crop-temperature-chart" role="img" aria-label="Gráfico de temperaturas diarias y referencias térmicas del cultivo seleccionado">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{top:14,right:18,bottom:6,left:-17}}>
          <CartesianGrid stroke="#e6eeea" vertical={false} strokeDasharray="3 5"/>
          <XAxis dataKey="date" minTickGap={42} tick={{fontSize:11,fill:'#739087'}}/>
          <YAxis domain={axisDomain(rows,crop)} tick={{fontSize:11,fill:'#739087'}} unit="°" width={43}/>
          <Tooltip labelFormatter={d=>`Fecha: ${d}`} formatter={(v,name)=>[fmt(v),name]}/>
          <Legend wrapperStyle={{fontSize:12}}/>
          {t && <>
            <ReferenceArea y1={t.optimumClimateC.min} y2={t.optimumClimateC.max} fill="#6aba83" fillOpacity={0.16} stroke="none"/>
            <ReferenceLine y={t.gddBaseC} stroke="#857bc3" strokeDasharray="3 6" strokeWidth={1.5}/>
            <ReferenceLine y={t.gddUpperC} stroke="#a98cc3" strokeDasharray="2 7" strokeWidth={1.5}/>
            <ReferenceLine y={t.coldFloweringReferenceC} stroke="#547eb2" strokeDasharray="6 5" strokeWidth={1.7}/>
            <ReferenceLine y={t.heatReproductiveReferenceC} stroke="#d4634c" strokeDasharray="6 5" strokeWidth={1.8}/>
          </>}
          <Line name="Mínima" dataKey="min_c" type="monotone" stroke="#3292b9" strokeWidth={2} connectNulls={false} dot={underCold}/>
          <Line name="Media" dataKey="mean_c" type="monotone" stroke="#288b6b" strokeWidth={2.6} connectNulls={false} dot={outsideOptimum}/>
          <Line name="Máxima" dataKey="max_c" type="monotone" stroke="#dc923f" strokeWidth={2} connectNulls={false} dot={overHeat}/>
        </LineChart>
      </ResponsiveContainer>
    </div>
    {t && <div className="crop-reference-legend" aria-label="Referencias del cultivo">
      <span><i className="optimum"/> Banda verde · óptimo climático orientativo: {t.optimumClimateC.min}–{t.optimumClimateC.max} °C</span>
      <span><i className="gdd"/> Morado · temperatura basal de desarrollo (GDD): {fmt(t.gddBaseC)}</span>
      <span><i className="gdd-upper"/> Lila · límite superior del cálculo GDD: {fmt(t.gddUpperC)}</span>
      <span><i className="cold"/> Azul · referencia de frío durante floración (no universal): {fmt(t.coldFloweringReferenceC)}</span>
      <span><i className="heat"/> Rojo · referencia de calor en etapa reproductiva: {fmt(t.heatReproductiveReferenceC)}</span>
    </div>}
    {t && <div className="crop-temperature-explanation">
      Los puntos resaltados señalan cruces con referencias: <b>media diaria</b> frente al óptimo climático,
      <b> máxima diaria</b> frente al calor reproductivo y <b>mínima diaria</b> frente al frío de floración (FAO).
      No demuestran daño: importan la etapa del cultivo, la variedad y la duración de exposición.
      El óptimo climático procede de rangos de referencia y no equivale necesariamente a un óptimo diario.
    </div>}
  </>;
}
