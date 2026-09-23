-- ============================================
-- GEMPA SENTINEL — Confluent Cloud Flink SQL Source Views
-- ============================================
-- Run these in Confluent Cloud Flink SQL workspace (or via scripts/deploy-flink.sh).
-- In Confluent Cloud, Kafka topics are automatically registered as inferred tables.
-- These views parse incoming JSON payloads and expose typed columns with $rowtime.

-- 1. Seismic Events (BMKG & USGS Feed)
CREATE VIEW IF NOT EXISTS seismic_events AS
SELECT 
    JSON_VALUE(MAKE_VALID_UTF8(val), '$.type') AS `type`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.magnitude') AS DOUBLE) AS `magnitude`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.depth') AS DOUBLE) AS `depth`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.frequency') AS DOUBLE) AS `frequency`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.count') AS INT) AS `count`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.latitude') AS DOUBLE) AS `latitude`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.longitude') AS DOUBLE) AS `longitude`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.mmi') AS INT) AS `mmi`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.pga') AS DOUBLE) AS `pga`,
    JSON_VALUE(MAKE_VALID_UTF8(val), '$.fault_zone') AS `fault_zone`,
    $rowtime AS `timestamp`
FROM `gempa.seismic`;

-- 2. BMKG Station Network Telemetry
CREATE VIEW IF NOT EXISTS station_events AS
SELECT 
    JSON_VALUE(MAKE_VALID_UTF8(val), '$.type') AS `type`,
    JSON_VALUE(MAKE_VALID_UTF8(val), '$.station_id') AS `station_id`,
    JSON_VALUE(MAKE_VALID_UTF8(val), '$.station_name') AS `station_name`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.latitude') AS DOUBLE) AS `latitude`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.longitude') AS DOUBLE) AS `longitude`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.signal_quality') AS DOUBLE) AS `signal_quality`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.p_wave_arrival') AS DOUBLE) AS `p_wave_arrival`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.s_wave_arrival') AS DOUBLE) AS `s_wave_arrival`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.pga_recorded') AS DOUBLE) AS `pga_recorded`,
    JSON_VALUE(MAKE_VALID_UTF8(val), '$.status') AS `status`,
    $rowtime AS `timestamp`
FROM `gempa.stations`;

-- 3. InaTEWS DART Buoy & Ocean Sensor Events
CREATE VIEW IF NOT EXISTS ocean_events AS
SELECT 
    JSON_VALUE(MAKE_VALID_UTF8(val), '$.type') AS `type`,
    JSON_VALUE(MAKE_VALID_UTF8(val), '$.sensor_id') AS `sensor_id`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.sea_level') AS DOUBLE) AS `sea_level`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.wave_height') AS DOUBLE) AS `wave_height`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.tsunami_sensor_reading') AS DOUBLE) AS `tsunami_sensor_reading`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.buoy_data') AS DOUBLE) AS `buoy_data`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.wave_eta') AS INT) AS `wave_eta`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.latitude') AS DOUBLE) AS `latitude`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.longitude') AS DOUBLE) AS `longitude`,
    $rowtime AS `timestamp`
FROM `gempa.tsunami`;

-- 4. Weather / Meteorological Events
CREATE VIEW IF NOT EXISTS weather_events AS
SELECT 
    JSON_VALUE(MAKE_VALID_UTF8(val), '$.type') AS `type`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.wind_speed') AS DOUBLE) AS `wind_speed`,
    JSON_VALUE(MAKE_VALID_UTF8(val), '$.wind_direction') AS `wind_direction`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.rainfall') AS DOUBLE) AS `rainfall`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.atmospheric_pressure') AS DOUBLE) AS `atmospheric_pressure`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.temperature') AS DOUBLE) AS `temperature`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.humidity') AS DOUBLE) AS `humidity`,
    $rowtime AS `timestamp`
FROM `gempa.weather`;

-- 5. Satellite Observation (InSAR & Geodetic Slip)
CREATE VIEW IF NOT EXISTS satellite_events AS
SELECT 
    JSON_VALUE(MAKE_VALID_UTF8(val), '$.type') AS `type`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.ground_displacement') AS DOUBLE) AS `ground_displacement`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.deformation') AS DOUBLE) AS `deformation`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.coseismic_slip') AS DOUBLE) AS `coseismic_slip`,
    JSON_VALUE(MAKE_VALID_UTF8(val), '$.satellite_id') AS `satellite_id`,
    $rowtime AS `timestamp`
FROM `gempa.satellite`;

-- 6. Critical Infrastructure Events
CREATE VIEW IF NOT EXISTS infrastructure_events AS
SELECT 
    JSON_VALUE(MAKE_VALID_UTF8(val), '$.type') AS `type`,
    JSON_VALUE(MAKE_VALID_UTF8(val), '$.facility_id') AS `facility_id`,
    JSON_VALUE(MAKE_VALID_UTF8(val), '$.facility_name') AS `facility_name`,
    JSON_VALUE(MAKE_VALID_UTF8(val), '$.facility_type') AS `facility_type`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.latitude') AS DOUBLE) AS `latitude`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.longitude') AS DOUBLE) AS `longitude`,
    JSON_VALUE(MAKE_VALID_UTF8(val), '$.damage_level') AS `damage_level`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.operational') AS BOOLEAN) AS `operational`,
    $rowtime AS `timestamp`
FROM `gempa.infrastructure`;

-- 7. Population & Evacuation Readiness Events
CREATE VIEW IF NOT EXISTS population_events AS
SELECT 
    JSON_VALUE(MAKE_VALID_UTF8(val), '$.type') AS `type`,
    JSON_VALUE(MAKE_VALID_UTF8(val), '$.zone') AS `zone`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.population') AS INT) AS `population`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.shelter_capacity') AS INT) AS `shelter_capacity`,
    JSON_VALUE(MAKE_VALID_UTF8(val), '$.evacuation_route_status') AS `evacuation_route_status`,
    CAST(JSON_VALUE(MAKE_VALID_UTF8(val), '$.evacuation_readiness') AS DOUBLE) AS `evacuation_readiness`,
    $rowtime AS `timestamp`
FROM `gempa.population`;

-- 8. Unified Multi-Sensor Telemetry (For append-only streaming window aggregation)
CREATE VIEW IF NOT EXISTS telemetry_events AS
SELECT 
    `timestamp`,
    'seismic' AS event_source,
    magnitude,
    pga,
    CAST(NULL AS DOUBLE) AS pga_recorded,
    CAST(NULL AS DOUBLE) AS coseismic_slip,
    CAST(NULL AS DOUBLE) AS wave_height
FROM seismic_events
UNION ALL
SELECT 
    `timestamp`,
    'station' AS event_source,
    CAST(NULL AS DOUBLE) AS magnitude,
    CAST(NULL AS DOUBLE) AS pga,
    pga_recorded,
    CAST(NULL AS DOUBLE) AS coseismic_slip,
    CAST(NULL AS DOUBLE) AS wave_height
FROM station_events
UNION ALL
SELECT 
    `timestamp`,
    'satellite' AS event_source,
    CAST(NULL AS DOUBLE) AS magnitude,
    CAST(NULL AS DOUBLE) AS pga,
    CAST(NULL AS DOUBLE) AS pga_recorded,
    coseismic_slip,
    CAST(NULL AS DOUBLE) AS wave_height
FROM satellite_events
UNION ALL
SELECT 
    `timestamp`,
    'ocean' AS event_source,
    CAST(NULL AS DOUBLE) AS magnitude,
    CAST(NULL AS DOUBLE) AS pga,
    CAST(NULL AS DOUBLE) AS pga_recorded,
    CAST(NULL AS DOUBLE) AS coseismic_slip,
    wave_height
FROM ocean_events;

