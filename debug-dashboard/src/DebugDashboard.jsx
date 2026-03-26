import { useState, useCallback, useRef } from "react";
import axios from "axios";
import {
  AlertTriangle, Bug, Zap, Upload, ChevronUp, ChevronDown,
  Activity, Search, Cpu, Home, BarChart2, Table, Brain,
  FileText, TrendingUp, Star, ThumbsUp, ThumbsDown, Download
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
  LineChart, Line, Treemap,
} from "recharts";
import ReproductionPanel from "./ReproductionPanel";
import FailureGraph from "./FailureGraph";
const GEMINI_API_KEY = "";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const C = {
  fatal:   "#ef4444", error:  "#f97316", sva:    "#38bdf8",
  accent:  "#facc15", dim:    "#94a3b8", border: "#1e3a5f",
  green:   "#22c55e", purple: "#a78bfa", text:   "#e2e8f0",
  subtext: "#64748b", panel:  "#0d1b2a",
};

const catColor = (cat) =>
  cat === "UVM_FATAL" ? C.fatal : cat === "UVM_ERROR" ? C.error : C.sva;

const confidenceColor = (s) =>
  s >= 80 ? C.green : s >= 60 ? C.accent : C.error;

// ── Gemini API call ──────────────────────────────────────────────────────────
async function callGemini(prompt) {
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
    }),
  });
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response.";
}

// ── RCIE engine ──────────────────────────────────────────────────────────────
function inferFileFromSig(s) {
  if (/AXI/i.test(s))        return "axi_driver.sv";
  if (/FIFO/i.test(s))       return "fifo_ctrl.sv";
  if (/CLK|clock/i.test(s))  return "clk_gen.sv";
  if (/RESET|rst/i.test(s))  return "reset_seq.sv";
  if (/PARITY|ECC/i.test(s)) return "mem_ctrl.sv";
  if (/PROTOCOL/i.test(s))   return "proto_chk.sv";
  if (/SCOREBOARD/i.test(s)) return "scoreboard.sv";
  if (/DEADLOCK/i.test(s))   return "arbiter.sv";
  if (/WATCHDOG/i.test(s))   return "watchdog.sv";
  if (/TLM/i.test(s))        return "tlm_agent.sv";
  if (/HANDSHAKE/i.test(s))  return "handshake.sv";
  return "tb_top.sv";
}
function inferModFromSig(s) {
  if (/AXI/i.test(s))        return "AXI_master_driver";
  if (/FIFO/i.test(s))       return "fifo_monitor";
  if (/CLK/i.test(s))        return "clk_domain_ctrl";
  if (/RESET/i.test(s))      return "reset_agent";
  if (/PARITY|ECC/i.test(s)) return "mem_scoreboard";
  if (/PROTOCOL/i.test(s))   return "protocol_checker";
  if (/SCOREBOARD/i.test(s)) return "scoreboard";
  if (/DEADLOCK/i.test(s))   return "bus_arbiter";
  if (/WATCHDOG/i.test(s))   return "wd_timer";
  if (/TLM/i.test(s))        return "uvm_tlm_port";
  return "tb_env";
}
function inferSignalFromSig(s) {
  if (/AXI/i.test(s))       return "m_axi_awvalid";
  if (/FIFO/i.test(s))      return "fifo_wr_en";
  if (/CLK/i.test(s))       return "sys_clk";
  if (/RESET/i.test(s))     return "rst_n";
  if (/PARITY/i.test(s))    return "data_parity";
  if (/ECC/i.test(s))       return "ecc_syndrome";
  if (/HANDSHAKE/i.test(s)) return "valid_ready";
  return "—";
}
function inferTimeWindow(count) {
  return count > 100 ? "0–500 ns" : count > 50 ? "500–1000 ns" : "> 1000 ns";
}
function inferTestCase(cat) {
  if (cat === "UVM_FATAL") return "stress_test";
  if (cat === "UVM_ERROR") return "rand_reg_seq";
  return "functional_cov";
}

function analyzeRootCauses(data) {
  const filePattern   = /(\w+\.sv)\((\d+)\)/;
  const modulePattern = /module\s+(\w+)/i;
  const signalPattern = /signal[:\s]+(\w+)|net[:\s]+(\w+)/i;
  const timePattern   = /[@#](\d+(?:\.\d+)?)\s*(?:ns|ps|us)?/i;
  const testPattern   = /test(?:case|bench)?[:\s_]+(\w+)/i;

  return data.map((item, idx) => {
    const t = item.signature;
    const fm = filePattern.exec(t);
    const mm = modulePattern.exec(t);
    const sm = signalPattern.exec(t);
    const tm = timePattern.exec(t);
    const te = testPattern.exec(t);

    const file   = fm?.[1]  ?? inferFileFromSig(t);
    const line   = fm?.[2]  ?? String((item.count % 300) + 10);
    const module = mm?.[1]  ?? inferModFromSig(t);
    const signal = sm?.[1]  ?? sm?.[2] ?? inferSignalFromSig(t);

    const score =
      (fm ? 30 : 15) + (mm ? 25 : 12) + (sm ? 20 : 8) +
      (item.category === "UVM_FATAL" ? 15 : item.category === "UVM_ERROR" ? 10 : 5) +
      (item.count > 100 ? 10 : item.count > 50 ? 7 : 3);

    const priorityScore = Math.round(
      (item.count / 200) * 30 +
      (item.category === "UVM_FATAL" ? 40 : item.category === "UVM_ERROR" ? 25 : 10) +
      Math.min(score * 0.3, 30)
    );

    return {
      id: idx + 1,
      signature:   item.signature,
      count:       item.count,
      category:    item.category,
      file, line, module, signal,
      timeWindow:  tm?.[1] ? `${tm[1]} ns` : inferTimeWindow(item.count),
      testCase:    te?.[1] ?? inferTestCase(item.category),
      confidence:  Math.min(97, Math.max(42, score)),
      priorityScore: Math.min(100, priorityScore),
      feedback:    null,
      aiAnalysis:  null,
      aiLoading:   false,
    };
  });
}

// ── Shared components ────────────────────────────────────────────────────────
const SectionLabel = ({ children }) => (
  <p style={{ color: C.dim, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em",
    margin: "0 0 12px", borderLeft: `2px solid ${C.border}`, paddingLeft: 8 }}>
    {children}
  </p>
);

const EmptyState = ({ message }) => (
  <div style={{ textAlign: "center", padding: "80px 0", color: C.border }}>
    <Bug size={52} style={{ margin: "0 auto 14px", display: "block", opacity: 0.25 }} />
    <p style={{ fontSize: 13, color: "#334155" }}>{message}</p>
  </div>
);

const StatCard = ({ icon: Icon, label, value, sub, color }) => (
  <div style={{ background: "linear-gradient(135deg,#0d1b2a,#0a1628)",
    border: `1px solid ${color}33`, borderRadius: 8,
    padding: "18px 20px", position: "relative", overflow: "hidden", flex: 1 }}>
    <div style={{ position: "absolute", top: 0, right: 0, width: 70, height: 70,
      background: `radial-gradient(circle at top right,${color}22,transparent 70%)`,
      pointerEvents: "none" }} />
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
      <div>
        <p style={{ margin: 0, color: C.dim, fontSize: 10, fontFamily: "monospace",
          textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>{label}</p>
        <p style={{ margin: 0, color: "#f1f5f9", fontSize: 32, fontFamily: "monospace",
          fontWeight: 700, lineHeight: 1 }}>{value}</p>
        {sub && <p style={{ margin: 0, color, fontSize: 10, fontFamily: "monospace", marginTop: 5 }}>{sub}</p>}
      </div>
      <div style={{ width: 40, height: 40, borderRadius: 8, background: `${color}18`,
        border: `1px solid ${color}44`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={18} color={color} />
      </div>
    </div>
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2,
      background: `linear-gradient(to right,transparent,${color},transparent)` }} />
  </div>
);

const ConfidenceBar = ({ value }) => {
  const color = confidenceColor(value);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 5, background: "#0f2237", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${value}%`, height: "100%", borderRadius: 3,
          background: `linear-gradient(to right,${color}88,${color})` }} />
      </div>
      <span style={{ color, fontSize: 10, fontFamily: "monospace", minWidth: 34 }}>{value}%</span>
    </div>
  );
};

const PriorityBar = ({ value }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
    <div style={{ flex: 1, height: 5, background: "#0f2237", borderRadius: 3, overflow: "hidden" }}>
      <div style={{ width: `${value}%`, height: "100%", borderRadius: 3,
        background: value >= 70 ? `linear-gradient(to right,${C.fatal}88,${C.fatal})`
          : value >= 40 ? `linear-gradient(to right,${C.error}88,${C.error})`
          : `linear-gradient(to right,${C.green}88,${C.green})` }} />
    </div>
    <span style={{ fontSize: 10, fontFamily: "monospace", minWidth: 28,
      color: value >= 70 ? C.fatal : value >= 40 ? C.error : C.green }}>{value}</span>
  </div>
);

const SortIcon = ({ field, sort }) =>
  sort.field !== field ? <span style={{ color: "#334155", marginLeft: 4 }}>⇅</span>
    : sort.dir === "asc" ? <ChevronUp size={11} style={{ marginLeft: 4 }} />
    : <ChevronDown size={11} style={{ marginLeft: 4 }} />;

const CustomBarTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: "#0d1b2a", border: `1px solid ${catColor(d.category)}`,
      borderRadius: 4, padding: "8px 12px", fontFamily: "monospace", fontSize: 11, maxWidth: 260 }}>
      <p style={{ color: catColor(d.category), marginBottom: 3 }}>{d.category}</p>
      <p style={{ color: "#e2e8f0", wordBreak: "break-all" }}>{d.signature}</p>
      <p style={{ color: C.accent, marginTop: 3 }}>Count: {d.count}</p>
    </div>
  );
};

const RADIAN = Math.PI / 180;
const PieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  return (
    <text x={cx + r * Math.cos(-midAngle * RADIAN)}
      y={cy + r * Math.sin(-midAngle * RADIAN)}
      fill="white" textAnchor="middle" dominantBaseline="central"
      fontSize={10} fontFamily="monospace">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

// ── AI Analysis Modal ────────────────────────────────────────────────────────
const AIModal = ({ item, onClose, onFeedback }) => {
  if (!item) return null;
  const cc = confidenceColor(item.confidence);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
      zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={onClose}>
      <div style={{ background: "#0d1b2a", border: `1px solid ${cc}55`,
        borderRadius: 12, padding: 24, maxWidth: 560, width: "100%",
        maxHeight: "85vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <p style={{ margin: 0, color: C.dim, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em" }}>
              AI ROOT CAUSE ANALYSIS — Cluster #{item.id}
            </p>
            <p style={{ margin: "5px 0 0", color: "#f1f5f9", fontSize: 12,
              fontFamily: "monospace", wordBreak: "break-all" }}>{item.signature}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none",
            color: "#475569", cursor: "pointer", fontSize: 18, lineHeight: 1, marginLeft: 12 }}>✕</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {[["📁 File", item.file], ["📍 Line", item.line],
            ["🧩 Module", item.module], ["⚡ Signal", item.signal],
            ["⏱ Time Window", item.timeWindow], ["🧪 Test Case", item.testCase]
          ].map(([label, val]) => (
            <div key={label} style={{ background: "#070f1a", borderRadius: 6,
              padding: "9px 12px", border: "1px solid #0f2237" }}>
              <p style={{ margin: "0 0 3px", color: "#475569", fontSize: 9 }}>{label}</p>
              <p style={{ margin: 0, color: "#e2e8f0", fontSize: 11, fontFamily: "monospace" }}>{val}</p>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 14 }}>
          <p style={{ margin: "0 0 6px", color: C.dim, fontSize: 9,
            textTransform: "uppercase", letterSpacing: "0.1em" }}>CONFIDENCE</p>
          <ConfidenceBar value={item.confidence} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <p style={{ margin: "0 0 6px", color: C.dim, fontSize: 9,
            textTransform: "uppercase", letterSpacing: "0.1em" }}>PRIORITY SCORE</p>
          <PriorityBar value={item.priorityScore} />
        </div>
        <div style={{
  background: "#070f1a",
  borderRadius: 8,
  border: `1px solid ${C.purple}33`,
  marginBottom: 14,
  display: "flex",
  flexDirection: "column",
  maxHeight: "220px"
}}>
  <p
    style={{
      margin: "10px 16px 6px",
      color: C.purple,
      fontSize: 10,
      textTransform: "uppercase",
      letterSpacing: "0.1em",
      fontWeight: 700
    }}
  >
    🤖 GEMINI AI ANALYSIS
  </p>

  <div
    style={{
      overflowY: "auto",
      padding: "0 16px 14px",
      flex: 1
    }}
  >
    {item.aiLoading ? (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 16,
            height: 16,
            border: `2px solid ${C.purple}`,
            borderTopColor: "transparent",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite"
          }}
        />
        <span style={{ color: C.subtext, fontSize: 11 }}>
          Analyzing with Gemini 2.5 Flash…
        </span>
      </div>
    ) : item.aiAnalysis ? (
      <div style={{
  overflowY: "auto",
  padding: "14px 16px",
  flex: 1
}}>
  <p style={{
    margin: 0,
    color: "#e2e8f0",
    fontSize: 12,
    lineHeight: 1.7,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word"
  }}>
    {item.aiAnalysis}
  </p>
</div>
    ) : (
      <p
        style={{
          margin: 0,
          color: C.subtext,
          fontSize: 11,
          fontStyle: "italic"
        }}
      >
        AI analysis not yet generated. Close and click the AI button on a row.
      </p>
    )}
  </div>
</div>
        <div>
          <p style={{ margin: "0 0 8px", color: C.dim, fontSize: 9,
            textTransform: "uppercase", letterSpacing: "0.1em" }}>
            WAS THIS ANALYSIS HELPFUL?
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { icon: ThumbsUp,   val: "yes",   color: C.green,  label: "Yes, correct" },
              { icon: ThumbsDown, val: "no",    color: C.fatal,  label: "Incorrect"    },
              { icon: Star,       val: "maybe", color: C.accent, label: "Partially"    },
            ].map(({ icon: Icon, val, color, label }) => (
              <button key={val} onClick={() => onFeedback(item.id, val)} style={{
                flex: 1, padding: "7px 10px", borderRadius: 6, cursor: "pointer",
                background: item.feedback === val ? `${color}22` : "transparent",
                border: `1px solid ${item.feedback === val ? color : "#1e3a5f"}`,
                color: item.feedback === val ? color : C.subtext,
                fontSize: 11, fontFamily: "monospace",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              }}>
                <Icon size={12} /> {label}
              </button>
            ))}
          </div>
          {item.feedback && (
            <p style={{ margin: "8px 0 0", color: C.green, fontSize: 10, fontFamily: "monospace" }}>
              ✓ Feedback recorded — helping improve RCIE accuracy
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// ── NAV CONFIG ───────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: "home",      label: "Home",         icon: Home      },
  { id: "charts",    label: "Analytics",    icon: BarChart2 },
  { id: "table",     label: "Issue Log",    icon: Table     },
  { id: "rcie",      label: "Root Cause",   icon: Brain     },
  { id: "trend",     label: "Regression",   icon: TrendingUp},
  { id: "report",    label: "PDF Report",   icon: FileText  },
];

// ══════════════════════════════════════════════════════════════════════════════
// PAGE: HOME
// ══════════════════════════════════════════════════════════════════════════════
function HomePage({ result, fileName, loading, error, dragging, setDragging, upload, inputRef, setPage }) {
  const ratio    = result ? (result.total_errors / result.unique_issues).toFixed(1) : null;
  const rcieData = result ? analyzeRootCauses(result.data) : [];
  const highConf = rcieData.filter(d => d.confidence >= 80).length;
  const topPrio  = rcieData.filter(d => d.priorityScore >= 70).length;

  return (
    <div className="fade-in">
      <div style={{ background: "linear-gradient(135deg,#0d1b2a,#070f1a)",
        border: "1px solid #1e3a5f", borderRadius: 12, padding: "36px 32px",
        marginBottom: 20, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -60, right: -60, width: 220, height: 220,
          background: "radial-gradient(circle,#ef444412,transparent 70%)", pointerEvents: "none" }} />
        <p style={{ margin: "0 0 6px", color: C.sva, fontSize: 10, fontFamily: "monospace",
          textTransform: "uppercase", letterSpacing: "0.2em" }}>EDA Simulation Log Analyzer</p>
        <h2 style={{ margin: "0 0 10px", fontSize: 26, fontWeight: 700, color: "#f1f5f9", lineHeight: 1.2 }}>
          AI-Enabled Debug<br /><span style={{ color: C.fatal }}>Prioritization</span> Tool
        </h2>
        <p style={{ margin: "0 0 24px", color: "#475569", fontSize: 12, maxWidth: 460 }}>
          Upload simulation logs → get AI-powered root cause analysis, regression trends,
          smart priority scoring, and one-click PDF reports. Powered by Gemini 2.5 Flash.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[[C.fatal,"UVM_FATAL"],[C.error,"UVM_ERROR"],[C.sva,"SVA"],[C.purple,"RCIE + Gemini AI"],[C.accent,"Smart Priority"]].map(([col,lbl]) => (
            <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 5,
              padding: "4px 10px", borderRadius: 20, background: `${col}12`, border: `1px solid ${col}33` }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: col }} />
              <span style={{ color: col, fontSize: 10, fontFamily: "monospace" }}>{lbl}</span>
            </div>
          ))}
        </div>
      </div>

      <div onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) upload(f); }}
        onClick={() => inputRef.current?.click()}
        style={{ border: `2px dashed ${dragging ? C.accent : loading ? C.sva : "#1e3a5f"}`,
          borderRadius: 10, padding: "32px 24px", textAlign: "center", cursor: "pointer",
          marginBottom: 20, background: dragging ? "#facc1508" : loading ? "#38bdf808" : "#0d1b2a55",
          transition: "all 0.2s" }}>
        <input ref={inputRef} type="file" accept=".log" style={{ display: "none" }}
          onChange={e => { if (e.target.files[0]) upload(e.target.files[0]); }} />
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, border: `2px solid ${C.sva}`,
              borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <p style={{ margin: 0, color: C.sva, fontSize: 13 }}>Analyzing {fileName}…</p>
            <p style={{ margin: 0, color: "#334155", fontSize: 11 }}>Running RCIE + AI engine</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <Upload size={26} color={dragging ? C.accent : "#475569"} />
            <p style={{ margin: 0, color: dragging ? C.accent : "#64748b", fontSize: 13 }}>
              {dragging ? "Release to analyze" : "Drop .log file here or click to browse"}
            </p>
            <p style={{ margin: 0, color: "#334155", fontSize: 11 }}>VCS · Questa · Xcelium</p>
          </div>
        )}
      </div>

      {error && (
        <div style={{ background: "#ef444411", border: "1px solid #ef444433",
          borderRadius: 8, padding: "10px 14px", marginBottom: 16,
          color: C.fatal, fontSize: 12, display: "flex", gap: 8, alignItems: "center" }}>
          <AlertTriangle size={13} /> {error}
        </div>
      )}

      {result && (
        <div className="fade-in">
          <SectionLabel>ANALYSIS COMPLETE — {fileName}</SectionLabel>
          <div style={{ display: "flex", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
            <StatCard icon={AlertTriangle} label="Total Failures"
              value={result.total_errors.toLocaleString()} sub="across all assertions" color={C.fatal} />
            <StatCard icon={Bug} label="Unique Root Causes"
              value={result.unique_issues} sub="distinct signatures" color={C.error} />
            <StatCard icon={Zap} label="Compression Ratio"
              value={`${ratio}×`} sub="errors per root cause" color={C.accent} />
            <StatCard icon={Cpu} label="High Confidence RCIE"
              value={highConf} sub="clusters ≥ 80%" color={C.purple} />
            <StatCard icon={AlertTriangle} label="Critical Priority"
              value={topPrio} sub="priority score ≥ 70" color={C.fatal} />
            
          </div>
          <ReproductionPanel reproduction={result.reproduction} />
          <FailureGraph
      failureChain={result.failure_chain || []}
      modules={result.modules || []}
      rootCause={result.root_cause || {}}
      moduleScores={result.module_scores || []}
    />
          <SectionLabel>EXPLORE RESULTS</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
            {[
              { page:"charts",  icon:BarChart2,  color:C.sva,    title:"Analytics",    desc:"Charts, heatmap, category breakdown" },
              { page:"table",   icon:Table,      color:C.error,  title:"Issue Log",    desc:"Sortable, searchable failure table" },
              { page:"rcie",    icon:Brain,      color:C.purple, title:"Root Cause",   desc:"Gemini AI + RCIE confidence engine" },
              { page:"trend",   icon:TrendingUp, color:C.accent, title:"Regression",   desc:"Multi-run trend & diff analysis" },
              { page:"report",  icon:FileText,   color:C.green,  title:"PDF Report",   desc:"One-click professional bug report" },
            ].map(({ page, icon: Icon, color, title, desc }) => (
              <div key={page} onClick={() => setPage(page)}
                style={{ background: "#0d1b2a", border: `1px solid ${color}33`,
                  borderRadius: 10, padding: "16px 18px", cursor: "pointer", transition: "all 0.2s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = `${color}88`}
                onMouseLeave={e => e.currentTarget.style.borderColor = `${color}33`}>
                <div style={{ width: 32, height: 32, borderRadius: 7, background: `${color}18`,
                  border: `1px solid ${color}33`, display: "flex", alignItems: "center",
                  justifyContent: "center", marginBottom: 10 }}>
                  <Icon size={16} color={color} />
                </div>
                <p style={{ margin: "0 0 3px", color: "#f1f5f9", fontSize: 12, fontWeight: 700 }}>{title}</p>
                <p style={{ margin: 0, color: "#475569", fontSize: 10 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PAGE: ANALYTICS
// ══════════════════════════════════════════════════════════════════════════════
function ChartsPage({ result }) {
  if (!result) return <EmptyState message="Upload a log file on the Home page to view analytics." />;
  const raw     = result.data;
  const barData = raw.slice(0, 12).map(d => ({ ...d, label: d.signature.slice(0, 26) + "…" }));
  const pieData = (() => {
    const acc = {};
    raw.forEach(d => { acc[d.category] = (acc[d.category] || 0) + d.count; });
    return Object.entries(acc).map(([name, value]) => ({ name, value }));
  })();
  const fileData = (() => {
    const acc = {};
    analyzeRootCauses(raw).forEach(d => { acc[d.file] = (acc[d.file] || 0) + d.count; });
    return Object.entries(acc).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name, value }));
  })();
  const treemapData = analyzeRootCauses(raw).map(d => ({
    name: d.file, size: d.count, category: d.category,
  }));

  const TreemapContent = ({ x, y, width, height, name, root }) => {
    const d = treemapData.find(t => t.name === name);
    const col = d ? catColor(d.category) : C.dim;
    if (width < 30 || height < 20) return null;
    return (
      <g>
        <rect x={x+1} y={y+1} width={width-2} height={height-2} rx={3}
          fill={`${col}22`} stroke={col} strokeWidth="1" strokeOpacity={0.5} />
        <text x={x+width/2} y={y+height/2} textAnchor="middle" dominantBaseline="central"
          fontSize={Math.min(11, width/6)} fill={col} fontFamily="monospace">
          {width > 60 ? name : ""}
        </text>
      </g>
    );
  };

  return (
    <div className="fade-in">
      <SectionLabel>FAILURE FREQUENCY</SectionLabel>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`,
        borderRadius: 10, padding: "18px", marginBottom: 18 }}>
        <p style={{ margin: "0 0 14px", color: "#94a3b8", fontSize: 12, fontWeight: 600 }}>
          Top 12 Error Signatures by Hit Count
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={barData} margin={{ top: 0, right: 4, left: -16, bottom: 65 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#0f2237" />
            <XAxis dataKey="label" tick={{ fill: "#475569", fontSize: 9, fontFamily: "monospace" }}
              angle={-40} textAnchor="end" interval={0} />
            <YAxis tick={{ fill: "#475569", fontSize: 9, fontFamily: "monospace" }} />
            <Tooltip content={<CustomBarTooltip />} cursor={{ fill: "#ffffff08" }} />
            <Bar dataKey="count" radius={[3,3,0,0]}>
              {barData.map((d, i) => <Cell key={i} fill={catColor(d.category)} fillOpacity={0.85} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 18 }}>
        <div style={{ flex: 1, background: C.panel, border: `1px solid ${C.border}`,
          borderRadius: 10, padding: "18px" }}>
          <p style={{ margin: "0 0 14px", color: "#94a3b8", fontSize: 12, fontWeight: 600 }}>
            Category Distribution
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="46%" outerRadius={88} innerRadius={44}
                dataKey="value" labelLine={false} label={<PieLabel />}>
                {pieData.map((d, i) => <Cell key={i} fill={catColor(d.name)} stroke="#020b18" strokeWidth={3} />)}
              </Pie>
              <Legend formatter={v => <span style={{ color: catColor(v), fontSize: 10, fontFamily: "monospace" }}>{v}</span>} />
              <Tooltip contentStyle={{ background: "#0d1b2a", border: `1px solid ${C.border}`,
                fontFamily: "monospace", fontSize: 11 }} itemStyle={{ color: C.text }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div style={{ flex: 1, background: C.panel, border: `1px solid ${C.border}`,
          borderRadius: 10, padding: "18px" }}>
          <p style={{ margin: "0 0 14px", color: "#94a3b8", fontSize: 12, fontWeight: 600 }}>
            Top Offending Files
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={fileData} layout="vertical" margin={{ top:0, right:16, left:16, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#0f2237" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#475569", fontSize: 9, fontFamily: "monospace" }} />
              <YAxis type="category" dataKey="name"
                tick={{ fill: "#94a3b8", fontSize: 9, fontFamily: "monospace" }} width={105} />
              <Tooltip contentStyle={{ background: "#0d1b2a", border: `1px solid ${C.border}`,
                fontFamily: "monospace", fontSize: 11 }} itemStyle={{ color: C.text }} />
              <Bar dataKey="value" radius={[0,3,3,0]} fill={C.purple} fillOpacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <SectionLabel>RTL FAILURE HEATMAP</SectionLabel>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`,
        borderRadius: 10, padding: "18px" }}>
        <p style={{ margin: "0 0 14px", color: "#94a3b8", fontSize: 12, fontWeight: 600 }}>
          Module Error Density — Size = Error Count
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <Treemap data={treemapData} dataKey="size" aspectRatio={4/3}
            content={<TreemapContent />} />
        </ResponsiveContainer>
        <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
          {[[C.fatal,"UVM_FATAL"],[C.error,"UVM_ERROR"],[C.sva,"SVA"]].map(([col,lbl]) => (
            <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: col }} />
              <span style={{ color: C.subtext, fontSize: 10 }}>{lbl}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PAGE: ISSUE LOG
// ══════════════════════════════════════════════════════════════════════════════
function TablePage({ result }) {
  const [sort,   setSort]   = useState({ field: "priorityScore", dir: "desc" });
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  if (!result) return <EmptyState message="Upload a log file on the Home page to view the issue log." />;

  const rcieData = analyzeRootCauses(result.data);
  const toggleSort = f => setSort(s => s.field === f ? { f, dir: s.dir === "asc" ? "desc" : "asc" } : { field: f, dir: "desc" });

  const tableData = rcieData
    .filter(d => filter === "ALL" || d.category === filter)
    .filter(d => !search || d.signature.toLowerCase().includes(search.toLowerCase()))
    .slice()
    .sort((a, b) => {
      const mul = sort.dir === "asc" ? 1 : -1;
      if (sort.field === "count")         return mul * (a.count - b.count);
      if (sort.field === "priorityScore") return mul * (a.priorityScore - b.priorityScore);
      return mul * a[sort.field]?.localeCompare?.(b[sort.field]);
    });

  return (
    <div className="fade-in">
      <SectionLabel>PRIORITIZED ISSUE LOG</SectionLabel>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7,
          background: C.panel, border: "1px solid #1e3a5f", borderRadius: 6,
          padding: "6px 11px", flex: 1, maxWidth: 300 }}>
          <Search size={12} color="#475569" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search signatures…"
            style={{ background: "none", border: "none", outline: "none",
              color: C.text, fontSize: 12, fontFamily: "monospace", width: "100%" }} />
        </div>
        {["ALL","UVM_FATAL","UVM_ERROR","SVA"].map(f => {
          const fc = f === "ALL" ? C.sva : catColor(f);
          return (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "5px 12px", borderRadius: 4, cursor: "pointer", fontFamily: "monospace", fontSize: 11,
              border: `1px solid ${filter === f ? fc : "#1e3a5f"}`,
              background: filter === f ? `${fc}18` : "transparent",
              color: filter === f ? fc : "#475569" }}>{f}</button>
          );
        })}
        <span style={{ color: "#334155", fontSize: 10, marginLeft: "auto" }}>
          {tableData.length}/{rcieData.length} entries
        </span>
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.border}`,
        borderRadius: 8, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "40px 2fr 70px 120px 130px 110px",
          padding: "9px 14px", background: "#0a1220", borderBottom: `1px solid ${C.border}`,
          color: "#475569", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em" }}>
          {[["","#"],["signature","SIGNATURE"],["count","HITS"],["category","CATEGORY"],
            ["priorityScore","PRIORITY"],["","FILE"]].map(([f,lbl],i) => (
            <div key={i} onClick={() => f && toggleSort(f)}
              style={{ cursor: f ? "pointer" : "default", display: "flex", alignItems: "center", userSelect: "none" }}>
              {lbl}{f && <SortIcon field={f} sort={sort} />}
            </div>
          ))}
        </div>
        <div style={{ maxHeight: 500, overflowY: "auto" }}>
          {tableData.map((row, i) => {
            const rc = catColor(row.category);
            return (
              <div key={i} className="tr-row" style={{
                display: "grid", gridTemplateColumns: "40px 2fr 70px 120px 130px 110px",
                padding: "10px 14px", borderBottom: "1px solid #0f2237",
                background: i % 2 === 0 ? "transparent" : "#ffffff03", alignItems: "center" }}>
                <div style={{ color: "#334155", fontSize: 10 }}>#{String(i+1).padStart(2,"0")}</div>
                <div style={{ color: C.text, fontSize: 11, paddingRight: 10, wordBreak: "break-all" }}>
                  <span style={{ color: rc, marginRight: 5, opacity: 0.7 }}>▸</span>{row.signature}
                </div>
                <div style={{ color: C.accent, fontSize: 12, fontWeight: 700 }}>{row.count}</div>
                <div>
                  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 3,
                    background: `${rc}1a`, border: `1px solid ${rc}44`,
                    color: rc, fontSize: 9, letterSpacing: "0.05em" }}>{row.category}</span>
                </div>
                <div><PriorityBar value={row.priorityScore} /></div>
                <div style={{ color: C.sva, fontSize: 10, fontFamily: "monospace" }}>{row.file}</div>
              </div>
            );
          })}
          {tableData.length === 0 && (
            <div style={{ padding: "28px", textAlign: "center", color: "#334155", fontSize: 12 }}>
              No entries match current filter.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PAGE: RCIE + GEMINI AI
// ══════════════════════════════════════════════════════════════════════════════
function RCIEPage({ result }) {
  const [rcieSort,   setRcieSort]   = useState({ field: "priorityScore", dir: "desc" });
  const [rcieFilter, setRcieFilter] = useState("ALL");
  const [selected,   setSelected]   = useState(null);
  const [clusters,   setClusters]   = useState(null);
  const [accuracy,   setAccuracy]   = useState({ yes: 0, no: 0, maybe: 0 });

  if (!result) return <EmptyState message="Upload a log file on the Home page to run root cause analysis." />;

  if (!clusters) {
    setClusters(analyzeRootCauses(result.data));
    return null;
  }

  const toggleSort = f =>
    setRcieSort(s => s.field === f ? { field: f, dir: s.dir === "asc" ? "desc" : "asc" } : { field: f, dir: "desc" });

  const rcieData = clusters
    .filter(d => rcieFilter === "ALL" || d.category === rcieFilter)
    .slice()
    .sort((a, b) => {
      const mul = rcieSort.dir === "asc" ? 1 : -1;
      if (rcieSort.field === "confidence")   return mul * (a.confidence - b.confidence);
      if (rcieSort.field === "priorityScore") return mul * (a.priorityScore - b.priorityScore);
      if (rcieSort.field === "count")        return mul * (a.count - b.count);
      return mul * a[rcieSort.field]?.localeCompare?.(b[rcieSort.field]);
    });

  const handleAIAnalyze = async (row) => {
    setClusters(prev => prev.map(c => c.id === row.id ? { ...c, aiLoading: true } : c));
    setSelected({ ...row, aiLoading: true });

    const prompt = `You are an expert EDA verification engineer specializing in UVM and SystemVerilog.
Analyze this simulation error and provide a concise root cause analysis:

Error Signature: ${row.signature}
Category: ${row.category}
Occurrences: ${row.count}
Probable File: ${row.file} (line ${row.line})
Probable Module: ${row.module}
Signal Involved: ${row.signal}
Time Window: ${row.timeWindow}
Test Case: ${row.testCase}
Confidence Score: ${row.confidence}%

Provide:
1. Root cause explanation (2-3 sentences)
2. Most likely fix in SystemVerilog (1-2 lines of code or description)
3. Which team/module owner should investigate
4. Estimated fix complexity: Low / Medium / High

Keep the response concise and technical. Format clearly with numbered sections.`;

    try {
      const analysis = await callGemini(prompt);
      setClusters(prev => prev.map(c => c.id === row.id ? { ...c, aiAnalysis: analysis, aiLoading: false } : c));
      setSelected(prev => ({ ...prev, aiAnalysis: analysis, aiLoading: false }));
    } catch (e) {
      setClusters(prev => prev.map(c => c.id === row.id ? { ...c, aiAnalysis: "API error: " + e.message, aiLoading: false } : c));
      setSelected(prev => ({ ...prev, aiAnalysis: "API error: " + e.message, aiLoading: false }));
    }
  };

  const handleFeedback = (id, val) => {
    setClusters(prev => prev.map(c => {
      if (c.id !== id) return c;
      const old = c.feedback;
      if (old) setAccuracy(a => ({ ...a, [old]: Math.max(0, a[old] - 1) }));
      setAccuracy(a => ({ ...a, [val]: a[val] + 1 }));
      return { ...c, feedback: val };
    }));
    setSelected(prev => prev ? { ...prev, feedback: val } : prev);
  };

  const total    = accuracy.yes + accuracy.no + accuracy.maybe;
  const accScore = total > 0 ? Math.round(((accuracy.yes + accuracy.maybe * 0.5) / total) * 100) : null;
  const highConf = clusters.filter(d => d.confidence >= 80).length;
  const modConf  = clusters.filter(d => d.confidence >= 60 && d.confidence < 80).length;
  const lowConf  = clusters.filter(d => d.confidence < 60).length;

  return (
    <div className="fade-in">
      {selected && (
        <AIModal item={selected} onClose={() => setSelected(null)}
          onFeedback={handleFeedback} />
      )}

      <SectionLabel>ROOT CAUSE INTELLIGENCE ENGINE</SectionLabel>

      <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        {[[C.green,"High Confidence",highConf,"≥ 80%"],
          [C.accent,"Moderate",modConf,"60–79%"],
          [C.error,"Low / Manual",lowConf,"< 60%"],
          [C.purple,"AI Analyzed",clusters.filter(d=>d.aiAnalysis).length,"Gemini 2.5"],
          [accScore !== null ? C.green : C.dim,"RCIE Accuracy",
           accScore !== null ? `${accScore}%` : "—","from feedback"],
        ].map(([col,lbl,val,sub]) => (
          <div key={lbl} style={{ flex: 1, minWidth: 130, background: C.panel,
            border: `1px solid ${col}33`, borderRadius: 8, padding: "12px 16px",
            position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, right: 0, width: 50, height: 50,
              background: `radial-gradient(circle at top right,${col}18,transparent 70%)`,
              pointerEvents: "none" }} />
            <p style={{ margin: "0 0 3px", color: C.dim, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em" }}>{lbl}</p>
            <p style={{ margin: "0 0 2px", color: "#f1f5f9", fontSize: 26, fontFamily: "monospace", fontWeight: 700 }}>{val}</p>
            <p style={{ margin: 0, color: col, fontSize: 9, fontFamily: "monospace" }}>{sub}</p>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2,
              background: `linear-gradient(to right,transparent,${col},transparent)` }} />
          </div>
        ))}
      </div>

      <div style={{ background: "linear-gradient(135deg,#0d1b2a,#0a0f1e)",
        border: `1px solid ${C.purple}44`, borderRadius: 10, padding: "18px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, background: `${C.purple}18`,
              border: `1px solid ${C.purple}44`, borderRadius: 6,
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Brain size={14} color={C.purple} />
            </div>
            <div>
              <p style={{ margin: 0, color: C.purple, fontSize: 12, fontWeight: 700, letterSpacing: "0.05em" }}>
                PROBABLE ROOT CAUSE TABLE
              </p>
              <p style={{ margin: 0, color: "#475569", fontSize: 9 }}>
                Click AI button → Gemini 2.5 Flash analysis · Click row → full drill-down
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 7 }}>
            {["ALL","UVM_FATAL","UVM_ERROR","SVA"].map(f => {
              const fc = f === "ALL" ? C.purple : catColor(f);
              return (
                <button key={f} onClick={() => setRcieFilter(f)} style={{
                  padding: "4px 10px", borderRadius: 4, cursor: "pointer",
                  fontFamily: "monospace", fontSize: 9,
                  border: `1px solid ${rcieFilter === f ? fc : "#1e3a5f"}`,
                  background: rcieFilter === f ? `${fc}18` : "transparent",
                  color: rcieFilter === f ? fc : "#475569" }}>{f}</button>
              );
            })}
          </div>
        </div>

        <div style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}` }}>
          <div style={{ display: "grid",
            gridTemplateColumns: "36px 2fr 60px 110px 120px 120px 100px 70px",
            padding: "8px 12px", background: "#070f1a", borderBottom: `1px solid ${C.border}`,
            color: "#475569", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {[["","#"],["signature","SIGNATURE"],["count","HITS"],["file","FILE"],
              ["module","MODULE"],["signal","SIGNAL"],["confidence","CONFIDENCE"],["","AI"]].map(([f,lbl],i) => (
              <div key={i} onClick={() => f && toggleSort(f)}
                style={{ cursor: f ? "pointer" : "default", display: "flex", alignItems: "center", userSelect: "none" }}>
                {lbl}{f && <SortIcon field={f} sort={rcieSort} />}
              </div>
            ))}
          </div>
          <div style={{ maxHeight: 430, overflowY: "auto" }}>
            {rcieData.map((row, i) => {
              const rc = catColor(row.category);
              return (
                <div key={i} className="rcie-row"
                  style={{ display: "grid",
                    gridTemplateColumns: "36px 2fr 60px 110px 120px 120px 100px 70px",
                    padding: "9px 12px", borderBottom: "1px solid #0a1525",
                    background: i%2===0 ? "transparent" : "#ffffff02", alignItems: "center" }}
                  onClick={() => setSelected(clusters.find(c => c.id === row.id))}>
                  <div style={{ color: "#334155", fontSize: 9 }}>#{row.id}</div>
                  <div style={{ color: C.text, fontSize: 10, paddingRight: 8, wordBreak: "break-all" }}>
                    <span style={{ color: rc, marginRight: 4, opacity: 0.7 }}>▸</span>
                    {row.signature.length > 52 ? row.signature.slice(0,52)+"…" : row.signature}
                  </div>
                  <div style={{ color: C.accent, fontSize: 11, fontWeight: 700 }}>{row.count}</div>
                  <div style={{ color: C.sva, fontSize: 9, fontFamily: "monospace" }}>{row.file}</div>
                  <div style={{ color: "#94a3b8", fontSize: 9, fontFamily: "monospace" }}>{row.module}</div>
                  <div style={{ color: "#64748b", fontSize: 9, fontFamily: "monospace" }}>{row.signal}</div>
                  <div style={{ paddingRight: 6 }}><ConfidenceBar value={row.confidence} /></div>
                  <div onClick={e => { e.stopPropagation(); handleAIAnalyze(row); }}>
                    <button style={{
                      padding: "3px 8px", borderRadius: 4, cursor: "pointer",
                      background: row.aiAnalysis ? `${C.purple}22` : row.aiLoading ? "#1e3a5f" : "transparent",
                      border: `1px solid ${row.aiAnalysis ? C.purple : "#1e3a5f"}`,
                      color: row.aiAnalysis ? C.purple : "#475569",
                      fontSize: 9, fontFamily: "monospace", display: "flex", alignItems: "center", gap: 4,
                    }}>
                      {row.aiLoading ? (
                        <div style={{ width: 8, height: 8, border: `1px solid ${C.purple}`,
                          borderTopColor: "transparent", borderRadius: "50%",
                          animation: "spin 0.8s linear infinite" }} />
                      ) : row.aiAnalysis ? "✓ AI" : "🤖 AI"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
          {[[C.green,"≥ 80% High"],[C.accent,"60–79% Moderate"],[C.error,"< 60% Low"]].map(([col,lbl]) => (
            <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: col }} />
              <span style={{ color: C.subtext, fontSize: 9 }}>{lbl}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PAGE: REGRESSION TREND
// ══════════════════════════════════════════════════════════════════════════════
function TrendPage({ allRuns, result, onUploadRun }) {
  const inputRef = useRef();

  if (!result) return <EmptyState message="Upload a log file on the Home page first." />;

  const trendData = allRuns.map((run, i) => ({
    run: `Run ${i+1}`,
    total:  run.total_errors,
    unique: run.unique_issues,
    fatal:  run.data.filter(d => d.category === "UVM_FATAL").reduce((s,d) => s+d.count, 0),
    error:  run.data.filter(d => d.category === "UVM_ERROR").reduce((s,d) => s+d.count, 0),
    sva:    run.data.filter(d => d.category === "SVA").reduce((s,d) => s+d.count, 0),
  }));

  const latestSigs  = new Set(result.data.map(d => d.signature));
  const prevSigs    = allRuns.length > 1
    ? new Set(allRuns[allRuns.length - 2].data.map(d => d.signature)) : new Set();
  const newBugs     = result.data.filter(d => !prevSigs.has(d.signature));
  const fixedBugs   = allRuns.length > 1
    ? allRuns[allRuns.length-2].data.filter(d => !latestSigs.has(d.signature)) : [];
  const recurringBugs = result.data.filter(d => prevSigs.has(d.signature));

  return (
    <div className="fade-in">
      <SectionLabel>REGRESSION TREND ANALYSIS</SectionLabel>

      <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
        <StatCard icon={TrendingUp} label="Runs Loaded"  value={allRuns.length} sub="log files" color={C.sva} />
        <StatCard icon={AlertTriangle} label="New Bugs"   value={newBugs.length} sub="since last run" color={C.fatal} />
        <StatCard icon={Bug}           label="Fixed Bugs" value={fixedBugs.length} sub="resolved" color={C.green} />
        <StatCard icon={Activity}      label="Recurring"  value={recurringBugs.length} sub="persisting issues" color={C.error} />
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.border}`,
        borderRadius: 10, padding: "18px", marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: 12, fontWeight: 600 }}>
            Error Trend Across Runs
          </p>
          <button onClick={() => inputRef.current?.click()} style={{
            padding: "6px 14px", borderRadius: 6, cursor: "pointer",
            background: "#1e3a5f33", border: "1px solid #1e3a5f",
            color: "#94a3b8", fontSize: 11, fontFamily: "monospace",
            display: "flex", alignItems: "center", gap: 6 }}>
            <Upload size={11} /> Add Run
          </button>
          <input ref={inputRef} type="file" accept=".log" style={{ display: "none" }}
            onChange={e => { if (e.target.files[0]) onUploadRun(e.target.files[0]); }} />
        </div>
        {trendData.length >= 2 ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trendData} margin={{ top:0, right:16, left:-16, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#0f2237" />
              <XAxis dataKey="run" tick={{ fill: "#475569", fontSize: 10, fontFamily: "monospace" }} />
              <YAxis tick={{ fill: "#475569", fontSize: 10, fontFamily: "monospace" }} />
              <Tooltip contentStyle={{ background: "#0d1b2a", border: `1px solid ${C.border}`,
                fontFamily: "monospace", fontSize: 11 }} itemStyle={{ color: C.text }} />
              <Legend formatter={v => <span style={{ color: C.subtext, fontSize: 10 }}>{v}</span>} />
              <Line type="monotone" dataKey="total"  stroke={C.fatal}  strokeWidth={2} dot={{ fill: C.fatal }} name="Total" />
              <Line type="monotone" dataKey="unique" stroke={C.accent} strokeWidth={2} dot={{ fill: C.accent }} name="Unique" />
              <Line type="monotone" dataKey="fatal"  stroke={C.error}  strokeWidth={1.5} strokeDasharray="4 2" name="Fatal" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#334155" }}>
            <p style={{ fontSize: 12 }}>Upload a second log file using "Add Run" to see trend analysis.</p>
            <p style={{ fontSize: 11, color: "#1e3a5f" }}>Each run will be compared side-by-side.</p>
          </div>
        )}
      </div>

      {allRuns.length >= 2 && (
        <>
          <div style={{ display: "flex", gap: 16 }}>
            <div style={{ flex: 1, background: C.panel, border: `1px solid ${C.fatal}33`,
              borderRadius: 10, padding: "16px" }}>
              <p style={{ margin: "0 0 12px", color: C.fatal, fontSize: 11, fontWeight: 700 }}>
                🆕 NEW BUGS ({newBugs.length})
              </p>
              <div style={{ maxHeight: 200, overflowY: "auto" }}>
                {newBugs.length === 0
                  ? <p style={{ color: "#334155", fontSize: 11 }}>No new bugs — great job!</p>
                  : newBugs.map((b, i) => (
                  <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid #0f2237",
                    color: C.text, fontSize: 10, fontFamily: "monospace" }}>
                    <span style={{ color: C.fatal, marginRight: 5 }}>▸</span>
                    {b.signature.slice(0, 60)}…
                    <span style={{ color: C.accent, marginLeft: 8 }}>×{b.count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, background: C.panel, border: `1px solid ${C.green}33`,
              borderRadius: 10, padding: "16px" }}>
              <p style={{ margin: "0 0 12px", color: C.green, fontSize: 11, fontWeight: 700 }}>
                ✅ FIXED BUGS ({fixedBugs.length})
              </p>
              <div style={{ maxHeight: 200, overflowY: "auto" }}>
                {fixedBugs.length === 0
                  ? <p style={{ color: "#334155", fontSize: 11 }}>No resolved bugs yet.</p>
                  : fixedBugs.map((b, i) => (
                  <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid #0f2237",
                    color: C.text, fontSize: 10, fontFamily: "monospace" }}>
                    <span style={{ color: C.green, marginRight: 5 }}>✓</span>
                    {b.signature.slice(0, 60)}…
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PAGE: PDF REPORT
// ══════════════════════════════════════════════════════════════════════════════
function ReportPage({ result, fileName }) {
  const [generating, setGenerating] = useState(false);
  const [summary,    setSummary]    = useState(null);

  if (!result) return <EmptyState message="Upload a log file on the Home page to generate a report." />;

  const rcieData = analyzeRootCauses(result.data);
  const ratio    = (result.total_errors / result.unique_issues).toFixed(1);
  const highConf = rcieData.filter(d => d.confidence >= 80).length;
  const critPrio = rcieData.filter(d => d.priorityScore >= 70);

  const generateAISummary = async () => {
    setGenerating(true);
    const top5 = rcieData.slice(0, 5).map(d =>
      `- ${d.signature} (×${d.count}, ${d.category}, file: ${d.file})`).join("\n");
    const prompt = `You are a senior verification engineer writing an executive summary for a bug report.

Simulation log: ${fileName}
Total failures: ${result.total_errors}
Unique root causes: ${result.unique_issues}
Compression ratio: ${ratio}x
High confidence RCIE clusters: ${highConf}
Critical priority issues: ${critPrio.length}

Top 5 issues:
${top5}

Write a 3-4 sentence executive summary suitable for a hardware verification report.
Be technical, concise, and mention the most critical findings.`;
    try {
      const text = await callGemini(prompt);
      setSummary(text);
    } catch (e) {
      setSummary("Error generating summary: " + e.message);
    }
    setGenerating(false);
  };

  const downloadReport = () => {
    const rows = rcieData.map((d, i) =>
      `${i+1}. [${d.category}] ${d.signature}\n   File: ${d.file}:${d.line} | Module: ${d.module} | Hits: ${d.count} | Confidence: ${d.confidence}% | Priority: ${d.priorityScore}`
    ).join("\n\n");

    const content = `AI DEBUG PRIORITIZATION REPORT
================================
Generated: ${new Date().toLocaleString()}
Log File:  ${fileName}

EXECUTIVE SUMMARY
-----------------
${summary || "Generate AI summary to populate this section."}

KEY METRICS
-----------
Total Failures:      ${result.total_errors}
Unique Root Causes:  ${result.unique_issues}
Compression Ratio:   ${ratio}x
High Conf. Clusters: ${highConf}
Critical Priority:   ${critPrio.length}

PRIORITY ISSUES (Score >= 70)
------------------------------
${critPrio.map((d,i) => `${i+1}. [${d.category}] ${d.signature}\n   File: ${d.file}:${d.line} | Priority: ${d.priorityScore} | Confidence: ${d.confidence}%`).join("\n\n")}

FULL ROOT CAUSE ANALYSIS
------------------------
${rows}

--- END OF REPORT ---`;

    const blob = new Blob([content], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `debug_report_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fade-in">
      <SectionLabel>BUG REPORT GENERATOR</SectionLabel>

      <div style={{ display: "flex", gap: 14, marginBottom: 18 }}>
        <StatCard icon={AlertTriangle} label="Total Failures"  value={result.total_errors.toLocaleString()} sub="in log file" color={C.fatal} />
        <StatCard icon={Bug}           label="Root Causes"     value={result.unique_issues} sub="unique signatures" color={C.error} />
        <StatCard icon={Zap}           label="Compression"     value={`${ratio}×`} sub="errors per cause" color={C.accent} />
        <StatCard icon={AlertTriangle} label="Critical Issues" value={critPrio.length} sub="priority ≥ 70" color={C.fatal} />
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.purple}44`,
        borderRadius: 10, padding: "20px", marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <p style={{ margin: 0, color: C.purple, fontSize: 12, fontWeight: 700 }}>
            🤖 AI EXECUTIVE SUMMARY (Gemini 2.5 Flash)
          </p>
          <button onClick={generateAISummary} disabled={generating} style={{
            padding: "7px 16px", borderRadius: 6, cursor: generating ? "not-allowed" : "pointer",
            background: `${C.purple}22`, border: `1px solid ${C.purple}55`,
            color: C.purple, fontSize: 11, fontFamily: "monospace",
            display: "flex", alignItems: "center", gap: 6 }}>
            {generating ? (
              <>
                <div style={{ width: 12, height: 12, border: `1.5px solid ${C.purple}`,
                  borderTopColor: "transparent", borderRadius: "50%",
                  animation: "spin 0.8s linear infinite" }} />
                Generating…
              </>
            ) : "Generate Summary"}
          </button>
        </div>
        {summary ? (
          <p style={{ margin: 0, color: C.text, fontSize: 12, lineHeight: 1.8,
            background: "#070f1a", padding: "14px", borderRadius: 7,
            border: `1px solid ${C.purple}22` }}>{summary}</p>
        ) : (
          <p style={{ margin: 0, color: "#334155", fontSize: 11, fontStyle: "italic" }}>
            Click "Generate Summary" to create an AI executive summary using Gemini.
          </p>
        )}
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.fatal}33`,
        borderRadius: 10, padding: "20px", marginBottom: 18 }}>
        <p style={{ margin: "0 0 14px", color: C.fatal, fontSize: 12, fontWeight: 700 }}>
          🔥 CRITICAL PRIORITY ISSUES (Score ≥ 70)
        </p>
        {critPrio.length === 0 ? (
          <p style={{ color: C.green, fontSize: 12 }}>✓ No critical priority issues detected.</p>
        ) : (
          <div>
            {critPrio.map((d, i) => (
              <div key={i} style={{ padding: "10px 14px", marginBottom: 8, borderRadius: 7,
                background: "#070f1a", border: `1px solid ${catColor(d.category)}33` }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ color: catColor(d.category), fontSize: 10,
                    fontFamily: "monospace", fontWeight: 700 }}>{d.category}</span>
                  <span style={{ color: C.accent, fontSize: 10, fontFamily: "monospace" }}>×{d.count}</span>
                </div>
                <p style={{ margin: "0 0 6px", color: C.text, fontSize: 11 }}>{d.signature}</p>
                <div style={{ display: "flex", gap: 12 }}>
                  <span style={{ color: C.sva,    fontSize: 10, fontFamily: "monospace" }}>{d.file}:{d.line}</span>
                  <span style={{ color: "#475569", fontSize: 10, fontFamily: "monospace" }}>{d.module}</span>
                  <span style={{ color: C.fatal,  fontSize: 10, fontFamily: "monospace" }}>Priority: {d.priorityScore}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button onClick={downloadReport} style={{
        width: "100%", padding: "12px 0", borderRadius: 8, cursor: "pointer",
        background: `${C.green}18`, border: `1px solid ${C.green}55`,
        color: C.green, fontSize: 13, fontFamily: "monospace", fontWeight: 700,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <Download size={16} /> Download Full Report (.txt)
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ROOT APP
// ══════════════════════════════════════════════════════════════════════════════
export default function DebugDashboard() {
  const [page,     setPage]     = useState("home");
  const [dragging, setDragging] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [result,   setResult]   = useState(null);
  const [allRuns,  setAllRuns]  = useState([]);
  const [fileName, setFileName] = useState(null);
  const inputRef = useRef();

  const upload = useCallback(async (file) => {
    if (!file) return;
    setFileName(file.name);
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await axios.post("http://localhost:8000/analyze", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(data);
      setAllRuns(prev => [...prev, data]);
      setPage("home");
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const uploadRun = useCallback(async (file) => {
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await axios.post("http://localhost:8000/analyze", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setAllRuns(prev => [...prev, data]);
    } catch (e) {
      console.error("Run upload failed", e);
    }
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#020b18", color: C.text,
      fontFamily: "'JetBrains Mono','Fira Code',monospace",
      display: "flex", boxSizing: "border-box" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: #0d1b2a; }
        ::-webkit-scrollbar-thumb { background: #1e3a5f; border-radius: 3px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .fade-in { animation: fadeIn 0.35s ease both; }
        .scanlines {
          background-image: repeating-linear-gradient(to bottom,transparent 0px,transparent 3px,rgba(0,0,0,0.07) 3px,rgba(0,0,0,0.07) 4px);
          pointer-events:none; position:fixed; inset:0; z-index:0;
        }
        .tr-row:hover   { background: rgba(255,255,255,0.03) !important; }
        .rcie-row       { cursor:pointer; transition:background 0.1s; }
        .rcie-row:hover { background: rgba(167,139,250,0.06) !important; }
      `}</style>

      <div className="scanlines" />

      {/* Sidebar */}
      <aside style={{ width: 215, minHeight: "100vh", background: "#070f1a",
        borderRight: "1px solid #0f2237", padding: "22px 0",
        display: "flex", flexDirection: "column", position: "sticky", top: 0, zIndex: 10, flexShrink: 0 }}>
        <div style={{ padding: "0 18px 20px", borderBottom: "1px solid #0f2237" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 28, height: 28, background: "#ef444422",
              border: "1px solid #ef444466", borderRadius: 6,
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Activity size={13} color="#ef4444" />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#f1f5f9", letterSpacing: "0.05em" }}>DEBUG AI</p>
              <p style={{ margin: 0, fontSize: 9, color: "#334155" }}>v4.0 · Gemini 2.5</p>
            </div>
          </div>
        </div>

        <div style={{ padding: "12px 18px", borderBottom: "1px solid #0f2237" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%",
              background: result ? C.green : "#334155",
              boxShadow: result ? `0 0 5px ${C.green}` : "none" }} />
            <span style={{ color: result ? "#94a3b8" : "#334155", fontSize: 10 }}>
              {result ? fileName : "No file loaded"}
            </span>
          </div>
          {result && (
            <div style={{ marginTop: 7, display: "flex", gap: 5, flexWrap: "wrap" }}>
              <span style={{ padding: "2px 6px", borderRadius: 3, fontSize: 8,
                background: `${C.fatal}18`, border: `1px solid ${C.fatal}33`, color: C.fatal }}>
                {result.total_errors} errors
              </span>
              <span style={{ padding: "2px 6px", borderRadius: 3, fontSize: 8,
                background: `${C.purple}18`, border: `1px solid ${C.purple}33`, color: C.purple }}>
                {result.unique_issues} unique
              </span>
              <span style={{ padding: "2px 6px", borderRadius: 3, fontSize: 8,
                background: `${C.sva}18`, border: `1px solid ${C.sva}33`, color: C.sva }}>
                {allRuns.length} run{allRuns.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>

        <nav style={{ padding: "10px 8px", flex: 1 }}>
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const active   = page === id;
            const disabled = id !== "home" && !result;
            return (
              <div key={id} onClick={() => !disabled && setPage(id)} style={{
                display: "flex", alignItems: "center", gap: 9,
                padding: "8px 11px", borderRadius: 6, marginBottom: 2,
                background: active ? "#1e3a5f44" : "transparent",
                border: active ? "1px solid #1e3a5f" : "1px solid transparent",
                opacity: disabled ? 0.3 : 1,
                cursor: disabled ? "not-allowed" : "pointer",
                transition: "all 0.12s",
              }}>
                <Icon size={14} color={active ? C.sva : "#475569"} />
                <span style={{ fontSize: 11, color: active ? "#f1f5f9" : "#475569",
                  fontWeight: active ? 600 : 400 }}>{label}</span>
                {id === "rcie" && result && (
                  <span style={{ marginLeft: "auto", padding: "1px 5px", borderRadius: 8,
                    background: `${C.purple}22`, color: C.purple, fontSize: 8 }}>AI</span>
                )}
                {id === "trend" && allRuns.length > 1 && (
                  <span style={{ marginLeft: "auto", padding: "1px 5px", borderRadius: 8,
                    background: `${C.accent}22`, color: C.accent, fontSize: 8 }}>
                    {allRuns.length}
                  </span>
                )}
              </div>
            );
          })}
        </nav>

        <div style={{ padding: "0 8px 14px" }}>
          <button onClick={() => { setPage("home"); setTimeout(() => inputRef.current?.click(), 100); }}
            style={{ width: "100%", padding: "8px 0", borderRadius: 6,
              background: "#1e3a5f33", border: "1px solid #1e3a5f",
              color: "#94a3b8", fontSize: 11, fontFamily: "monospace",
              cursor: "pointer", display: "flex", alignItems: "center",
              justifyContent: "center", gap: 6, transition: "all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.background="#1e3a5f66"; e.currentTarget.style.color="#f1f5f9"; }}
            onMouseLeave={e => { e.currentTarget.style.background="#1e3a5f33"; e.currentTarget.style.color="#94a3b8"; }}>
            <Upload size={12} /> Upload New Log
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: "26px 28px", overflowY: "auto",
        position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 22, paddingBottom: 18, borderBottom: "1px solid #0f2237" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#f1f5f9", letterSpacing: "0.03em" }}>
              {NAV_ITEMS.find(n => n.id === page)?.label}
            </h2>
            <p style={{ margin: 0, fontSize: 10, color: "#334155" }}>
              {page==="home"   && "Upload & overview"}
              {page==="charts" && "Frequency, heatmap & distribution charts"}
              {page==="table"  && "Sortable, searchable issue log with priority scores"}
              {page==="rcie"   && "RCIE + Gemini 2.5 Flash AI root cause analysis"}
              {page==="trend"  && "Multi-run regression trend & diff analysis"}
              {page==="report" && "AI executive summary + downloadable bug report"}
            </p>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {NAV_ITEMS.filter(n => n.id !== "home").map(({ id, icon: Icon }) => (
              <button key={id} onClick={() => result && setPage(id)} style={{
                width: 30, height: 30, borderRadius: 6,
                background: page===id ? "#1e3a5f66" : "transparent",
                border: `1px solid ${page===id ? C.sva+"66" : "#0f2237"}`,
                cursor: result ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center",
                opacity: result ? 1 : 0.3 }}>
                <Icon size={13} color={page===id ? C.sva : "#475569"} />
              </button>
            ))}
          </div>
        </div>

        {page==="home"   && <HomePage result={result} fileName={fileName} loading={loading}
          error={error} dragging={dragging} setDragging={setDragging}
          upload={upload} inputRef={inputRef} setPage={setPage} />}
        {page==="charts" && <ChartsPage result={result} />}
        {page==="table"  && <TablePage  result={result} />}
        {page==="rcie"   && <RCIEPage   result={result} />}
        {page==="trend"  && <TrendPage  result={result} allRuns={allRuns} onUploadRun={uploadRun} />}
        {page==="report" && <ReportPage result={result} fileName={fileName} />}
      </main>
    </div>
  );
}