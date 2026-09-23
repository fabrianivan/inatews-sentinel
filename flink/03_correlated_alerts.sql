-- ============================================
-- GEMPA SENTINEL — Correlated Alerts
-- ============================================
-- Detects when multiple independent indicators change 
-- simultaneously — seismic, station PGA, InSAR slip, and tsunami sensors.
-- Outputs JSON alerts directly into Confluent Cloud topic gempa.correlated_alerts.

INSERT INTO `gempa.correlated_alerts` (`key`, `val`)
SELECT
    CAST('alert' AS BYTES) AS `key`,
    CAST(
        JSON_OBJECT(
            'alert_level' VALUE alert_level,
            'correlated_indicators' VALUE correlated_indicators,
            'time_window' VALUE time_window,
            'description' VALUE description,
            'timestamp' VALUE DATE_FORMAT(`timestamp`, 'yyyy-MM-dd''T''HH:mm:ss.SSS''Z''')
        ) AS BYTES
    ) AS `val`
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
        
        window_end AS `timestamp`
        
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
            TUMBLE(TABLE telemetry_events, DESCRIPTOR(`timestamp`), INTERVAL '2' MINUTE)
        )
        GROUP BY window_start, window_end
    )
    WHERE indicator_count >= 2
);

