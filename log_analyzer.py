import re
from collections import Counter

def parse_uvm_logs(log_filename):
    # Regex Pattern Breakdown:
    # (UVM_ERROR|UVM_FATAL|Assertion) -> The Failure Category
    # @ \d+ns: -> Matches the timestamp (to be ignored/stripped)
    # (.*) -> Captures the actual error message/path
    log_pattern = re.compile(r"(UVM_ERROR|UVM_FATAL|Assertion failed|Assertion '.*' failed) @? ?\d*n?s?:? (.*)")

    unique_failures = Counter()
    failure_details = {}

    with open(log_filename, 'r') as file:
        for line in file:
            match = log_pattern.search(line)
            if match:
                category = match.group(1).strip()
                message = match.group(2).strip()
                
                # Create a signature by combining category and message
                # This treats "Error at 100ns" and "Error at 500ns" as the same bug
                signature = f"[{category}] {message}"
                
                unique_failures[signature] += 1
    
    return unique_failures

def display_report(failures):
    print(f"{'Count':<8} | {'Unique Failure Signature'}")
    print("-" * 60)
    
    # Sort by frequency (Priority)
    for sig, count in failures.most_common():
        print(f"{count:<8} | {sig}")

if __name__ == "__main__":
    LOG_FILE = "sim_debug_results.log"
    results = parse_uvm_logs(LOG_FILE)
    display_report(results)