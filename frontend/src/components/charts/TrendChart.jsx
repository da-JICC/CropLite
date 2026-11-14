import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
const specs = {
  moisture: { label: 'Soil moisture', suffix: '%', color: '#298b64', domain: [0, 70] },
  rain: { label: 'Rainfall', suffix: ' mm', color: '#3685b2', domain: [0, 'auto'] },
  temp: { label: 'Air temperature', suffix: '°C', color: '#d9903e', domain: [0, 35] },
  ndvi: { label: 'Vegetation health (NDVI)', suffix: '', color: '#7aa649', domain: [0, 1] },
  et: { label: 'Evapotranspiration', suffix: ' mm/day', color: '#528fa8', domain: [0, 8] }
};

export function TrendChart({ data, metric = 'moisture', height = 238, compare = false }) {
  const s = specs[metric] || specs.moisture;
  if (!data?.length) return <div className="chart-empty">No simulated values available.</div>;
  return <div style={{ width: '100%', height }}>
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 18, right: 7, left: -26, bottom: 0 }}>
        <defs><linearGradient id={`fill-${metric}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={s.color} stopOpacity={0.18} /><stop offset="100%" stopColor={s.color} stopOpacity={0.012} /></linearGradient></defs>
        <CartesianGrid vertical={false} stroke="#e9eeeb" strokeDasharray="3 5" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#81908d', fontSize: 11 }} dy={9} />
        <YAxis tickLine={false} axisLine={false} tick={{ fill: '#81908d', fontSize: 11 }} domain={s.domain} />
        <Tooltip contentStyle={{ borderRadius: 13, border: '1px solid #e4ece7', boxShadow: '0 12px 35px #0b28271a' }} formatter={(v) => [`${v}${s.suffix}`, s.label]} />
        <Area type="monotone" dataKey={metric} stroke={s.color} strokeWidth={3} fill={`url(#fill-${metric})`} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
      </AreaChart>
    </ResponsiveContainer>
  </div>;
}

export function ProjectionChart({ values, height = 230 }) {
  return <div style={{ width: '100%', height }}><ResponsiveContainer width="100%" height="100%"><LineChart data={values} margin={{ top: 16, right: 18, left: -24, bottom: 0 }}>
    <CartesianGrid vertical={false} stroke="#ebefec" strokeDasharray="3 5" />
    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#82908b' }} />
    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#82908b' }} domain={[0, 65]} />
    <Tooltip formatter={(v, n) => [`${v}%`, n === 'baseline' ? 'Reference scenario' : 'Dry scenario']} contentStyle={{ borderRadius: 12, border: '1px solid #e4ece7' }} />
    <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 11 }} />
    <Line dataKey="baseline" name="Reference scenario" stroke="#35976b" strokeWidth={3} dot={{r:3}} />
    <Line dataKey="dry" name="Dry scenario" stroke="#dca65d" strokeWidth={2} strokeDasharray="6 4" dot={false} />
  </LineChart></ResponsiveContainer></div>;
}
