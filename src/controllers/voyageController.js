const routeOptimizer = require('../ai/routeOptimizer');
const fuelPredictor = require('../ai/fuelPredictor');
const Voyage = require('../models/Voyage');
const Ship = require('../models/Ship');
const logger = require('../utils/logger');

/**
 * Plan a new voyage with AI optimization
 * POST /api/v1/voyages/plan-voyage
 */
const planVoyage = async (req, res, next) => {
  try {
    const {
      shipId,
      origin,
      destination,
      departureTime,
      cargoLoad,
      weatherForecast
    } = req.body;

    // Validate required fields
    if (!shipId || !origin || !destination || !departureTime || !cargoLoad) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: shipId, origin, destination, departureTime, cargoLoad'
      });
    }

    // Get ship data
    const ship = await Ship.findOne({ shipId });
    if (!ship) {
      return res.status(404).json({
        success: false,
        error: 'Ship not found'
      });
    }

    // Generate voyage ID
    const voyageId = `VYG-${shipId}-${Date.now()}`;

    // Optimize route using AI
    const routeOptimization = await routeOptimizer.optimizeRoute({
      origin,
      destination,
      cargoWeight: cargoLoad.weight,
      weatherForecast: weatherForecast || [],
      departureTime
    });

    // Predict fuel consumption
    const fuelPrediction = await fuelPredictor.predictFuelConsumption({
      ship,
      voyage: {
        origin,
        destination,
        cargoLoad,
        weatherForecast: weatherForecast || []
      },
      routeData: routeOptimization
    });

    // Calculate ETA
    const estimatedArrival = new Date(
      new Date(departureTime).getTime() + 
      routeOptimization.estimatedTime * 60 * 60 * 1000
    );

    // Create voyage record
    const voyageData = {
      voyageId,
      shipId,
      origin,
      destination,
      departureTime: new Date(departureTime),
      estimatedArrival,
      cargoLoad,
      weatherForecast: weatherForecast || [],
      plannedRoute: {
        waypoints: routeOptimization.waypoints,
        totalDistance: routeOptimization.totalDistance,
        estimatedDuration: routeOptimization.estimatedTime
      },
      fuelPrediction: {
        estimatedConsumption: fuelPrediction.estimatedConsumption,
        efficiency: fuelPrediction.efficiency
      },
      optimizationMetrics: {
        routeEfficiency: routeOptimization.confidence * 100,
        fuelEfficiency: fuelPrediction.efficiency,
        timeEfficiency: 85, // Mock metric
        costSavings: fuelPrediction.costEstimate * 0.1 // 10% savings estimate
      },
      aiRecommendations: {
        optimalSpeed: routeOptimization.optimalSpeed,
        alternativeRoutes: [], // Could be enhanced
        weatherAlerts: routeOptimization.recommendations,
        maintenanceFlags: []
      },
      status: 'planned'
    };

    const voyage = new Voyage(voyageData);
    await voyage.save();

    logger.info(`Voyage planned successfully: ${voyageId}`);

    res.status(201).json({
      success: true,
      data: {
        voyageId,
        estimatedArrival,
        optimizedRoute: {
          totalDistance: routeOptimization.totalDistance,
          estimatedDuration: routeOptimization.estimatedTime,
          optimalSpeed: routeOptimization.optimalSpeed,
          waypoints: routeOptimization.waypoints
        },
        fuelEstimate: {
          consumption: fuelPrediction.estimatedConsumption,
          cost: fuelPrediction.costEstimate,
          efficiency: fuelPrediction.efficiency,
          emissions: fuelPrediction.emissionsEstimate
        },
        recommendations: routeOptimization.recommendations,
        confidence: {
          route: routeOptimization.confidence,
          fuel: fuelPrediction.confidence
        }
      },
      message: 'Voyage planned successfully with AI optimization'
    });

  } catch (error) {
    logger.error('Error planning voyage:', error);
    next(error);
  }
};

/**
 * Get voyage history with performance metrics
 * GET /api/v1/voyages/plan-history
 */
const getPlanHistory = async (req, res, next) => {
  try {
    const { 
      shipId, 
      status, 
      page = 1, 
      limit = 10,
      startDate,
      endDate 
    } = req.query;

    // Build query
    const query = {};
    if (shipId) query.shipId = shipId;
    if (status) query.status = status;
    if (startDate || endDate) {
      query.departureTime = {};
      if (startDate) query.departureTime.$gte = new Date(startDate);
      if (endDate) query.departureTime.$lte = new Date(endDate);
    }

    // Execute query with pagination
    const voyages = await Voyage.find(query)
      .sort({ departureTime: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Voyage.countDocuments(query);

    // Calculate performance metrics
    const performanceMetrics = await calculatePerformanceMetrics(voyages);

    res.json({
      success: true,
      data: {
        voyages: voyages.map(voyage => ({
          voyageId: voyage.voyageId,
          shipId: voyage.shipId,
          origin: voyage.origin.name,
          destination: voyage.destination.name,
          departureTime: voyage.departureTime,
          estimatedArrival: voyage.estimatedArrival,
          actualArrival: voyage.actualArrival,
          status: voyage.status,
          plannedVsActual: {
            distance: {
              planned: voyage.plannedRoute?.totalDistance,
              actual: voyage.actualRoute?.totalDistance
            },
            duration: {
              planned: voyage.plannedRoute?.estimatedDuration,
              actual: voyage.actualRoute?.actualDuration
            },
            fuel: {
              predicted: voyage.fuelPrediction?.estimatedConsumption,
              actual: voyage.fuelPrediction?.actualConsumption
            }
          },
          optimizationMetrics: voyage.optimizationMetrics
        })),
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalVoyages: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        },
        performanceMetrics
      }
    });

  } catch (error) {
    logger.error('Error fetching voyage history:', error);
    next(error);
  }
};

/**
 * Submit voyage feedback for AI learning
 * POST /api/v1/voyages/feedback
 */
const submitFeedback = async (req, res, next) => {
  try {
    const {
      voyageId,
      actualRoute,
      actualFuelConsumption,
      actualDuration,
      actualArrival
    } = req.body;

    if (!voyageId) {
      return res.status(400).json({
        success: false,
        error: 'Voyage ID is required'
      });
    }

    // Find and update voyage
    const voyage = await Voyage.findOne({ voyageId });
    if (!voyage) {
      return res.status(404).json({
        success: false,
        error: 'Voyage not found'
      });
    }

    // Update voyage with actual data
    const updateData = {
      status: 'completed',
      actualArrival: actualArrival ? new Date(actualArrival) : new Date()
    };

    if (actualRoute) {
      updateData.actualRoute = actualRoute;
    }

    if (actualFuelConsumption) {
      updateData['fuelPrediction.actualConsumption'] = actualFuelConsumption;
      
      // Calculate actual efficiency
      if (voyage.plannedRoute?.totalDistance) {
        updateData['fuelPrediction.efficiency'] = 
          (voyage.plannedRoute.totalDistance * voyage.cargoLoad.weight) / actualFuelConsumption;
      }
    }

    if (actualDuration) {
      updateData['actualRoute.actualDuration'] = actualDuration;
    }

    // Calculate optimization metrics
    if (actualFuelConsumption && voyage.fuelPrediction?.estimatedConsumption) {
      const fuelAccuracy = 1 - Math.abs(
        (actualFuelConsumption - voyage.fuelPrediction.estimatedConsumption) / 
        voyage.fuelPrediction.estimatedConsumption
      );
      updateData['optimizationMetrics.fuelEfficiency'] = fuelAccuracy * 100;
    }

    await Voyage.findOneAndUpdate({ voyageId }, updateData);

    // Update AI models with feedback
    const updatedVoyage = await Voyage.findOne({ voyageId });
    
    // Update route optimizer
    if (actualRoute) {
      await routeOptimizer.updateModelWithFeedback(updatedVoyage);
    }

    // Update fuel predictor
    if (actualFuelConsumption) {
      await fuelPredictor.updateModelWithActualData(updatedVoyage);
    }

    logger.info(`Feedback submitted for voyage: ${voyageId}`);

    res.json({
      success: true,
      message: 'Feedback submitted successfully. AI models updated for improved future predictions.',
      data: {
        voyageId,
        updatedMetrics: updateData.optimizationMetrics || {},
        learningImpact: {
          routeOptimization: !!actualRoute,
          fuelPrediction: !!actualFuelConsumption
        }
      }
    });

  } catch (error) {
    logger.error('Error submitting voyage feedback:', error);
    next(error);
  }
};

/**
 * Get voyage details by ID
 * GET /api/v1/voyages/:voyageId
 */
const getVoyageById = async (req, res, next) => {
  try {
    const { voyageId } = req.params;

    const voyage = await Voyage.findOne({ voyageId }).lean();
    if (!voyage) {
      return res.status(404).json({
        success: false,
        error: 'Voyage not found'
      });
    }

    res.json({
      success: true,
      data: voyage
    });

  } catch (error) {
    logger.error('Error fetching voyage details:', error);
    next(error);
  }
};

/**
 * Update voyage status
 * PUT /api/v1/voyages/:voyageId/status
 */
const updateVoyageStatus = async (req, res, next) => {
  try {
    const { voyageId } = req.params;
    const { status, currentLocation } = req.body;

    const validStatuses = ['planned', 'in-progress', 'completed', 'cancelled', 'delayed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
      });
    }

    const updateData = { status };
    if (currentLocation) {
      updateData.currentLocation = currentLocation;
    }

    const voyage = await Voyage.findOneAndUpdate(
      { voyageId },
      updateData,
      { new: true }
    );

    if (!voyage) {
      return res.status(404).json({
        success: false,
        error: 'Voyage not found'
      });
    }

    res.json({
      success: true,
      data: voyage,
      message: `Voyage status updated to ${status}`
    });

  } catch (error) {
    logger.error('Error updating voyage status:', error);
    next(error);
  }
};

/**
 * Calculate performance metrics for voyages
 */
const calculatePerformanceMetrics = async (voyages) => {
  const completedVoyages = voyages.filter(v => v.status === 'completed' && v.actualRoute);
  
  if (completedVoyages.length === 0) {
    return {
      totalVoyages: voyages.length,
      completedVoyages: 0,
      averageAccuracy: null,
      fuelSavings: null,
      timeSavings: null
    };
  }

  let totalFuelAccuracy = 0;
  let totalTimeAccuracy = 0;
  let totalFuelSavings = 0;
  let totalTimeSavings = 0;
  let validFuelPredictions = 0;
  let validTimePredictions = 0;

  for (const voyage of completedVoyages) {
    // Fuel accuracy
    if (voyage.fuelPrediction?.estimatedConsumption && voyage.fuelPrediction?.actualConsumption) {
      const fuelAccuracy = 1 - Math.abs(
        (voyage.fuelPrediction.actualConsumption - voyage.fuelPrediction.estimatedConsumption) / 
        voyage.fuelPrediction.estimatedConsumption
      );
      totalFuelAccuracy += Math.max(0, fuelAccuracy);
      validFuelPredictions++;

      // Calculate savings (compared to baseline)
      const baselineFuel = voyage.fuelPrediction.estimatedConsumption * 1.15; // Assume 15% higher without optimization
      totalFuelSavings += Math.max(0, baselineFuel - voyage.fuelPrediction.actualConsumption);
    }

    // Time accuracy
    if (voyage.plannedRoute?.estimatedDuration && voyage.actualRoute?.actualDuration) {
      const timeAccuracy = 1 - Math.abs(
        (voyage.actualRoute.actualDuration - voyage.plannedRoute.estimatedDuration) / 
        voyage.plannedRoute.estimatedDuration
      );
      totalTimeAccuracy += Math.max(0, timeAccuracy);
      validTimePredictions++;

      // Calculate time savings
      const baselineTime = voyage.plannedRoute.estimatedDuration * 1.1; // Assume 10% longer without optimization
      totalTimeSavings += Math.max(0, baselineTime - voyage.actualRoute.actualDuration);
    }
  }

  return {
    totalVoyages: voyages.length,
    completedVoyages: completedVoyages.length,
    averageAccuracy: {
      fuel: validFuelPredictions > 0 ? (totalFuelAccuracy / validFuelPredictions * 100).toFixed(2) : null,
      time: validTimePredictions > 0 ? (totalTimeAccuracy / validTimePredictions * 100).toFixed(2) : null
    },
    fuelSavings: validFuelPredictions > 0 ? totalFuelSavings.toFixed(2) : null,
    timeSavings: validTimePredictions > 0 ? (totalTimeSavings / 24).toFixed(2) : null // Convert to days
  };
};

module.exports = {
  planVoyage,
  getPlanHistory,
  submitFeedback,
  getVoyageById,
  updateVoyageStatus
};
