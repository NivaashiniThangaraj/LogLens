import random
import time
import datetime

LOG_FILE = "sim_debug_results2.log"

TESTS = [
    "axi_stress_test",
    "fifo_random_test",
    "protocol_check_test",
    "memory_integrity_test"
]

UVM_ERRORS = [
    "uvm_test_top.env.agent.driver [DRV] Packet size mismatch. Expected 64, Got 128",
    "uvm_test_top.env.scoreboard [SCB] Data mismatch! Exp: 0xDEADBEEF Act: 0x00000000",
    "uvm_test_top.env.agent.monitor [MON] Illegal opcode detected in stream",
    "uvm_test_top.env.cfg_db [CFG] Resource 'vif' not found in uvm_config_db"
]

SVA_FAILURES = [
    "Assertion 'A_READY_CHECK' failed: Ready signal not asserted within 10 cycles",
    "Assertion 'REQ_ACK_PROTOCOL' failed: ACK received without REQ",
    "Assertion 'ADDR_STABLE' failed: Address changed while VALID was high"
]

UVM_FATAL = [
    "uvm_test_top.env [PHASE] Phase 'run' timeout. Objection not dropped.",
    "uvm_test_top.env.agent.sqr [SQR] Null pointer dereference in sequence start"
]

UVM_WARNINGS = [
    "uvm_test_top.env.agent.monitor [MON] Backpressure detected",
    "uvm_test_top.env.agent.driver [DRV] Transaction retry triggered"
]


def generate_log():

    with open(LOG_FILE, "w") as f:

        test = random.choice(TESTS)
        seed = random.randint(10000, 99999)

        start_time = datetime.datetime.now()

        f.write(f"--- Simulation Started at {start_time} ---\n")
        f.write(f"UVM_INFO @ 0: reporter [RNTST] Running test {test}...\n")
        f.write(f"UVM_INFO @ 0: reporter [SEED] Random seed = {seed}\n\n")
        f.flush()

        sim_time = 100

        while True:

            event = random.choice(["INFO", "ERROR", "SVA", "FATAL", "WARNING"])

            if event == "ERROR":
                msg = random.choice(UVM_ERRORS)
                line = f"UVM_ERROR @ {sim_time}ns: {msg}"

            elif event == "SVA":
                msg = random.choice(SVA_FAILURES)
                line = f"SVA_FAILURE @ {sim_time}ns: {msg}"

            elif event == "FATAL":
                msg = random.choice(UVM_FATAL)
                line = f"UVM_FATAL @ {sim_time}ns: {msg}"

            elif event == "WARNING":
                msg = random.choice(UVM_WARNINGS)
                line = f"UVM_WARNING @ {sim_time}ns: {msg}"

            else:
                line = f"UVM_INFO @ {sim_time}ns: reporter [IDLE] Simulation progressing..."

            f.write(line + "\n")
            f.flush()

            print(line)

            sim_time += random.randint(50, 500)
            time.sleep(0.8)


if __name__ == "__main__":
    generate_log()