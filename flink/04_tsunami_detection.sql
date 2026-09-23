-- ============================================
-- GEMPA SENTINEL — Tsunami Anomaly Detection
-- ============================================
-- Monitors InaTEWS DART buoys and coastal tide gauges
-- for megathrust tsunami wave propagation.
-- Outputs JSON alerts directly into Confluent Cloud topic gempa.tsunami_scenarios.

INSERT INTO `gempa.tsunami_scenarios` (`key`, `val`)
SELECT
    CAST('tsunami' AS BYTES) AS `key`,
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
    ) AS `val`
FROM (
    SELECT
        window_start,
        window_end,
        sensor_id,
        MAX(wave_height) AS max_wave_height
    FROM TABLE(
        TUMBLE(TABLE ocean_events, DESCRIPTOR(`timestamp`), INTERVAL '1' MINUTE)
    )
    GROUP BY window_start, window_end, sensor_id
)
WHERE max_wave_height > 1.5;
