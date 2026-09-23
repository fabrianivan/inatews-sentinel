package realtime

import "testing"

func TestConvertBMKGToSeismicEventRejectsEmptyCoordinates(t *testing.T) {
	quake := BMKGGempaDetail{
		Tanggal:     "09 Sep 2026",
		Jam:         "13:21:30 WIB",
		DateTime:    "2026-09-09T06:21:30+00:00",
		Coordinates: "",
		Magnitude:   "3.8",
		Kedalaman:   "25 km",
		Wilayah:     "Pusat gempa berada di laut 31 km selatan Sumur",
		Potensi:     "Gempa ini dirasakan untuk diteruskan pada masyarakat",
	}

	evt, _ := convertBMKGToSeismicEvent(quake)
	if evt != nil {
		t.Fatalf("expected empty BMKG coordinates to be rejected, got %+v", evt)
	}
}
