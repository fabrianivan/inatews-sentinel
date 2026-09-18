#!/bin/bash
# ============================================
# GEMPA SENTINEL — Topic Setup Script
# ============================================
# Creates all required Kafka topics via Confluent CLI
# Prerequisites: confluent CLI installed and logged in

set -e

echo "🌍 Creating Gempa Sentinel Kafka topics..."

# Source topics (7)
TOPICS=(
    "gempa.seismic"
    "gempa.stations"
    "gempa.tsunami"
    "gempa.weather"
    "gempa.satellite"
    "gempa.infrastructure"
    "gempa.population"
)

# Flink output topics (5)
OUTPUT_TOPICS=(
    "gempa.intensity_index"
    "gempa.correlated_alerts"
    "gempa.tsunami_scenarios"
    "gempa.incidents"
    "gempa.response"
)

echo ""
echo "📥 Creating source topics..."
for topic in "${TOPICS[@]}"; do
    echo "  Creating: $topic"
    confluent kafka topic create "$topic" --partitions 3 2>/dev/null || echo "    ⚠ Already exists or error"
done

echo ""
echo "📤 Creating Flink output topics..."
for topic in "${OUTPUT_TOPICS[@]}"; do
    echo "  Creating: $topic"
    confluent kafka topic create "$topic" --partitions 3 2>/dev/null || echo "    ⚠ Already exists or error"
done

echo ""
echo "✅ All topics created!"
echo ""
echo "📋 Topic list:"
confluent kafka topic list 2>/dev/null | grep "gempa\." || echo "  (run 'confluent kafka topic list' manually)"
