import random
import datetime

# Configuration
LOG_FILE = "sim_debug_results.log"
NUM_ENTRIES = 100

# Error Templates
ERROR_TYPES = {
    "UVM_ERROR": [
        "uvm_test_top.env.agent.driver [DRV] Packet size mismatch. Expected 64, Got 128",
        "uvm_test_top.env.scoreboard [SCB] Data mismatch! Exp: 0xDEADBEEF Act: 0x00000000",
        "uvm_test_top.env.agent.monitor [MON] Illegal opcode detected in stream",
        "uvm_test_top.env.cfg_db [CFG] Resource 'vif' not found in uvm_config_db"
    ],
    "SVA_FAILURE": [
        "Assertion 'A_READY_CHECK' failed at time 4500ns: Ready signal not asserted within 10 cycles",
        "Assertion 'REQ_ACK_PROTOCOL' failed at time 12200ns: ACK received without REQ",
        "Assertion 'ADDR_STABLE' failed: Address changed while VALID was high"
    ],
    "UVM_FATAL": [
        "uvm_test_top.env [PHASE] Phase 'run' timeout. Objection not dropped.",
        "uvm_test_top.env.agent.sqr [SQR] Null pointer dereference in sequence start"
    ]
}

def generate_fake_logs(filename, count):
    with open(filename, "w") as f:
        f.write(f"--- Simulation Started at {datetime.datetime.now()} ---\n")
        f.write("UVM_INFO @ 0: reporter [RNTST] Running test base_test...\n\n")
        
        for i in range(count):
            # Randomly pick an error category
            category = random.choice(list(ERROR_TYPES.keys()))
            message = random.choice(ERROR_TYPES[category])
            
            # Simulate a simulation timestamp (in nanoseconds)
            timestamp = random.randint(100, 50000)
            
            # Format the log line to look like standard UVM output
            log_line = f"{category} @ {timestamp}ns: {message}\n"
            f.write(log_line)
            
            # Add some "noise" INFO lines in between
            if random.random() > 0.7:
                f.write(f"UVM_INFO @ {timestamp + 5}ns: reporter [IDLE] Simulation progressing...\n")
        
        f.write("\n--- Simulation Finished with Errors ---")

if __name__ == "__main__":
    generate_fake_logs(LOG_FILE, NUM_ENTRIES)
    print(f"Generated {NUM_ENTRIES} fake log entries in '{LOG_FILE}'")