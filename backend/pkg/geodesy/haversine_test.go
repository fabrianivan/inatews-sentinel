package geodesy

import (
	"testing"
)

func TestCalculateDistance(t *testing.T) {
	jakarta := Coordinates{Latitude: -6.2088, Longitude: 106.8456, DepthKm: 10}
	bandung := Coordinates{Latitude: -6.9175, Longitude: 107.6191, DepthKm: 0}

	res := CalculateDistance(jakarta, bandung, 2000)
	if res.DistanceKm < 110 || res.DistanceKm > 160 {
		t.Fatalf("expected distance around 130-150 km, got %f", res.DistanceKm)
	}

	if res.PWaveTravelSec <= 0 || res.SWaveTravelSec <= 0 {
		t.Fatalf("expected positive travel times")
	}

	if res.SWaveTravelSec <= res.PWaveTravelSec {
		t.Fatalf("S-wave travel time must be greater than P-wave")
	}
}

func TestEstimateModifiedMercalli(t *testing.T) {
	mmi := EstimateModifiedMercalli(7.5, 20.0, 10.0)
	if mmi < 7.0 || mmi > 12.0 {
		t.Fatalf("expected high MMI for M7.5 at 20km distance, got %f", mmi)
	}

	farMmi := EstimateModifiedMercalli(5.0, 300.0, 30.0)
	if farMmi > 4.5 {
		t.Fatalf("expected attenuated MMI for M5.0 at 300km, got %f", farMmi)
	}
}

func BenchmarkCalculateDistance(b *testing.B) {
	locA := Coordinates{Latitude: -8.3405, Longitude: 115.0920, DepthKm: 15}
	locB := Coordinates{Latitude: -7.2575, Longitude: 112.7521, DepthKm: 0}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = CalculateDistance(locA, locB, 3000)
	}
}
