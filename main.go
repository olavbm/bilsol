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
	Lat         float64 `json:"lat"`
	Lon         float64 `json:"lon"`
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
	
	// Get current weather (first entry)
	current := yrData.Properties.Timeseries[0]
	
	weather := WeatherData{
		Lat:         lat,
		Lon:         lon,
		Temperature: current.Data.Instant.Details.AirTemperature,
		Symbol:      current.Data.Next1Hours.Summary.SymbolCode,
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(weather)
}