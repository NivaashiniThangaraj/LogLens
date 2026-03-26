import random
import datetime

def generate_log(filename, bugs, entries=80):

    with open(filename, "w") as f:

        f.write(f"--- Simulation Started at {datetime.datetime.now()} ---\n")
        f.write("UVM_INFO @ 0: reporter [RNTST] Running test axi_stress_test...\n")
        f.write(f"UVM_INFO @ 0: reporter [SEED] Random seed = {random.randint(10000,99999)}\n\n")

        for i in range(entries):

            bug = random.choice(bugs)
            timestamp = random.randint(100,50000)

            f.write(f"{bug['type']} @ {timestamp}ns: {bug['message']}\n")

            if random.random() > 0.7:
                f.write(f"UVM_INFO @ {timestamp+5}ns: reporter [IDLE] Simulation progressing...\n")

        f.write("\n--- Simulation Finished ---")


# --------------------------
# RUN 1 BUGS
# --------------------------

run1_bugs = [

    {
        "type":"UVM_ERROR",
        "message":"uvm_test_top.env.scoreboard [SCB] Data mismatch! Exp: 0xDEADBEEF Act: 0x00000000"
    },

    {
        "type":"UVM_ERROR",
        "message":"uvm_test_top.env.agent.driver [DRV] Packet size mismatch. Expected 64, Got 128"
    },

    {
        "type":"SVA_FAILURE",
        "message":"Assertion 'REQ_ACK_PROTOCOL' failed at time 12200ns: ACK received without REQ"
    },

    {
        "type":"UVM_FATAL",
        "message":"uvm_test_top.env [PHASE] Phase 'run' timeout. Objection not dropped."
    }

]


# --------------------------
# RUN 2 BUGS
# --------------------------
# (one resolved, one recurring, one new)

run2_bugs = [

    # recurring bug
    {
        "type":"UVM_ERROR",
        "message":"uvm_test_top.env.scoreboard [SCB] Data mismatch! Exp: 0xDEADBEEF Act: 0x00000000"
    },

    # recurring bug
    {
        "type":"SVA_FAILURE",
        "message":"Assertion 'REQ_ACK_PROTOCOL' failed at time 12200ns: ACK received without REQ"
    },

    # NEW BUG
    {
        "type":"UVM_ERROR",
        "message":"uvm_test_top.env.agent.monitor [MON] Illegal opcode detected in stream"
    },

    # NEW BUG
    {
        "type":"SVA_FAILURE",
        "message":"Assertion 'ADDR_STABLE' failed: Address changed while VALID was high"
    }

]


# Generate logs
generate_log("regression_run1.log", run1_bugs)
generate_log("regression_run2.log", run2_bugs)

print("Generated regression_run1.log and regression_run2.log")