#!/bin/bash
# ========================================================
# KRAKATAU SENTINEL — Confluent Cloud Auto-Config Helper
# ========================================================
# Run this after: confluent login --save

set -e

echo "🌋 KRAKATAU SENTINEL — Confluent Cloud Setup Helper"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if logged in
if ! confluent environment list >/dev/null 2>&1; then
    echo "❌ You are not logged into Confluent Cloud CLI."
    echo "👉 Please run: confluent login --save"
    echo "   Then re-run this script!"
    exit 1
fi

echo "✅ Authenticated with Confluent Cloud"
echo ""

# 1. Select Environment
echo "📋 Available Environments:"
confluent environment list

echo ""
read -p "Enter Environment ID (e.g., env-xxxxx) [leave blank for active]: " ENV_ID
if [ -n "$ENV_ID" ]; then
    confluent environment use "$ENV_ID"
fi

# 2. Select Cluster
echo ""
echo "📋 Available Kafka Clusters:"
confluent kafka cluster list

echo ""
read -p "Enter Kafka Cluster ID (e.g., lkc-xxxxx) [leave blank for active]: " CLUSTER_ID
if [ -n "$CLUSTER_ID" ]; then
    confluent kafka cluster use "$CLUSTER_ID"
fi

# Get Cluster Details
CLUSTER_INFO=$(confluent kafka cluster describe -o json)
BOOTSTRAP=$(echo "$CLUSTER_INFO" | grep -o '"endpoint": "[^"]*' | head -1 | cut -d'"' -f4 | sed 's/SASL_SSL:\/\///')
CURRENT_CLUSTER_ID=$(echo "$CLUSTER_INFO" | grep -o '"id": "[^"]*' | head -1 | cut -d'"' -f4)

echo "✅ Bootstrap Server: $BOOTSTRAP"

# 3. Create or reuse Kafka API Key
echo ""
echo "🔑 Creating Kafka API Key for cluster $CURRENT_CLUSTER_ID..."
KAFKA_KEY_JSON=$(confluent api-key create --resource "$CURRENT_CLUSTER_ID" --description "Krakatau Sentinel Cluster Key" -o json 2>/dev/null || true)

if [ -n "$KAFKA_KEY_JSON" ]; then
    KAFKA_KEY=$(echo "$KAFKA_KEY_JSON" | grep -o '"key": "[^"]*' | cut -d'"' -f4)
    KAFKA_SECRET=$(echo "$KAFKA_KEY_JSON" | grep -o '"secret": "[^"]*' | cut -d'"' -f4)
    echo "✅ Kafka API Key created: $KAFKA_KEY"
else
    echo "⚠️  Could not auto-generate new cluster key. Please enter an existing one if you have it."
    read -p "Enter CONFLUENT_API_KEY: " KAFKA_KEY
    read -sp "Enter CONFLUENT_API_SECRET: " KAFKA_SECRET
    echo ""
fi

# 4. Schema Registry Details
echo ""
echo "📋 Checking Schema Registry..."
SR_INFO=$(confluent schema-registry cluster describe -o json 2>/dev/null || true)

if [ -n "$SR_INFO" ]; then
    SR_ENDPOINT=$(echo "$SR_INFO" | grep -o '"endpoint_url": "[^"]*' | cut -d'"' -f4)
    SR_ID=$(echo "$SR_INFO" | grep -o '"id": "[^"]*' | head -1 | cut -d'"' -f4)
    echo "✅ Schema Registry Endpoint: $SR_ENDPOINT"

    echo "🔑 Creating Schema Registry API Key for $SR_ID..."
    SR_KEY_JSON=$(confluent api-key create --resource "$SR_ID" --description "Krakatau Sentinel SR Key" -o json 2>/dev/null || true)
    if [ -n "$SR_KEY_JSON" ]; then
        SR_KEY=$(echo "$SR_KEY_JSON" | grep -o '"key": "[^"]*' | cut -d'"' -f4)
        SR_SECRET=$(echo "$SR_KEY_JSON" | grep -o '"secret": "[^"]*' | cut -d'"' -f4)
        echo "✅ Schema Registry API Key created: $SR_KEY"
    fi
else
    echo "ℹ️  No Schema Registry found on this environment."
fi

# 5. Update .env file
ENV_FILE="$(cd "$(dirname "$0")/.." && pwd)/.env"

echo ""
echo "📝 Updating $ENV_FILE..."

# Update Bootstrap
if [ -n "$BOOTSTRAP" ]; then
    sed -i '' "s|^CONFLUENT_BOOTSTRAP_SERVERS=.*|CONFLUENT_BOOTSTRAP_SERVERS=$BOOTSTRAP|" "$ENV_FILE"
fi

# Update Kafka Key & Secret
if [ -n "$KAFKA_KEY" ]; then
    sed -i '' "s|^CONFLUENT_API_KEY=.*|CONFLUENT_API_KEY=$KAFKA_KEY|" "$ENV_FILE"
fi
if [ -n "$KAFKA_SECRET" ]; then
    sed -i '' "s|^CONFLUENT_API_SECRET=.*|CONFLUENT_API_SECRET=$KAFKA_SECRET|" "$ENV_FILE"
fi

# Update Schema Registry
if [ -n "$SR_ENDPOINT" ]; then
    sed -i '' "s|^CONFLUENT_SCHEMA_REGISTRY_URL=.*|CONFLUENT_SCHEMA_REGISTRY_URL=$SR_ENDPOINT|" "$ENV_FILE"
fi
if [ -n "$SR_KEY" ]; then
    sed -i '' "s|^CONFLUENT_SR_API_KEY=.*|CONFLUENT_SR_API_KEY=$SR_KEY|" "$ENV_FILE"
fi
if [ -n "$SR_SECRET" ]; then
    sed -i '' "s|^CONFLUENT_SR_API_SECRET=.*|CONFLUENT_SR_API_SECRET=$SR_SECRET|" "$ENV_FILE"
fi

# Disable DEMO_MODE
sed -i '' "s|^DEMO_MODE=.*|DEMO_MODE=false|" "$ENV_FILE"

echo ""
echo "🎉 Confluent Cloud settings saved to .env!"
echo ""
echo "Next step: create topics by running:"
echo "  ./scripts/setup-topics.sh"
