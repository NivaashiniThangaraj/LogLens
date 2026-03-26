"""
simv.py – Simulated reproduction runner for Debug AI
Supports optional +DEBUG_MODULE=<name> flag to filter output to
only lines that concern the specified module.
"""

import sys
import time
import random
import re
from datetime import datetime

# ─────────────────────────────────────────────────────────
# Parse CLI arguments  (+KEY=VALUE  or  +FLAG)
# ─────────────────────────────────────────────────────────

def parse_args(argv: list[str]) -> dict:
    args = {}
    for token in argv[1:]:
        if token.startswith("+"):
            token = token[1:]
            if "=" in token:
                k, v = token.split("=", 1)
                args[k.upper()] = v
            else:
                args[token.upper()] = True
    return args


# ─────────────────────────────────────────────────────────
# Synthetic log bank  (realistic-looking UVM/SVA lines)
# ─────────────────────────────────────────────────────────

SYNTHETIC_LOGS = [
    # (relative_ns, level, path_suffix, message)
    (100,  "UVM_INFO",    "agent.driver",         "Starting packet transmission"),
    (200,  "UVM_INFO",    "agent.monitor",         "Monitoring bus activity"),
    (500,  "UVM_WARNING", "agent.driver",         "Back-pressure detected, retrying"),
    (700,  "UVM_INFO",    "agent.sequencer",       "Sequence item sent"),
    (900,  "UVM_ERROR",   "agent.driver",         "Packet size mismatch: expected=64 got=48"),
    (1100, "UVM_INFO",    "agent.monitor",         "Captured response packet"),
    (1300, "UVM_WARNING", "agent.monitor",         "Unexpected idle cycle observed"),
    (1500, "UVM_ERROR",   "scoreboard",            "Data mismatch: exp=0xDEAD got=0xBEEF"),
    (1700, "UVM_INFO",    "coverage_collector",    "Coverage point hit: pkt_size_64"),
    (1900, "SVA_FAILURE", "protocol_checker",      "Assertion axi_valid_stable failed"),
    (2100, "UVM_ERROR",   "scoreboard",            "Transaction count mismatch: exp=10 got=9"),
    (2300, "UVM_FATAL",   "agent.driver",         "Unrecoverable bus error – aborting"),
    (2500, "UVM_INFO",    "env",                   "Simulation ending due to fatal error"),
]


# ─────────────────────────────────────────────────────────
# FEATURE 5 – Log filtering by module
# ─────────────────────────────────────────────────────────

def should_include_line(line: str, debug_module: str | None) -> bool:
    """
    Return True if the line is relevant given the active DEBUG_MODULE filter.
    When no filter is active every line passes.
    Rules:
      - Always pass non-error bookkeeping lines (simulation start/end, seed info)
      - Pass lines whose path contains the target module name
      - Pass UVM_FATAL lines regardless (they affect everyone)
    """
    if not debug_module:
        return True

    low = line.lower()
    module_low = debug_module.lower()

    # Always keep structural / header lines
    if any(kw in low for kw in ("simulation", "seed", "testname", "finish", "starting sim")):
        return True

    # Always keep fatal errors
    if "uvm_fatal" in low:
        return True

    # Keep lines that mention the target module in the hierarchy path
    if module_low in low:
        return True

    return False


# ─────────────────────────────────────────────────────────
# Simulation runner
# ─────────────────────────────────────────────────────────

def run_simulation(args: dict) -> None:
    test_name    = args.get("UVM_TESTNAME", "default_test")
    seed         = args.get("NTB_RANDOM_SEED", str(random.randint(1, 99999)))
    debug_module = args.get("DEBUG_MODULE")          # may be None

    base_ns = random.randint(1000, 3000)

    # ── Header ──────────────────────────────────────────
    header_lines = [
        "",
        "=" * 60,
        f"  Debug AI Simulator  –  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "=" * 60,
        f"  Test    : {test_name}",
        f"  Seed    : {seed}",
    ]
    if debug_module:
        header_lines.append(f"  Filter  : DEBUG_MODULE={debug_module}  [targeted mode]")
    else:
        header_lines.append("  Filter  : none  [full simulation]")
    header_lines += ["=" * 60, "  Starting simulation…", ""]

    for line in header_lines:
        print(line)

    # ── Log emission ────────────────────────────────────
    error_count   = 0
    warning_count = 0
    printed_count = 0

    for rel_ns, level, path_suffix, message in SYNTHETIC_LOGS:
        ts   = base_ns + rel_ns
        path = f"uvm_test_top.env.{path_suffix}"
        line = f"{level:<14} @ {ts}ns : {path}  {message}"

        time.sleep(0.07)   # simulate real-time streaming

        if should_include_line(line, debug_module):
            print(line)
            printed_count += 1

        if "ERROR" in level:
            error_count += 1
        if "WARNING" in level:
            warning_count += 1

    # ── Footer ──────────────────────────────────────────
    print()
    print("=" * 60)
    print("  Simulation complete")
    print(f"  Total errors   : {error_count}")
    print(f"  Total warnings : {warning_count}")
    if debug_module:
        print(f"  Lines shown    : {printed_count}  (filtered to '{debug_module}')")
    print("=" * 60)
    print()

    if error_count > 0:
        sys.exit(1)


# ─────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    parsed = parse_args(sys.argv)
    run_simulation(parsed)