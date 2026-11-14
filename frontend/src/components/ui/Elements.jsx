import React from 'react';
import { ArrowUpRight, ArrowRight, ShieldAlert, Info } from 'lucide-react';

export function MockFlag({ compact = false }) { return <span className={`mock-flag ${compact ? 'small' : ''}`}><span className="mock-dot" /> SIMULATED DATA</span>; }
export function SectionHeading({ overline, title, description, action }) { return <div className="section-heading"><div><div className="overline">{overline}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="heading-action">{action}</div>}</div>; }
export function Panel({ title, subtitle, action, children, className = '' }) { return <section className={`panel ${className}`}><div className="panel-head"><div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>{action}</div>{children}</section>; }
export function Bar({ value, color = '#3b936b', inverted = false }) { return <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.max(0,Math.min(100,value))}%`, background: color }} /></div>; }
export function Stat({ icon: Icon, label, value, unit, hint, tone = 'green', change }) { return <article className="stat-card"><div className="stat-top"><span className={`stat-icon ${tone}`}><Icon size={21} strokeWidth={1.85} /></span>{change && <span className="stat-change">{change}</span>}</div><div className="stat-label">{label}</div><div className="stat-value">{value}<small>{unit}</small></div><div className="stat-hint">{hint}</div></article>; }
export function SoftButton({ children, onClick, icon: Icon = ArrowRight, className = '' }) { return <button className={`soft-button ${className}`} type="button" onClick={onClick}>{children}<Icon size={15} /></button>; }
export function Disclaimer({ children }) { return <div className="disclaimer"><ShieldAlert size={16} /><span>{children || 'All farm readings, risk indicators and comparisons are illustrative. Confirm crop suitability and field decisions with a local agronomist.'}</span></div>; }
export function Explain({ children }) { return <span className="explain" title={children}><Info size={15} /></span>; }
export function Chip({ children, variant = 'neutral' }) { return <span className={`chip ${variant}`}>{children}</span>; }
