import React, {useEffect,useRef,useState} from 'react';
import {CheckCircle2, CloudOff, Leaf, Menu, Satellite, X} from 'lucide-react';
import Sidebar, {NAV} from './components/layout/Sidebar.jsx';
import {MyFarm} from './pages/MyFarm.jsx';
import {Environment} from './pages/Environment.jsx';
import {analyzeSelectedRegion,getBackendStatus} from './services/regionAnalysisService.js';

const formatDate=d=>d.toISOString().slice(0,10);
const daysAgo=n=>{const d=new Date();d.setUTCDate(d.getUTCDate()-n);return formatDate(d);};
const TODAY=daysAgo(0);

export default function App() {
  const [active,setActive]=useState('overview');
  const [mobileOpen,setMobileOpen]=useState(false);
  const [region,setRegion]=useState(null);
  const [start,setStart]=useState(daysAgo(97));
  const [end,setEnd]=useState(daysAgo(7));
  const [interval,setInterval]=useState('P10D');
  const [heatThreshold,setHeatThreshold]=useState('35');
  const [coldThreshold,setColdThreshold]=useState('0');
  const [analysis,setAnalysis]=useState(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [backend,setBackend]=useState(null);
  const activeRequest=useRef(null);
  const queryRevision=useRef(0);

  useEffect(()=>{
    const controller=new AbortController();
    getBackendStatus(controller.signal).then(setBackend).catch(()=>setBackend(null));
    return()=>{controller.abort();activeRequest.current?.abort();};
  },[]);
  function invalidate() {
    queryRevision.current+=1;
    activeRequest.current?.abort();
    activeRequest.current=null;
    setAnalysis(null);setLoading(false);setError('');
  }
  function changeRegion(next){invalidate();setRegion(next);}
  function changeDate(which,value){invalidate();(which==='start'?setStart:setEnd)(value);}
  function changeOption(which,value){invalidate();({interval:setInterval,heatThreshold:setHeatThreshold,coldThreshold:setColdThreshold})[which](value);}
  function navigate(id){setActive(id==='environment'?'environment':'overview');window.scrollTo({top:0,behavior:'smooth'});}
  const rangeError=!start||!end||start>end?'Selecciona un rango de fechas válido.':
    start<'2017-01-01'?'El prototipo utiliza observaciones Sentinel-2 L2A desde 2017.':
    end>TODAY?'No se pueden consultar fechas futuras.':
    (Date.parse(end)-Date.parse(start))/86400000>366?'Consulta un máximo de un año por análisis.':'';
  const thresholdsOk=heatThreshold.trim()!==''&&coldThreshold.trim()!==''&&Number.isFinite(Number(heatThreshold))&&Number.isFinite(Number(coldThreshold))&&Number(heatThreshold)>=-20&&Number(heatThreshold)<=70&&Number(coldThreshold)>=-70&&Number(coldThreshold)<=50;
  const canAnalyze=!!region&&!rangeError&&thresholdsOk&&!loading;
  async function analyze(){
    if(!canAnalyze)return;
    activeRequest.current?.abort();
    const controller=new AbortController();activeRequest.current=controller;
    const requestRevision=++queryRevision.current;
    setLoading(true);setAnalysis(null);setError('');
    try {
      const data=await analyzeSelectedRegion({geometry:region.geometry,start,end,interval,
        heatThreshold:Number(heatThreshold),coldThreshold:Number(coldThreshold)},controller.signal);
      if(!controller.signal.aborted&&queryRevision.current===requestRevision) {
        setAnalysis(data);
        setBackend(prev=>prev?{...prev}:prev);
      }
    }catch(e){
      if(!controller.signal.aborted&&queryRevision.current===requestRevision) {
        setError(e instanceof TypeError?'No se pudo conectar con FastAPI. Inicia el backend en el puerto 8000.':e.message);
      }
    }finally{if(!controller.signal.aborted&&queryRevision.current===requestRevision)setLoading(false);}
  }
  const common={region,start,end,interval,heatThreshold,coldThreshold,analysis,loading,error,backend,navigate};
  return <div className="app-shell">
    <Sidebar active={active} setActive={navigate} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen}/>
    <div className="app-main">
      <header className="topbar">
        <div className="topbar-left"><button onClick={()=>setMobileOpen(true)} className="menu-toggle" aria-label="Abrir menú"><Menu size={21}/></button><span className="breadcrumb">TERRAAI</span><span className="breadcrumb-sep">/</span><strong>{NAV.find(n=>n.id===active)?.label}</strong></div>
        <div className="topbar-right"><span className={`mode-pill ${backend?'':'offline'}`}><span/>{backend?'BACKEND CONNECTED':'BACKEND OFFLINE'}</span><div className="top-avatar"><Leaf size={17}/></div></div>
      </header>
      <main className="page-body">
        {active==='environment'?
          <Environment {...common}/>:
          <MyFarm {...common} onRegionChange={changeRegion} onDateChange={changeDate} onOptionChange={changeOption} onAnalyze={analyze} canAnalyze={canAnalyze} rangeError={rangeError} thresholdsOk={thresholdsOk} maxDate={TODAY}/>}
      </main>
      <footer className="app-footer"><span>© TerraAI · NASA Space Apps Challenge 2026</span><span>Copernicus Sentinel-2 NDVI · NASA POWER regional air-temperature estimates · Measurements are not forecasts.</span></footer>
    </div>
  </div>;
}
