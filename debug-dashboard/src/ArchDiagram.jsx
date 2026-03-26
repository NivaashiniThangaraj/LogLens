import { useState } from "react";

const FONT = "'JetBrains Mono', monospace";

const C = {
  bg:      "#020b18",
  panel:   "#0d1b2a",
  border:  "#1e3a5f",
  fatal:   "#ef4444",
  error:   "#f97316",
  sva:     "#38bdf8",
  accent:  "#facc15",
  green:   "#22c55e",
  purple:  "#a78bfa",
  dim:     "#475569",
  text:    "#e2e8f0",
  subtext: "#64748b",
};

const NODES = {
  user:       { x: 60,   y: 260, w: 110, h: 52, color: C.sva,    label: "👤 Engineer",      sub: "uploads .log",     group: "user"     },
  upload:     { x: 240,  y: 100, w: 130, h: 52, color: C.accent, label: "📤 Upload Zone",   sub: "drag & drop",      group: "frontend" },
  home:       { x: 240,  y: 190, w: 130, h: 52, color: C.sva,    label: "🏠 Home Page",     sub: "overview + nav",   group: "frontend" },
  charts:     { x: 240,  y: 280, w: 130, h: 52, color: C.sva,    label: "📊 Analytics",     sub: "bar + pie charts", group: "frontend" },
  table:      { x: 240,  y: 370, w: 130, h: 52, color: C.sva,    label: "📋 Issue Log",     sub: "sort + filter",    group: "frontend" },
  rcie_page:  { x: 240,  y: 460, w: 130, h: 52, color: C.purple, label: "🧠 Root Cause",    sub: "RCIE page",        group: "frontend" },
  axios:      { x: 445,  y: 175, w: 120, h: 52, color: C.accent, label: "⚡ Axios",         sub: "POST /analyze",    group: "network"  },
  state:      { x: 445,  y: 280, w: 120, h: 52, color: C.accent, label: "🔄 React State",   sub: "useState hooks",   group: "state"    },
  fastapi:    { x: 640,  y: 175, w: 130, h: 52, color: C.green,  label: "🚀 FastAPI",       sub: "localhost:8000",   group: "backend"  },
  parser:     { x: 640,  y: 280, w: 130, h: 52, color: C.green,  label: "🔍 Log Parser",    sub: "regex engine",     group: "backend"  },
  cluster:    { x: 640,  y: 370, w: 130, h: 52, color: C.green,  label: "🗂 Clusterer",     sub: "signature groups", group: "backend"  },
  rcie:       { x: 445,  y: 390, w: 120, h: 52, color: C.purple, label: "🤖 RCIE Engine",   sub: "confidence algo",  group: "rcie"     },
  meta:       { x: 445,  y: 480, w: 120, h: 52, color: C.purple, label: "📐 Meta Extract",  sub: "file·line·module", group: "rcie"     },
  recharts:   { x: 60,   y: 430, w: 120, h: 52, color: C.error,  label: "📈 Recharts",      sub: "BarChart · Pie",   group: "lib"      },
  sidebar:    { x: 60,   y: 100, w: 120, h: 52, color: C.dim,    label: "🗂 Sidebar Nav",   sub: "4-page router",    group: "frontend" },
};

const EDGES = [
  { from: "user",     to: "upload",    label: "uploads .log",  color: C.sva    },
  { from: "sidebar",  to: "home",      label: "navigate",      color: C.dim    },
  { from: "sidebar",  to: "charts",    label: "navigate",      color: C.dim    },
  { from: "sidebar",  to: "table",     label: "navigate",      color: C.dim    },
  { from: "sidebar",  to: "rcie_page", label: "navigate",      color: C.dim    },
  { from: "upload",   to: "axios",     label: "FormData",      color: C.accent },
  { from: "axios",    to: "fastapi",   label: "POST .log",     color: C.green  },
  { from: "fastapi",  to: "parser",    label: "raw bytes",     color: C.green  },
  { from: "parser",   to: "cluster",   label: "error lines",   color: C.green  },
  { from: "cluster",  to: "axios",     label: "JSON response", color: C.accent },
  { from: "axios",    to: "state",     label: "setResult()",   color: C.accent },
  { from: "state",    to: "home",      label: "result",        color: C.sva    },
  { from: "state",    to: "charts",    label: "result",        color: C.sva    },
  { from: "state",    to: "table",     label: "result",        color: C.sva    },
  { from: "state",    to: "rcie",      label: "data[]",        color: C.purple },
  { from: "rcie",     to: "meta",      label: "regex parse",   color: C.purple },
  { from: "rcie",     to: "rcie_page", label: "rcieData[]",    color: C.purple },
  { from: "charts",   to: "recharts",  label: "props",         color: C.error  },
];

const GROUPS = [
  { id: "user",     x: 32,  y: 230, w: 168, h: 110, color: C.sva,    label: "USER" },
  { id: "frontend", x: 32,  y: 68,  w: 168, h: 110, color: C.dim,    label: "NAVIGATION" },
  { id: "fe2",      x: 210, y: 68,  w: 185, h: 470, color: C.sva,    label: "FRONTEND · React" },
  { id: "net",      x: 415, y: 145, w: 175, h: 210, color: C.accent, label: "NETWORK + STATE" },
  { id: "rcie",     x: 415, y: 360, w: 175, h: 195, color: C.purple, label: "RCIE ENGINE" },
  { id: "backend",  x: 610, y: 145, w: 185, h: 260, color: C.green,  label: "BACKEND · FastAPI" },
  { id: "lib",      x: 32,  y: 398, w: 168, h: 110, color: C.error,  label: "LIBRARIES" },
];

function center(n) {
  return { x: n.x + n.w / 2, y: n.y + n.h / 2 };
}

function edgePath(a, b) {
  const ca = center(a), cb = center(b);
  const dx = cb.x - ca.x, dy = cb.y - ca.y;
  const cx1 = ca.x + dx * 0.55, cy1 = ca.y;
  const cx2 = cb.x - dx * 0.55, cy2 = cb.y;
  return `M ${ca.x} ${ca.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${cb.x} ${cb.y}`;
}

const W = 820, H = 580;

export default function ArchDiagram() {
  const [hovered, setHovered] = useState(null);
  const [active,  setActive]  = useState(null);
  const sel  = active || hovered;
  const node = sel ? NODES[sel] : null;

  const connectedIds = sel
    ? new Set([sel, ...EDGES.filter(e => e.from === sel || e.to === sel).flatMap(e => [e.from, e.to])])
    : null;

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: FONT, padding: "20px", color: C.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap');
        * { box-sizing: border-box; }
        @keyframes dash { to { stroke-dashoffset: -24; } }
        @keyframes popIn { from { opacity:0; transform:scale(0.94) translateY(6px);} to { opacity:1; transform:scale(1) translateY(0);} }
        .flow { stroke-dasharray: 8 4; animation: dash 1.4s linear infinite; }
        .flow-slow { stroke-dasharray: 8 4; animation: dash 2.2s linear infinite; }
        .node-g { cursor: pointer; }
        .pop { animation: popIn 0.25s ease both; }
      `}</style>

      {/* Title */}
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
        <div style={{ width:30, height:30, background:"#ef444420", border:"1px solid #ef444455", borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>⚙</div>
        <div>
          <h1 style={{ margin:0, fontSize:15, fontWeight:700, letterSpacing:"0.06em" }}>SYSTEM ARCHITECTURE DIAGRAM</h1>
          <p style={{ margin:0, fontSize:10, color:C.subtext }}>AI Debug Prioritization Tool · v3.0.0 · hover or click any node</p>
        </div>
      </div>

      <div style={{ display:"flex", gap:16, alignItems:"flex-start" }}>

        {/* SVG */}
        <div style={{ flex:1, background:C.panel, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden" }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display:"block" }}>
            <defs>
              {[C.sva, C.accent, C.green, C.purple, C.error, C.dim, C.fatal].map(col => (
                <marker key={col} id={`a${col.replace("#","")}`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                  <path d="M0,0 L7,3.5 L0,7 Z" fill={col} opacity="0.85" />
                </marker>
              ))}
              <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="10" cy="10" r="0.7" fill={C.border} opacity="0.4" />
              </pattern>
            </defs>

            {/* Dot grid */}
            <rect width={W} height={H} fill="url(#dots)" />

            {/* Group lanes */}
            {GROUPS.map(g => (
              <g key={g.id}>
                <rect x={g.x} y={g.y} width={g.w} height={g.h} rx="10"
                  fill={`${g.color}07`} stroke={`${g.color}20`} strokeWidth="1" strokeDasharray="5 3" />
                <rect x={g.x} y={g.y} width={g.w} height={14} rx="10" fill={`${g.color}18`} />
                <rect x={g.x} y={g.y+4} width={g.w} height={10} fill={`${g.color}18`} />
                <text x={g.x+10} y={g.y+11} fontSize="7.5" fill={`${g.color}cc`}
                  fontFamily={FONT} fontWeight="700" letterSpacing="0.14em">{g.label}</text>
              </g>
            ))}

            {/* Edges */}
            {EDGES.map((e, i) => {
              const a = NODES[e.from], b = NODES[e.to];
              if (!a || !b) return null;
              const isConn = connectedIds ? (connectedIds.has(e.from) && connectedIds.has(e.to)) : false;
              const dimmed = sel && !isConn;
              const ca = center(a), cb = center(b);
              const mid = { x: (ca.x+cb.x)/2, y: (ca.y+cb.y)/2 };
              const isSlow = e.color === C.dim;
              return (
                <g key={i} opacity={dimmed ? 0.07 : isConn ? 1 : 0.45}>
                  <path d={edgePath(a, b)} fill="none" stroke={e.color}
                    strokeWidth={isConn ? 2.2 : 1.4}
                    markerEnd={`url(#a${e.color.replace("#","")})`}
                    className={isSlow ? "flow-slow" : "flow"} />
                  {isConn && (
                    <g>
                      <rect x={mid.x - 28} y={mid.y - 9} width={56} height={14} rx="3"
                        fill="#0a1628" stroke={`${e.color}55`} strokeWidth="1" />
                      <text x={mid.x} y={mid.y+1.5} fontSize="7.5" fill={e.color}
                        fontFamily={FONT} textAnchor="middle">{e.label}</text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {Object.entries(NODES).map(([id, n]) => {
              const isActive  = sel === id;
              const isDimmed  = sel && !connectedIds?.has(id);
              return (
                <g key={id} className="node-g"
                  opacity={isDimmed ? 0.15 : 1}
                  onMouseEnter={() => setHovered(id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => setActive(active === id ? null : id)}
                >
                  {isActive && (
                    <rect x={n.x-4} y={n.y-4} width={n.w+8} height={n.h+8} rx="12"
                      fill="none" stroke={n.color} strokeWidth="1.5" opacity="0.5"
                      strokeDasharray="4 2" />
                  )}
                  {/* Shadow */}
                  <rect x={n.x+2} y={n.y+3} width={n.w} height={n.h} rx="8"
                    fill={`${n.color}0a`} />
                  {/* Main box */}
                  <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="8"
                    fill={isActive ? `${n.color}20` : `${n.color}10`}
                    stroke={isActive ? n.color : `${n.color}50`}
                    strokeWidth={isActive ? 1.8 : 1} />
                  {/* Left accent bar */}
                  <rect x={n.x} y={n.y+8} width="3" height={n.h-16} rx="1.5"
                    fill={n.color} opacity={isActive ? 1 : 0.5} />
                  {/* Bottom glow bar */}
                  <rect x={n.x+12} y={n.y+n.h-2.5} width={n.w-24} height="2" rx="1"
                    fill={n.color} opacity={isActive ? 0.9 : 0.3} />
                  {/* Label */}
                  <text x={n.x+n.w/2+2} y={n.y+20} fontSize="10.5"
                    fill={isActive ? "#f8fafc" : C.text}
                    fontFamily={FONT} fontWeight="700" textAnchor="middle">
                    {n.label}
                  </text>
                  {/* Sub */}
                  <text x={n.x+n.w/2+2} y={n.y+35} fontSize="8.5"
                    fill={isActive ? n.color : C.subtext}
                    fontFamily={FONT} textAnchor="middle">
                    {n.sub}
                  </text>
                  {/* Pulse dot when active */}
                  {isActive && (
                    <circle cx={n.x+n.w-9} cy={n.y+10} r="3.5" fill={n.color}>
                      <animate attributeName="r"       values="2.5;5;2.5" dur="1.4s" repeatCount="indefinite"/>
                      <animate attributeName="opacity" values="1;0.3;1"   dur="1.4s" repeatCount="indefinite"/>
                    </circle>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Side Panel */}
        <div style={{ width:210, flexShrink:0, display:"flex", flexDirection:"column", gap:12 }}>

          {/* Node Inspector */}
          <div style={{
            background: C.panel,
            border: `1px solid ${node ? node.color+"55" : C.border}`,
            borderRadius:10, padding:"14px", minHeight:180,
            transition:"border-color 0.2s",
          }}>
            {node ? (
              <div className="pop" key={sel}>
                <p style={{ margin:"0 0 2px", color:C.dim, fontSize:8, textTransform:"uppercase", letterSpacing:"0.12em" }}>SELECTED NODE</p>
                <div style={{ display:"flex", alignItems:"center", gap:8, margin:"8px 0 10px" }}>
                  <div style={{ width:28, height:28, borderRadius:6, background:`${node.color}18`,
                    border:`1px solid ${node.color}44`, display:"flex", alignItems:"center",
                    justifyContent:"center", fontSize:14 }}>{node.label.split(" ")[0]}</div>
                  <div>
                    <p style={{ margin:0, color:"#f1f5f9", fontSize:11, fontWeight:700, lineHeight:1.3 }}>
                      {node.label.slice(3)}
                    </p>
                    <p style={{ margin:0, color:node.color, fontSize:9 }}>{node.sub}</p>
                  </div>
                </div>
                <div style={{ padding:"6px 9px", borderRadius:5, background:`${node.color}0e`,
                  border:`1px solid ${node.color}22`, marginBottom:10 }}>
                  <span style={{ color:C.dim, fontSize:8, textTransform:"uppercase", letterSpacing:"0.1em" }}>Layer: </span>
                  <span style={{ color:node.color, fontSize:9, fontWeight:700 }}>{node.group.toUpperCase()}</span>
                </div>
                <p style={{ margin:"0 0 6px", color:C.dim, fontSize:8, textTransform:"uppercase", letterSpacing:"0.1em" }}>EDGES</p>
                <div style={{ maxHeight:140, overflowY:"auto" }}>
                  {EDGES.filter(e => e.from===sel||e.to===sel).map((e,i)=>(
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:5, marginBottom:4 }}>
                      <div style={{ width:5, height:5, borderRadius:"50%", background:e.color, flexShrink:0 }}/>
                      <span style={{ color:C.subtext, fontSize:8.5, flex:1 }}>
                        {e.from===sel ? `→ ${e.to}` : `← ${e.from}`}
                      </span>
                      <span style={{ color:e.color, fontSize:7.5 }}>{e.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
                justifyContent:"center", height:160, gap:6 }}>
                <div style={{ fontSize:30, opacity:0.2 }}>◈</div>
                <p style={{ margin:0, color:C.dim, fontSize:11 }}>Click any node</p>
                <p style={{ margin:0, color:C.subtext, fontSize:9 }}>to inspect connections</p>
              </div>
            )}
          </div>

          {/* Legend */}
          <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px" }}>
            <p style={{ margin:"0 0 9px", color:C.dim, fontSize:8, textTransform:"uppercase", letterSpacing:"0.12em" }}>LAYER LEGEND</p>
            {[
              [C.sva,    "Frontend · React"],
              [C.green,  "Backend · FastAPI"],
              [C.accent, "Network / State"],
              [C.purple, "RCIE Engine"],
              [C.error,  "Libraries"],
              [C.dim,    "Navigation"],
            ].map(([col,lbl])=>(
              <div key={lbl} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                <div style={{ width:20, height:3, borderRadius:2,
                  background:`linear-gradient(to right, ${col}44, ${col})` }}/>
                <span style={{ color:C.subtext, fontSize:9.5 }}>{lbl}</span>
              </div>
            ))}
          </div>

          {/* Flow Steps */}
          <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px" }}>
            <p style={{ margin:"0 0 9px", color:C.dim, fontSize:8, textTransform:"uppercase", letterSpacing:"0.12em" }}>DATA FLOW</p>
            {[
              [C.sva,    "User uploads .log file"],
              [C.accent, "Axios POSTs to FastAPI"],
              [C.green,  "Parser clusters errors"],
              [C.accent, "JSON → React state"],
              [C.purple, "RCIE scores confidence"],
              [C.sva,    "Pages render results"],
            ].map(([col,desc],i)=>(
              <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:7, marginBottom:7 }}>
                <div style={{ width:14, height:14, borderRadius:3, flexShrink:0,
                  background:`${col}1e`, border:`1px solid ${col}44`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:7, color:col, fontWeight:700 }}>{i+1}</div>
                <span style={{ color:C.subtext, fontSize:9, lineHeight:1.5 }}>{desc}</span>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px" }}>
            <p style={{ margin:"0 0 9px", color:C.dim, fontSize:8, textTransform:"uppercase", letterSpacing:"0.12em" }}>STATS</p>
            {[
              [C.sva,    `${Object.keys(NODES).length} nodes`],
              [C.accent, `${EDGES.length} edges`],
              [C.green,  "3 backend services"],
              [C.purple, "2 RCIE components"],
              [C.error,  "1 chart library"],
            ].map(([col,val])=>(
              <div key={val} style={{ display:"flex", alignItems:"center", gap:7, marginBottom:5 }}>
                <div style={{ width:5, height:5, borderRadius:"50%", background:col }}/>
                <span style={{ color:C.subtext, fontSize:9.5 }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop:14, display:"flex", justifyContent:"space-between",
        borderTop:`1px solid #0f2237`, paddingTop:10, color:"#1e3a5f", fontSize:9 }}>
        <span>AI DEBUG PRIORITIZATION · ARCHITECTURE DIAGRAM v3.0.0</span>
        <span>{Object.keys(NODES).length} nodes · {EDGES.length} edges · click to explore</span>
      </div>
    </div>
  );
}