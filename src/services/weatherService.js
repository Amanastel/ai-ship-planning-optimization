const logger = require('../utils/logger');

class WeatherService {
  constructor() {
    this.apiKey = process.env.WEATHER_API_KEY;
    this.baseUrl = 'https://api.openweathermap.org/data/2.5';
  }

  /**
   * Get current weather for coordinates
   */
  async getCurrentWeather(latitude, longitude) {
    try {
      // Mock weather data for development
      return this.generateMockWeather(latitude, longitude);
    } catch (error) {
      logger.error('Error fetching weather data:', error);
      return this.generateMockWeather(latitude, longitude);
    }
  }

  /**
   * Get weather forecast for route
   */
  async getRouteForecast(waypoints) {
    try {
      const forecasts = [];
      
      for (const waypoint of waypoints) {
        const weather = await this.getCurrentWeather(
          waypoint.latitude, 
          waypoint.longitude
        );
        forecasts.push({
          ...weather,
          timestamp: waypoint.timestamp,
          location: {
            latitude: waypoint.latitude,
            longitude: waypoint.longitude
          }
        });
      }
      
      return forecasts;
    } catch (error) {
      logger.error('Error fetching route forecast:', error);
      return this.generateMockRouteForecast(waypoints);
    }
  }

  /**
   * Generate mock weather data for development/testing
   */
  generateMockWeather(_latitude, _longitude) {
    const conditions = ['clear', 'cloudy', 'rain', 'fog', 'storm'];
    const condition = conditions[Math.floor(Math.random() * conditions.length)];
    
    let windSpeed = 5 + Math.random() * 25; // 5-30 knots
    let waveHeight = 0.5 + Math.random() * 4; // 0.5-4.5 meters
    let visibility = 8 + Math.random() * 7; // 8-15 km
    
    // Adjust based on condition
    if (condition === 'storm') {
      windSpeed += 15;
      waveHeight += 2;
      visibility *= 0.3;
    } else if (condition === 'fog') {
      visibility *= 0.2;
    }

    return {
      conditions: condition,
      windSpeed: Math.round(windSpeed * 10) / 10,
      windDirection: Math.floor(Math.random() * 360),
      waveHeight: Math.round(waveHeight * 10) / 10,
      temperature: 10 + Math.random() * 25, // 10-35°C
      humidity: 40 + Math.random() * 50, // 40-90%
      pressure: 1000 + Math.random() * 40, // 1000-1040 hPa
      visibility: Math.round(visibility * 10) / 10,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate mock forecast for route
   */
  generateMockRouteForecast(waypoints) {
    return waypoints.map(waypoint => ({
      ...this.generateMockWeather(waypoint.latitude, waypoint.longitude),
      timestamp: waypoint.timestamp,
      location: {
        latitude: waypoint.latitude,
        longitude: waypoint.longitude
      }
    }));
  }

  /**
   * Calculate weather severity score (0-10)
   */
  calculateWeatherSeverity(weatherData) {
    let score = 0;
    
    // Wind impact
    if (weatherData.windSpeed > 35) score += 4;
    else if (weatherData.windSpeed > 25) score += 3;
    else if (weatherData.windSpeed > 15) score += 2;
    else if (weatherData.windSpeed > 10) score += 1;

    // Wave impact
    if (weatherData.waveHeight > 6) score += 4;
    else if (weatherData.waveHeight > 4) score += 3;
    else if (weatherData.waveHeight > 2) score += 2;
    else if (weatherData.waveHeight > 1) score += 1;

    // Visibility impact
    if (weatherData.visibility < 1) score += 2;
    else if (weatherData.visibility < 3) score += 1;

    // Condition impact
    if (weatherData.conditions === 'storm') score += 3;
    else if (weatherData.conditions === 'rain') score += 1;
    else if (weatherData.conditions === 'fog') score += 2;

    return Math.min(10, score);
  }
}

module.exports = new WeatherService();
