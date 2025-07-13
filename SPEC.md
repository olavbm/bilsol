# Car Vacation Helper - Project Specification

## Overview

A simple web application that helps users find good weather within driving distance for day trips or short vacations. Users input their location and maximum driving distance, and the app displays a map showing current weather conditions in the reachable area.

## Core Features

### User Input
- **Current Location**: Either auto-detect via geolocation API or manual entry (city, address, or coordinates)
- **Driving Distance**: Maximum distance willing to drive (in km or miles)
- Simple, clean input interface with minimal fields

### Weather Display
- **Current Day Weather**: Show today's weather conditions only
- **Visual Map**: Interactive map displaying the drivable area with weather overlays
- **Weather Icons**: Clear, intuitive weather icons (sunny, cloudy, rainy, etc.)
- **Temperature**: Display current temperature for each area

### Map Functionality
- Show circular radius representing maximum driving distance
- Weather icons or color coding across the map
- Clickable areas to see detailed weather info for specific locations
- Zoom and pan capabilities

## Important Implementation Notes

### Yr API Requirements
- **CRITICAL**: Must include proper User-Agent header or API will reject requests
- Use `/compact` endpoint for smaller payloads
- Weather icon set available at: https://github.com/metno/weathericons
- API provides current conditions plus 9-day forecast (use current/first hour for today's weather)

## Technical Requirements

### Frontend
- Responsive web design (works on desktop and mobile)
- Modern web technologies (HTML5, CSS3, JavaScript)
- Map integration using OpenStreetMap with Leaflet
- Clean, minimal UI focused on the core functionality

### Backend/APIs
- Weather API integration using Yr (https://api.met.no/weatherapi/locationforecast/2.0/)
- Geolocation services
- No user accounts or data persistence required

### Yr API Implementation Details
- **Endpoint**: Use `/compact` endpoint for efficient data: `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat={lat}&lon={lon}`
- **Authentication**: MUST include descriptive User-Agent header with contact info (e.g., "CarVacationHelper/1.0 contact@example.com")
- **Coordinate Precision**: Round lat/lon to 4 decimal places maximum
- **Data Format**: JSON (default) provides 9-day forecast with hourly data
- **Weather Icons**: Yr provides official weather icon set on GitHub with day/night variations
- **Coverage**: Global coverage, but may return 422 status for unsupported locations
- **Rate Limits**: Follow caching headers and use `If-Modified-Since` for efficiency

### Performance
- Keep it simple - no optimization for now
- Direct API calls without batching or caching
- Responsive map rendering

## User Experience

### Primary Use Case
1. User opens the website
2. Allows location access or enters their location
3. Sets maximum driving distance (default suggestions: 100km, 200km, 500km)
4. Instantly sees a map with weather conditions in their range
5. Can click on areas to see more detailed weather information

### Design Principles
- **Dead Simple**: Minimal interface, maximum functionality
- **Fast**: Quick results without unnecessary loading
- **Visual**: Map-first approach, information at a glance
- **Mobile-Friendly**: Works well on phones for on-the-go planning

## Out of Scope (v1)

- Multi-day weather forecasts
- Historical weather data
- Trip planning features
- User accounts or saved searches
- Detailed weather metrics (humidity, wind speed, etc.)
- Traffic or route optimization
- Points of interest or attractions

## Success Criteria

- User can find good weather within their driving range in under 30 seconds
- Map loads and displays weather data quickly (< 5 seconds)
- Interface is intuitive enough to use without instructions
- Works reliably on both desktop and mobile devices

## Technical Stack

- **Backend**: Go with standard library HTTP server
- **Frontend**: HTML templates served by Go + vanilla JavaScript for map interactions
- **Mapping**: Leaflet with OpenStreetMap (allows custom weather icons and overlays)
- **Weather Data**: Yr API (https://api.met.no) - free Norwegian weather service
- **Styling**: CSS (minimal, focused styling)
- **Deployment**: Single Go binary, easily deployable anywhere

## Go Implementation Approach

- **Simple HTTP server**: Use `net/http` to serve templates and handle API requests
- **Template rendering**: Use `html/template` for server-side page generation
- **HTTP client**: Use standard `net/http` client for Yr API calls
- **JSON handling**: Use `encoding/json` for API response parsing
- **Static files**: Serve CSS, JS, and weather icons directly from Go server
- **No external dependencies**: Keep it simple with just the standard library initially

## Future Enhancements (Beyond v1)

- 7-day weather forecast
- Weather alerts and warnings
- Save favorite locations
- Share weather maps
- Historical weather trends
- Integration with travel booking sites