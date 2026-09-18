# INATEWS SENTINEL

🏆 **3rd Prize: The Most Creative AI App for Confluent AI Day Indonesia 2026**

**Sistem Peringatan Dini Lava Gunung, Gempa & Tsunami Indonesia — Real-Time Disaster Intelligence & Early Warning**

A streaming intelligence system that continuously monitors BMKG seismic networks, InaTEWS tsunami buoys & IOC sea level gauges, geodetic satellite observations, and meteorological feeds across Indonesia's major subduction zones through Confluent Cloud. Apache Flink SQL correlates events in real time to compute a National Seismic Intensity Index (MMI) and detect tsunami wave anomalies, while Google Gemini AI provides explainable risk assessments and decision-support recommendations for disaster response authorities (BMKG, BNPB, BASARNAS).

> ⚠️ **Important**: This system provides real-time seismic decision-support and rapid impact estimation. It is **NOT** an earthquake prediction system.

**Live dashboard:** [https://inatews-sentinel.vercel.app](https://inatews-sentinel.vercel.app)

<img width="1512" height="867" alt="Screenshot 2026-09-11 at 15 30 26" src="https://github.com/user-attachments/assets/f7fa35e1-8cfb-4468-8e17-b9e1203322c5" />

<img width="1501" height="862" alt="Screenshot 2026-09-11 at 14 56 23" src="https://github.com/user-attachments/assets/b3ed1b8e-b293-40d2-9fbd-4fae8d273cac" />

<img width="1497" height="864" alt="Screenshot 2026-09-11 at 14 56 20" src="https://github.com/user-attachments/assets/49f9eb77-085f-4c0b-adcb-745887f86dc5" />

<img width="1512" height="867" alt="Screenshot 2026-09-11 at 15 40 52" src="https://github.com/user-attachments/assets/9cf6a146-0d92-4e11-83d9-f582386eb726" />


---

## The Upgraded Paradigm: Earthquake → Impact → Cascade → Response

> *"We don't just detect earthquakes. We correlate thousands of events in motion to understand how a disaster is evolving, then turn those signals into actionable intelligence."*

Instead of an alert monitor that simply notifies after an event, **INATEWS Sentinel** models disaster dynamics as a chain of real-time cascading consequences continuously correlated by **Confluent Cloud** and **Apache Flink SQL**:

```
                    DATA SOURCES
                         │
       ┌─────────────────┼──────────────────┐
       │                 │                  │
   SEISMIC            OCEAN             SATELLITE
 (BMKG/USGS)       (InaTEWS Buoy)      (InSAR Slip)
   STATIONS        INFRASTRUCTURE      POPULATION
       │                 │                  │
       ▼                 ▼                  ▼
                 ┌───────▼────────┐
                 │  CONFLUENT     │
                 │  CLOUD KAFKA   │
                 └───────┬────────┘
                         │
              ┌──────────▼──────────┐
              │     APACHE FLINK    │
              │                     │
              │ Event Correlation   │
              │ Window Aggregation  │
              │ State Management    │
              │ Hazard Detection    │
              └──────────┬──────────┘
                         │
          ┌──────────────┼───────────────┐
          ▼              ▼               ▼
   intensity_index   correlated      tsunami
                     alerts          scenarios
          │              │               │
          └──────────────┼───────────────┘
                         ▼
                 gempa.incidents (Evolving Incident State)
                         │
                         ▼
              CASCADING IMPACT ENGINE
              & CONFIDENCE SCORING MODEL
                         │
                         ▼
                  gempa.response (Tactical Directives)
                         │
                ┌────────┴────────┐
                ▼                 ▼
             GEMINI          DASHBOARD
              AGENT              │
                │                │
                └───────┬────────┘
                        ▼
                 INCIDENT COCKPIT
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Go 1.23 + Gin + confluent-kafka-go v2 |
| Stream Processing | Confluent Cloud Apache Flink SQL (CEP & Window Aggregation) |
| AI Decision Support | Google Gemini 2.5 Flash & AWS Bedrock (Claude 3.5 Sonnet) |
| Frontend | Next.js 16 + Leaflet.js + Tailwind-free Vanilla Tactical CSS |
| Messaging | Confluent Cloud (Apache Kafka with Schema Registry) |

## Core Innovations

### 1. Single Evolving Disaster State (`gempa.incidents`)
Rather than disconnected alert pings, the platform aggregates all incoming telemetry into a single, continuously updated incident event:
```json
{
  "incident_id": "INC-20260915-001",
  "hazard": "EARTHQUAKE_TSUNAMI_CASCADE",
  "magnitude": 7.8,
  "region": "South Java Trench",
  "risk_score": 86,
  "seismic_intensity": "VII",
  "tsunami_risk": "HIGH",
  "population_exposed": 1842000,
  "critical_infrastructure": 37,
  "road_disruptions": 12,
  "confidence": 0.95,
  "confidence_score": 95,
  "status": "ESCALATING"
}
```

### 2. Multi-Stream Confidence Model (0–100 Score)
Not all sensor feeds are equally definitive. Confidence accumulates dynamically as evidence arrives:
- **Broadband Seismic Stations**: `+35` (P/S waves, PGA > 0.15g)
- **USGS / BMKG Agreement**: `+20` (Cross-agency validation)
- **Satellite InSAR Slip**: `+15` (Coseismic seabed fault displacement)
- **InaTEWS DART Buoy**: `+20` (Sea level wave anomaly confirmed)
- **Infrastructure Signal**: `+10` (Bridges, hospitals, power substations reporting strain)

### 3. Event-Time Window Progression
Disaster consequences unfold over distinct physical time windows:
- **10s**: Sensor confirmation (Broadband network)
- **30s**: Seismic intensity (MMI calculated)
- **2m**: Tsunami wave front correlation (DART buoy)
- **5m**: Infrastructure disruptions (Bridge & port halts)
- **10m**: Evacuation priorities (Coastal population buffer)

### 4. Interactive Disaster Replay (`▶ REPLAY DISASTER`)
Audiences watch the **Confluent Stream Lineage** update while the dashboard simultaneously evolves in motion:
`gempa.seismic → gempa.stations → gempa.intensity_index → gempa.satellite → gempa.tsunami → gempa.population → gempa.infrastructure → gempa.incidents → gempa.response`

---

## Key Kafka Topics

| Topic | Description | Source / Role |
|---|---|---|
| `gempa.seismic` | Real-time earthquake events (USGS & BMKG) | Ingestion Feed |
| `gempa.stations` | BMKG broadband seismic station telemetry (PGA, P/S waves) | Network Telemetry |
| `gempa.tsunami` | InaTEWS DART buoy and tide gauge telemetry | Ocean Sensors |
| `gempa.weather` | Real-time meteorology & barometric pressure | Open-Meteo |
| `gempa.satellite` | InSAR surface displacement and coseismic slip | Geodetic Operations |
| `gempa.infrastructure` | Hospital, bridge, port, and power grid status | Infrastructure Monitoring |
| `gempa.population` | Evacuation routes, shelters, and readiness | Civil Defense |
| `gempa.intensity_index` | Computed real-time seismic intensity & MMI | Flink SQL Star Query |
| `gempa.correlated_alerts` | Multi-stream correlated hazard warnings | Flink SQL CEP |
| `gempa.tsunami_scenarios` | Detected tsunami wave propagation alerts | Flink SQL |
| `gempa.incidents` | **Single evolving disaster state** | **Flink SQL & Cascading Engine** |
| `gempa.response` | **Tactical AI & operational response directives** | **Flink SQL & Gemini AI** |

---

## AI Intelligence & Autonomous Streaming Data Agent

### 1. Dual AI Engine Architecture (Gemini & AWS Bedrock)
- **Google Gemini 2.5 Flash**: Default low-latency reasoning engine with dynamic parameter grounding.
- **AWS Bedrock (Anthropic Claude 3.5 Sonnet / Amazon Nova)**: Enterprise multi-model support via AWS SDK v2 Converse protocol.
- **Runtime Provider Switching**: Toggle providers dynamically from the UI or via `POST /api/ai/provider`.
- **Resilient Fallback**: If cloud AI credentials are not provided or API calls fail, the system smoothly falls back to an internal high-precision seismological heuristic engine.

### 2. Autonomous Streaming Data Agent
The streaming agent operates an event-driven OODA (Observe-Orient-Decide-Act) reasoning loop over live Kafka and Flink event streams:
- **Continuous Sliding-Window Memory**: Evaluates seismic swarms, tremor spikes, tsunami buoy anomalies, and infrastructure strain.
- **Multi-Agency Directive Dispatch**: Dispatches automated tactical directives for BMKG (tsunami sirens), BNPB (evacuation corridors), KEMENHUB (bridge & maritime transit suspension), and BASARNAS (search & rescue deployment).
- **Token-by-Token Live Streaming Chat**: `/api/agent/chat/stream` streams AI response tokens in real-time over SSE directly into the dashboard.

---

## License & Copyright

This project is licensed under the [MIT License](LICENSE).

Copyright (c) 2026 Fabrian Ivan Prasetya. All rights reserved.

### Open Source & Public APIs
This application utilizes public data and Open Source / Open Data APIs provided by:
- **BMKG (InaTEWS)** — National Earthquake & Tsunami Data Feeds
- **USGS** — Earthquake Hazards Program Real-time GeoJSON API
- **IOC / UNESCO** — Sea Level Station Monitoring Facility (Tide Gauges)
- **MAGMA Indonesia / PVMBG** — Real-time Volcanic Activity Reports
- **Open-Meteo** — Real-time Meteorology & Weather API

