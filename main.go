package main

import (
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"log"
	"net/http"
	"strconv"
)

func main() {
	http.HandleFunc("/", homeHandler)
	http.HandleFunc("/api/weather", weatherHandler)
	http.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir("static"))))

	log.Println("Server starting on http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

type WeatherData struct {
	Lat      float64           `json:"lat"`
	Lon      float64           `json:"lon"`
	Forecast []DayWeatherData `json:"forecast"`
}

type DayWeatherData struct {
	Date        string  `json:"date"`
	Day         int     `json:"day"` // 0=today, 1=tomorrow, etc
	Temperature float64 `json:"temperature"`
	Symbol      string  `json:"symbol"`
}

type YrResponse struct {
	Properties struct {
		Timeseries []struct {
			Time string `json:"time"`
			Data struct {
				Instant struct {
					Details struct {
						AirTemperature float64 `json:"air_temperature"`
					} `json:"details"`
				} `json:"instant"`
				Next1Hours struct {
					Summary struct {
						SymbolCode string `json:"symbol_code"`
					} `json:"summary"`
				} `json:"next_1_hours"`
			} `json:"data"`
		} `json:"timeseries"`
	} `json:"properties"`
}

func homeHandler(w http.ResponseWriter, r *http.Request) {
	tmpl := template.Must(template.ParseFiles("templates/index.html"))
	tmpl.Execute(w, nil)
}

func weatherHandler(w http.ResponseWriter, r *http.Request) {
	latStr := r.URL.Query().Get("lat")
	lonStr := r.URL.Query().Get("lon")
	
	if latStr == "" || lonStr == "" {
		http.Error(w, "lat and lon parameters required", http.StatusBadRequest)
		return
	}
	
	lat, err := strconv.ParseFloat(latStr, 64)
	if err != nil {
		http.Error(w, "Invalid lat parameter", http.StatusBadRequest)
		return
	}
	
	lon, err := strconv.ParseFloat(lonStr, 64)
	if err != nil {
		http.Error(w, "Invalid lon parameter", http.StatusBadRequest)
		return
	}
	
	// Fetch weather from Yr API
	url := fmt.Sprintf("https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=%.4f&lon=%.4f", lat, lon)
	
	client := &http.Client{}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		http.Error(w, "Failed to create request", http.StatusInternalServerError)
		return
	}
	
	req.Header.Set("User-Agent", "CarVacationHelper/1.0 (github.com/youruser/bilsol)")
	
	resp, err := client.Do(req)
	if err != nil {
		http.Error(w, "Failed to fetch weather", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()
	
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		http.Error(w, "Failed to read response", http.StatusInternalServerError)
		return
	}
	
	var yrData YrResponse
	if err := json.Unmarshal(body, &yrData); err != nil {
		http.Error(w, "Failed to parse weather data", http.StatusInternalServerError)
		return
	}
	
	if len(yrData.Properties.Timeseries) == 0 {
		http.Error(w, "No weather data available", http.StatusNotFound)
		return
	}
	
	// Extract 4 days of weather data (taking noon forecast for each day)
	var forecast []DayWeatherData
	processedDays := make(map[string]bool)
	
	for i, entry := range yrData.Properties.Timeseries {
		if len(forecast) >= 4 {
			break
		}
		
		// Extract date (YYYY-MM-DD) from timestamp
		date := entry.Time[:10]
		
		// Skip if we already processed this day
		if processedDays[date] {
			continue
		}
		
		// Look for entries around noon (12:00) for better daily representation
		if len(entry.Time) >= 13 {
			hour := entry.Time[11:13]
			if hour != "12" && hour != "11" && hour != "13" && hour != "10" && hour != "14" {
				// If not near noon, skip unless it's the only entry for this day
				hasNoonEntry := false
				for j := i + 1; j < len(yrData.Properties.Timeseries) && j < i+24; j++ {
					if yrData.Properties.Timeseries[j].Time[:10] == date {
						noonHour := yrData.Properties.Timeseries[j].Time[11:13]
						if noonHour == "12" || noonHour == "11" || noonHour == "13" {
							hasNoonEntry = true
							break
						}
					}
				}
				if hasNoonEntry {
					continue
				}
			}
		}
		
		processedDays[date] = true
		
		dayWeather := DayWeatherData{
			Date:        date,
			Day:         len(forecast),
			Temperature: entry.Data.Instant.Details.AirTemperature,
			Symbol:      entry.Data.Next1Hours.Summary.SymbolCode,
		}
		
		forecast = append(forecast, dayWeather)
	}
	
	weather := WeatherData{
		Lat:      lat,
		Lon:      lon,
		Forecast: forecast,
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(weather)
}