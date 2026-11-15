import React from 'react';

// A visible fallback instead of a blank screen if a React render fails.
export default class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { failed: false, message: '' }; }
  static getDerivedStateFromError(error) { return { failed: true, message: String(error?.message || error) }; }
  componentDidCatch(error, info) { console.error('CropLite UI failure:', error, info); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div style={{ minHeight:'100vh',display:'grid',placeItems:'center',padding:30,background:'#f2f8f3',fontFamily:'system-ui' }}>
      <div style={{background:'#fff',border:'1px solid #dce9e0',padding:34,borderRadius:14,maxWidth:560}}>
        <h1 style={{fontSize:25,color:'#1d5941'}}>CropLite could not render this screen.</h1>
        <p style={{color:'#5b766a',lineHeight:1.6}}>Open browser Developer Tools (F12 → Console) to see the underlying error. Make sure dependencies were installed with <code>npm install</code> from the frontend folder.</p>
        <pre style={{whiteSpace:'pre-wrap',fontSize:11,color:'#9b4c38',background:'#fdf4f0',padding:12,borderRadius:8}}>{this.state.message}</pre>
        <button onClick={() => window.location.reload()} style={{background:'#2f8f61',color:'#fff',border:0,borderRadius:8,padding:'12px 16px',cursor:'pointer'}}>Reload CropLite</button>
      </div>
    </div>;
  }
}
