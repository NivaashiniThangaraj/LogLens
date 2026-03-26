import { useState } from "react";
import { Copy, Play, Terminal, CheckCircle, AlertTriangle } from "lucide-react";

/**
 * ReproductionPanel
 * Props:
 *   reproduction: { test: string, seed: string, command: string } | null
 *
 * Drop this component anywhere in your dashboard.
 * It is self-contained — no extra dependencies beyond lucide-react and axios.
 */
export default function ReproductionPanel({ reproduction }) {
  const [copied,   setCopied]   = useState(false);
  const [running,  setRunning]  = useState(false);
  const [output,   setOutput]   = useState(null);
  const [simError, setSimError] = useState(null);

  if (!reproduction) {
    return (
      <div style={{
        background: "linear-gradient(135deg, #0d1b2a, #0a0f1e)",
        border: "1px solid #f9731644",
        borderRadius: 10,
        padding: "20px",
        marginBottom: 20,
        color: "#94a3b8",
        fontSize: 12,
        fontFamily: "monospace",
      }}>
        ⚠ Reproduction info not available
      </div>
    );
  }

  const test = reproduction?.test || "unknown";
  const seed = reproduction?.seed || "unknown";
  const command = reproduction?.command || "";

  // ── Copy command to clipboard ──────────────────────────────────────────
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback for non-HTTPS or restricted environments
      const el = document.createElement("textarea");
      el.value = command;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ── Run simulation ─────────────────────────────────────────────────────
  const handleRun = async () => {
    setRunning(true);
    setOutput(null);
    setSimError(null);
    try {
      const res = await fetch("http://localhost:8000/run_simulation", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ test, seed }),
      });
      const data = await res.json();
      setOutput(data.output);
      if (data.returncode !== 0) setSimError(`Exit code: ${data.returncode}`);
    } catch (e) {
      setSimError("Failed to reach backend: " + e.message);
    } finally {
      setRunning(false);
    }
  };

  // ── Colour output lines by severity ───────────────────────────────────
  const colorLine = (line) => {
    if (/UVM_FATAL/i.test(line))   return "#ef4444";
    if (/UVM_ERROR/i.test(line))   return "#f97316";
    if (/UVM_WARNING/i.test(line)) return "#facc15";
    if (/UVM_INFO/i.test(line))    return "#94a3b8";
    if (/=+/.test(line))           return "#1e3a5f";
    if (/finished|exit/i.test(line)) return "#22c55e";
    return "#e2e8f0";
  };

  return (
    <div style={{
      background: "linear-gradient(135deg, #0d1b2a, #0a0f1e)",
      border: "1px solid #22c55e44",
      borderRadius: 10,
      padding: "20px",
      marginBottom: 20,
    }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 6,
          background: "#22c55e18", border: "1px solid #22c55e44",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Play size={15} color="#22c55e" />
        </div>
        <div>
          <p style={{ margin: 0, color: "#22c55e", fontSize: 12,
            fontWeight: 700, letterSpacing: "0.05em", fontFamily: "monospace" }}>
            FAILURE REPRODUCTION SYSTEM
          </p>
          <p style={{ margin: 0, color: "#475569", fontSize: 10, fontFamily: "monospace" }}>
            Extracted from simulation log — ready to re-run
          </p>
        </div>
      </div>

      {/* Meta grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        {[
          { label: "🧪 Test Name",   value: test },
          { label: "🎲 Random Seed", value: seed },
        ].map(({ label, value }) => (
          <div key={label} style={{
            background: "#070f1a", borderRadius: 7,
            padding: "10px 14px", border: "1px solid #0f2237",
          }}>
            <p style={{ margin: "0 0 4px", color: "#475569", fontSize: 9,
              textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: "monospace" }}>
              {label}
            </p>
            <p style={{ margin: 0, color: "#38bdf8", fontSize: 13,
              fontFamily: "monospace", fontWeight: 600 }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Command box */}
      <div style={{ marginBottom: 14 }}>
        <p style={{ margin: "0 0 7px", color: "#475569", fontSize: 9,
          textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: "monospace" }}>
          REPRODUCTION COMMAND
        </p>
        <div style={{
          display: "flex", alignItems: "center", gap: 0,
          background: "#020b18", border: "1px solid #1e3a5f",
          borderRadius: 7, overflow: "hidden",
        }}>
          <code style={{
            flex: 1, padding: "11px 14px",
            color: "#facc15", fontSize: 12, fontFamily: "monospace",
            overflowX: "auto", whiteSpace: "nowrap",
          }}>
            {command}
          </code>
          <button onClick={handleCopy} style={{
            padding: "11px 14px", background: copied ? "#22c55e22" : "#0d1b2a",
            border: "none", borderLeft: "1px solid #1e3a5f",
            cursor: "pointer", color: copied ? "#22c55e" : "#475569",
            display: "flex", alignItems: "center", gap: 5,
            fontSize: 11, fontFamily: "monospace",
            transition: "all 0.15s", flexShrink: 0,
          }}>
            {copied
              ? <><CheckCircle size={13} /> Copied!</>
              : <><Copy size={13} /> Copy</>
            }
          </button>
        </div>
      </div>

      {/* Run button */}
      <button onClick={handleRun} disabled={running} style={{
        width: "100%", padding: "10px 0", borderRadius: 7,
        background: running ? "#1e3a5f33" : "#22c55e18",
        border: `1px solid ${running ? "#1e3a5f" : "#22c55e55"}`,
        color: running ? "#475569" : "#22c55e",
        fontSize: 12, fontFamily: "monospace", fontWeight: 700,
        cursor: running ? "not-allowed" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        transition: "all 0.15s", marginBottom: output || simError ? 14 : 0,
      }}>
        {running ? (
          <>
            <div style={{
              width: 14, height: 14, border: "2px solid #22c55e",
              borderTopColor: "transparent", borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }} />
            Running simulation…
          </>
        ) : (
          <><Play size={14} /> Run Simulation</>
        )}
      </button>

      {/* Terminal output */}
      {(output || simError) && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
            <Terminal size={13} color="#94a3b8" />
            <p style={{ margin: 0, color: "#94a3b8", fontSize: 9,
              textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: "monospace" }}>
              SIMULATION OUTPUT
            </p>
            {simError && (
              <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4,
                color: "#f97316", fontSize: 10, fontFamily: "monospace" }}>
                <AlertTriangle size={11} /> {simError}
              </span>
            )}
          </div>
          <div style={{
            background: "#020b18", border: "1px solid #1e3a5f",
            borderRadius: 7, padding: "12px 14px",
            fontFamily: "monospace", fontSize: 11, lineHeight: 1.8,
            maxHeight: 320, overflowY: "auto",
          }}>
            {(output || "").split("\n").map((line, i) => (
              <div key={i} style={{ color: colorLine(line), whiteSpace: "pre-wrap" }}>
                {line || "\u00A0"}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}