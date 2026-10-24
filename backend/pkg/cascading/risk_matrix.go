package cascading

import (
	"math"
	"time"
)

type ThreatLevel string

const (
	ThreatLow      ThreatLevel = "LOW"
	ThreatModerate ThreatLevel = "MODERATE"
	ThreatHigh     ThreatLevel = "HIGH"
	ThreatCritical ThreatLevel = "CRITICAL"
)

type SeismicEvent struct {
	Magnitude      float64   `json:"magnitude"`
	DepthKm        float64   `json:"depth_km"`
	IsOffshore     bool      `json:"is_offshore"`
	DistanceToCity float64   `json:"distance_to_city_km"`
	RecordedAt     time.Time `json:"recorded_at"`
}

type CascadingEvaluation struct {
	TsunamiThreatLevel   ThreatLevel `json:"tsunami_threat_level"`
	LiquefactionRisk     ThreatLevel `json:"liquefaction_risk"`
	LandslideProbability float64     `json:"landslide_probability"`
	CompoundRiskScore    float64     `json:"compound_risk_score"` // 0.0 - 100.0
	EvacuationUrgency    string      `json:"evacuation_urgency"`
}

// EvaluateCascadingThreat evaluates multi-hazard interactions from raw seismic parameters.
func EvaluateCascadingThreat(event SeismicEvent, rainfallIntensityMm float64, slopeSteepnessDeg float64) CascadingEvaluation {
	var tsunamiThreat ThreatLevel = ThreatLow

	if event.IsOffshore && event.DepthKm < 70.0 {
		if event.Magnitude >= 7.8 {
			tsunamiThreat = ThreatCritical
		} else if event.Magnitude >= 7.0 {
			tsunamiThreat = ThreatHigh
		} else if event.Magnitude >= 6.5 {
			tsunamiThreat = ThreatModerate
		}
	}

	var liquefaction ThreatLevel = ThreatLow
	if event.Magnitude >= 6.0 && event.DepthKm < 30.0 && event.DistanceToCity < 100.0 {
		if event.Magnitude >= 7.2 {
			liquefaction = ThreatCritical
		} else if event.Magnitude >= 6.8 {
			liquefaction = ThreatHigh
		} else {
			liquefaction = ThreatModerate
		}
	}

	// Landslide probability: Newmark displacement proxy
	baseSeismicAcc := math.Pow(10, 0.25*event.Magnitude-0.03*event.DepthKm) / (event.DistanceToCity + 10.0)
	slopeFactor := math.Sin(slopeSteepnessDeg * math.Pi / 180.0)
	rainFactor := math.Min(rainfallIntensityMm/100.0, 2.0)

	landslideProb := (baseSeismicAcc * slopeFactor * (1.0 + 0.5*rainFactor))
	if landslideProb > 1.0 {
		landslideProb = 1.0
	} else if landslideProb < 0.0 {
		landslideProb = 0.0
	}

	// Compound score: 0 to 100
	score := (event.Magnitude/9.0)*40.0 + (1.0/(event.DepthKm+1.0))*200.0 + (landslideProb * 20.0)
	if tsunamiThreat == ThreatCritical {
		score += 30.0
	} else if tsunamiThreat == ThreatHigh {
		score += 18.0
	}
	if score > 100.0 {
		score = 100.0
	}

	var urgency string
	switch {
	case score >= 75.0:
		urgency = "IMMEDIATE_MANDATORY_EVACUATION"
	case score >= 50.0:
		urgency = "HEIGHTENED_ALERT_PREPARE_SHELTER"
	case score >= 25.0:
		urgency = "ADVISORY_MONITOR_CHANNELS"
	default:
		urgency = "NORMAL_OPERATIONAL_POSTURE"
	}

	return CascadingEvaluation{
		TsunamiThreatLevel:   tsunamiThreat,
		LiquefactionRisk:     liquefaction,
		LandslideProbability: math.Round(landslideProb*100) / 100,
		CompoundRiskScore:    math.Round(score*10) / 10,
		EvacuationUrgency:    urgency,
	}
}
