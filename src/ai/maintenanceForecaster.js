const tf = require('@tensorflow/tfjs-node');
const logger = require('../utils/logger');

class MaintenanceForecaster {
  constructor() {
    this.model = null;
    this.isModelLoaded = false;
    this.maintenanceHistory = [];
    this.componentRiskModel = null;
  }

  /**
   * Initialize maintenance prediction models
   */
  async initializeModel() {
    try {
      // Main maintenance prediction model
      this.model = tf.sequential({
        layers: [
          tf.layers.dense({
            inputShape: [12], // ship_age, engine_hours, last_maintenance_days, component_type, usage_intensity, operating_conditions, etc.
            units: 64,
            activation: 'relu'
          }),
          tf.layers.dropout({ rate: 0.3 }),
          tf.layers.dense({
            units: 32,
            activation: 'relu'
          }),
          tf.layers.dense({
            units: 16,
            activation: 'relu'
          }),
          tf.layers.dense({
            units: 2, // [days_until_maintenance, risk_score]
            activation: 'sigmoid'
          })
        ]
      });

      this.model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'meanSquaredError',
        metrics: ['mae']
      });

      // Component-specific risk assessment model
      this.componentRiskModel = tf.sequential({
        layers: [
          tf.layers.dense({
            inputShape: [8], // component_age, usage_hours, stress_factors, etc.
            units: 32,
            activation: 'relu'
          }),
          tf.layers.dense({
            units: 16,
            activation: 'relu'
          }),
          tf.layers.dense({
            units: 1, // failure_probability
            activation: 'sigmoid'
          })
        ]
      });

      this.componentRiskModel.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'binaryCrossentropy',
        metrics: ['accuracy']
      });

      // Generate training data and train models
      await this.generateTrainingData();
      await this.trainModels();

      this.isModelLoaded = true;
      logger.info('Maintenance forecasting models initialized successfully');
    } catch (error) {
      logger.error('Error initializing maintenance forecasting models:', error);
      throw error;
    }
  }

  /**
   * Generate synthetic training data for maintenance prediction
   */
  async generateTrainingData() {
    const trainingSize = 2000;
    const maintenanceInputs = [];
    const maintenanceOutputs = [];
    const componentInputs = [];
    const componentOutputs = [];

    // Component types and their typical lifespans
    const components = {
      'engine': { baseLifespan: 8760, variability: 0.3 }, // hours
      'hull': { baseLifespan: 17520, variability: 0.2 },
      'navigation': { baseLifespan: 4380, variability: 0.4 },
      'safety': { baseLifespan: 2190, variability: 0.3 },
      'electrical': { baseLifespan: 6570, variability: 0.35 },
      'propulsion': { baseLifespan: 10950, variability: 0.25 }
    };

    const componentTypes = Object.keys(components);

    for (let i = 0; i < trainingSize; i++) {
      // Ship and usage parameters
      const shipAge = Math.random() * 25; // 0-25 years
      const engineHours = Math.random() * 100000; // 0-100k hours
      const lastMaintenanceDays = Math.random() * 730; // 0-2 years
      const componentType = componentTypes[Math.floor(Math.random() * componentTypes.length)];
      const componentIndex = componentTypes.indexOf(componentType);
      const usageIntensity = Math.random(); // 0-1
      const operatingConditions = Math.random() * 10; // 0-10 severity
      const maintenanceQuality = Math.random(); // 0-1
      const environmentalStress = Math.random() * 5; // 0-5
      const loadFactor = Math.random(); // 0-1
      const vibrationLevel = Math.random() * 10; // 0-10
      const temperatureStress = Math.random() * 5; // 0-5
      const corrosionRisk = Math.random() * 8; // 0-8

      // Maintenance prediction inputs (normalized)
      const maintenanceInput = [
        shipAge / 25,
        engineHours / 100000,
        lastMaintenanceDays / 730,
        componentIndex / componentTypes.length,
        usageIntensity,
        operatingConditions / 10,
        maintenanceQuality,
        environmentalStress / 5,
        loadFactor,
        vibrationLevel / 10,
        temperatureStress / 5,
        corrosionRisk / 8
      ];

      // Calculate realistic maintenance needs
      const component = components[componentType];
      const baseRemainingLife = component.baseLifespan * (1 - usageIntensity);
      const adjustedLife = baseRemainingLife * 
        (1 - operatingConditions * 0.1) * 
        (1 + maintenanceQuality * 0.2) *
        (1 - environmentalStress * 0.05);

      const daysUntilMaintenance = Math.max(1, 
        (adjustedLife - engineHours) / 24 + 
        Math.random() * component.baseLifespan * component.variability
      );

      const riskScore = Math.min(1, 
        (engineHours / adjustedLife) * 
        (1 + operatingConditions * 0.1) * 
        (1 + lastMaintenanceDays / 365 * 0.3)
      );

      const maintenanceOutput = [
        Math.min(1, daysUntilMaintenance / 730), // normalized to 2 years max
        riskScore
      ];

      maintenanceInputs.push(maintenanceInput);
      maintenanceOutputs.push(maintenanceOutput);

      // Component risk assessment inputs
      const componentAge = Math.random() * shipAge;
      const componentUsageHours = Math.random() * engineHours;
      const stressFactor = (operatingConditions + environmentalStress + vibrationLevel) / 3;
      
      const componentInput = [
        componentAge / 25,
        componentUsageHours / 100000,
        stressFactor / 10,
        loadFactor,
        temperatureStress / 5,
        corrosionRisk / 8,
        maintenanceQuality,
        usageIntensity
      ];

      // Binary failure probability (0 or 1)
      const failureProbability = riskScore > 0.7 ? 1 : 0;
      
      componentInputs.push(componentInput);
      componentOutputs.push([failureProbability]);
    }

    this.maintenanceTrainingInputs = tf.tensor2d(maintenanceInputs);
    this.maintenanceTrainingOutputs = tf.tensor2d(maintenanceOutputs);
    this.componentTrainingInputs = tf.tensor2d(componentInputs);
    this.componentTrainingOutputs = tf.tensor2d(componentOutputs);
  }

  /**
   * Train both maintenance prediction models
   */
  async trainModels() {
    try {
      // Train main maintenance model
      await this.model.fit(this.maintenanceTrainingInputs, this.maintenanceTrainingOutputs, {
        epochs: 120,
        batchSize: 32,
        validationSplit: 0.2,
        verbose: 0
      });

      // Train component risk model
      await this.componentRiskModel.fit(this.componentTrainingInputs, this.componentTrainingOutputs, {
        epochs: 100,
        batchSize: 32,
        validationSplit: 0.2,
        verbose: 0
      });

      logger.info('Maintenance forecasting models training completed');
    } catch (error) {
      logger.error('Error training maintenance models:', error);
      throw error;
    }
  }

  /**
   * Predict maintenance requirements for a ship
   */
  async predictMaintenance(shipData, usageData = {}) {
    if (!this.isModelLoaded) {
      await this.initializeModel();
    }

    try {
      const predictions = [];
      const componentTypes = ['engine', 'hull', 'navigation', 'safety', 'electrical', 'propulsion'];

      for (let i = 0; i < componentTypes.length; i++) {
        const componentType = componentTypes[i];
        const prediction = await this.predictComponentMaintenance(shipData, componentType, i, usageData);
        predictions.push(prediction);
      }

      // Sort by risk score (highest first)
      predictions.sort((a, b) => b.riskScore - a.riskScore);

      // Generate overall recommendations
      const overallRecommendations = this.generateOverallRecommendations(predictions);

      return {
        predictions,
        overallRecommendations,
        nextCriticalMaintenance: predictions[0],
        maintenanceWindows: this.calculateOptimalMaintenanceWindows(predictions),
        costEstimate: this.calculateMaintenanceCosts(predictions),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error predicting maintenance:', error);
      throw error;
    }
  }

  /**
   * Predict maintenance for a specific component
   */
  async predictComponentMaintenance(shipData, componentType, componentIndex, usageData) {
    const shipAge = new Date().getFullYear() - (shipData.yearBuilt || 2010);
    const engineHours = usageData.engineHours || shipAge * 2000; // Estimate if not provided
    const lastMaintenanceDays = shipData.lastMaintenance ? 
      (Date.now() - new Date(shipData.lastMaintenance).getTime()) / (1000 * 60 * 60 * 24) : 
      365;

    // Environmental and operational factors
    const usageIntensity = this.calculateUsageIntensity(usageData);
    const operatingConditions = this.calculateOperatingConditions(shipData, usageData);
    const maintenanceQuality = 0.8; // Assume good maintenance quality
    const environmentalStress = this.calculateEnvironmentalStress(shipData);
    const loadFactor = usageData.averageLoadFactor || 0.7;
    const vibrationLevel = this.calculateVibrationLevel(componentType, usageData);
    const temperatureStress = this.calculateTemperatureStress(componentType, usageData);
    const corrosionRisk = this.calculateCorrosionRisk(shipData);

    // Prepare input for main model
    const maintenanceInput = tf.tensor2d([[
      shipAge / 25,
      engineHours / 100000,
      lastMaintenanceDays / 730,
      componentIndex / 6,
      usageIntensity,
      operatingConditions / 10,
      maintenanceQuality,
      environmentalStress / 5,
      loadFactor,
      vibrationLevel / 10,
      temperatureStress / 5,
      corrosionRisk / 8
    ]]);

    // Prepare input for component risk model
    const componentAge = shipAge * (0.5 + Math.random() * 0.5); // Components aren't always as old as ship
    const componentInput = tf.tensor2d([[
      componentAge / 25,
      engineHours / 100000,
      (operatingConditions + environmentalStress + vibrationLevel) / 30,
      loadFactor,
      temperatureStress / 5,
      corrosionRisk / 8,
      maintenanceQuality,
      usageIntensity
    ]]);

    // Make predictions
    const maintenancePrediction = this.model.predict(maintenanceInput);
    const riskPrediction = this.componentRiskModel.predict(componentInput);

    const maintenanceData = await maintenancePrediction.data();
    const riskData = await riskPrediction.data();

    // Denormalize results
    const daysUntilMaintenance = Math.round(maintenanceData[0] * 730);
    const riskScore = Math.round(maintenanceData[1] * 100);
    const failureProbability = Math.round(riskData[0] * 100);

    // Calculate confidence based on data quality
    const confidence = this.calculatePredictionConfidence(shipData, usageData);

    // Generate component-specific recommendations
    const recommendations = this.generateComponentRecommendations(
      componentType, 
      riskScore, 
      daysUntilMaintenance,
      failureProbability
    );

    // Clean up tensors
    maintenanceInput.dispose();
    componentInput.dispose();
    maintenancePrediction.dispose();
    riskPrediction.dispose();

    return {
      componentType,
      daysUntilMaintenance,
      riskScore,
      failureProbability,
      confidence,
      priority: this.calculatePriority(riskScore, daysUntilMaintenance),
      estimatedCost: this.estimateMaintenanceCost(componentType, riskScore),
      recommendedAction: this.getRecommendedAction(riskScore, daysUntilMaintenance),
      recommendations,
      predictedFailureDate: new Date(Date.now() + daysUntilMaintenance * 24 * 60 * 60 * 1000)
    };
  }

  /**
   * Calculate usage intensity based on operational data
   */
  calculateUsageIntensity(usageData) {
    if (!usageData.operatingHoursPerDay) return 0.6; // Default moderate usage
    
    const dailyUsage = usageData.operatingHoursPerDay / 24;
    return Math.min(1, dailyUsage);
  }

  /**
   * Calculate operating conditions severity
   */
  calculateOperatingConditions(shipData, usageData) {
    let severity = 3; // Base severity

    // Harsh environmental conditions
    if (usageData.averageWaveHeight > 3) severity += 2;
    if (usageData.averageWindSpeed > 20) severity += 1;
    if (usageData.operatingTemperature > 40 || usageData.operatingTemperature < 0) severity += 1;

    // Route complexity
    if (usageData.complexRoutes) severity += 2;

    return Math.min(10, severity);
  }

  /**
   * Calculate environmental stress factors
   */
  calculateEnvironmentalStress(shipData) {
    let stress = 2; // Base stress

    // Salt water exposure
    stress += 1;

    // Based on current location or typical routes
    if (shipData.currentLocation) {
      // Arctic conditions
      if (Math.abs(shipData.currentLocation.latitude) > 60) stress += 2;
      // Tropical conditions
      if (Math.abs(shipData.currentLocation.latitude) < 23.5) stress += 1;
    }

    return Math.min(5, stress);
  }

  calculateVibrationLevel(componentType, usageData) {
    const baseVibration = {
      'engine': 6,
      'propulsion': 7,
      'hull': 4,
      'navigation': 2,
      'electrical': 3,
      'safety': 2
    };

    let vibration = baseVibration[componentType] || 3;
    
    if (usageData.averageSpeed > 20) vibration += 2;
    if (usageData.averageWaveHeight > 4) vibration += 1;

    return Math.min(10, vibration);
  }

  calculateTemperatureStress(componentType, usageData) {
    const tempSensitive = ['electrical', 'navigation', 'engine'];
    let stress = 2;

    if (tempSensitive.includes(componentType)) {
      if (usageData.operatingTemperature > 35) stress += 2;
      if (usageData.operatingTemperature < 5) stress += 1;
    }

    return Math.min(5, stress);
  }

  calculateCorrosionRisk(shipData) {
    let risk = 3; // Base marine environment risk

    const shipAge = new Date().getFullYear() - (shipData.yearBuilt || 2010);
    risk += Math.min(3, shipAge / 10); // Age factor

    // Hull material (if available)
    if (shipData.specifications && shipData.specifications.hullMaterial === 'steel') {
      risk += 1;
    }

    return Math.min(8, risk);
  }

  /**
   * Calculate prediction confidence
   */
  calculatePredictionConfidence(shipData, usageData) {
    let confidence = 0.75; // Base confidence

    // More data = higher confidence
    const dataPoints = Object.keys(usageData).length;
    confidence += Math.min(0.15, dataPoints * 0.02);

    // Recent maintenance data increases confidence
    if (shipData.lastMaintenance) {
      const daysSinceLastMaintenance = (Date.now() - new Date(shipData.lastMaintenance).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLastMaintenance < 90) confidence += 0.05;
    }

    return Math.min(0.95, confidence);
  }

  /**
   * Calculate maintenance priority
   */
  calculatePriority(riskScore, daysUntilMaintenance) {
    if (riskScore > 80 || daysUntilMaintenance < 30) return 'critical';
    if (riskScore > 60 || daysUntilMaintenance < 90) return 'high';
    if (riskScore > 40 || daysUntilMaintenance < 180) return 'medium';
    return 'low';
  }

  /**
   * Estimate maintenance cost
   */
  estimateMaintenanceCost(componentType, riskScore) {
    const baseCosts = {
      'engine': 50000,
      'hull': 80000,
      'propulsion': 40000,
      'navigation': 15000,
      'electrical': 20000,
      'safety': 10000
    };

    const baseCost = baseCosts[componentType] || 25000;
    const riskMultiplier = 1 + (riskScore / 100);
    
    return Math.round(baseCost * riskMultiplier);
  }

  /**
   * Get recommended action based on risk and timeline
   */
  getRecommendedAction(riskScore, daysUntilMaintenance) {
    if (riskScore > 85 || daysUntilMaintenance < 15) {
      return 'immediate_action';
    } else if (riskScore > 70 || daysUntilMaintenance < 45) {
      return 'schedule_soon';
    } else if (riskScore > 50 || daysUntilMaintenance < 120) {
      return 'plan_maintenance';
    } else {
      return 'monitor';
    }
  }

  /**
   * Generate component-specific recommendations
   */
  generateComponentRecommendations(componentType, riskScore, daysUntilMaintenance, failureProbability) {
    const recommendations = [];

    if (riskScore > 75) {
      recommendations.push(`High risk detected for ${componentType} - prioritize inspection`);
    }

    if (daysUntilMaintenance < 60) {
      recommendations.push(`Schedule ${componentType} maintenance within ${daysUntilMaintenance} days`);
    }

    if (failureProbability > 70) {
      recommendations.push(`Consider immediate replacement of ${componentType} components`);
    }

    // Component-specific recommendations
    switch (componentType) {
    case 'engine':
      if (riskScore > 60) {
        recommendations.push('Perform oil analysis and engine performance diagnostics');
      }
      break;
    case 'hull':
      if (riskScore > 50) {
        recommendations.push('Schedule underwater hull inspection for corrosion and damage');
      }
      break;
    case 'navigation':
      recommendations.push('Verify all navigation equipment calibration and software updates');
      break;
    }

    return recommendations;
  }

  /**
   * Generate overall maintenance recommendations
   */
  generateOverallRecommendations(predictions) {
    const recommendations = [];
    const criticalCount = predictions.filter(p => p.priority === 'critical').length;
    const highCount = predictions.filter(p => p.priority === 'high').length;

    if (criticalCount > 0) {
      recommendations.push(`${criticalCount} critical maintenance item(s) require immediate attention`);
    }

    if (highCount > 2) {
      recommendations.push('Multiple high-priority maintenance items - consider extended maintenance window');
    }

    const nextMaintenance = Math.min(...predictions.map(p => p.daysUntilMaintenance));
    if (nextMaintenance < 30) {
      recommendations.push('Plan for upcoming maintenance window within 30 days');
    }

    return recommendations;
  }

  /**
   * Calculate optimal maintenance windows
   */
  calculateOptimalMaintenanceWindows(predictions) {
    const windows = [];
    const sortedPredictions = [...predictions].sort((a, b) => a.daysUntilMaintenance - b.daysUntilMaintenance);

    const currentWindow = {
      startDate: new Date(),
      components: [],
      totalCost: 0,
      duration: 0
    };

    for (const prediction of sortedPredictions) {
      if (prediction.daysUntilMaintenance < 90) {
        currentWindow.components.push(prediction.componentType);
        currentWindow.totalCost += prediction.estimatedCost;
        currentWindow.duration = Math.max(currentWindow.duration, this.getMaintenanceDuration(prediction.componentType));
      }
    }

    if (currentWindow.components.length > 0) {
      windows.push(currentWindow);
    }

    return windows;
  }

  getMaintenanceDuration(componentType) {
    const durations = {
      'engine': 7, // days
      'hull': 10,
      'propulsion': 5,
      'navigation': 2,
      'electrical': 3,
      'safety': 1
    };
    return durations[componentType] || 3;
  }

  /**
   * Calculate total maintenance costs
   */
  calculateMaintenanceCosts(predictions) {
    const totalCost = predictions.reduce((sum, p) => sum + p.estimatedCost, 0);
    const criticalCosts = predictions
      .filter(p => p.priority === 'critical')
      .reduce((sum, p) => sum + p.estimatedCost, 0);

    return {
      total: totalCost,
      critical: criticalCosts,
      nextSixMonths: predictions
        .filter(p => p.daysUntilMaintenance < 180)
        .reduce((sum, p) => sum + p.estimatedCost, 0)
    };
  }

  /**
   * Update models with actual maintenance data
   */
  async updateWithMaintenanceData(maintenanceRecord) {
    try {
      // Store maintenance history for model improvement
      this.maintenanceHistory.push({
        ...maintenanceRecord,
        timestamp: new Date()
      });

      // Retrain models periodically
      if (this.maintenanceHistory.length % 100 === 0) {
        await this.retrainWithHistoricalData();
      }

      logger.info('Maintenance forecasting models updated with new data');
    } catch (error) {
      logger.error('Error updating maintenance models:', error);
    }
  }

  async retrainWithHistoricalData() {
    logger.info('Retraining maintenance forecasting models with historical data');
    // Implementation for incremental learning
  }
}

module.exports = new MaintenanceForecaster();
