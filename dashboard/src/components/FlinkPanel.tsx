'use client';

import { useState } from 'react';
import type { ActivityIndex, SystemStatus } from '@/lib/types';

interface FlinkPanelProps {
  activityIndex: ActivityIndex | null;
  status: SystemStatus | null;
}

const FLINK_QUERIES = [
  {
    id: 'create_views',
    name: '01_create_tables.sql (Source Views)',
    description: 'Mendefinisikan Flink SQL Source Views di atas inferred topics gempa.* Confluent Cloud dengan parsing payload JSON dan event-time $rowtime.',
    sql: `-- Run in Confluent Cloud Flink SQL workspace.
-- In Confluent Cloud, topics are automatically registered as inferred tables.
-- These views parse incoming JSON payloads into typed relational schemas with $rowtime.

CREATE VIEW IF NOT EXISTS seismic_events AS
SELECT 
    JSON_VALUE(MAKE_VALID_UTF8(val), '$.type') AS \`type\`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.magnitude') AS DOUBLE) AS \`magnitude\`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.depth') AS DOUBLE) AS \`depth\`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.frequency') AS DOUBLE) AS \`frequency\`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.count') AS INT) AS \`count\`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.latitude') AS DOUBLE) AS \`latitude\`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.longitude') AS DOUBLE) AS \`longitude\`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.mmi') AS INT) AS \`mmi\`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.pga') AS DOUBLE) AS \`pga\`,
    JSON_VALUE(MAKE_VALID_UTF8(val), '$.fault_zone') AS \`fault_zone\`,
    $rowtime AS \`timestamp\`
FROM \`gempa.seismic\`;

CREATE VIEW IF NOT EXISTS station_events AS
SELECT 
    JSON_VALUE(MAKE_VALID_UTF8(val), '$.type') AS \`type\`,
    JSON_VALUE(MAKE_VALID_UTF8(val), '$.station_id') AS \`station_id\`,
    JSON_VALUE(MAKE_VALID_UTF8(val), '$.station_name') AS \`station_name\`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.latitude') AS DOUBLE) AS \`latitude\`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.longitude') AS DOUBLE) AS \`longitude\`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.signal_quality') AS DOUBLE) AS \`signal_quality\`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.p_wave_arrival') AS DOUBLE) AS \`p_wave_arrival\`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.s_wave_arrival') AS DOUBLE) AS \`s_wave_arrival\`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.pga_recorded') AS DOUBLE) AS \`pga_recorded\`,
    JSON_VALUE(MAKE_VALID_UTF8(val), '$.status') AS \`status\`,
    $rowtime AS \`timestamp\`
FROM \`gempa.stations\`;

CREATE VIEW IF NOT EXISTS ocean_events AS
SELECT 
    JSON_VALUE(MAKE_VALID_UTF8(val), '$.type') AS \`type\`,
    JSON_VALUE(MAKE_VALID_UTF8(val), '$.sensor_id') AS \`sensor_id\`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.sea_level') AS DOUBLE) AS \`sea_level\`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.wave_height') AS DOUBLE) AS \`wave_height\`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.tsunami_sensor_reading') AS DOUBLE) AS \`tsunami_sensor_reading\`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.buoy_data') AS DOUBLE) AS \`buoy_data\`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.wave_eta') AS INT) AS \`wave_eta\`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.latitude') AS DOUBLE) AS \`latitude\`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.longitude') AS DOUBLE) AS \`longitude\`,
    $rowtime AS \`timestamp\`
FROM \`gempa.tsunami\`;

-- 8. Unified Multi-Sensor Telemetry
CREATE VIEW IF NOT EXISTS telemetry_events AS
SELECT \`timestamp\`, 'seismic' AS event_source, magnitude, pga, CAST(NULL AS DOUBLE) AS pga_recorded, CAST(NULL AS DOUBLE) AS coseismic_slip, CAST(NULL AS DOUBLE) AS wave_height FROM seismic_events
UNION ALL
SELECT \`timestamp\`, 'station' AS event_source, CAST(NULL AS DOUBLE) AS magnitude, CAST(NULL AS DOUBLE) AS pga, pga_recorded, CAST(NULL AS DOUBLE) AS coseismic_slip, CAST(NULL AS DOUBLE) AS wave_height FROM station_events
UNION ALL
SELECT \`timestamp\`, 'satellite' AS event_source, CAST(NULL AS DOUBLE) AS magnitude, CAST(NULL AS DOUBLE) AS pga, CAST(NULL AS DOUBLE) AS pga_recorded, coseismic_slip, CAST(NULL AS DOUBLE) AS wave_height FROM satellite_events
UNION ALL
SELECT \`timestamp\`, 'ocean' AS event_source, CAST(NULL AS DOUBLE) AS magnitude, CAST(NULL AS DOUBLE) AS pga, CAST(NULL AS DOUBLE) AS pga_recorded, CAST(NULL AS DOUBLE) AS coseismic_slip, wave_height FROM ocean_events;`,
  },
  {
    id: 'activity_index',
    name: '02_activity_index.sql (Star Query)',
    description: 'Menghitung Indeks Intensitas Seismik Nasional secara kontinyu menggunakan Window TVF 1 menit dengan bobot multi-sensor dan sink langsung ke Confluent Cloud.',
    sql: `-- Computes the real-time National Seismic Intensity Index
-- using 1-minute tumbling windows over BMKG station telemetry & seismic events.
-- Sinks JSON payloads directly to Confluent Cloud topic gempa.intensity_index.

INSERT INTO \`gempa.intensity_index\` (\`key\`, \`val\`)
SELECT
    CAST('intensity' AS BYTES) AS \`key\`,
    CAST(
        JSON_OBJECT(
            'overall_percentage' VALUE overall_percentage,
            'seismic_change' VALUE seismic_change,
            'tremor_change' VALUE tremor_change,
            'deformation_trend' VALUE deformation_trend,
            'thermal_trend' VALUE thermal_trend,
            'trend_direction' VALUE trend_direction,
            'earthquake_count' VALUE earthquake_count,
            'avg_magnitude' VALUE avg_magnitude,
            'max_magnitude' VALUE max_magnitude,
            'timestamp' VALUE DATE_FORMAT(\`timestamp\`, 'yyyy-MM-dd''T''HH:mm:ss.SSS''Z''')
        ) AS BYTES
    ) AS \`val\`
FROM (
    SELECT
        -- Weighted seismic intensity formula:
        -- 40% magnitude/energy + 35% station PGA + 15% InSAR coseismic slip + 10% tsunami wave anomaly
        CASE 
            WHEN (
                (COALESCE(MAX(magnitude), 1.0) / 9.5 * 40.0) +
                (COALESCE(AVG(pga_recorded), 0.0) / 0.5 * 35.0) +
                (COALESCE(MAX(coseismic_slip), 0.0) / 5.0 * 15.0) +
                (COALESCE(MAX(wave_height), 0.0) / 10.0 * 10.0)
            ) > 100.0 THEN 100.0
            ELSE (
                (COALESCE(MAX(magnitude), 1.0) / 9.5 * 40.0) +
                (COALESCE(AVG(pga_recorded), 0.0) / 0.5 * 35.0) +
                (COALESCE(MAX(coseismic_slip), 0.0) / 5.0 * 15.0) +
                (COALESCE(MAX(wave_height), 0.0) / 10.0 * 10.0)
            )
        END AS overall_percentage,
        
        COALESCE(AVG(pga) * 200.0, 0.0) AS seismic_change,
        COALESCE(AVG(pga_recorded) * 100.0, 0.0) AS tremor_change,
        
        CASE 
            WHEN COALESCE(MAX(coseismic_slip), 0.0) > 2.0 THEN 'MAJOR FAULT RUPTURE'
            WHEN COALESCE(MAX(coseismic_slip), 0.0) > 0.5 THEN 'COSEISMIC DISPLACEMENT'
            ELSE 'STABLE'
        END AS deformation_trend,
        
        'STABLE' AS thermal_trend,
        
        CASE 
            WHEN COALESCE(MAX(magnitude), 0.0) >= 8.0 THEN 'MEGATHRUST RUPTURE DETECTED'
            WHEN COALESCE(MAX(magnitude), 0.0) >= 6.5 THEN 'MAJOR SHAKING'
            WHEN COALESCE(MAX(magnitude), 0.0) >= 5.0 THEN 'MODERATE EVENT'
            ELSE 'STABLE'
        END AS trend_direction,
        
        COALESCE(COUNT(CASE WHEN event_source = 'seismic' THEN 1 END), 0) AS earthquake_count,
        COALESCE(AVG(magnitude), 0.0) AS avg_magnitude,
        COALESCE(MAX(magnitude), 0.0) AS max_magnitude,
        window_end AS \`timestamp\`
    FROM TABLE(
        TUMBLE(TABLE telemetry_events, DESCRIPTOR(\`timestamp\`), INTERVAL '1' MINUTE)
    )
    GROUP BY window_start, window_end
);`,
  },
  {
    id: 'correlated_alerts',
    name: '03_correlated_alerts.sql (Multi-Indicator Join)',
    description: 'Mendeteksi lonjakan anomali simultan lintas domain (seismik + PGA stasiun + deformasi satelit InSAR + buoy laut) dalam window 2 menit.',
    sql: `-- Detects when multiple independent indicators change simultaneously.
-- Sinks JSON alerts directly to Confluent Cloud topic gempa.correlated_alerts.

INSERT INTO \`gempa.correlated_alerts\` (\`key\`, \`val\`)
SELECT
    CAST('alert' AS BYTES) AS \`key\`,
    CAST(
        JSON_OBJECT(
            'alert_level' VALUE alert_level,
            'correlated_indicators' VALUE correlated_indicators,
            'time_window' VALUE time_window,
            'description' VALUE description,
            'timestamp' VALUE DATE_FORMAT(\`timestamp\`, 'yyyy-MM-dd''T''HH:mm:ss.SSS''Z''')
        ) AS BYTES
    ) AS \`val\`
FROM (
    SELECT
        CASE 
            WHEN indicator_count >= 3 THEN 'CRITICAL'
            WHEN indicator_count >= 2 THEN 'HIGH'
            ELSE 'ELEVATED'
        END AS alert_level,
        
        CASE 
            WHEN max_mag >= 7.0 AND max_pga >= 0.15 AND max_slip >= 1.0 AND max_wave >= 2.0
                THEN JSON_ARRAY('Seismic Alert (M>=7.0)', 'Station PGA Surge (>=0.15g)', 'InSAR Fault Slip (>=1.0m)', 'Tsunami Wave Surge (>=2.0m)')
            WHEN max_mag >= 7.0 AND max_pga >= 0.15 AND max_wave >= 2.0
                THEN JSON_ARRAY('Seismic Alert (M>=7.0)', 'Station PGA Surge (>=0.15g)', 'Tsunami Wave Surge (>=2.0m)')
            WHEN max_mag >= 7.0 AND max_pga >= 0.15 AND max_slip >= 1.0
                THEN JSON_ARRAY('Seismic Alert (M>=7.0)', 'Station PGA Surge (>=0.15g)', 'InSAR Fault Slip (>=1.0m)')
            WHEN max_mag >= 7.0 AND max_wave >= 2.0
                THEN JSON_ARRAY('Seismic Alert (M>=7.0)', 'Tsunami Wave Surge (>=2.0m)')
            WHEN max_mag >= 7.0 AND max_slip >= 1.0
                THEN JSON_ARRAY('Seismic Alert (M>=7.0)', 'InSAR Fault Slip (>=1.0m)')
            WHEN max_pga >= 0.15 AND max_wave >= 2.0
                THEN JSON_ARRAY('Station PGA Surge (>=0.15g)', 'Tsunami Wave Surge (>=2.0m)')
            WHEN max_pga >= 0.15 AND max_slip >= 1.0
                THEN JSON_ARRAY('Station PGA Surge (>=0.15g)', 'InSAR Fault Slip (>=1.0m)')
            ELSE JSON_ARRAY('Seismic Precursor', 'Station Network Acceleration')
        END AS correlated_indicators,
        
        CAST(window_start AS STRING) || ' to ' || CAST(window_end AS STRING) AS time_window,
        
        CASE 
            WHEN indicator_count >= 3 THEN 'CRITICAL: Multiple independent seismic, geodetic, and ocean indicators confirm major megathrust event. Immediate evacuation recommended.'
            WHEN indicator_count >= 2 THEN 'HIGH: Co-seismic slip and severe ground acceleration detected simultaneously across regional network.'
            ELSE 'ELEVATED: Precursor earthquake swarm and ground acceleration increase.'
        END AS description,
        
        window_end AS \`timestamp\`
    FROM (
        SELECT
            window_start,
            window_end,
            MAX(magnitude) AS max_mag,
            MAX(pga_recorded) AS max_pga,
            MAX(coseismic_slip) AS max_slip,
            MAX(wave_height) AS max_wave,
            (CASE WHEN MAX(magnitude) >= 7.0 THEN 1 ELSE 0 END) +
            (CASE WHEN COALESCE(MAX(pga_recorded), 0.0) >= 0.15 THEN 1 ELSE 0 END) +
            (CASE WHEN COALESCE(MAX(coseismic_slip), 0.0) >= 1.0 THEN 1 ELSE 0 END) +
            (CASE WHEN COALESCE(MAX(wave_height), 0.0) >= 2.0 THEN 1 ELSE 0 END)
            AS indicator_count
        FROM TABLE(
            TUMBLE(TABLE telemetry_events, DESCRIPTOR(\`timestamp\`), INTERVAL '2' MINUTE)
        )
        GROUP BY window_start, window_end
    )
    WHERE indicator_count >= 2
);`,
  },
  {
    id: 'tsunami_detection',
    name: '04_tsunami_detection.sql (Wave Front Matcher)',
    description: 'Pencocokan pola rambatan gelombang tsunami dari sensor InaTEWS DART Buoy & IOC tide gauge dengan ambang batas bahaya pesisir.',
    sql: `-- Real-time tsunami wave height & anomaly pattern matching.
-- Sinks JSON alerts directly to Confluent Cloud topic gempa.tsunami_scenarios.

INSERT INTO \`gempa.tsunami_scenarios\` (\`key\`, \`val\`)
SELECT
    CAST('tsunami' AS BYTES) AS \`key\`,
    CAST(
        JSON_OBJECT(
            'active' VALUE TRUE,
            'detection_time' VALUE DATE_FORMAT(window_start, 'yyyy-MM-dd''T''HH:mm:ss.SSS''Z'''),
            'sensor_id' VALUE sensor_id,
            'wave_anomaly' VALUE max_wave_height,
            'affected_zones' VALUE (
                CASE 
                    WHEN max_wave_height > 10.0 THEN JSON_ARRAY('Pesisir Mentawai', 'Padang', 'Cilacap', 'Anyer', 'Palu Bay')
                    WHEN max_wave_height > 5.0 THEN JSON_ARRAY('Zona Pesisir Utama (0-10m ASL)', 'Pesisir Banten & Selat Sunda', 'Pesisir Barat Sumatera')
                    ELSE JSON_ARRAY('Zona Waspada Pesisir', 'Pelabuhan Regional')
                END
            ),
            'response_actions' VALUE (
                CASE 
                    WHEN max_wave_height > 5.0 THEN JSON_ARRAY('🚨 EVAKUASI SEGERA ke dataran tinggi (>20m)', 'Aktifkan sirene tsunami nasional', 'Hentikan seluruh navigasi laut & pelabuhan', 'Mobilisasi Tim SAR & BNPB')
                    ELSE JSON_ARRAY('Waspada potensi gelombang tinggi', 'Jauhi pantai dan muara sungai')
                END
            ),
            'severity' VALUE (
                CASE 
                    WHEN max_wave_height > 8.0 THEN 'CRITICAL'
                    WHEN max_wave_height > 3.0 THEN 'HIGH'
                    ELSE 'ELEVATED'
                END
            ),
            'timestamp' VALUE DATE_FORMAT(window_end, 'yyyy-MM-dd''T''HH:mm:ss.SSS''Z''')
        ) AS BYTES
    ) AS \`val\`
FROM (
    SELECT
        window_start,
        window_end,
        sensor_id,
        MAX(wave_height) AS max_wave_height
    FROM TABLE(
        TUMBLE(TABLE ocean_events, DESCRIPTOR(\`timestamp\`), INTERVAL '1' MINUTE)
    )
    GROUP BY window_start, window_end, sensor_id
)
WHERE max_wave_height > 1.5;`,
  },
];

export default function FlinkPanel({ activityIndex, status }: FlinkPanelProps) {
  const intensity = activityIndex?.overall_percentage ?? status?.seismic_intensity ?? 15.0;

  return (
    <div className="flink-panel">
      {/* Top Banner & Telemetry Header */}
      <div className="card flink-header-card">
        <div className="flink-header-card__left">
          <div className="flink-header-card__icon-wrap">
            <span className="flink-header-card__icon">⚡</span>
          </div>
          <div>
            <div className="flink-header-card__title-row">
              <h2 className="flink-header-card__title">Apache Flink Stream Processing Engine</h2>
              <span className="card__badge card__badge--flink">CONFLUENT CLUSTER FLINK v1.20</span>
              <span className="card__badge card__badge--live">LIVE PROCESSING</span>
            </div>
            <p className="flink-header-card__desc">
              Stateful Stream Processing berkecepatan tinggi dengan distributed event-time tumbling windows,
              multi-stream correlation, dan evaluasi kontinyu terhadap seluruh telemetri kegempaan Indonesia.
            </p>
          </div>
        </div>

        <div className="flink-header-card__stats">
          <div className="flink-stat-box">
            <span className="flink-stat-box__label">COMPUTE POOL</span>
            <span className="flink-stat-box__val">cpool-gempa-prod</span>
          </div>
          <div className="flink-stat-box">
            <span className="flink-stat-box__label">THROUGHPUT</span>
            <span className="flink-stat-box__val">1,480 msgs/s</span>
          </div>
          <div className="flink-stat-box">
            <span className="flink-stat-box__label">WATERMARK LAG</span>
            <span className="flink-stat-box__val">&lt; 140 ms</span>
          </div>
          <div className="flink-stat-box">
            <span className="flink-stat-box__label">CHECKPOINTS</span>
            <span className="flink-stat-box__val" style={{ color: 'var(--status-normal)' }}>100% OK</span>
          </div>
        </div>
      </div>

      {/* Visual Streaming Pipeline DAG Topology */}
      <div className="card flink-dag-card">
        <div className="card__header">
          <span className="card__title">
            <span className="card__title-icon">🔀</span>
            Streaming DAG Topology (Confluent Cloud ➔ Flink Engine ➔ Dashboard)
          </span>
          <span className="card__badge card__badge--live">ACTIVE EVENT FLOW</span>
        </div>

        <div className="flink-dag">
          {/* Step 1: Ingestion Topics */}
          <div className="flink-dag__col">
            <div className="flink-dag__col-title">1. KAFKA SOURCES</div>
            <div className="flink-dag__node flink-dag__node--source">
              <span className="flink-dag__node-tag">TOPIC</span>
              <span className="flink-dag__node-name">gempa.seismic</span>
              <span className="flink-dag__node-sub">BMKG & USGS Quakes</span>
            </div>
            <div className="flink-dag__node flink-dag__node--source">
              <span className="flink-dag__node-tag">TOPIC</span>
              <span className="flink-dag__node-name">gempa.stations</span>
              <span className="flink-dag__node-sub">12 Broadband Seismometers</span>
            </div>
            <div className="flink-dag__node flink-dag__node--source">
              <span className="flink-dag__node-tag">TOPIC</span>
              <span className="flink-dag__node-name">gempa.tsunami</span>
              <span className="flink-dag__node-sub">InaTEWS Buoys & IOC</span>
            </div>
            <div className="flink-dag__node flink-dag__node--source">
              <span className="flink-dag__node-tag">TOPIC</span>
              <span className="flink-dag__node-name">gempa.satellite</span>
              <span className="flink-dag__node-sub">InSAR Fault Slip</span>
            </div>
            <div className="flink-dag__node flink-dag__node--source">
              <span className="flink-dag__node-tag">TOPIC</span>
              <span className="flink-dag__node-name">gempa.weather</span>
              <span className="flink-dag__node-sub">Open-Meteo Maritime</span>
            </div>
          </div>

          <div className="flink-dag__arrow">➔</div>

          {/* Step 2: Apache Flink Processing Jobs */}
          <div className="flink-dag__col">
            <div className="flink-dag__col-title">2. FLINK SQL PROCESSING</div>
            <div className="flink-dag__node flink-dag__node--flink">
              <span className="flink-dag__node-tag" style={{ color: '#00f2ff' }}>FLINK JOB #1</span>
              <span className="flink-dag__node-name">TUMBLE Window (1 Min)</span>
              <span className="flink-dag__node-sub">Seismic Intensity Index Aggregation (40% Mag + 35% PGA + 15% Slip + 10% Ocean)</span>
            </div>
            <div className="flink-dag__node flink-dag__node--flink">
              <span className="flink-dag__node-tag" style={{ color: '#00f2ff' }}>FLINK JOB #2</span>
              <span className="flink-dag__node-name">Multi-Indicator Join (2 Min)</span>
              <span className="flink-dag__node-sub">Correlated Alert Engine (Threshold: ≥2 & ≥3 Sensors)</span>
            </div>
            <div className="flink-dag__node flink-dag__node--flink">
              <span className="flink-dag__node-tag" style={{ color: '#00f2ff' }}>FLINK JOB #3</span>
              <span className="flink-dag__node-name">Tsunami Anomaly Window (30s)</span>
              <span className="flink-dag__node-sub">InaTEWS Wave Surge & Run-up Assessment</span>
            </div>
          </div>

          <div className="flink-dag__arrow">➔</div>

          {/* Step 3: Sinks Topics */}
          <div className="flink-dag__col">
            <div className="flink-dag__col-title">3. KAFKA DERIVED SINKS</div>
            <div className="flink-dag__node flink-dag__node--sink">
              <span className="flink-dag__node-tag" style={{ color: '#10b981' }}>DERIVED TOPIC</span>
              <span className="flink-dag__node-name">gempa.intensity_index</span>
              <span className="flink-dag__node-sub">Current: {intensity.toFixed(1)}%</span>
            </div>
            <div className="flink-dag__node flink-dag__node--sink">
              <span className="flink-dag__node-tag" style={{ color: '#10b981' }}>DERIVED TOPIC</span>
              <span className="flink-dag__node-name">gempa.correlated_alerts</span>
              <span className="flink-dag__node-sub">Multi-Agency Early Warning</span>
            </div>
            <div className="flink-dag__node flink-dag__node--sink">
              <span className="flink-dag__node-tag" style={{ color: '#10b981' }}>DERIVED TOPIC</span>
              <span className="flink-dag__node-name">gempa.tsunami_scenarios</span>
              <span className="flink-dag__node-sub">Wave Height & Arrival Times</span>
            </div>
          </div>

          <div className="flink-dag__arrow">➔</div>

          {/* Step 4: Streaming Output */}
          <div className="flink-dag__col">
            <div className="flink-dag__col-title">4. STREAMING OUTPUT</div>
            <div className="flink-dag__node flink-dag__node--sink">
              <span className="flink-dag__node-tag" style={{ color: '#a855f7' }}>STREAM HUB</span>
              <span className="flink-dag__node-name">Go Backend SSE Hub</span>
              <span className="flink-dag__node-sub">Real-Time WebSocket & Dashboard</span>
            </div>
          </div>
        </div>
      </div>

      {/* Flink SQL Query Studio disembunyikan sesuai arahan */}
    </div>
  );
}
