import { useState } from "react";
import DebugDashboard from "./DebugDashboard";
import ArchDiagram from "./ArchDiagram";

export default function App() {
  const [view, setView] = useState("dashboard");

  return (
    <div>
      {/* Tab switcher */}
      <div style={{
        display: "flex", gap: 8, padding: "10px 24px",
        background: "#070f1a", borderBottom: "1px solid #0f2237",
        fontFamily: "monospace",
      }}>
        {[
          { id: "dashboard", label: "🛠 Debug Dashboard" },
          { id: "arch",      label: "⚙ Architecture" },
        ].map(({ id, label }) => (
          <button key={id} onClick={() => setView(id)} style={{
            padding: "6px 16px", borderRadius: 5, cursor: "pointer",
            fontFamily: "monospace", fontSize: 12,
            background: view === id ? "#1e3a5f66" : "transparent",
            border: `1px solid ${view === id ? "#38bdf866" : "#1e3a5f"}`,
            color: view === id ? "#f1f5f9" : "#475569",
            transition: "all 0.15s",
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* Page content */}
      {view === "dashboard" && <DebugDashboard />}
      {view === "arch"      && <ArchDiagram />}
    </div>
  );
}