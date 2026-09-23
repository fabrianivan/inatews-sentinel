package realtime

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"gempa-sentinel/internal/models"
)

// BMKGAutogempaResponse represents the BMKG autogempa.json response
type BMKGAutogempaResponse struct {
	Infogempa struct {
		Gempa BMKGGempaDetail `json:"gempa"`
	} `json:"Infogempa"`
}

// BMKGGempaterkiniResponse represents the BMKG gempaterkini.json response
type BMKGGempaterkiniResponse struct {
	Infogempa struct {
		Gempa []BMKGGempaDetail `json:"gempa"`
	} `json:"Infogempa"`
}

// BMKGGempaDetail represents individual earthquake details from BMKG
type BMKGGempaDetail struct {
	Tanggal     string `json:"Tanggal"`
	Jam         string `json:"Jam"`
	DateTime    string `json:"DateTime"`
	Coordinates string `json:"Coordinates"`
	Lintang     string `json:"Lintang"`
	Bujur       string `json:"Bujur"`
	Magnitude   string `json:"Magnitude"`
	Kedalaman   string `json:"Kedalaman"`
	Wilayah     string `json:"Wilayah"`
	Potensi     string `json:"Potensi"`
	Dirasakan   string `json:"Dirasakan,omitempty"`
	Shakemap    string `json:"Shakemap,omitempty"`
}

// BMKGClient handles fetching real data from BMKG TEWS public APIs
type BMKGClient struct {
	httpClient *http.Client
}

// NewBMKGClient creates a new BMKG client
func NewBMKGClient() *BMKGClient {
	return &BMKGClient{
		httpClient: &http.Client{Timeout: 8 * time.Second},
	}
}

// FetchLatestGempa gets the most recent significant or felt earthquake
func (c *BMKGClient) FetchLatestGempa() (*models.SeismicEvent, *BMKGGempaDetail, error) {
	url := "https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json"
	resp, err := c.httpClient.Get(url)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to fetch BMKG autogempa: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, nil, fmt.Errorf("BMKG autogempa HTTP error: %d", resp.StatusCode)
	}

	var data BMKGAutogempaResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, nil, fmt.Errorf("failed to parse BMKG autogempa json: %w", err)
	}

	detail := data.Infogempa.Gempa
	if isEmptyBMKGDetail(detail) {
		return nil, nil, nil
	}

	evt, _ := convertBMKGToSeismicEvent(detail)
	return evt, &detail, nil
}

// FetchRecentGempa gets the last 15 M5.0+ earthquakes in Indonesia
func (c *BMKGClient) FetchRecentGempa() ([]models.SeismicEvent, []BMKGGempaDetail, error) {
	url := "https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json"
	resp, err := c.httpClient.Get(url)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to fetch BMKG gempaterkini: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, nil, fmt.Errorf("BMKG gempaterkini HTTP error: %d", resp.StatusCode)
	}

	var data BMKGGempaterkiniResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, nil, fmt.Errorf("failed to parse BMKG gempaterkini json: %w", err)
	}

	var events []models.SeismicEvent
	filtered := make([]BMKGGempaDetail, 0, len(data.Infogempa.Gempa))
	for _, g := range data.Infogempa.Gempa {
		if isEmptyBMKGDetail(g) {
			continue
		}
		evt, _ := convertBMKGToSeismicEvent(g)
		if evt != nil {
			events = append(events, *evt)
			filtered = append(filtered, g)
		}
	}
	return events, filtered, nil
}

func isEmptyBMKGDetail(g BMKGGempaDetail) bool {
	return strings.TrimSpace(g.Magnitude) == "" ||
		strings.TrimSpace(g.Coordinates) == "" ||
		strings.TrimSpace(g.Wilayah) == "" ||
		strings.TrimSpace(g.DateTime) == ""
}

func convertBMKGToSeismicEvent(g BMKGGempaDetail) (*models.SeismicEvent, string) {
	if isEmptyBMKGDetail(g) {
		return nil, g.Potensi
	}

	mag, err := strconv.ParseFloat(g.Magnitude, 64)
	if err != nil || mag <= 0 {
		return nil, g.Potensi
	}

	// Parse depth e.g. "10 km", "10 Km", "10KM", " 25 km "
	rawDepth := strings.ToLower(strings.TrimSpace(g.Kedalaman))
	rawDepth = strings.ReplaceAll(rawDepth, "km", "")
	rawDepth = strings.TrimSpace(rawDepth)
	depth, err := strconv.ParseFloat(rawDepth, 64)
	if err != nil || depth <= 0 {
		depth = 10.0 // Default crustal depth
	}

	// Parse coordinates e.g. "-8.08,120.56"
	parts := strings.Split(g.Coordinates, ",")
	if len(parts) != 2 {
		return nil, g.Potensi
	}
	lat, err := strconv.ParseFloat(strings.TrimSpace(parts[0]), 64)
	if err != nil {
		return nil, g.Potensi
	}
	lon, err := strconv.ParseFloat(strings.TrimSpace(parts[1]), 64)
	if err != nil {
		return nil, g.Potensi
	}

	// Parse timestamp
	t, err := time.Parse(time.RFC3339, g.DateTime)
	if err != nil {
		t = time.Now()
	}

	mmi := int(mag * 1.5 - depth*0.015)
	if mmi < 1 {
		mmi = 1
	}
	if mmi > 12 {
		mmi = 12
	}

	pga := (mag * 0.14) / (1.0 + depth*0.01)
	if pga < 0.001 {
		pga = 0.001
	}

	return &models.SeismicEvent{
		Type:      "SEISMIC",
		Magnitude: mag,
		Depth:     depth,
		Frequency: 1.0 + mag*0.5,
		Count:     1,
		Latitude:  lat,
		Longitude: lon,
		MMI:       mmi,
		PGA:       pga,
		FaultZone: g.Wilayah,
		Timestamp: t,
	}, g.Potensi
}
