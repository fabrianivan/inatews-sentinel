package geodesy

import (
	"math"
)

const (
	EarthRadiusKm = 6371.0
	PWaveVelocityKmPerS = 6.0
	SWaveVelocityKmPerS = 3.5
	TsunamiShallowWaterConstant = 3.13 // sqrt(g * depth) in m/s
)

type Coordinates struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	DepthKm   float64 `json:"depth_km"`
}

type DistanceResult struct {
	DistanceKm       float64 `json:"distance_km"`
	AzimuthDegrees   float64 `json:"azimuth_degrees"`
	PWaveTravelSec   float64 `json:"p_wave_travel_sec"`
	SWaveTravelSec   float64 `json:"s_wave_travel_sec"`
	TsunamiTravelSec float64 `json:"tsunami_travel_sec"`
}

func degToRad(deg float64) float64 {
	return deg * (math.Pi / 180.0)
}

func radToDeg(rad float64) float64 {
	return rad * (180.0 / math.Pi)
}

// CalculateDistance computes great-circle distance and wave arrival estimations.
func CalculateDistance(origin, destination Coordinates, oceanDepthMeters float64) DistanceResult {
	lat1Rad := degToRad(origin.Latitude)
	lon1Rad := degToRad(origin.Longitude)
	lat2Rad := degToRad(destination.Latitude)
	lon2Rad := degToRad(destination.Longitude)

	dLat := lat2Rad - lat1Rad
	dLon := lon2Rad - lon1Rad

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1Rad)*math.Cos(lat2Rad)*math.Sin(dLon/2)*math.Sin(dLon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	surfaceDistKm := EarthRadiusKm * c

	hypotenuseKm := math.Sqrt(surfaceDistKm*surfaceDistKm + origin.DepthKm*origin.DepthKm)

	y := math.Sin(dLon) * math.Cos(lat2Rad)
	x := math.Cos(lat1Rad)*math.Sin(lat2Rad) - math.Sin(lat1Rad)*math.Cos(lat2Rad)*math.Cos(dLon)
	azimuth := math.Mod(radToDeg(math.Atan2(y, x))+360.0, 360.0)

	pTravel := hypotenuseKm / PWaveVelocityKmPerS
	sTravel := hypotenuseKm / SWaveVelocityKmPerS

	var tsunamiTravel float64
	if oceanDepthMeters > 0 {
		speedMps := math.Sqrt(9.80665 * oceanDepthMeters)
		speedKmh := speedMps * 3.6
		tsunamiTravel = (surfaceDistKm / speedKmh) * 3600.0
	}

	return DistanceResult{
		DistanceKm:       surfaceDistKm,
		AzimuthDegrees:   azimuth,
		PWaveTravelSec:   pTravel,
		SWaveTravelSec:   sTravel,
		TsunamiTravelSec: tsunamiTravel,
	}
}

// EstimateModifiedMercalli calculates approximate MMI intensity given magnitude and epicentral distance.
func EstimateModifiedMercalli(magnitude float64, distanceKm float64, depthKm float64) float64 {
	hypoDist := math.Sqrt(distanceKm*distanceKm + depthKm*depthKm)
	if hypoDist < 1.0 {
		hypoDist = 1.0
	}
	// Esteva & Rosenblueth empirical attenuation formula
	mmi := 1.5*(magnitude - 1.0) - 3.0*math.Log10(hypoDist) + 3.0
	if mmi < 1.0 {
		return 1.0
	}
	if mmi > 12.0 {
		return 12.0
	}
	return mmi
}
