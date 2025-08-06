# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
Car vacation helper web app that shows weather within driving distance using multiple weather APIs and interactive mapping.

**IMPORTANT: This app is focused on weather exploration only. Do NOT add route planning, trip planning, or routing functionality. Keep it simple as a weather discovery tool for roadtrips.**

## Development Commands

### Go Commands
- `go run main.go` - Start the development server on port 8080
- `go build` - Build the binary
- `go mod tidy` - Clean up dependencies

### Environment Setup
- Go installation: `/home/olav/go/bin/go`
- Uses fish shell (not bash)
- Project uses Go standard library only

## Architecture Overview

### Backend (main.go)
Minimalist Go HTTP server with three routes:
- `/` - Serves main HTML template
- `/api/weather` - Weather API proxy for Yr API calls
- `/static/` - Static file server for CSS, JS, assets

### Frontend Architecture (app.js)
Complex JavaScript application with multiple integrations:
- **Base Map**: Leaflet.js with OpenStreetMap tiles
- **Weather Overlays**: OpenWeatherMap temperature and precipitation layers
- **Place Discovery**: Overpass API integration for finding interesting locations
- **Dynamic Loading**: Viewport-based weather marker updates
- **Adaptive Spacing**: Zoom-aware marker distribution

## API Integrations

### Yr API (Weather Data)
- **Endpoint**: `https://api.met.no/weatherapi/locationforecast/2.0/compact`
- **Critical**: Must include User-Agent header: `"CarVacationHelper/1.0 (github.com/youruser/bilsol)"`
- **Backend Route**: `/api/weather?lat={lat}&lon={lon}` 
- **Data**: Temperature and weather symbol for specific coordinates

### OpenWeatherMap API (Weather Overlays)
- **Temperature Layer**: `https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png`
- **Precipitation Layer**: `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png`
- **API Key**: Hardcoded in frontend (security consideration)
- **Usage**: Overlay layers on map for visual weather representation

### Overpass API (Place Discovery)
- **Endpoint**: `https://overpass-api.de/api/interpreter`
- **Query Types**: beaches, peaks, viewpoints, parks, attractions
- **Method**: POST with custom query language
- **Filtering**: Viewport-based bounding box queries

## Key Features

### Dynamic Place Discovery
- Automatically finds interesting places within current viewport
- Filters by type: beaches, peaks, viewpoints, parks, attractions
- Adaptive minimum distance based on viewport size (10% of viewport width)
- Rate limited weather loading (600ms between requests)

### Weather Visualization
- **Point Markers**: Temperature + weather emoji + place type emoji
- **Overlay Layers**: Temperature and precipitation from OpenWeatherMap
- **Marker Colors**: Different border colors for different place types
- **Popup Content**: Detailed weather info for each location

### Interactive Map Behavior
- **Default Center**: Oslo, Norway (59.9139, 10.7522)
- **Zoom Levels**: Adaptive based on driving distance (100km=9, 200km=8, 500km=7)
- **Dynamic Loading**: Weather markers update on map movement (1s debounce)
- **Viewport Updates**: Places reload when user pans or zooms

## Critical Implementation Details

### Rate Limiting & Performance
- 600ms delay between consecutive weather API calls
- Debounced map movement events (1s delay)
- Maximum 12 weather markers per viewport
- Adaptive spacing prevents marker overcrowding

### Data Flow
1. User sets location → Map centers and zooms
2. Overpass API finds places in viewport
3. Places filtered by adaptive distance algorithm
4. Weather data fetched for each place (rate limited)
5. Markers added to map with weather + place type info

### Place Type System
- **Categories**: natural (beach, peak), tourism (viewpoint, attraction), leisure (park)
- **Emojis**: 🏖️ beaches, ⛰️ peaks, 👁️ viewpoints, 🌳 parks, 🎯 attractions
- **Styling**: Different border colors for each type

## JavaScript Functions (app.js)

### Core Functions
- `findInterestingPlacesInViewport()` - Overpass API queries
- `loadWeatherForPlacesInViewport()` - Main orchestration function
- `addWeatherMarker()` - Creates custom weather markers
- `getAdaptiveMinDistance()` - Calculates spacing based on viewport

### Event Handlers
- `map.on('moveend')` - Debounced place reloading
- Distance selector change - Updates zoom and reloads places
- Geolocation button - Updates location and reloads viewport

## Security Considerations
- OpenWeatherMap API key is exposed in frontend code
- No backend validation of API responses
- Direct frontend API calls to external services