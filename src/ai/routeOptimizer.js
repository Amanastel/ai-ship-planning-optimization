const tf = require('@tensorflow/tfjs-node');
const logger = require('../utils/logger');

class RouteOptimizer {
  constructor() {
    this.model = null;
    this.isModelLoaded = false;
    this.trainingData = [];
  }

  /**
   * Initialize and train the route optimization model
   */
  async initializeModel() {
    try {
      // Create a simple neural network for route optimization
      this.model = tf.sequential({
        layers: [
          tf.layers.dense({
            inputShape: [8], // distance, cargo_weight, weather_score, speed, fuel_price, sea_conditions, traffic_density, port_congestion
            units: 32,
            activation: 'relu'
          }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({
            units: 16,
            activation: 'relu'
          }),
          tf.layers.dense({
            units: 8,
            activation: 'relu'
          }),
          tf.layers.dense({
            units: 3, // [optimal_speed, estimated_time, fuel_consumption]
            activation: 'linear'
          })
        ]
      });

      this.model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'meanSquaredError',
        metrics: ['mse']
      });

      // Generate some initial training data
      await this.generateInitialTrainingData();
      await this.trainModel();

      this.isModelLoaded = true;
      logger.info('Route optimization model initialized successfully');
    } catch (error) {
      logger.error('Error initializing route optimization model:', error);
      throw error;
    }
  }

  /**
   * Generate synthetic training data for initial model training
   */
  async generateInitialTrainingData() {
    const trainingSize = 1000;
    const inputs = [];
    const outputs = [];

    for (let i = 0; i < trainingSize; i++) {
      // Generate synthetic input features
      const distance = Math.random() * 5000 + 100; // 100-5100 nautical miles
      const cargoWeight = Math.random() * 50000 + 1000; // 1000-51000 tons
      const weatherScore = Math.random() * 10; // 0-10 (0=perfect, 10=severe)
      const speed = Math.random() * 20 + 5; // 5-25 knots
      const fuelPrice = Math.random() * 500 + 200; // $200-700 per ton
      const seaConditions = Math.random() * 5; // 0-5 sea state
      const trafficDensity = Math.random() * 10; // 0-10
      const portCongestion = Math.random() * 5; // 0-5

      const input = [
        distance / 5000, // normalized
        cargoWeight / 50000,
        weatherScore / 10,
        speed / 25,
        fuelPrice / 500,
        seaConditions / 5,
        trafficDensity / 10,
        portCongestion / 5
      ];

      // Calculate synthetic optimal outputs based on logical relationships
      const baseSpeed = 15 - (weatherScore * 0.5) - (seaConditions * 0.3);
      const optimalSpeed = Math.max(8, Math.min(22, baseSpeed));
      const estimatedTime = distance / optimalSpeed;
      const fuelConsumption = (distance * cargoWeight * 0.0001) * (1 + weatherScore * 0.1);

      const output = [
        optimalSpeed / 25, // normalized
        estimatedTime / 300, // normalized (max ~300 hours)
        fuelConsumption / 1000 // normalized
      ];

      inputs.push(input);
      outputs.push(output);
    }

    this.trainingInputs = tf.tensor2d(inputs);
    this.trainingOutputs = tf.tensor2d(outputs);
  }

  /**
   * Train the route optimization model
   */
  async trainModel() {
    if (!this.trainingInputs || !this.trainingOutputs) {
      throw new Error('Training data not available');
    }

    try {
      await this.model.fit(this.trainingInputs, this.trainingOutputs, {
        epochs: 100,
        batchSize: 32,
        validationSplit: 0.2,
        verbose: 0
      });

      logger.info('Route optimization model training completed');
    } catch (error) {
      logger.error('Error training route optimization model:', error);
      throw error;
    }
  }

  /**
   * Optimize route based on input parameters
   */
  async optimizeRoute(params) {
    if (!this.isModelLoaded) {
      await this.initializeModel();
    }

    const {
      origin,
      destination,
      cargoWeight,
      weatherForecast
    } = params;

    try {
      // Calculate distance (simplified great circle distance)
      const distance = this.calculateDistance(origin.coordinates, destination.coordinates);

      // Process weather data
      const weatherScore = this.calculateWeatherScore(weatherForecast);

      // Current market conditions (mock data - in production, fetch from APIs)
      const fuelPrice = 450; // USD per ton
      const seaConditions = Math.random() * 3; // 0-3 for calm seas
      const trafficDensity = Math.random() * 5;
      const portCongestion = Math.random() * 3;

      // Prepare input for prediction
      const input = tf.tensor2d([[
        distance / 5000,
        cargoWeight / 50000,
        weatherScore / 10,
        15 / 25, // base speed
        fuelPrice / 500,
        seaConditions / 5,
        trafficDensity / 10,
        portCongestion / 5
      ]]);

      // Make prediction
      const prediction = this.model.predict(input);
      const predictionData = await prediction.data();

      // Denormalize results
      const optimalSpeed = predictionData[0] * 25;
      const estimatedTime = predictionData[1] * 300;
      const estimatedFuelConsumption = predictionData[2] * 1000;

      // Generate waypoints for optimal route
      const waypoints = this.generateWaypoints(origin.coordinates, destination.coordinates, 10);

      // Clean up tensors
      input.dispose();
      prediction.dispose();

      return {
        optimalSpeed: Math.round(optimalSpeed * 10) / 10,
        estimatedTime: Math.round(estimatedTime * 10) / 10,
        estimatedFuelConsumption: Math.round(estimatedFuelConsumption * 10) / 10,
        totalDistance: Math.round(distance * 10) / 10,
        waypoints,
        recommendations: this.generateRecommendations(weatherScore, seaConditions),
        confidence: 0.85 // Mock confidence score
      };
    } catch (error) {
      logger.error('Error optimizing route:', error);
      throw error;
    }
  }

  /**
   * Calculate great circle distance between two points
   */
  calculateDistance(coord1, coord2) {
    const R = 3440.065; // Earth's radius in nautical miles
    const lat1Rad = coord1.latitude * Math.PI / 180;
    const lat2Rad = coord2.latitude * Math.PI / 180;
    const deltaLatRad = (coord2.latitude - coord1.latitude) * Math.PI / 180;
    const deltaLonRad = (coord2.longitude - coord1.longitude) * Math.PI / 180;

    const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
              Math.cos(lat1Rad) * Math.cos(lat2Rad) *
              Math.sin(deltaLonRad / 2) * Math.sin(deltaLonRad / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Calculate weather impact score
   */
  calculateWeatherScore(weatherForecast) {
    if (!weatherForecast || weatherForecast.length === 0) return 3; // default moderate conditions

    let totalScore = 0;
    for (const forecast of weatherForecast) {
      let score = 0;
      
      // Wind impact
      if (forecast.windSpeed > 25) score += 3;
      else if (forecast.windSpeed > 15) score += 2;
      else if (forecast.windSpeed > 10) score += 1;

      // Wave height impact
      if (forecast.waveHeight > 4) score += 3;
      else if (forecast.waveHeight > 2) score += 2;
      else if (forecast.waveHeight > 1) score += 1;

      // Visibility impact
      if (forecast.visibility < 1) score += 2;
      else if (forecast.visibility < 5) score += 1;

      totalScore += score;
    }

    return Math.min(10, totalScore / weatherForecast.length);
  }

  /**
   * Generate waypoints for the route
   */
  generateWaypoints(start, end, numWaypoints) {
    const waypoints = [];
    
    for (let i = 0; i <= numWaypoints; i++) {
      const ratio = i / numWaypoints;
      const lat = start.latitude + (end.latitude - start.latitude) * ratio;
      const lon = start.longitude + (end.longitude - start.longitude) * ratio;
      
      waypoints.push({
        latitude: Math.round(lat * 1000000) / 1000000,
        longitude: Math.round(lon * 1000000) / 1000000,
        timestamp: new Date(Date.now() + (i * 3600000)), // hourly waypoints
        speed: 15 // default speed, can be optimized per segment
      });
    }

    return waypoints;
  }

  /**
   * Generate route recommendations
   */
  generateRecommendations(weatherScore, seaConditions) {
    const recommendations = [];

    if (weatherScore > 7) {
      recommendations.push('Consider delaying departure due to severe weather conditions');
      recommendations.push('Monitor weather updates continuously during voyage');
    } else if (weatherScore > 5) {
      recommendations.push('Proceed with caution - moderate weather expected');
      recommendations.push('Maintain regular communication with weather services');
    }

    if (seaConditions > 3) {
      recommendations.push('Reduce speed in high sea conditions for safety');
      recommendations.push('Secure all cargo properly before departure');
    }

    if (recommendations.length === 0) {
      recommendations.push('Optimal conditions for voyage - proceed as planned');
    }

    return recommendations;
  }

  /**
   * Update model with actual voyage data for continuous learning
   */
  async updateModelWithFeedback(voyageData) {
    try {
      // Extract features from actual voyage data
      const actualFeatures = this.extractFeaturesFromVoyage(voyageData);
      const actualResults = this.extractResultsFromVoyage(voyageData);

      // Add to training data
      this.trainingData.push({ features: actualFeatures, results: actualResults });

      // Retrain model periodically (every 100 new data points)
      if (this.trainingData.length % 100 === 0) {
        await this.retrainModel();
      }

      logger.info('Model updated with voyage feedback');
    } catch (error) {
      logger.error('Error updating model with feedback:', error);
    }
  }

  extractFeaturesFromVoyage(voyageData) {
    // Extract normalized features from voyage data
    return [
      voyageData.plannedRoute.totalDistance / 5000,
      voyageData.cargoLoad.weight / 50000,
      // Add other normalized features...
    ];
  }

  extractResultsFromVoyage(voyageData) {
    // Extract normalized results from voyage data
    return [
      voyageData.optimizationMetrics.optimalSpeed / 25,
      voyageData.actualRoute.actualDuration / 300,
      voyageData.fuelPrediction.actualConsumption / 1000
    ];
  }

  async retrainModel() {
    // Implement incremental learning or full retraining
    logger.info('Retraining route optimization model with new data');
    // Implementation details...
  }
}

module.exports = new RouteOptimizer();
