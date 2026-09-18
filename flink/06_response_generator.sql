-- ============================================
-- GEMPA SENTINEL — Tactical Response Generator
-- ============================================
-- Evaluates cascading hazards and dispatches prioritized multi-agency directives
-- directly into Confluent Cloud topic `gempa.response`.

INSERT INTO `gempa.response` (`key`, `val`)
SELECT
    CAST('INC-20260915-001' AS BYTES) AS `key`,
    CAST(
        JSON_OBJECT(
            'incident_id' VALUE 'INC-20260915-001',
            'priority' VALUE priority,
            'target' VALUE target,
            'action' VALUE action,
            'reason' VALUE reason,
            'generated_at' VALUE DATE_FORMAT(`timestamp`, 'yyyy-MM-dd''T''HH:mm:ss.SSS''Z'''),
            'confidence' VALUE 0.95
        ) AS BYTES
    ) AS `val`
FROM (
    SELECT
        CASE
            WHEN max_wave >= 2.0 OR max_mag >= 7.5 THEN 'CRITICAL'
            WHEN max_mag >= 6.5 THEN 'HIGH'
            ELSE 'ELEVATED'
        END AS priority,

        CASE
            WHEN max_wave >= 2.0 THEN 'EMERGENCY_OPERATIONS'
            WHEN max_pga >= 0.3 THEN 'BNPB_BASARNAS'
            ELSE 'BMKG_DISSEMINATION'
        END AS target,

        CASE
            WHEN max_wave >= 2.0 THEN 'COASTAL_EVACUATION_MANDATE'
            WHEN max_mag >= 7.5 THEN 'INFRASTRUCTURE_SAFE_SHUTDOWN'
            ELSE 'REGIONAL_MONITORING_ALERT'
        END AS action,

        CASE
            WHEN max_wave >= 2.0 AND max_mag >= 7.5
                THEN JSON_ARRAY('High seismic intensity MMI VII+', 'Tsunami wave anomaly confirmed by InaTEWS buoy', 'High coastal population exposure in inundation zone')
            WHEN max_wave >= 2.0
                THEN JSON_ARRAY('Tsunami sensor wave anomaly exceeds 2.0m threshold', 'Rapid golden evacuation window < 20 minutes')
            WHEN max_mag >= 7.5
                THEN JSON_ARRAY('Major megathrust rupture M>=7.5 detected', 'High liquefaction and structural collapse risk')
            ELSE JSON_ARRAY('Seismic acceleration above baseline', 'Emergency services placed on standby')
        END AS reason,

        window_end AS `timestamp`

    FROM (
        SELECT
            window_start,
            window_end,
            MAX(magnitude) AS max_mag,
            MAX(pga_recorded) AS max_pga,
            MAX(wave_height) AS max_wave
        FROM TABLE(
            TUMBLE(TABLE telemetry_events, DESCRIPTOR(`timestamp`), INTERVAL '1' MINUTE)
        )
        GROUP BY window_start, window_end
    )
    WHERE max_mag >= 6.5 OR max_wave >= 1.5
);
