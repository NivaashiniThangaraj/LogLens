/**
 * FailureGraph.jsx
 * Failure Dependency Graph + Targeted Reproduction
 *
 * Renders an SVG-based directed graph of the module failure chain.
 * Clicking a node triggers targeted reproduction for that module.
 *
 * Props
 * ─────
 *   failureChain  : string[]          ordered module names
 *   modules       : {name,count}[]    per-module error counts
 *   rootCause     : {module,confidence}
 *   moduleScores  : {module,score}[]
 *   reproduction  : {test,seed}
 *   onRunSim      : (module:string) => void   optional external handler
 *
 * The component can also be used stand-alone with the built-in API call.
 */

import { useState, useCallback, useEffect, useRef } from "react";

// ── colour palette ──────────────────────────────────────────────────
const COLORS = {
  bg:           "#0b0f1a",
  panel:        "#111827",
  border:       "#1e2d40",
  accent:       "#00d4ff",
  accentDim:    "#0088aa",
  danger:       "#ff4560",
  warning:      "#ffb74d",
  success:      "#00e676",
  muted:        "#4a5568",
  text:         "#e2e8f0",
  textDim:      "#718096",
  nodeDefault:  "#162032",
  nodeHover:    "#1e3a5f",
  nodeRoot:     "#1a0a0a",
  edgeDefault:  "#1e3a5f",
  edgeActive:   "#00d4ff",
};

// ── severity colour by count ────────────────────────────────────────
function countColor(count) {
  if (count >= 10) return COLORS.danger;
  if (count >= 5)  return COLORS.warning;
  return COLORS.accent;
}

// ── SVG arrow marker id ─────────────────────────────────────────────
const ARROW_ID = "fdg-arrow";

// ─────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────

function ModuleNode({ module, count, score, isRoot, isSelected, isHovered,
                      cx, cy, R, onClick, onMouseEnter, onMouseLeave }) {
  const fill   = isRoot    ? COLORS.nodeRoot
               : isHovered ? COLORS.nodeHover
               :             COLORS.nodeDefault;
  const stroke = isRoot    ? COLORS.danger
               : isSelected ? COLORS.accent
               :              COLORS.edgeDefault;
  const sw     = isRoot || isSelected ? 2.5 : 1.5;
  const color  = countColor(count);

  return (
    <g
      style={{ cursor: "pointer" }}
      onClick={() => onClick(module)}
      onMouseEnter={() => onMouseEnter(module)}
      onMouseLeave={onMouseLeave}
    >
      {/* glow ring for root cause */}
      {isRoot && (
        <circle cx={cx} cy={cy} r={R + 12}
          fill="none" stroke={COLORS.danger} strokeWidth={1}
          opacity={0.25} />
      )}

      {/* main circle */}
      <circle cx={cx} cy={cy} r={R}
        fill={fill} stroke={stroke} strokeWidth={sw} />

      {/* score arc */}
      {score > 0 && (() => {
        const angle = score * 2 * Math.PI - Math.PI / 2;
        const x2 = cx + R * Math.cos(angle);
        const y2 = cy + R * Math.sin(angle);
        const large = score > 0.5 ? 1 : 0;
        return (
          <path
            d={`M ${cx} ${cy - R} A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`}
            fill="none" stroke={color} strokeWidth={3}
            strokeLinecap="round" opacity={0.8}
          />
        );
      })()}

      {/* label */}
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
        fill={COLORS.text} fontSize={13} fontFamily="'JetBrains Mono', monospace"
        fontWeight={isRoot ? 700 : 500}>
        {module}
      </text>

      {/* count badge */}
      <text x={cx} y={cy + R + 16} textAnchor="middle"
        fill={color} fontSize={11} fontFamily="monospace">
        {count} err{count !== 1 ? "s" : ""}
      </text>

      {/* ROOT badge */}
      {isRoot && (
        <g>
          <rect x={cx - 22} y={cy - R - 26} width={44} height={18} rx={4}
            fill={COLORS.danger} opacity={0.9}/>
          <text x={cx} y={cy - R - 13} textAnchor="middle"
            fill="#fff" fontSize={9} fontFamily="monospace" fontWeight={700}
            letterSpacing={1}>
            ROOT
          </text>
        </g>
      )}
    </g>
  );
}


function EdgeArrow({ x1, y1, x2, y2, active }) {
  // shorten line so it doesn't overlap nodes
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const R   = 36;
  const sx  = x1 + (dx / len) * R;
  const sy  = y1 + (dy / len) * R;
  const ex  = x2 - (dx / len) * (R + 8);
  const ey  = y2 - (dy / len) * (R + 8);

  // curved path via midpoint offset
  const mx = (sx + ex) / 2 - dy * 0.12;
  const my = (sy + ey) / 2 + dx * 0.12;

  return (
    <path
      d={`M ${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}`}
      fill="none"
      stroke={active ? COLORS.edgeActive : COLORS.edgeDefault}
      strokeWidth={active ? 2.5 : 1.5}
      opacity={active ? 1 : 0.5}
      markerEnd={`url(#${ARROW_ID})`}
      strokeDasharray={active ? "none" : "5,3"}
    />
  );
}


// ─────────────────────────────────────────────────────────────────────
// Simulation Output Panel
// ─────────────────────────────────────────────────────────────────────

function SimOutput({ lines, loading, module, onClose }) {
  const endRef = useRef(null);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [lines]);

  return (
    <div style={{
      background: COLORS.panel,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 8,
      padding: "16px",
      marginTop: 16,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ color: COLORS.accent, fontFamily: "monospace", fontSize: 13 }}>
          ▶ Targeted Reproduction{module ? ` — module: ${module}` : ""}
        </span>
        <button onClick={onClose}
          style={{ background: "none", border: "none", color: COLORS.textDim,
                   cursor: "pointer", fontSize: 18 }}>✕</button>
      </div>

      <div style={{
        background: "#070b14",
        borderRadius: 6,
        padding: "12px 14px",
        maxHeight: 280,
        overflowY: "auto",
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        fontSize: 12,
        lineHeight: 1.7,
      }}>
        {loading && lines.length === 0 && (
          <span style={{ color: COLORS.muted }}>Connecting to simulator…</span>
        )}
        {lines.map((l, i) => {
          const color = l.includes("FATAL")   ? COLORS.danger
                      : l.includes("ERROR")   ? "#ff7b7b"
                      : l.includes("WARNING") ? COLORS.warning
                      : l.includes("SVA")     ? "#c084fc"
                      : l.includes("===")     ? COLORS.accentDim
                      : COLORS.textDim;
          return (
            <div key={i} style={{ color, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
              {l || "\u00A0"}
            </div>
          );
        })}
        {loading && lines.length > 0 && (
          <span style={{ color: COLORS.accent }}>▋</span>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────

const API_BASE = import.meta?.env?.VITE_API_URL ?? "http://localhost:8000";

export default function FailureGraph({
  failureChain  = [],
  modules       = [],
  rootCause     = null,
  moduleScores  = [],
  reproduction  = { test: "default_test", seed: "12345" },
  onRunSim,
}) {

  const [hovered,  setHovered]  = useState(null);
  const [selected, setSelected] = useState(null);
  const [simLines, setSimLines] = useState([]);
  const [simMod,   setSimMod]   = useState(null);
  const [loading,  setLoading]  = useState(false);

  // ── demo data if no props provided ─────────────────────────────────
  const chain  = failureChain.length ? failureChain
               : ["driver", "monitor", "scoreboard", "protocol_checker"];
  const mods   = modules.length ? modules
               : chain.map((n, i) => ({ name: n, count: 12 - i * 2 }));
  const rc     = rootCause ?? { module: chain[0], confidence: 0.91 };
  const scores = moduleScores.length ? moduleScores
               : chain.map((m, i) => ({ module: m, score: 0.9 - i * 0.15 }));

  // ── layout: horizontal chain ────────────────────────────────────────
  const SVG_W  = Math.max(700, chain.length * 160 + 80);
  const SVG_H  = 260;
  const CY     = SVG_H / 2;
  const R      = 42;
  const step   = (SVG_W - 100) / Math.max(chain.length - 1, 1);

  const nodePos = chain.map((m, i) => ({
    module: m,
    cx: 50 + i * step,
    cy: CY,
  }));

  const scoreMap  = Object.fromEntries(scores.map(s => [s.module, s.score]));
  const countMap  = Object.fromEntries(mods.map(m => [m.name, m.count]));

  // ── targeted reproduction ───────────────────────────────────────────
  const runTargetedSim = useCallback(async (module) => {

  if (onRunSim) { 
    onRunSim(module); 
    return; 
  }

  setSelected(module);
  setSimMod(module);
  setSimLines(["Connecting to simulator...\n"]);
  setLoading(true);

  try {

    const res = await fetch(`${API_BASE}/stream_simulation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        test: reproduction.test,
        seed: reproduction.seed,
        module
      })
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    let buffer = "";

    while (true) {

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split("\n\n");
      buffer = parts.pop();

      for (const part of parts) {

        if (!part.startsWith("data:")) continue;

        const line = part.replace("data:", "").trim();

        setSimLines(prev => [...prev, line]);

      }
    }

  } catch (err) {

    setSimLines(prev => [...prev, `[Error] ${err.message}`]);

  } finally {

    setLoading(false);

  }

}, [reproduction, onRunSim]);

  // ─────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────

  return (
    <div style={{
      background: COLORS.bg,
      borderRadius: 12,
      padding: "24px",
      fontFamily: "system-ui, sans-serif",
      color: COLORS.text,
      maxWidth: 900,
    }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{
          margin: 0,
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: "0.04em",
          color: COLORS.accent,
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          ⬡ Failure Dependency Graph
        </h2>
        <p style={{ margin: "4px 0 0", color: COLORS.textDim, fontSize: 13 }}>
          Click any module node to run targeted reproduction
        </p>
      </div>

      {/* ── Root Cause Banner ── */}
      {rc && (
        <div style={{
          background: "#1a0a0a",
          border: `1px solid ${COLORS.danger}`,
          borderRadius: 8,
          padding: "10px 16px",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}>
          <span style={{ color: COLORS.danger, fontSize: 20 }}>⚠</span>
          <div>
            <span style={{ color: COLORS.textDim, fontSize: 12 }}>Root Cause Module</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{
                color: COLORS.danger, fontFamily: "monospace",
                fontWeight: 700, fontSize: 16,
              }}>
                {rc.module}
              </span>
              <span style={{
                background: COLORS.danger,
                color: "#fff",
                borderRadius: 4,
                padding: "1px 7px",
                fontSize: 11,
                fontFamily: "monospace",
              }}>
                {Math.round(rc.confidence * 100)}% confidence
              </span>
            </div>
          </div>
          <button
            onClick={() => runTargetedSim(rc.module)}
            style={{
              marginLeft: "auto",
              background: COLORS.danger,
              border: "none",
              borderRadius: 6,
              color: "#fff",
              padding: "7px 16px",
              cursor: "pointer",
              fontFamily: "monospace",
              fontWeight: 600,
              fontSize: 12,
            }}>
            ▶ Reproduce Root Cause
          </button>
        </div>
      )}

      {/* ── SVG Graph ── */}
      <div style={{
        background: COLORS.panel,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 10,
        overflowX: "auto",
        padding: "8px 0",
      }}>
        <svg
          width={SVG_W}
          height={SVG_H}
          style={{ display: "block", minWidth: SVG_W }}
        >
          <defs>
            <marker
              id={ARROW_ID}
              viewBox="0 0 10 10"
              refX={8} refY={5}
              markerWidth={6}
              markerHeight={6}
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z"
                fill={COLORS.edgeActive} opacity={0.8} />
            </marker>

            {/* subtle grid background */}
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40"
                fill="none" stroke={COLORS.border} strokeWidth={0.5} opacity={0.4}/>
            </pattern>
          </defs>

          <rect width={SVG_W} height={SVG_H} fill="url(#grid)" />

          {/* Edges */}
          {nodePos.slice(0, -1).map((p, i) => {
            const q     = nodePos[i + 1];
            const isAct = hovered === p.module || hovered === q.module
                       || selected === p.module || selected === q.module;
            return (
              <EdgeArrow key={i}
                x1={p.cx} y1={p.cy} x2={q.cx} y2={q.cy}
                active={isAct} />
            );
          })}

          {/* Nodes */}
          {nodePos.map(({ module, cx, cy }) => (
            <ModuleNode
              key={module}
              module={module}
              count={countMap[module] ?? 0}
              score={scoreMap[module] ?? 0}
              isRoot={module === rc?.module}
              isSelected={module === selected}
              isHovered={module === hovered}
              cx={cx} cy={cy} R={R}
              onClick={runTargetedSim}
              onMouseEnter={setHovered}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </svg>
      </div>

      {/* ── Chain label ── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        marginTop: 10,
        flexWrap: "wrap",
      }}>
        <span style={{ color: COLORS.textDim, fontSize: 12 }}>Failure chain:</span>
        {chain.map((m, i) => (
          <span key={m} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span
              style={{
                color: m === rc?.module ? COLORS.danger : COLORS.accent,
                fontFamily: "monospace",
                fontSize: 12,
                cursor: "pointer",
                textDecoration: m === selected ? "underline" : "none",
              }}
              onClick={() => runTargetedSim(m)}
            >
              {m}
            </span>
            {i < chain.length - 1 && (
              <span style={{ color: COLORS.muted, fontSize: 11 }}>→</span>
            )}
          </span>
        ))}
      </div>

      {/* ── Simulation Output ── */}
      {(simLines.length > 0 || loading) && (
        <SimOutput
          lines={simLines}
          loading={loading}
          module={simMod}
          onClose={() => { setSimLines([]); setSimMod(null); setSelected(null); }}
        />
      )}

    </div>
  );
}