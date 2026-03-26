/**
 * AnalysisPage.jsx  –  Integration example
 *
 * Drop-in replacement / extension of your existing analysis page.
 * Shows how to upload a log, call /analyze, and render the new
 * FailureGraph component alongside existing results.
 */

import { useState, useCallback } from "react";
import FailureGraph from "./FailureGraph";

const API_BASE = import.meta?.env?.VITE_API_URL ?? "http://localhost:8000";

export default function AnalysisPage() {
  const [result,   setResult]   = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [filename, setFilename] = useState("");

  const handleUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFilename(file.name);
    setLoading(true);
    setError(null);
    setResult(null);

    const form = new FormData();
    form.append("file", file);

    try {
      const res  = await fetch(`${API_BASE}/analyze`, { method: "POST", body: form });
      if (!res.ok) throw new Error(await res.text());
      setResult(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div style={{ padding: 32, maxWidth: 960, margin: "0 auto" }}>
      <h1>Debug AI</h1>

      {/* Upload */}
      <label style={{ display: "inline-block", marginBottom: 24 }}>
        <span style={{ marginRight: 12 }}>Upload simulation log:</span>
        <input type="file" accept=".log,.txt" onChange={handleUpload} />
      </label>

      {loading && <p>Analysing {filename}…</p>}
      {error   && <p style={{ color: "red" }}>Error: {error}</p>}

      {result && (
        <>
          {/* ── Existing summary ── */}
          <p>Total errors: {result.total_errors} | Unique issues: {result.unique_issues}</p>

          {/* ── NEW: Failure Dependency Graph ── */}
          <FailureGraph
            failureChain={result.failure_chain}
            modules={result.modules}
            rootCause={result.root_cause}
            moduleScores={result.module_scores}
            reproduction={result.reproduction}
          />

          {/* ── Existing clusters / repro cmd can follow here ── */}
        </>
      )}
    </div>
  );
}