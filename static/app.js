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
    
    // Try OpenWeatherMap layers again - API key might be activated now
    const temperatureLayer = L.tileLayer('https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=97fd1f1317a96a72f3fc8c9a800863db', {
        attribution: '© OpenWeatherMap',
        opacity: 0.6,
        maxZoom: 18
    });
    
    const cloudsLayer = L.tileLayer('https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=97fd1f1317a96a72f3fc8c9a800863db', {
        attribution: '© OpenWeatherMap',
        opacity: 0.5,
        maxZoom: 18
    });
    
    // Try temperature layer first
    temperatureLayer.addTo(map);
    
    temperatureLayer.on('tileerror', function(e) {
        console.error('Temperature tiles still failing, trying clouds layer...');
        map.removeLayer(temperatureLayer);
        cloudsLayer.addTo(map);
    });
    
    temperatureLayer.on('tileload', function(e) {
        console.log('🎉 Temperature tiles now working!');
    });
    
    cloudsLayer.on('tileerror', function(e) {
        console.error('Both temperature and clouds tiles failed - sticking with Yr markers');
        map.removeLayer(cloudsLayer);
    });
    
    cloudsLayer.on('tileload', function(e) {
        console.log('Clouds tiles working! Temperature tiles may need more time.');
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
    async function fetchAndDisplayWeather(lat, lon) {
        try {
            const response = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
            const weather = await response.json();
            
            if (response.ok) {
                addWeatherMarker(weather);
            }
        } catch (error) {
            console.error('Failed to fetch weather:', error);
        }
    }
    
    // Function to add weather marker to map
    function addWeatherMarker(weather) {
        const icon = L.divIcon({
            className: 'weather-marker',
            html: `
                <div class="weather-content">
                    <div class="temperature">${Math.round(weather.temperature)}°</div>
                    <div class="symbol">${getWeatherEmoji(weather.symbol)}</div>
                </div>
            `,
            iconSize: [60, 60],
            iconAnchor: [30, 30]
        });
        
        const marker = L.marker([weather.lat, weather.lon], { icon: icon }).addTo(map);
        marker.bindPopup(`
            <strong>Weather</strong><br>
            Temperature: ${weather.temperature.toFixed(1)}°C<br>
            Condition: ${weather.symbol}
        `);
        
        weatherMarkers.push(marker);
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
    fetchAndDisplayWeather(59.9139, 10.7522);

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
                    
                    // Fetch weather for user's location
                    fetchAndDisplayWeather(lat, lon);
                    
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
    });
});