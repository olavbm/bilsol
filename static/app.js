document.addEventListener('DOMContentLoaded', function() {
    const useLocationBtn = document.getElementById('useLocation');
    const manualLocationInput = document.getElementById('manualLocation');
    const locationResult = document.getElementById('locationResult');
    
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
    
    // OpenWeatherMap layers - now that we know they work
    const temperatureLayer = L.tileLayer('https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=97fd1f1317a96a72f3fc8c9a800863db', {
        attribution: '© OpenWeatherMap - Temperature',
        opacity: 0.5,
        maxZoom: 18
    });
    
    const precipitationLayer = L.tileLayer('https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=97fd1f1317a96a72f3fc8c9a800863db', {
        attribution: '© OpenWeatherMap - Precipitation',
        opacity: 0.6,
        maxZoom: 18
    });
    
    // Add both layers - temperature first (lower opacity), then precipitation
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
    
    // Function to fetch and display weather
    async function fetchAndDisplayWeather(lat, lon, placeName = null, placeType = null) {
        try {
            const response = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
            const weather = await response.json();
            
            if (response.ok) {
                addWeatherMarker(weather, placeName, placeType);
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
    
    // Function to filter out overlapping places
    function filterOverlappingPlaces(places, minDistanceKm = 5) {
        const filtered = [];
        
        for (const place of places) {
            let tooClose = false;
            
            for (const existing of filtered) {
                const distance = calculateDistance(
                    place.lat, place.lon,
                    existing.lat, existing.lon
                );
                
                if (distance < minDistanceKm) {
                    tooClose = true;
                    break;
                }
            }
            
            if (!tooClose) {
                filtered.push(place);
            }
        }
        
        return filtered;
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
    
    // Function to load weather for interesting places in viewport
    async function loadWeatherForPlacesInViewport() {
        // Clear existing weather markers
        weatherMarkers.forEach(marker => map.removeLayer(marker));
        weatherMarkers = [];
        
        // Add weather marker for center location
        const center = map.getCenter();
        fetchAndDisplayWeather(center.lat, center.lng, "Map Center", "location");
        
        // Find interesting places in current viewport
        const places = await findInterestingPlacesInViewport();
        
        // Calculate adaptive minimum distance based on viewport size
        const adaptiveMinDistance = getAdaptiveMinDistance();
        
        // Filter out overlapping places using adaptive distance
        const filteredPlaces = filterOverlappingPlaces(places, adaptiveMinDistance);
        
        // Limit to max 12 places since we're filtering
        const limitedPlaces = filteredPlaces.slice(0, 12);
        
        console.log(`Showing ${limitedPlaces.length} places (filtered from ${places.length})`);
        
        // Load weather for each place with delay to avoid rate limiting
        limitedPlaces.forEach((place, index) => {
            setTimeout(() => {
                const placeName = place.tags.name || getPlaceTypeLabel(place.tags);
                const placeType = getPlaceType(place.tags);
                fetchAndDisplayWeather(place.lat, place.lon, placeName, placeType);
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
    
    // Function to add weather marker to map
    function addWeatherMarker(weather, placeName = null, placeType = null) {
        const icon = L.divIcon({
            className: `weather-marker ${placeType ? 'place-' + placeType : ''}`,
            html: `
                <div class="weather-content">
                    <div class="temperature">${Math.round(weather.temperature)}°</div>
                    <div class="symbol">${getWeatherEmoji(weather.symbol)}</div>
                    ${placeType ? `<div class="place-type">${getPlaceTypeEmoji(placeType)}</div>` : ''}
                </div>
            `,
            iconSize: [60, 60],
            iconAnchor: [30, 30]
        });
        
        const marker = L.marker([weather.lat, weather.lon], { icon: icon }).addTo(map);
        
        const popupContent = `
            <strong>${placeName || 'Weather'}</strong>${placeType ? ` (${getPlaceTypeLabel({[getPlaceCategory(placeType)]: placeType})})` : ''}<br>
            Temperature: ${weather.temperature.toFixed(1)}°C<br>
            Condition: ${weather.symbol}
        `;
        
        marker.bindPopup(popupContent, {
            autoPan: false
        });
        weatherMarkers.push(marker);
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
            useLocationBtn.textContent = 'Getting location...';
            useLocationBtn.disabled = true;
            
            navigator.geolocation.getCurrentPosition(
                function(position) {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    
                    locationResult.innerHTML = `
                        <div class="location-found">
                            <strong>Location found:</strong><br>
                            Latitude: ${lat.toFixed(4)}<br>
                            Longitude: ${lon.toFixed(4)}
                        </div>
                    `;
                    
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
                    
                    useLocationBtn.textContent = 'Use My Location';
                    useLocationBtn.disabled = false;
                },
                function(error) {
                    locationResult.innerHTML = `
                        <div class="location-error">
                            Error: ${error.message}
                        </div>
                    `;
                    useLocationBtn.textContent = 'Use My Location';
                    useLocationBtn.disabled = false;
                }
            );
        } else {
            locationResult.innerHTML = `
                <div class="location-error">
                    Geolocation is not supported by this browser.
                </div>
            `;
        }
    });

    manualLocationInput.addEventListener('input', function() {
        if (this.value.trim()) {
            locationResult.innerHTML = `
                <div class="location-manual">
                    Manual location: ${this.value}
                </div>
            `;
        } else {
            locationResult.innerHTML = '';
        }
    });
    
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