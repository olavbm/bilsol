document.addEventListener('DOMContentLoaded', function() {
    const useLocationBtn = document.getElementById('useLocation');
    
    // Initialize map
    const map = L.map('map').setView([59.9139, 10.7522], 8); // Default to Oslo, Norway
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    // Test API key first by making a direct call to OpenWeatherMap
    async function testApiKey() {
        try {
            const response = await fetch('https://api.openweathermap.org/data/2.5/weather?q=Oslo&appid=97fd1f1317a96a72f3fc8c9a800863db');
            if (response.ok) {
                console.log('OpenWeatherMap API key is working');
                // If API works, the issue might be with map tiles specifically
                return true;
            } else {
                console.error('API key test failed:', response.status, response.statusText);
                return false;
            }
        } catch (error) {
            console.error('API key test error:', error);
            return false;
        }
    }
    
    // Test the API key on load
    testApiKey().then(keyWorks => {
        if (keyWorks) {
            console.log('API key works, but map tiles might need activation or different URLs');
        }
    });
    
    // OpenWeatherMap layers with MAXIMUM visibility for easy weather spotting
    const temperatureLayer = L.tileLayer('https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=97fd1f1317a96a72f3fc8c9a800863db', {
        attribution: '© OpenWeatherMap - Temperature (Hot = Red/Orange)',
        opacity: 0.95,
        maxZoom: 18,
        className: 'weather-temperature-layer'
    });
    
    const precipitationLayer = L.tileLayer('https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=97fd1f1317a96a72f3fc8c9a800863db', {
        attribution: '© OpenWeatherMap - Precipitation (Rain = Blue/Purple)', 
        opacity: 0.95,
        maxZoom: 18,
        className: 'weather-precipitation-layer'
    });
    
    // Add both layers - temperature first, then precipitation for better layering
    temperatureLayer.addTo(map);
    precipitationLayer.addTo(map);
    
    temperatureLayer.on('tileload', function(e) {
        console.log('🌡️ Temperature layer loaded successfully');
    });
    
    temperatureLayer.on('tileerror', function(e) {
        console.error('Temperature layer failed to load');
    });
    
    precipitationLayer.on('tileload', function(e) {
        console.log('🌧️ Precipitation layer loaded successfully');
    });
    
    precipitationLayer.on('tileerror', function(e) {
        console.error('Precipitation layer failed to load');
    });
    
    let locationMarker = null;
    let weatherMarkers = [];
    let currentLocation = { lat: 59.9139, lon: 10.7522 }; // Default Oslo
    let radiusCircle = null;
    let forecastData = []; // Store all location forecast data
    let currentDay = 0;
    let animationInterval = null;
    let isPlaying = false;
    
    // Function to calculate zoom level for given radius
    function getZoomForRadius(radiusKm) {
        // Rough calculation for zoom level based on radius
        // These values work well for most cases
        if (radiusKm <= 100) return 9;
        if (radiusKm <= 200) return 8;
        if (radiusKm <= 500) return 7;
        return 6;
    }
    
    // Function to update map view based on location and radius
    function updateMapView(lat, lon, radiusKm) {
        currentLocation = { lat, lon };
        
        const zoom = getZoomForRadius(radiusKm);
        map.setView([lat, lon], zoom);
        
        // Remove existing radius circle if it exists
        if (radiusCircle) {
            map.removeLayer(radiusCircle);
            radiusCircle = null;
        }
    }
    
    // Function to fetch and store weather forecast data
    async function fetchAndStoreWeatherForecast(lat, lon, placeName = null, placeType = null) {
        try {
            const response = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
            const weatherData = await response.json();
            
            if (response.ok) {
                // Store the forecast data for this location
                forecastData.push({
                    lat: lat,
                    lon: lon,
                    placeName: placeName || 'Location',
                    placeType: placeType,
                    forecast: weatherData.forecast
                });
                
                // Add marker for current day (day 0)
                if (weatherData.forecast && weatherData.forecast.length > 0) {
                    addWeatherMarkerForDay(weatherData.forecast[currentDay], lat, lon, placeName, placeType);
                }
            }
        } catch (error) {
            console.error('Failed to fetch weather:', error);
        }
    }
    
    // Function to find interesting places using Overpass API within current viewport
    async function findInterestingPlacesInViewport() {
        const bounds = map.getBounds();
        const south = bounds.getSouth();
        const west = bounds.getWest();
        const north = bounds.getNorth();
        const east = bounds.getEast();
        
        // Overpass query using bounding box instead of radius
        const query = `
[out:json][timeout:25];
(
  node["natural"="beach"](${south},${west},${north},${east});
  node["natural"="peak"](${south},${west},${north},${east});
  node["tourism"="viewpoint"](${south},${west},${north},${east});
  node["leisure"="park"](${south},${west},${north},${east});
  node["tourism"="attraction"](${south},${west},${north},${east});
);
out;
`;
        
        try {
            const response = await fetch('https://overpass-api.de/api/interpreter', {
                method: 'POST',
                body: query,
                headers: {
                    'Content-Type': 'text/plain'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log(`Found ${data.elements.length} interesting places in viewport`);
                return data.elements;
            } else {
                console.error('Overpass API error:', response.status);
                return [];
            }
        } catch (error) {
            console.error('Failed to fetch places:', error);
            return [];
        }
    }
    
    // Function to distribute places evenly across viewport using grid system
    function distributePlacesEvenly(places, maxPlaces = 12) {
        if (places.length === 0) return [];
        
        const bounds = map.getBounds();
        const south = bounds.getSouth();
        const west = bounds.getWest();
        const north = bounds.getNorth();
        const east = bounds.getEast();
        
        // Create a 4x3 grid for even distribution (12 cells max)
        const gridRows = 3;
        const gridCols = 4;
        const latStep = (north - south) / gridRows;
        const lonStep = (east - west) / gridCols;
        
        // Create grid cells
        const grid = [];
        for (let row = 0; row < gridRows; row++) {
            for (let col = 0; col < gridCols; col++) {
                grid.push({
                    row,
                    col,
                    south: south + (row * latStep),
                    north: south + ((row + 1) * latStep),
                    west: west + (col * lonStep),
                    east: west + ((col + 1) * lonStep),
                    places: []
                });
            }
        }
        
        // Assign places to grid cells
        places.forEach(place => {
            for (const cell of grid) {
                if (place.lat >= cell.south && place.lat < cell.north &&
                    place.lon >= cell.west && place.lon < cell.east) {
                    cell.places.push(place);
                    break;
                }
            }
        });
        
        // Pick the best place from each cell (prioritize named places)
        const distributed = [];
        grid.forEach(cell => {
            if (cell.places.length > 0) {
                // Sort by priority: named places first, then by place type variety
                cell.places.sort((a, b) => {
                    const aHasName = a.tags.name ? 1 : 0;
                    const bHasName = b.tags.name ? 1 : 0;
                    return bHasName - aHasName;
                });
                distributed.push(cell.places[0]);
            }
        });
        
        console.log(`Grid distribution: ${places.length} places → ${distributed.length} distributed evenly`);
        return distributed;
    }
    
    // Function to calculate distance between two points in kilometers
    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in kilometers
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
    
    // Function to calculate adaptive minimum distance based on viewport
    function getAdaptiveMinDistance() {
        const bounds = map.getBounds();
        const center = map.getCenter();
        
        // Calculate the approximate width of the viewport in kilometers
        const viewportWidthKm = calculateDistance(
            center.lat, bounds.getWest(),
            center.lat, bounds.getEast()
        );
        
        // Calculate the approximate height of the viewport in kilometers
        const viewportHeightKm = calculateDistance(
            bounds.getSouth(), center.lng,
            bounds.getNorth(), center.lng
        );
        
        // Use the smaller dimension to ensure good coverage
        const viewportSizeKm = Math.min(viewportWidthKm, viewportHeightKm);
        
        // Scale the minimum distance as a percentage of viewport size
        // Small viewport (e.g., 10km): 1km spacing
        // Medium viewport (e.g., 100km): 10km spacing  
        // Large viewport (e.g., 500km): 50km spacing
        const minDistance = Math.max(1, viewportSizeKm * 0.1);
        
        console.log(`Viewport: ${viewportSizeKm.toFixed(0)}km, Min distance: ${minDistance.toFixed(1)}km`);
        
        return minDistance;
    }
    
    // Function to load weather forecast for interesting places in viewport
    async function loadWeatherForPlacesInViewport() {
        // Clear existing forecast data and markers
        forecastData = [];
        weatherMarkers.forEach(marker => map.removeLayer(marker));
        weatherMarkers = [];
        
        // Add weather marker for center location
        const center = map.getCenter();
        fetchAndStoreWeatherForecast(center.lat, center.lng, "Map Center", "location");
        
        // Find interesting places in current viewport
        const places = await findInterestingPlacesInViewport();
        
        // Distribute places evenly across viewport using grid system
        const distributedPlaces = distributePlacesEvenly(places, 12);
        
        console.log(`Showing ${distributedPlaces.length} evenly distributed places (from ${places.length} total)`);
        
        // Load weather forecast for each distributed place with delay to avoid rate limiting
        distributedPlaces.forEach((place, index) => {
            setTimeout(() => {
                const placeName = place.tags.name || getPlaceTypeLabel(place.tags);
                const placeType = getPlaceType(place.tags);
                fetchAndStoreWeatherForecast(place.lat, place.lon, placeName, placeType);
            }, (index + 1) * 600); // 600ms delay between requests
        });
    }
    
    // Function to load weather for a specific location (used for geolocation)
    async function loadWeatherForLocation(centerLat, centerLon, radiusKm) {
        // Update map view first
        updateMapView(centerLat, centerLon, radiusKm);
        
        // Then load places in the new viewport
        setTimeout(() => {
            loadWeatherForPlacesInViewport();
        }, 500); // Small delay to let map finish updating
    }
    
    // Helper function to get place type from tags
    function getPlaceType(tags) {
        if (tags.natural === 'beach') return 'beach';
        if (tags.natural === 'peak') return 'peak';
        if (tags.tourism === 'viewpoint') return 'viewpoint';
        if (tags.leisure === 'park') return 'park';
        if (tags.tourism === 'attraction') return 'attraction';
        return 'place';
    }
    
    // Helper function to get readable label for place type
    function getPlaceTypeLabel(tags) {
        if (tags.natural === 'beach') return 'Beach';
        if (tags.natural === 'peak') return 'Peak';
        if (tags.tourism === 'viewpoint') return 'Viewpoint';
        if (tags.leisure === 'park') return 'Park';
        if (tags.tourism === 'attraction') return 'Attraction';
        return 'Place';
    }
    
    // Simple weather scoring function
    function getWeatherScore(weather) {
        const temp = weather.temperature;
        const symbol = weather.symbol;
        
        // Bad weather conditions
        if (symbol.includes('rain') || symbol.includes('snow') || symbol.includes('sleet') || symbol.includes('fog')) {
            return 'bad';
        }
        
        // Temperature scoring (ideal range 15-25°C)
        if (temp >= 15 && temp <= 25 && (symbol.includes('clearsky') || symbol.includes('fair'))) {
            return 'good';
        } else if (temp >= 10 && temp <= 30) {
            return 'okay';
        } else {
            return 'bad';
        }
    }
    
    // Function to add weather marker for a specific day
    function addWeatherMarkerForDay(dayWeather, lat, lon, placeName = null, placeType = null) {
        const score = getWeatherScore(dayWeather);
        const emoji = score === 'good' ? '☀️' : score === 'okay' ? '⛅' : '🌧️';
        
        const icon = L.divIcon({
            className: `weather-marker ${score}`,
            html: `<div class="weather-content">${emoji}</div>`,
            iconSize: [50, 50],
            iconAnchor: [25, 25]
        });
        
        const marker = L.marker([lat, lon], { icon: icon }).addTo(map);
        
        const popupContent = `
            <strong>${placeName || 'Location'}</strong><br>
            Day ${dayWeather.day}: ${Math.round(dayWeather.temperature)}°C<br>
            Condition: ${getWeatherEmoji(dayWeather.symbol)}<br>
            Date: ${dayWeather.date}
        `;
        
        marker.bindPopup(popupContent, {
            autoPan: false
        });
        weatherMarkers.push(marker);
    }
    
    // Function to update all markers for a specific day
    function updateMarkersForDay(day) {
        // Clear existing markers
        weatherMarkers.forEach(marker => map.removeLayer(marker));
        weatherMarkers = [];
        
        // Add markers for the selected day
        forecastData.forEach(locationData => {
            if (locationData.forecast && locationData.forecast[day]) {
                addWeatherMarkerForDay(
                    locationData.forecast[day], 
                    locationData.lat, 
                    locationData.lon, 
                    locationData.placeName, 
                    locationData.placeType
                );
            }
        });
    }
    
    // Helper function to get emoji for place type
    function getPlaceTypeEmoji(placeType) {
        const emojiMap = {
            'beach': '🏖️',
            'peak': '⛰️', 
            'viewpoint': '👁️',
            'park': '🌳',
            'attraction': '🎯',
            'location': '📍'
        };
        return emojiMap[placeType] || '📍';
    }
    
    // Helper function to get category for place type
    function getPlaceCategory(placeType) {
        if (['beach', 'peak'].includes(placeType)) return 'natural';
        if (['viewpoint', 'attraction'].includes(placeType)) return 'tourism';
        if (placeType === 'park') return 'leisure';
        return 'place';
    }
    
    // Function to get emoji for weather symbol
    function getWeatherEmoji(symbol) {
        const symbolMap = {
            'clearsky_day': '☀️',
            'clearsky_night': '🌙',
            'fair_day': '🌤️',
            'fair_night': '🌙',
            'partlycloudy_day': '⛅',
            'partlycloudy_night': '☁️',
            'cloudy': '☁️',
            'rain': '🌧️',
            'lightrain': '🌦️',
            'heavyrain': '⛈️',
            'snow': '❄️',
            'sleet': '🌨️',
            'fog': '🌫️'
        };
        return symbolMap[symbol] || '🌤️';
    }
    
    // Load default weather for Oslo and set initial view
    const distanceSelect = document.getElementById('distance');
    const initialRadius = parseInt(distanceSelect.value);
    updateMapView(currentLocation.lat, currentLocation.lon, initialRadius);
    
    // Load places after map is ready
    setTimeout(() => {
        loadWeatherForPlacesInViewport();
    }, 1000);

    useLocationBtn.addEventListener('click', function() {
        if (navigator.geolocation) {
            useLocationBtn.textContent = '⏳ Getting location...';
            useLocationBtn.disabled = true;
            
            navigator.geolocation.getCurrentPosition(
                function(position) {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    
                    // Location found - no need to show details in simple UI
                    
                    // Update map with current radius
                    const selectedRadius = parseInt(distanceSelect.value);
                    updateMapView(lat, lon, selectedRadius);
                    
                    if (locationMarker) {
                        map.removeLayer(locationMarker);
                    }
                    
                    locationMarker = L.marker([lat, lon]).addTo(map)
                        .bindPopup('Your Location')
                        .openPopup();
                    
                    // Load weather for interesting places around user's location
                    const currentRadius = parseInt(distanceSelect.value);
                    loadWeatherForLocation(lat, lon, currentRadius);
                    
                    useLocationBtn.textContent = '📍 Use My Location';
                    useLocationBtn.disabled = false;
                },
                function(error) {
                    // Error handling - just reset button in simple UI
                    useLocationBtn.textContent = '❌ Location Error';
                    setTimeout(() => {
                        useLocationBtn.textContent = '📍 Use My Location';
                        useLocationBtn.disabled = false;
                    }, 3000);
                }
            );
        } else {
            useLocationBtn.textContent = '❌ Not Supported';
        }
    });

    // Removed manual location input in simplified UI
    
    // Distance selector change handler
    distanceSelect.addEventListener('change', function() {
        const selectedRadius = parseInt(this.value);
        updateMapView(currentLocation.lat, currentLocation.lon, selectedRadius);
        
        // Load places in new viewport after zoom changes
        setTimeout(() => {
            loadWeatherForPlacesInViewport();
        }, 500);
    });
    
    // Add event listener for map movement to reload places when user pans/zooms
    map.on('moveend', function() {
        // Debounce to avoid too many API calls
        clearTimeout(window.mapMoveTimeout);
        window.mapMoveTimeout = setTimeout(() => {
            loadWeatherForPlacesInViewport();
        }, 1000);
    });
    
    // Animation controls
    const playBtn = document.getElementById('playBtn');
    const daySlider = document.getElementById('daySlider');
    const currentDayLabel = document.getElementById('currentDay');
    
    const dayNames = ['Today', 'Tomorrow', 'Day 3', 'Day 4'];
    
    // Play/Pause button
    playBtn.addEventListener('click', function() {
        if (isPlaying) {
            // Stop animation
            clearInterval(animationInterval);
            isPlaying = false;
            playBtn.textContent = '▶️ Play';
            playBtn.classList.remove('playing');
        } else {
            // Start animation
            isPlaying = true;
            playBtn.textContent = '⏸️ Pause';
            playBtn.classList.add('playing');
            
            animationInterval = setInterval(() => {
                currentDay = (currentDay + 1) % 4;
                daySlider.value = currentDay;
                currentDayLabel.textContent = dayNames[currentDay];
                updateMarkersForDay(currentDay);
            }, 2000); // Change day every 2 seconds
        }
    });
    
    // Day slider
    daySlider.addEventListener('input', function() {
        currentDay = parseInt(this.value);
        currentDayLabel.textContent = dayNames[currentDay];
        updateMarkersForDay(currentDay);
        
        // Stop animation if user manually changes day
        if (isPlaying) {
            clearInterval(animationInterval);
            isPlaying = false;
            playBtn.textContent = '▶️ Play';
            playBtn.classList.remove('playing');
        }
    });
    
    // Enlarge map functionality
    const enlargeBtn = document.getElementById('enlargeMap');
    const mapSection = document.querySelector('.map-section');
    let isEnlarged = false;
    
    enlargeBtn.addEventListener('click', function() {
        if (!isEnlarged) {
            // Enlarge the map
            mapSection.classList.add('map-enlarged');
            enlargeBtn.textContent = '📉 Normal Size';
            isEnlarged = true;
            
            // Trigger map resize after DOM update
            setTimeout(() => {
                map.invalidateSize();
            }, 100);
        } else {
            // Return to normal size
            mapSection.classList.remove('map-enlarged');
            enlargeBtn.textContent = '🔍 Enlarge Map';
            isEnlarged = false;
            
            // Trigger map resize after DOM update
            setTimeout(() => {
                map.invalidateSize();
            }, 100);
        }
    });
});