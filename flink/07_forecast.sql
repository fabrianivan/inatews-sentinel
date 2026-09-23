-- ============================================
-- INATEWS SENTINEL — AI/ML Forecast Pipeline
-- ============================================
-- Confluent Cloud Flink SQL: Real-time seismic forecast using
-- windowed trend analysis and anomaly detection.

INSERT INTO `gempa.forecast` (`key`, `val`)
SELECT
    CAST(forecast_id AS BYTES) AS `key`,
    CAST(
        JSON_OBJECT(
            'forecast_id' VALUE forecast_id,
            'forecast_type' VALUE forecast_type,
            'target_metric' VALUE target_metric,
            'current_value' VALUE ROUND(current_value, 3),
            'predicted_5min' VALUE ROUND(predicted_5min, 3),
            'predicted_15min' VALUE ROUND(predicted_15min, 3),
            'predicted_30min' VALUE ROUND(predicted_30min, 3),
            'trend_direction' VALUE trend_direction,
            'trend_velocity' VALUE ROUND(trend_velocity, 4),
            'anomaly_score' VALUE ROUND(anomaly_score, 3),
            'confidence' VALUE ROUND(confidence, 3),
            'risk_level' VALUE risk_level,
            'model' VALUE model_name,
            'window_start' VALUE DATE_FORMAT(window_start, 'yyyy-MM-dd''T''HH:mm:ss.SSS''Z'''),
            'window_end' VALUE DATE_FORMAT(window_end, 'yyyy-MM-dd''T''HH:mm:ss.SSS''Z'''),
            'generated_at' VALUE DATE_FORMAT(`timestamp`, 'yyyy-MM-dd''T''HH:mm:ss.SSS''Z''')
        ) AS BYTES
    ) AS `val`
FROM (
    SELECT
        CONCAT('FCAST-', DATE_FORMAT(window_end, 'yyyyMMdd-HHmmss')) AS forecast_id,
        'SEISMIC_FORECAST' AS forecast_type,
        'seismic_intensity' AS target_metric,

        current_intensity AS current_value,

        GREATEST(0.0, LEAST(100.0,
            current_intensity + (trend_factor * 5.0)
        )) AS predicted_5min,

        GREATEST(0.0, LEAST(100.0,
            current_intensity + (trend_factor * 15.0 * 0.85)
        )) AS predicted_15min,

        GREATEST(0.0, LEAST(100.0,
            current_intensity + (trend_factor * 30.0 * 0.65)
        )) AS predicted_30min,

        CASE
            WHEN trend_factor > 5.0 THEN 'RAPIDLY_INCREASING'
            WHEN trend_factor > 2.0 THEN 'INCREASING'
            WHEN trend_factor > 0.5 THEN 'SLIGHTLY_INCREASING'
            WHEN trend_factor > -0.5 THEN 'STABLE'
            WHEN trend_factor > -2.0 THEN 'SLIGHTLY_DECREASING'
            WHEN trend_factor > -5.0 THEN 'DECREASING'
            ELSE 'RAPIDLY_DECREASING'
        END AS trend_direction,

        ABS(trend_factor) AS trend_velocity,

        CASE
            WHEN stddev_intensity > 0 THEN
                ABS(current_intensity - avg_intensity) / stddev_intensity
            ELSE 0.0
        END AS anomaly_score,

        GREATEST(0.3, LEAST(0.99,
            base_confidence * (1.0 - ABS(trend_factor) * 0.02)
        )) AS confidence,

        CASE
            WHEN current_intensity >= 75.0 THEN 'CRITICAL'
            WHEN current_intensity >= 50.0 THEN 'HIGH'
            WHEN current_intensity >= 30.0 THEN 'ELEVATED'
            ELSE 'NORMAL'
        END AS risk_level,

        'FlinkSQL-TrendExtrapolation-v1' AS model_name,

        window_start,
        window_end,
        window_end AS `timestamp`

    FROM (
        SELECT
            window_start,
            window_end,

            (
                COALESCE(MAX(magnitude), 0.0) / 9.5 * 40.0 +
                COALESCE(AVG(pga_recorded), 0.0) / 0.5 * 35.0 +
                COALESCE(MAX(coseismic_slip), 0.0) / 5.0 * 15.0 +
                COALESCE(MAX(wave_height), 0.0) / 10.0 * 10.0
            ) AS current_intensity,

            COALESCE(AVG(magnitude), 0.0) * 10.0 + COALESCE(AVG(pga_recorded), 0.0) * 100.0 AS avg_intensity,

            COALESCE(STDDEV_POP(magnitude), 0.0) * 10.0 + COALESCE(STDDEV_POP(pga_recorded), 0.0) * 100.0 AS stddev_intensity,

            (COALESCE(MAX(magnitude), 0.0) - COALESCE(MIN(magnitude), 0.0)) * 5.0 +
            (COALESCE(MAX(pga_recorded), 0.0) - COALESCE(MIN(pga_recorded), 0.0)) * 50.0 AS trend_factor,

            CASE
                WHEN COUNT(*) >= 10 THEN 0.95
                WHEN COUNT(*) >= 5 THEN 0.85
                WHEN COUNT(*) >= 2 THEN 0.70
                ELSE 0.50
            END AS base_confidence

        FROM TABLE(
            TUMBLE(TABLE telemetry_events, DESCRIPTOR(`timestamp`), INTERVAL '2' MINUTE)
        )
        GROUP BY window_start, window_end
    )
    WHERE current_intensity > 0.0
);
