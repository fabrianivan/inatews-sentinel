#!/bin/bash
# ========================================================
# INATEWS SENTINEL — Confluent Cloud Connector Deployer
# ========================================================
set -e

DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

echo "⚡ InaTEWS Sentinel — Deploying Confluent Cloud Connector..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

: "${KAFKA_API_KEY:?Set KAFKA_API_KEY before deploying a connector}"
: "${KAFKA_API_SECRET:?Set KAFKA_API_SECRET before deploying a connector}"

if [ "${1:-}" = "" ]; then
    CONFIG_FILE="connectors/datagen-seismic-source.json"
else
    CONFIG_FILE="$1"
fi

if [[ "$CONFIG_FILE" == *http-alert-sink.json ]]; then
    : "${ALERT_WEBHOOK_URL:?Set ALERT_WEBHOOK_URL before deploying the HTTP sink}"
fi

RENDERED_DIR="connectors/.rendered"
mkdir -p "$RENDERED_DIR"
RENDERED_CONFIG="$RENDERED_DIR/$(basename "$CONFIG_FILE")"
envsubst '${KAFKA_API_KEY} ${KAFKA_API_SECRET} ${ALERT_WEBHOOK_URL}' < "$CONFIG_FILE" > "$RENDERED_CONFIG"
CONFIG_FILE="$RENDERED_CONFIG"

# Check Confluent CLI authentication
if ! confluent kafka cluster describe >/dev/null 2>&1; then
    echo "❌ Error: Not logged in or no active Kafka cluster selected."
    echo "   Run: confluent login --save && confluent kafka cluster use <cluster-id>"
    exit 1
fi

CLUSTER_ID=$(confluent kafka cluster describe -o json | grep -o '"id": "[^"]*' | head -1 | cut -d'"' -f4)
echo "✅ Active Kafka Cluster: $CLUSTER_ID"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Configuration file not found: $CONFIG_FILE"
    exit 1
fi

CONNECTOR_NAME=$(grep -o '"name": "[^"]*' "$CONFIG_FILE" | head -1 | cut -d'"' -f4)
echo "🚀 Target Connector: $CONNECTOR_NAME using $CONFIG_FILE..."

# Find existing connector by name
EXISTING_ID=$(confluent connect cluster list --cluster "$CLUSTER_ID" -o json 2>/dev/null | grep -B 2 "\"name\": \"$CONNECTOR_NAME\"" | grep -o '"id": "[^"]*' | head -1 | cut -d'"' -f4 || true)

if [ -n "$EXISTING_ID" ]; then
    echo "⚠️ Connector $CONNECTOR_NAME already exists (ID: $EXISTING_ID). Updating configuration..."
    confluent connect cluster update "$EXISTING_ID" --config-file "$CONFIG_FILE" --cluster "$CLUSTER_ID"
    TARGET_ID="$EXISTING_ID"
else
    echo "📦 Creating new connector in Confluent Cloud..."
    CREATE_OUT=$(confluent connect cluster create --config-file "$CONFIG_FILE" --cluster "$CLUSTER_ID" -o json 2>/dev/null || confluent connect cluster create --config-file "$CONFIG_FILE" --cluster "$CLUSTER_ID")
    echo "$CREATE_OUT"
    TARGET_ID=$(echo "$CREATE_OUT" | grep -o '"id": "[^"]*' | head -1 | cut -d'"' -f4 || true)
fi

echo ""
echo "✅ Connector successfully submitted to Confluent Cloud!"
echo "📋 Active Connectors in Cluster:"
confluent connect cluster list --cluster "$CLUSTER_ID"
