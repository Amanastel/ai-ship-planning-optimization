const tf = require('@tensorflow/tfjs-node');
const logger = require('../utils/logger');

class FuelPredictor {
  constructor() {
    this.model = null;
    this.isModelLoaded = false;
    this.historicalData = [];
  }

  /**
   * Initialize and train the fuel prediction model
   */
  async initializeModel() {
    try {
      // Create a neural network for fuel consumption prediction
      this.model = tf.sequential({
        layers: [
          tf.layers.dense({
            inputShape: [10], // ship_specs, cargo_weight, distance, speed, weather, sea_conditions, engine_load, route_complexity, fuel_type, ship_age
            units: 64,
            activation: 'relu'
          }),
          tf.layers.dropout({ rate: 0.3 }),
          tf.layers.dense({
            units: 32,
            activation: 'relu'
          }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({
            units: 16,
            activation: 'relu'
          }),
          tf.layers.dense({
            units: 1, // fuel_consumption
            activation: 'linear'
          })
        ]
      });

      this.model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'meanSquaredError',
        metrics: ['mae', 'mse']
      });

      // Generate initial training data
      await this.generateInitialTrainingData();
      await this.trainModel();

      this.isModelLoaded = true;
      logger.info('Fuel prediction model initialized successfully');
    } catch (error) {
      logger.error('Error initializing fuel prediction model:', error);
      throw error;
    }
  }

  /**
   * Generate synthetic training data for fuel consumption
   */
  async generateInitialTrainingData() {
    const trainingSize = 1500;
    const inputs = [];
    const outputs = [];

    for (let i = 0; i < trainingSize; i++) {
      // Ship specifications (normalized)
      const shipCapacity = Math.random() * 80000 + 5000; // 5000-85000 tons
      const enginePower = Math.random() * 20000 + 5000; // 5000-25000 kW
      const shipAge = Math.random() * 30; // 0-30 years
      
      // Voyage parameters
      const cargoWeight = Math.random() * shipCapacity * 0.9; // Up to 90% capacity
      const distance = Math.random() * 8000 + 200; // 200-8200 nautical miles
      const speed = Math.random() * 15 + 8; // 8-23 knots
      const weatherScore = Math.random() * 10; // 0-10
      const seaConditions = Math.random() * 6; // 0-6 sea state
      const engineLoad = Math.random() * 0.4 + 0.6; // 60-100% load
      const routeComplexity = Math.random() * 5; // 0-5 (straits, channels, etc.)
      const fuelTypeMultiplier = Math.random() > 0.7 ? 1.2 : 1.0; // Heavy fuel vs marine diesel

      const input = [
        shipCapacity / 80000,
        cargoWeight / 80000,
        distance / 8000,
        speed / 25,
        weatherScore / 10,
        seaConditions / 6,
        engineLoad,
        routeComplexity / 5,
        fuelTypeMultiplier,
        shipAge / 30
      ];

      // Calculate realistic fuel consumption
      // Base consumption formula considering multiple factors
      const baseFuelConsumption = 
        (enginePower * 0.0001) * // Base engine consumption
        (distance / speed) * // Time factor
        engineLoad * // Engine load factor
        (1 + cargoWeight / shipCapacity * 0.3) * // Cargo weight factor
        (1 + weatherScore * 0.15) * // Weather factor
        (1 + seaConditions * 0.1) * // Sea conditions factor
        (1 + shipAge * 0.02) * // Ship age factor
        fuelTypeMultiplier * // Fuel type factor
        (1 + routeComplexity * 0.05); // Route complexity factor

      // Add some noise for realism
      const fuelConsumption = baseFuelConsumption * (0.9 + Math.random() * 0.2);

      inputs.push(input);
      outputs.push([fuelConsumption / 1000]); // Normalized (max ~1000 tons)
    }

    this.trainingInputs = tf.tensor2d(inputs);
    this.trainingOutputs = tf.tensor2d(outputs);
  }

  /**
   * Train the fuel prediction model
   */
  async trainModel() {
    if (!this.trainingInputs || !this.trainingOutputs) {
      throw new Error('Training data not available');
    }

    try {
      const history = await this.model.fit(this.trainingInputs, this.trainingOutputs, {
        epochs: 150,
        batchSize: 32,
        validationSplit: 0.2,
        verbose: 0,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            if (epoch % 50 === 0) {
              logger.info(`Training epoch ${epoch}: loss=${logs.loss.toFixed(4)}, val_loss=${logs.val_loss.toFixed(4)}`);
            }
          }
        }
      });

      logger.info('Fuel prediction model training completed');
      return history;
    } catch (error) {
      logger.error('Error training fuel prediction model:', error);
      throw error;
    }
  }

  /**
   * Predict fuel consumption for a voyage
   */
  async predictFuelConsumption(params) {
    if (!this.isModelLoaded) {
      await this.initializeModel();
    }

    const {
      ship,
      voyage,
      routeData
    } = params;

    try {
      // Extract and normalize features
      const shipCapacity = ship.capacity || 40000;
      const cargoWeight = voyage.cargoLoad.weight;
      const distance = routeData.totalDistance;
      const speed = routeData.optimalSpeed || 15;
      const weatherScore = this.calculateWeatherImpact(voyage.weatherForecast);
      const seaConditions = this.calculateSeaConditions(voyage.weatherForecast);
      const engineLoad = this.calculateEngineLoad(cargoWeight, shipCapacity, speed);
      const routeComplexity = this.calculateRouteComplexity(voyage.origin, voyage.destination);
      const fuelTypeMultiplier = this.getFuelTypeMultiplier(ship.engineType);
      const shipAge = new Date().getFullYear() - (ship.yearBuilt || 2010);

      const input = tf.tensor2d([[
        shipCapacity / 80000,
        cargoWeight / 80000,
        distance / 8000,
        speed / 25,
        weatherScore / 10,
        seaConditions / 6,
        engineLoad,
        routeComplexity / 5,
        fuelTypeMultiplier,
        shipAge / 30
      ]]);

      // Make prediction
      const prediction = this.model.predict(input);
      const fuelConsumption = (await prediction.data())[0] * 1000; // Denormalize

      // Calculate additional metrics
      const efficiency = this.calculateEfficiency(fuelConsumption, distance, cargoWeight);
      const costEstimate = this.calculateFuelCost(fuelConsumption, ship.engineType);
      const emissionsEstimate = this.calculateEmissions(fuelConsumption, ship.engineType);

      // Clean up tensors
      input.dispose();
      prediction.dispose();

      return {
        estimatedConsumption: Math.round(fuelConsumption * 100) / 100,
        efficiency: Math.round(efficiency * 100) / 100,
        costEstimate: Math.round(costEstimate * 100) / 100,
        emissionsEstimate: Math.round(emissionsEstimate * 100) / 100,
        confidence: this.calculatePredictionConfidence(params),
        factors: this.getInfluencingFactors(weatherScore, seaConditions, engineLoad),
        recommendations: this.generateEfficiencyRecommendations(efficiency, weatherScore)
      };
    } catch (error) {
      logger.error('Error predicting fuel consumption:', error);
      throw error;
    }
  }

  /**
   * Calculate weather impact on fuel consumption
   */
  calculateWeatherImpact(weatherForecast) {
    if (!weatherForecast || weatherForecast.length === 0) return 3;

    let impactScore = 0;
    for (const forecast of weatherForecast) {
      if (forecast.windSpeed > 30) impactScore += 4;
      else if (forecast.windSpeed > 20) impactScore += 3;
      else if (forecast.windSpeed > 15) impactScore += 2;
      else if (forecast.windSpeed > 10) impactScore += 1;

      if (forecast.waveHeight > 5) impactScore += 3;
      else if (forecast.waveHeight > 3) impactScore += 2;
      else if (forecast.waveHeight > 1.5) impactScore += 1;
    }

    return Math.min(10, impactScore / weatherForecast.length);
  }

  /**
   * Calculate sea conditions impact
   */
  calculateSeaConditions(weatherForecast) {
    if (!weatherForecast || weatherForecast.length === 0) return 2;

    let totalWaveHeight = 0;
    for (const forecast of weatherForecast) {
      totalWaveHeight += forecast.waveHeight || 1;
    }

    const avgWaveHeight = totalWaveHeight / weatherForecast.length;
    return Math.min(6, Math.floor(avgWaveHeight));
  }

  /**
   * Calculate engine load percentage
   */
  calculateEngineLoad(cargoWeight, shipCapacity, speed) {
    const loadFactor = cargoWeight / shipCapacity;
    const speedFactor = speed / 20; // Assuming max efficient speed of 20 knots
    return Math.min(1.0, 0.6 + (loadFactor * 0.2) + (speedFactor * 0.2));
  }

  /**
   * Calculate route complexity score
   */
  calculateRouteComplexity(origin, destination) {
    // Simplified complexity calculation based on geographic regions
    const complexRegions = ['Mediterranean', 'Baltic', 'Persian Gulf', 'Malacca Strait'];
    
    let complexity = 1; // Base complexity
    
    // Check if route passes through complex regions (simplified)
    if (origin.name && complexRegions.some(region => origin.name.includes(region))) complexity += 1;
    if (destination.name && complexRegions.some(region => destination.name.includes(region))) complexity += 1;
    
    // Add complexity based on distance (longer routes may have more complex navigation)
    const distance = Math.abs(destination.coordinates.latitude - origin.coordinates.latitude) +
                    Math.abs(destination.coordinates.longitude - origin.coordinates.longitude);
    
    if (distance > 100) complexity += 1;
    if (distance > 180) complexity += 1;

    return Math.min(5, complexity);
  }

  /**
   * Get fuel type multiplier
   */
  getFuelTypeMultiplier(engineType) {
    const multipliers = {
      'diesel': 1.0,
      'heavy-fuel-oil': 1.15,
      'gas-turbine': 0.85,
      'hybrid': 0.75,
      'electric': 0.1
    };
    return multipliers[engineType] || 1.0;
  }

  /**
   * Calculate fuel efficiency
   */
  calculateEfficiency(fuelConsumption, distance, cargoWeight) {
    // Efficiency metric: nautical miles per ton of fuel per ton of cargo
    if (fuelConsumption === 0 || cargoWeight === 0) return 0;
    return (distance * cargoWeight) / fuelConsumption;
  }

  /**
   * Calculate fuel cost estimate
   */
  calculateFuelCost(fuelConsumption, engineType) {
    const fuelPrices = {
      'diesel': 650, // USD per ton
      'heavy-fuel-oil': 450,
      'gas-turbine': 800,
      'hybrid': 550,
      'electric': 100 // Equivalent cost
    };
    
    const pricePerTon = fuelPrices[engineType] || 500;
    return fuelConsumption * pricePerTon;
  }

  /**
   * Calculate emissions estimate
   */
  calculateEmissions(fuelConsumption, engineType) {
    const emissionFactors = {
      'diesel': 3.2, // tons CO2 per ton fuel
      'heavy-fuel-oil': 3.4,
      'gas-turbine': 2.8,
      'hybrid': 2.0,
      'electric': 0.5
    };
    
    const factor = emissionFactors[engineType] || 3.0;
    return fuelConsumption * factor;
  }

  /**
   * Calculate prediction confidence
   */
  calculatePredictionConfidence(params) {
    let confidence = 0.8; // Base confidence

    // Reduce confidence for extreme conditions
    const weatherScore = this.calculateWeatherImpact(params.voyage.weatherForecast);
    if (weatherScore > 7) confidence -= 0.1;
    if (weatherScore > 9) confidence -= 0.1;

    // Reduce confidence for very long or very short routes
    const distance = params.routeData.totalDistance;
    if (distance < 50 || distance > 5000) confidence -= 0.1;

    // Increase confidence for modern ships
    const shipAge = new Date().getFullYear() - (params.ship.yearBuilt || 2010);
    if (shipAge < 5) confidence += 0.05;

    return Math.max(0.5, Math.min(0.95, confidence));
  }

  /**
   * Get factors influencing fuel consumption
   */
  getInfluencingFactors(weatherScore, seaConditions, engineLoad) {
    const factors = [];

    if (weatherScore > 6) factors.push('High wind conditions (+15% consumption)');
    if (seaConditions > 4) factors.push('Rough seas (+10% consumption)');
    if (engineLoad > 0.9) factors.push('High engine load (+8% consumption)');
    if (weatherScore < 3 && seaConditions < 2) factors.push('Excellent conditions (-5% consumption)');

    return factors;
  }

  /**
   * Generate fuel efficiency recommendations
   */
  generateEfficiencyRecommendations(efficiency, weatherScore) {
    const recommendations = [];

    if (efficiency < 50) {
      recommendations.push('Consider reducing speed by 10% to improve fuel efficiency');
      recommendations.push('Review cargo distribution for optimal trim');
    }

    if (weatherScore > 6) {
      recommendations.push('Wait for better weather conditions if schedule permits');
      recommendations.push('Consider alternative route to avoid severe weather');
    }

    if (efficiency > 80) {
      recommendations.push('Excellent efficiency - maintain current parameters');
    }

    return recommendations;
  }

  /**
   * Update model with actual fuel consumption data
   */
  async updateModelWithActualData(voyageData) {
    try {
      // Extract features and actual consumption
      const features = this.extractFeaturesFromVoyageData(voyageData);
      const actualConsumption = voyageData.fuelPrediction.actualConsumption;

      // Add to historical data
      this.historicalData.push({
        features,
        actualConsumption,
        timestamp: new Date()
      });

      // Retrain model periodically
      if (this.historicalData.length % 50 === 0) {
        await this.retrainWithHistoricalData();
      }

      logger.info('Fuel prediction model updated with actual consumption data');
    } catch (error) {
      logger.error('Error updating fuel prediction model:', error);
    }
  }

  extractFeaturesFromVoyageData(_voyageData) {
    // Extract normalized features from voyage data for retraining
    // Implementation details...
    return [];
  }

  async retrainWithHistoricalData() {
    // Implement retraining with accumulated historical data
    logger.info('Retraining fuel prediction model with historical data');
    // Implementation details...
  }
}

module.exports = new FuelPredictor();
