import React,{useState} from 'react';
import {CartesianGrid,ComposedChart,Line,Bar,ResponsiveContainer,Tooltip,XAxis,YAxis,ReferenceArea,ReferenceLine} from 'recharts';
import {CloudRain,Droplets,Sun,Wind,ThermometerSun,Waves,Download,AlertCircle,RefreshCcw,Gauge} from 'lucide-react';
import {STAGE_COLORS,YEAR_END} from '../phenology/phenologyEngine.mjs';

/** Seven environmental observation tabs. Crop-dependent indicators live below the chart. */
const OPTIONS=[
 {id:'temperature',label:'Temperatura',Icon:ThermometerSun,color:'#cf8350',desc:'Temperatura media, mínima y máxima diaria · NASA POWER'},
 {id:'humidity',label:'Humedad atmosférica',Icon:Droplets,color:'#3e8cb8',desc:'Humedad relativa diaria · NASA POWER'},
 {id:'precipitation',label:'Precipitación',Icon:CloudRain,color:'#4e98bf',desc:'Lluvia diaria, NASA POWER o GPM IMERG'},
 {id:'radiation',label:'Radiación solar',Icon:Sun,color:'#c99c44',desc:'Radiación solar diaria · NASA POWER'},
 {id:'wind',label:'Viento',Icon:Wind,color:'#76909a',desc:'Viento medio diario a 2 m · NASA POWER'},
 {id:'pressure',label:'Presión atmosférica',Icon:Gauge,color:'#8e73ab',desc:'Presión atmosférica superficial · NASA POWER'},
 {id:'soil_moisture',label:'Humedad del suelo',Icon:Waves,color:'#8575af',desc:'Humedad superficial y zona radicular · producto regional NASA POWER HY'},
];
const isNum=v=>typeof v==='number'&&Number.isFinite(v);
const fmt=(v,places=2)=>isNum(v)?v.toLocaleString('es-CL',{maximumFractionDigits:places}):'—';
function downloadDaily(dataset,region){
 if(!dataset?.daily?.length)return;
 const fields=['date','value','min_c','max_c','rootzone_moisture_m3_m3'];
 const quote=x=>`"${String(x??'').replaceAll('"','""')}"`;
 const metadata=[['variable',dataset.name],['source',dataset.source],['unit',dataset.unit],
 ['method',dataset.method],['limitations',dataset.limitations],
 ['latitude',region?.representative_point?.latitude],['longitude',region?.representative_point?.longitude],
 ['start','2025-01-01'],['end','2025-12-31']];
 const csv='\ufeff'+metadata.map(row=>row.map(quote).join(',')).join('\r\n')+'\r\n'+fields.join(',')+'\r\n'+
 dataset.daily.map(row=>fields.map(k=>quote(row[k])).join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download=`croplite-2025-${dataset.id}.csv`;a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function Plot({dataset,option,timeline}){
 const temperature=option.id==='temperature';
 const soil=option.id==='soil_moisture';
 const precipitation=option.id==='precipitation';
 const rows=dataset.daily??[];
 const min=Math.min(0,...rows.flatMap(r=>[r.value,r.min_c,r.max_c]).filter(isNum));
 const max=Math.max(1,...rows.flatMap(r=>[r.value,r.min_c,r.max_c]).filter(isNum));
 const domain=temperature?[Math.floor(min-2),Math.ceil(max+2)]:[0,'auto'];
 const visibleStages=(timeline?.stages??[]).filter(stage=>stage.start<=YEAR_END && stage.covered_2025_days>0);
 const tooltip=({active,payload,label})=>!active||!payload?.length?null:(()=>{
   const stage=visibleStages.find(s=>label>=s.start && label<=s.end);
   return <div className="terra-daily-tooltip"><strong>{label}</strong>
     {stage&&<div className="terra-chart-stage-tooltip"><i style={{background:STAGE_COLORS[stage.id]}}/>{stage.label} · escenario</div>}
     {payload.filter(p=>isNum(p.value)).map((p,i)=><div key={i}><span style={{color:p.color}}>{p.name}:</span> <b>{fmt(p.value,3)} {dataset.unit}</b></div>)}
   </div>;
 })();
 return <div className="terra-chart-surface terra-daily-chart" aria-label={`Serie diaria ${dataset.name}, año 2025, sin interpolación de días faltantes`}>
   <ResponsiveContainer width="100%" height="100%"><ComposedChart data={rows} margin={{top:20,right:28,bottom:10,left:2}}>
   <CartesianGrid vertical={false} stroke="#e5eee8" strokeDasharray="4 5"/>
   <XAxis dataKey="date" minTickGap={30} tick={{fontSize:10,fill:'#6b8174'}} tickFormatter={v=>v.slice(5)}/>
   <YAxis width={61} domain={domain} tick={{fontSize:11,fill:'#6b8174'}} tickFormatter={v=>fmt(v,2)}/>
   <Tooltip content={tooltip}/>
   {visibleStages.map((stage,i)=><ReferenceArea key={stage.id} x1={stage.start} x2={stage.end>YEAR_END?YEAR_END:stage.end} yAxisId={0}
     strokeOpacity={0} fill={STAGE_COLORS[stage.id]} fillOpacity={0.19} ifOverflow="hidden"
     label={stage.covered_2025_days>=10?{value:`${i+1}. ${stage.label.split(' / ')[0]}`,position:'insideTop',fontSize:10,fill:'#39564a'}:undefined}/>)}
   {timeline?.sow_date&&<ReferenceLine x={timeline.sow_date} stroke="#29855e" strokeWidth={1.5} strokeDasharray="4 3" ifOverflow="hidden"/>}
   {temperature&&<>
      <Line name="Mínima diaria" dataKey="min_c" type="linear" stroke="#3b83b4" dot={false} strokeWidth={1.5} connectNulls={false} isAnimationActive={false}/>
      <Line name="Máxima diaria" dataKey="max_c" type="linear" stroke="#d39b43" dot={false} strokeWidth={1.5} connectNulls={false} isAnimationActive={false}/>
   </>}
   {soil&&<Line name="Zona radicular" dataKey="rootzone_moisture_m3_m3" stroke="#a06bb9" dot={false} strokeWidth={1.6} connectNulls={false} isAnimationActive={false}/>}
   {precipitation?<Bar name={dataset.name} dataKey="value" fill={option.color} maxBarSize={6} isAnimationActive={false}/>:
    <Line name={temperature?'Temperatura media':soil?'Humedad superficial':dataset.name} dataKey="value" type="linear" stroke={option.color} strokeWidth={2} dot={false} activeDot={{r:4}} connectNulls={false} isAnimationActive={false}/>}
   </ComposedChart></ResponsiveContainer>
 </div>;
}
export function Daily2025Explorer({region,analysis,loading,onRetry,timeline}){
 const [activeId,setActive]=useState('temperature');
 const [rainSource,setRainSource]=useState('power');
 const option=OPTIONS.find(o=>o.id===activeId)||OPTIONS[0];
 const dataset=activeId==='precipitation'?(rainSource==='gpm'?analysis?.datasets?.precipitation:analysis?.datasets?.precipitation_power):analysis?.datasets?.[activeId];
 const count=dataset?.coverage?.valid_days??0;
 return <>
 <nav className="terra-parameter-tabs" aria-label="Variables ambientales diarias" role="tablist">
  {OPTIONS.map(o=><button key={o.id} type="button" role="tab" aria-selected={activeId===o.id} className={activeId===o.id?'selected':''} onClick={()=>setActive(o.id)}><o.Icon size={17}/><span>{o.label}</span></button>)}
 </nav>
 {!region&&<div className="terra-empty-analysis"><AlertCircle size={23}/><strong>Selecciona una región en el mapa</strong><span>Verás sus variables ambientales diarias de 2025, sin inventar datos faltantes.</span></div>}
 {region&&loading&&<div className="terra-empty-analysis" role="status"><span className="terra-loader"/><strong>Consultando 2025</strong><span>Las fuentes ambientales se recuperan una vez por región. Mover la siembra no genera consultas nuevas.</span></div>}
 {region&&!loading&&!analysis&&<div className="terra-empty-analysis"><AlertCircle size={22}/><strong>No se pudo recuperar el análisis</strong><button onClick={onRetry} type="button"><RefreshCcw size={14}/> Reintentar</button></div>}
 {analysis&&<section className="terra-variable-panel">
  <header className="terra-variable-heading"><div><span className="overline">ANÁLISIS AMBIENTAL / 2025</span><h3>{option.label}</h3><p>{option.desc}</p></div><span className="terra-period-tag">01 ENE — 31 DIC 2025</span></header>
  {activeId==='precipitation'&&<div className="terra-rain-source-switch"><span>Fuente de lluvia:</span><button type="button" className={rainSource==='power'?'selected':''} onClick={()=>setRainSource('power')}>POWER · LST</button><button type="button" className={rainSource==='gpm'?'selected':''} onClick={()=>setRainSource('gpm')}>GPM · UTC</button></div>}
  <div className="terra-source-strip"><span className={`terra-data-dot ${count?'':'missing'}`}/><b>{dataset?.source||'Fuente no disponible'}</b><span>{count}/365 días con datos · {dataset?.unit||'—'}</span></div>
  {!dataset||!count?<div className="terra-empty-analysis"><AlertCircle size={22}/><strong>Sin observaciones disponibles para esta variable</strong><span>{dataset?.metadata?.error||'No existe una serie válida para el terreno seleccionado.'}</span></div>:<>
    <Plot dataset={dataset} option={option} timeline={timeline}/>
    <div className="terra-chart-caption"><span>Gráfico fijo del 1 de enero al 31 de diciembre de 2025. Las franjas muestran etapas fenológicas estimadas; los días sin datos siguen vacíos. Ajusta la siembra debajo del gráfico.</span><button type="button" onClick={()=>downloadDaily(dataset,analysis.region)}><Download size={14}/> CSV diario</button></div>
  </>}
  <div className="terra-variable-notes"><p><b>Método:</b> {dataset?.method||'—'} · <b>Unidad:</b> {dataset?.unit||'—'}.</p><p><b>Limitación:</b> {dataset?.limitations||dataset?.resolution_note||'—'}</p></div>
 </section>}
 </>;
}
