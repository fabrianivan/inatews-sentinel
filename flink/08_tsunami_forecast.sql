-- ============================================
-- INATEWS SENTINEL — Tsunami Wave Forecast
-- ============================================

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
        CONCAT('FCAST-TSUNAMI-', DATE_FORMAT(window_end, 'yyyyMMdd-HHmmss')) AS forecast_id,
        'TSUNAMI_WAVE_FORECAST' AS forecast_type,
        'wave_height' AS target_metric,

        current_wave AS current_value,

        GREATEST(0.0, current_wave + (wave_trend * 5.0)) AS predicted_5min,
        GREATEST(0.0, current_wave + (wave_trend * 15.0 * 0.90)) AS predicted_15min,
        GREATEST(0.0, current_wave + (wave_trend * 30.0 * 0.70)) AS predicted_30min,

        CASE
            WHEN wave_trend > 0.5 THEN 'RAPIDLY_RISING'
            WHEN wave_trend > 0.1 THEN 'RISING'
            WHEN wave_trend > -0.1 THEN 'STABLE'
            WHEN wave_trend > -0.5 THEN 'RECEDING'
            ELSE 'RAPIDLY_RECEDING'
        END AS trend_direction,

        ABS(wave_trend) AS trend_velocity,

        CASE
            WHEN wave_stddev > 0 THEN ABS(current_wave - wave_mean) / wave_stddev
            ELSE 0.0
        END AS anomaly_score,

        GREATEST(0.3, 0.90 - ABS(wave_trend) * 0.1) AS confidence,

        CASE
            WHEN current_wave >= 3.0 THEN 'CRITICAL'
            WHEN current_wave >= 1.5 THEN 'HIGH'
            WHEN current_wave >= 0.8 THEN 'ELEVATED'
            ELSE 'NORMAL'
        END AS risk_level,

        'FlinkSQL-TsunamiPropagation-v1' AS model_name,

        window_start,
        window_end,
        window_end AS `timestamp`

    FROM (
        SELECT
            window_start,
            window_end,
            MAX(wave_height) AS current_wave,
            AVG(wave_height) AS wave_mean,
            STDDEV_POP(wave_height) AS wave_stddev,
            (MAX(wave_height) - MIN(wave_height)) * 2.0 AS wave_trend
        FROM TABLE(
            TUMBLE(TABLE ocean_events, DESCRIPTOR(`timestamp`), INTERVAL '2' MINUTE)
        )
        GROUP BY window_start, window_end
    )
    WHERE current_wave IS NOT NULL AND current_wave > 0.0
);
