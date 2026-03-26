"""
main.py – Debug AI FastAPI backend
Handles:
 - log analysis
 - failure clustering
 - module dependency graph
 - targeted reproduction
 - streaming simulation output
"""

import re
import subprocess
import sys
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from module_analyzer import analyze_modules

app = FastAPI(title="Debug AI", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SIMV_PATH = Path(__file__).parent / "simv.py"


# ─────────────────────────────────────
# Error Detection
# ─────────────────────────────────────

def detect_errors(text):

    pattern = re.compile(
        r"(UVM_ERROR|UVM_FATAL|SVA_FAILURE|UVM_WARNING)"
        r"\s+@\s+(\d+)ns\s*:\s+(\S+)\s+(.*)",
        re.IGNORECASE
    )

    errors = []

    for line in text.splitlines():

        m = pattern.search(line)

        if m:

            errors.append({
                "level": m.group(1),
                "timestamp": int(m.group(2)),
                "path": m.group(3),
                "message": m.group(4)
            })

    return errors


# ─────────────────────────────────────
# Failure Clustering
# ─────────────────────────────────────

def cluster_failures(errors):

    clusters = {}

    for e in errors:

        key = re.sub(r"0x[0-9a-fA-F]+|\d+", "#", e["message"])[:80]

        if key not in clusters:
            clusters[key] = {
                "signature": key,
                "count": 0,
                "category": e["level"],   # store error category
                "sample": e
            }

        clusters[key]["count"] += 1

    return list(clusters.values())


# ─────────────────────────────────────
# Extract Reproduction Info
# ─────────────────────────────────────

def extract_reproduction(text):

    seed_match = re.search(r"Random seed\s*=\s*(\d+)", text)
    test_match = re.search(r"Running test\s+(\w+)", text)

    seed = seed_match.group(1) if seed_match else "12345"
    test = test_match.group(1) if test_match else "default_test"

    return {
        "command": f"./simv +UVM_TESTNAME={test} +ntb_random_seed={seed}",
        "seed": seed,
        "test": test
    }


# ─────────────────────────────────────
# API: Analyze Log
# ─────────────────────────────────────

@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):

    content = await file.read()

    try:
        text = content.decode("utf-8")
    except:
        text = content.decode("latin-1")

    errors = detect_errors(text)

    clusters = cluster_failures(errors)

    reproduction = extract_reproduction(text)

    module_data = analyze_modules(text)

    return {

        "total_errors": len(errors),
        "unique_issues": len(clusters),

        "data": clusters,

        "modules": module_data["modules"],
        "failure_chain": module_data["failure_chain"],
        "root_cause": module_data["root_cause"],
        "module_scores": module_data["module_scores"],

        "reproduction": reproduction
    }


# ─────────────────────────────────────
# Simulation Request Model
# ─────────────────────────────────────

class SimulationRequest(BaseModel):

    test: str = "default_test"
    seed: str = "12345"
    module: Optional[str] = None


class SimulationResponse(BaseModel):

    command: str
    output: str
    exit_code: int


# ─────────────────────────────────────
# Run Simulation (non-stream)
# ─────────────────────────────────────

@app.post("/run_simulation", response_model=SimulationResponse)
async def run_simulation(req: SimulationRequest):

    cmd = [
        sys.executable,
        str(SIMV_PATH),
        f"+UVM_TESTNAME={req.test}",
        f"+ntb_random_seed={req.seed}"
    ]

    if req.module:
        cmd.append(f"+DEBUG_MODULE={req.module}")

    command_str = " ".join(cmd)

    try:

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30
        )

        return SimulationResponse(
            command=command_str,
            output=result.stdout + (result.stderr or ""),
            exit_code=result.returncode
        )

    except subprocess.TimeoutExpired:

        raise HTTPException(status_code=504, detail="Simulation timed out")

    except Exception as e:

        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────
# Streaming Simulation (SSE)
# ─────────────────────────────────────

def stream_generator(cmd):

    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True
    )

    for line in proc.stdout:

        yield f"data: {{\"line\": \"{line.strip()}\"}}\n\n"

    proc.wait()


@app.post("/stream_simulation")
def stream_simulation(req: SimulationRequest):

    cmd = [
        sys.executable,
        str(SIMV_PATH),
        f"+UVM_TESTNAME={req.test}",
        f"+ntb_random_seed={req.seed}"
    ]

    if req.module:
        cmd.append(f"+DEBUG_MODULE={req.module}")

    return StreamingResponse(
        stream_generator(cmd),
        media_type="text/event-stream"
    )


# ─────────────────────────────────────
# Dev Entry Point
# ─────────────────────────────────────

if __name__ == "__main__":

    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )