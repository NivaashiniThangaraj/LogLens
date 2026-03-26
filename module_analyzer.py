"""
Module Extraction, Dependency Chain Detection, and Root Cause Scoring
for Debug AI - Failure Dependency Graph Feature
"""

import re
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Optional


# ─────────────────────────────────────────────
# Data Structures
# ─────────────────────────────────────────────

@dataclass
class LogEvent:
    timestamp_ns: int
    level: str          # UVM_ERROR | UVM_WARNING | UVM_FATAL | SVA_FAILURE
    module: str
    message: str
    raw_line: str


@dataclass
class ModuleStats:
    name: str
    count: int = 0
    earliest_ts: int = field(default_factory=lambda: int(1e18))
    latest_ts: int = 0
    levels: dict = field(default_factory=lambda: defaultdict(int))
    downstream_count: int = 0   # filled during chain analysis


# ─────────────────────────────────────────────
# Regex Patterns
# ─────────────────────────────────────────────

# Matches:   UVM_ERROR @ 2200ns : uvm_test_top.env.agent.driver Packet ...
#            UVM_WARNING @ 3100ns : uvm_test_top.env.scoreboard ...
#            SVA_FAILURE @ 2500ns : uvm_test_top.env.protocol_checker ...
LOG_PATTERN = re.compile(
    r"(?P<level>UVM_ERROR|UVM_WARNING|UVM_FATAL|SVA_FAILURE)"
    r"\s+@\s+(?P<ts>\d+)ns\s*:"
    r"\s+uvm_test_top\.env(?:\.agent)?\.(?P<module>\w+)"
    r"(?:\s+(?P<message>.*))?",
    re.IGNORECASE,
)

# Fallback – grab module anywhere inside the hierarchy path
MODULE_PATH_PATTERN = re.compile(
    r"uvm_test_top\.env\.(?:\w+\.)*(?P<module>\w+)",
    re.IGNORECASE,
)


# ─────────────────────────────────────────────
# FEATURE 1 – Module Extraction
# ─────────────────────────────────────────────

def extract_modules(log_text: str) -> dict:
    """
    Parse raw log text and return per-module occurrence counts.

    Returns
    -------
    {
      "modules": [
        {"name": "driver", "count": 12},
        ...
      ]
    }
    """
    stats: dict[str, ModuleStats] = {}
    events: list[LogEvent] = []

    for line in log_text.splitlines():
        m = LOG_PATTERN.search(line)
        if not m:
            continue

        level   = m.group("level").upper()
        ts      = int(m.group("ts"))
        module  = m.group("module").lower()
        message = (m.group("message") or "").strip()

        if module not in stats:
            stats[module] = ModuleStats(name=module)

        s = stats[module]
        s.count += 1
        s.levels[level] += 1
        s.earliest_ts = min(s.earliest_ts, ts)
        s.latest_ts   = max(s.latest_ts,   ts)

        events.append(LogEvent(ts, level, module, message, line.strip()))

    modules_sorted = sorted(stats.values(), key=lambda x: -x.count)
    return {
        "modules": [{"name": s.name, "count": s.count} for s in modules_sorted],
        "_stats":  stats,   # internal – used by downstream functions
        "_events": events,
    }


# ─────────────────────────────────────────────
# FEATURE 2 – Failure Chain Detection
# ─────────────────────────────────────────────

def build_failure_chain(extracted: dict) -> dict:
    """
    Order modules by their *first* error timestamp to produce a causal chain.

    Returns
    -------
    {
      "failure_chain": ["driver", "monitor", "scoreboard"]
    }
    """
    stats: dict[str, ModuleStats] = extracted.get("_stats", {})
    if not stats:
        return {"failure_chain": []}

    ordered = sorted(stats.values(), key=lambda s: s.earliest_ts)
    chain   = [s.name for s in ordered]

    # annotate downstream counts (each module propagates failures to later ones)
    for i, mod in enumerate(ordered):
        mod.downstream_count = len(ordered) - i - 1

    return {"failure_chain": chain}


# ─────────────────────────────────────────────
# FEATURE 3 – Root Cause Scoring
# ─────────────────────────────────────────────

_LEVEL_WEIGHT = {
    "UVM_FATAL":   1.0,
    "SVA_FAILURE": 0.85,
    "UVM_ERROR":   0.70,
    "UVM_WARNING": 0.40,
}

def score_root_cause(extracted: dict, chain: list[str]) -> dict:
    """
    Compute a root-cause confidence score for each module.

    Scoring factors
    ---------------
    1. Temporal priority   – earlier first-error → higher score
    2. Downstream reach    – more modules follow → higher score
    3. Error severity      – FATAL > SVA > ERROR > WARNING
    4. Error volume        – raw count (log-scaled to avoid domination)

    Returns
    -------
    {
      "root_cause": {"module": "driver", "confidence": 0.91},
      "scores":     [{"module": "driver", "score": 0.91}, ...]
    }
    """
    import math

    stats: dict[str, ModuleStats] = extracted.get("_stats", {})
    if not stats or not chain:
        return {"root_cause": {"module": "unknown", "confidence": 0.0}, "scores": []}

    n = len(chain)
    scores: dict[str, float] = {}

    for i, name in enumerate(chain):
        s = stats.get(name)
        if not s:
            scores[name] = 0.0
            continue

        # 1. Temporal score: first in chain gets 1.0, last gets ~0
        temporal = (n - i) / n

        # 2. Downstream reach score
        downstream = s.downstream_count / max(n - 1, 1)

        # 3. Severity score: weighted average over observed levels
        total_events = max(s.count, 1)
        severity = sum(
            _LEVEL_WEIGHT.get(lvl, 0.3) * cnt
            for lvl, cnt in s.levels.items()
        ) / total_events

        # 4. Volume score (log scale so huge counts don't overwhelm)
        volume = math.log1p(s.count) / math.log1p(max(st.count for st in stats.values()))

        # Weighted combination
        score = (
            0.40 * temporal   +
            0.30 * downstream +
            0.20 * severity   +
            0.10 * volume
        )
        scores[name] = round(score, 4)

    ranked = sorted(scores.items(), key=lambda x: -x[1])
    top_module, top_score = ranked[0] if ranked else ("unknown", 0.0)

    return {
        "root_cause": {
            "module":     top_module,
            "confidence": round(top_score, 2),
        },
        "scores": [{"module": m, "score": s} for m, s in ranked],
    }


# ─────────────────────────────────────────────
# Combined Analysis Entry Point
# ─────────────────────────────────────────────

def analyze_modules(log_text: str) -> dict:
    """
    Run all three analyses and return a combined result dict ready to merge
    into the /analyze endpoint response.
    """
    extracted    = extract_modules(log_text)
    chain_result = build_failure_chain(extracted)
    chain        = chain_result["failure_chain"]
    rc_result    = score_root_cause(extracted, chain)

    return {
        "modules":       extracted["modules"],
        "failure_chain": chain,
        "root_cause":    rc_result["root_cause"],
        "module_scores": rc_result["scores"],
    }