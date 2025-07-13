# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
Car vacation helper web app that shows weather within driving distance using Yr API and OpenStreetMap.

## Development Commands

### Go Commands
- `go run main.go` - Start the development server
- `go build` - Build the binary
- `go mod tidy` - Clean up dependencies

### Environment Setup
- Go installation: `/home/olav/go/bin/go`
- Uses fish shell (not bash)
- Project uses Go standard library only

## Project Structure
- `main.go` - HTTP server and API integration
- `templates/` - HTML templates
- `static/` - CSS, JavaScript, weather icons
- `SPEC.md` - Detailed project specification

## API Integration
- Weather: Yr API (https://api.met.no/weatherapi/locationforecast/2.0/compact)
- Maps: OpenStreetMap with Leaflet.js
- **Critical**: Must include User-Agent header for Yr API

## Current Features
- Location detection via browser geolocation API
- Manual location input with city/address
- Interactive map with OpenStreetMap tiles
- Driving distance selector (100km, 200km, 500km)
- Dynamic radius visualization on map
- Weather markers with temperature and emoji icons
- `/api/weather` endpoint for fetching Yr data
- Responsive map zoom based on selected radius

## Technical Implementation
- **Backend**: Go HTTP server using standard library
- **Frontend**: Vanilla JavaScript with Leaflet.js
- **Weather API**: Direct integration with Yr's locationforecast API
- **Map Features**: Custom weather markers with temperature display
- **User Location**: Browser geolocation with manual fallback
- **Radius Display**: Leaflet circle overlay showing driving distance