-- ============================================
-- GEMPA SENTINEL — Seismic Intensity Index
-- ============================================
-- Star Query: Computes the real-time National Seismic Intensity Index
-- using 1-minute tumbling windows over BMKG station telemetry & seismic events.
-- Outputs JSON payloads directly to Confluent Cloud topic gempa.intensity_index.

INSERT INTO `gempa.intensity_index` (`key`, `val`)
SELECT
    CAST('intensity' AS BYTES) AS `key`,
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
            'timestamp' VALUE DATE_FORMAT(`timestamp`, 'yyyy-MM-dd''T''HH:mm:ss.SSS''Z''')
        ) AS BYTES
    ) AS `val`
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
        window_end AS `timestamp`
    FROM TABLE(
        TUMBLE(TABLE telemetry_events, DESCRIPTOR(`timestamp`), INTERVAL '1' MINUTE)
    )
    GROUP BY window_start, window_end
);

