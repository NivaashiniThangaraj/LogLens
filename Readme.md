⚡ AI-Enabled Debug Prioritization (Debug AI)

An intelligent log analysis and targeted reproduction dashboard for SystemVerilog/UVM ASIC Verification. Bridging the gap between raw text logs and targeted waveform reproduction to transform how verification engineers isolate hardware bugs.

📖 The Problem: "The Global Waveform Dilemma"

In modern semiconductor design, verifying a System-on-Chip (SoC) involves running thousands of randomized tests overnight. When a test fails, engineers face two major bottlenecks:

The "Needle in a Haystack" Log Problem: Engineers must manually read through 10,000+ line text logs to find the exact UVM_ERROR, UVM_FATAL, or SVA_FAILURE that caused the crash.

The "Global Waveform" Compute Bottleneck: Because finding the exact hierarchical path of a bug is difficult, engineers often turn on waveform dumping (VCD/FSDB) for the entire chip to reproduce the error. This slows down simulation speeds by 10x to 50x, wastes server memory, and generates laggy, gigabyte-sized debug files.

🎯 Our Solution

Debug AI automatically parses UVM/EDA logs, maps the chronological dependency of the failures, identifies the exact root cause module, and generates a Targeted Reproduction Command. By injecting targeted verbosity flags (e.g., +uvm_set_verbosity), engineers can re-run simulations at full speed and dump waveforms only for the specific module that failed.

✨ Core Features

📊 Intelligent Log Extraction: Parses raw EDA terminal logs to extract dynamic runtime data, including failing UVM components, SVA assertions, test names, and randomized seeds.

🕸️ Failure Dependency Graph: A custom-built, interactive SVG graph that visually maps the propagation of errors, tracking how a failure in one module (e.g., a physical interface) cascades into downstream components (e.g., monitors and scoreboards).

🧠 Algorithmic Root Cause Scoring: Replaces guesswork with a mathematical confidence score evaluating Temporal Priority (who failed first), Downstream Reach, Error Severity, and Error Volume to pinpoint the exact root cause module.

🛠️ Targeted EDA Command Generator: Automatically synthesizes the exact Linux CLI command needed to reproduce the bug for Synopsys VCS, Aldec Riviera-PRO, and Siemens Questa.

🛡️ Interactive Verification Engine: An "Engineer-in-the-Loop" UI that allows the user to cross-reference the AI's predicted root cause with the resulting waveform, verify the exact match, and definitively close the debug loop.

💻 Technology Stack & Architecture

⚛️ React Frontend Architecture

The frontend is a single-page React application (built with Vite) engineered for high performance and visual clarity. It does not rely on heavy third-party charting libraries; instead, it uses custom, math-driven SVG rendering to ensure the dependency graphs load instantly.

DebugDashboard.jsx (Main Container): Handles state management, drag-and-drop log uploading, and API communication with the Python backend.

FailureGraph.jsx (The Core Engine): * SVG Visualization: Dynamically calculates node positions, curve paths (Q Bezier curves), and glowing root-cause highlights based on the array of failing modules.

Verification Engine: An interactive "Engineer-in-the-Loop" UI component nested within the graph. It compares the AI's predicted root cause against the target module.

Targeted Command UI: A sleek interface to copy the exact generated simulator command with properly escaped hierarchical paths.

Styling & Icons: Utilizes highly customized CSS-in-JS for state-driven styling (glowing nodes, active dependency paths) and lucide-react for clean typography and iconography.

⚙️ Backend Technology Stack

Python 3: Core data parsing and algorithm execution.

FastAPI & Uvicorn: High-performance REST API architecture to handle log uploads and serve the JSON analysis.

Regex Engine (re): Multi-pattern string matching designed to extract UVM_TESTNAME, random seeds, and hierarchical component paths from unstructured simulator text.

🎯 Target Domain

SystemVerilog & UVM 1.2: The industry-standard hardware verification language and methodology.

📈 Business Impact & ROI

Reduces Debugging Time: Cuts the time spent isolating a bug from hours to minutes.

Optimizes Compute Resources: Eliminates the need for global waveform dumps, saving massive amounts of CPU time and memory on enterprise server farms.

Improves Handoff: Provides a clean, visual proof-of-failure that verification engineers can easily hand off to RTL designers for fixing.

🚀 Getting Started

Prerequisites

Node.js (v16+)

Python (3.8+)

An EDA Environment (Local Linux Simulator or EDA Playground)

1. Start the Python Backend

Navigate to your backend directory:

# Install required Python packages
pip install fastapi uvicorn pydantic python-multipart

# Start the FastAPI server on localhost:8000
uvicorn main:app --reload --port 8000


2. Start the React Frontend

Navigate to your frontend directory:

# Install Node dependencies
npm install

# Start the Vite development server
npm run dev


🖥️ Usage Workflow

The tool is designed to seamlessly integrate into a Verification Engineer's daily debug routine:

Upload the Failing Log: Drag and drop your massive UVM simulation log (.log or .txt) into the dashboard upload zone. The Python backend instantly parses the text.

Analyze the Dependency Graph: Review the generated Failure Dependency Graph on the UI. The node outlined in glowing red with the "PREDICTED" badge is the AI-identified root cause (e.g., uvm_test_top.env).

Select the Target: Click the glowing root cause node to slide open the Verification & Target Panel.

Generate the Command: Select your specific commercial simulator (VCS, Riviera, or Questa). Click "Copy" to grab the generated targeted string.

Example output: vsim -c -do "run -all; exit" +UVM_TESTNAME=test_errors +sv_seed=1 +uvm_set_verbosity=uvm_test_top.env,_ALL_,UVM_FULL

Dump Targeted Waveforms: Paste the copied command into your Linux terminal or EDA Playground. The simulator will quickly run, bypassing global wave dumping, and output a highly localized .vcd or .fsdb file.

Verify and Close: Open the waveform in Verdi or EPWave, visually confirm the logic bug (e.g., XX data or missing ack), return to the React dashboard, and click "Verify Match" to lock the graph to a 100% verified state.

🔮 Future Scope

To scale this prototype into an enterprise-grade EDA tool, the following features are mapped for future development:

CI/CD Pipeline Integration: Integrate the Python backend directly into Jenkins or GitHub Actions. When an overnight regression suite finishes, the tool will automatically parse the failing logs and post the UI links directly into a Slack/Teams channel.

Automated VCD/Waveform Parsing: Develop a Python parser (using libraries like pyvcd) to automatically read the resulting waveform file and mathematically verify the XX or Z signal failures without requiring human eyes.

LLM Auto-Patching Generation: Connect the backend to an LLM API (e.g., Gemini 1.5 Pro). By feeding the LLM the failing SystemVerilog module alongside the extracted log errors, the tool will dynamically generate unified Git diffs to auto-fix the RTL code.

Historical Trend Analytics: Implement a PostgreSQL database to track which RTL modules and UVM sequences fail most frequently over a 6-month project lifecycle, providing tape-out confidence metrics.

Built for modern ASIC/VLSI Verification workflows.
