#!/bin/bash
# ============================================
# GEMPA SENTINEL — Flink SQL Deployment Script
# ============================================
# Deploys all Flink SQL views and stream processing jobs to Confluent Cloud.
# Usage:
#   ./scripts/deploy-flink.sh           (deploys or skips if already active)
#   ./scripts/deploy-flink.sh --recreate (re-creates existing statements)

set -e

RECREATE=false
if [ "$1" == "--recreate" ]; then
    RECREATE=true
fi

echo "=================================================="
echo "⚡ DEPLOYING FLINK SQL TO CONFLUENT CLOUD"
echo "=================================================="

# 1. Determine Kafka Cluster Database
DATABASE="${CONFLUENT_KAFKA_CLUSTER_ID:-$(confluent kafka cluster list -o json 2>/dev/null | jq -r '.[] | select(.is_current == true) | .id' 2>/dev/null || confluent kafka cluster list -o json 2>/dev/null | grep '"id"' | head -n 1 | awk -F'"' '{print $4}')}"
if [ -z "$DATABASE" ]; then
    echo "❌ Error: Could not determine Kafka cluster ID. Set CONFLUENT_KAFKA_CLUSTER_ID or run 'confluent kafka cluster use <id>'."
    exit 1
fi
echo "📦 Using Kafka Database (Cluster): $DATABASE"

# 2. Determine Kafka Region & Matching Compute Pool
KAFKA_REGION=$(confluent kafka cluster describe "$DATABASE" -o json 2>/dev/null | jq -r '.region' 2>/dev/null || true)
if [ -z "$KAFKA_REGION" ]; then
    KAFKA_REGION=$(confluent kafka cluster describe -o json 2>/dev/null | grep '"region"' | head -1 | cut -d'"' -f4)
fi
echo "📍 Kafka Cluster Region: $KAFKA_REGION"

POOL="${CONFLUENT_FLINK_COMPUTE_POOL:-$(confluent flink compute-pool list -o json 2>/dev/null | jq -r --arg reg "$KAFKA_REGION" '.[] | select(.region == $reg) | .id' | head -1)}"
if [ -z "$POOL" ]; then
    POOL=$(confluent flink compute-pool list -o json 2>/dev/null | grep '"id"' | head -n 1 | awk -F'"' '{print $4}')
fi
if [ -n "$POOL" ]; then
    echo "⚡ Using Flink Compute Pool: $POOL"
    confluent flink compute-pool use "$POOL" 2>/dev/null || true
else
    echo "❌ Error: No Flink compute pool found in region $KAFKA_REGION."
    exit 1
fi

# 3. Helper to deploy statement via python runner
export DATABASE
export RECREATE

python3 - << 'EOF'
import os
import re
import subprocess
import sys

database = os.environ.get("DATABASE")
recreate = os.environ.get("RECREATE") == "true"

def run_cmd(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)

def deploy_statement(name, sql, is_job=False):
    print(f"\n🚀 Checking statement: {name}...")
    describe = run_cmd(["confluent", "flink", "statement", "describe", name])
    output = describe.stdout or ""
    
    if "Status" in output:
        status_match = re.search(r'Status\s+\|\s+([A-Z_]+)', output)
        status = status_match.group(1) if status_match else "UNKNOWN"
        print(f"   Current status: {status}")
        
        if not recreate:
            if status in ("COMPLETED", "RUNNING"):
                print(f"   ✔ Statement '{name}' is already {status}. (Use --recreate to redeploy)")
                return
        
        print(f"   Deleting existing statement '{name}'...")
        run_cmd(["confluent", "flink", "statement", "delete", name, "--force"])

    print(f"   ➜ Submitting statement to Confluent Cloud...")
    res = run_cmd([
        "confluent", "flink", "statement", "create", name,
        "--sql", sql,
        "--database", database
    ])
    
    if res.returncode != 0:
        print(f"   ❌ Failed to submit {name}: {res.stderr.strip() or res.stdout.strip()}")
    else:
        print(f"   ✅ Submitted {name} successfully.")

# 1. Deploy Views from flink/01_create_tables.sql
print("\n" + "="*50)
print("📦 [1/4] Deploying Source & Unified Views (flink/01_create_tables.sql)")
print("="*50)

with open("flink/01_create_tables.sql") as f:
    raw = f.read()

chunks = raw.split(";")
for chunk in chunks:
    lines = [l for l in chunk.splitlines() if not l.strip().startswith("--")]
    sql = " ".join(" ".join(lines).split())
    if not sql:
        continue
    m = re.search(r'CREATE\s+VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)', sql, re.IGNORECASE)
    if m:
        view_name = m.group(1)
        stmt_name = f"view-{view_name.replace('_', '-')}"
        deploy_statement(stmt_name, sql, is_job=False)

# 2. Deploy Activity Index
print("\n" + "="*50)
print("⚡ [2/4] Deploying Activity Index Star Query (flink/02_activity_index.sql)")
print("="*50)
with open("flink/02_activity_index.sql") as f:
    sql_02 = " ".join([l for l in f.read().splitlines() if not l.strip().startswith("--")])
deploy_statement("job-gempa-activity-index", sql_02, is_job=True)

# 3. Deploy Correlated Alerts
print("\n" + "="*50)
print("🚨 [3/4] Deploying Correlated Alerts Job (flink/03_correlated_alerts.sql)")
print("="*50)
with open("flink/03_correlated_alerts.sql") as f:
    sql_03 = " ".join([l for l in f.read().splitlines() if not l.strip().startswith("--")])
deploy_statement("job-gempa-correlated-alerts", sql_03, is_job=True)

# 4. Deploy Tsunami Detection
print("\n" + "="*50)
print("🌊 [4/6] Deploying Tsunami Detection Job (flink/04_tsunami_detection.sql)")
print("="*50)
with open("flink/04_tsunami_detection.sql") as f:
    sql_04 = " ".join([l for l in f.read().splitlines() if not l.strip().startswith("--")])
deploy_statement("job-gempa-tsunami-detection", sql_04, is_job=True)

# 5. Deploy Cascading Incident Correlator
print("\n" + "="*50)
print("🌋 [5/6] Deploying Cascading Incident Correlator (flink/05_incident_correlator.sql)")
print("="*50)
with open("flink/05_incident_correlator.sql") as f:
    sql_05 = " ".join([l for l in f.read().splitlines() if not l.strip().startswith("--")])
deploy_statement("job-gempa-incident-correlator", sql_05, is_job=True)

# 6. Deploy Tactical Response Generator
print("\n" + "="*50)
print("⚡ [6/6] Deploying Tactical Response Generator (flink/06_response_generator.sql)")
print("="*50)
with open("flink/06_response_generator.sql") as f:
    sql_06 = " ".join([l for l in f.read().splitlines() if not l.strip().startswith("--")])
deploy_statement("job-gempa-response-generator", sql_06, is_job=True)

EOF

echo ""
echo "=================================================="
echo "✅ All Flink SQL stream processing pipelines submitted!"
echo "=================================================="
echo "📋 Active statements in pool $POOL:"
confluent flink statement list 2>/dev/null || true
