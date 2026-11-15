import React from 'react';

// A visible fallback instead of a blank screen if a React render fails.
export default class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { failed: false, message: '' }; }
  static getDerivedStateFromError(error) { return { failed: true, message: String(error?.message || error) }; }
  componentDidCatch(error, info) { console.error('CropLite UI failure:', error, info); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div style={{ minHeight:'100vh',display:'grid',placeItems:'center',padding:30,background:'#FAF8F3',fontFamily:'DM Sans,system-ui' }}>
      <div style={{background:'#fff',border:'1px solid #E9EDE5',padding:34,borderRadius:18,maxWidth:560,boxShadow:'0 9px 28px #103D2811'}}><img src='/brand/croplite-symbol.svg' width='58' height='58' alt='' />
        <h1 style={{fontSize:25,color:'#103D28'}}>CropLite could not load this page.</h1>
        <p style={{color:'#25332B',lineHeight:1.6}}>Open developer tools (F12 → Console) for details. Make sure dependencies are installed with <code>npm install</code> in the frontend folder.</p>
        <pre style={{whiteSpace:'pre-wrap',fontSize:11,color:'#9b4c38',background:'#fdf4f0',padding:12,borderRadius:8}}>{this.state.message}</pre>
        <button onClick={() => window.location.reload()} style={{background:'#103D28',color:'#fff',border:0,borderRadius:8,padding:'12px 16px',cursor:'pointer'}}>Reload CropLite</button>
      </div>
    </div>;
  }
}
