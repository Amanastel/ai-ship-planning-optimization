const maintenanceForecaster = require('../ai/maintenanceForecaster');
const Maintenance = require('../models/Maintenance');
const Ship = require('../models/Ship');
const logger = require('../utils/logger');

/**
 * Get maintenance alerts and recommendations
 * GET /api/v1/maintenance/alerts
 */
const getMaintenanceAlerts = async (req, res, next) => {
  try {
    const { shipId, priority, category } = req.query;

    // Build query for active maintenance alerts
    const query = { status: { $in: ['scheduled', 'overdue'] } };
    if (shipId) query.shipId = shipId;
    if (priority) query.priority = priority;
    if (category) query.category = category;

    // Get current maintenance records
    const maintenanceRecords = await Maintenance.find(query)
      .sort({ 'aiPrediction.riskScore': -1, scheduledDate: 1 })
      .lean();

    // Get AI predictions for ships
    const ships = shipId ? 
      await Ship.find({ shipId }).lean() : 
      await Ship.find({ status: 'active' }).limit(10).lean();

    const aiPredictions = [];
    for (const ship of ships) {
      try {
        // Get usage data (mock for now - in production, this would come from IoT sensors)
        const usageData = await generateMockUsageData(ship);
        
        const prediction = await maintenanceForecaster.predictMaintenance(ship, usageData);
        aiPredictions.push({
          shipId: ship.shipId,
          shipName: ship.name,
          ...prediction
        });
      } catch (error) {
        logger.warn(`Failed to get AI prediction for ship ${ship.shipId}:`, error.message);
      }
    }

    // Combine scheduled maintenance with AI predictions
    const alerts = [
      ...maintenanceRecords.map(record => ({
        type: 'scheduled',
        alertId: record.maintenanceId,
        shipId: record.shipId,
        component: record.category,
        priority: record.priority,
        scheduledDate: record.scheduledDate,
        description: record.description,
        riskScore: record.aiPrediction?.riskScore || 50,
        estimatedCost: record.cost?.estimated || 0,
        daysUntil: Math.ceil((new Date(record.scheduledDate) - new Date()) / (1000 * 60 * 60 * 24))
      })),
      ...aiPredictions.flatMap(prediction => 
        prediction.predictions
          .filter(p => p.priority === 'critical' || p.priority === 'high')
          .map(p => ({
            type: 'ai_prediction',
            alertId: `AI-${prediction.shipId}-${p.componentType}`,
            shipId: prediction.shipId,
            shipName: prediction.shipName,
            component: p.componentType,
            priority: p.priority,
            riskScore: p.riskScore,
            daysUntilMaintenance: p.daysUntilMaintenance,
            estimatedCost: p.estimatedCost,
            recommendations: p.recommendations,
            confidence: p.confidence,
            predictedFailureDate: p.predictedFailureDate
          }))
      )
    ];

    // Sort by priority and risk score
    alerts.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const aPriority = priorityOrder[a.priority] || 0;
      const bPriority = priorityOrder[b.priority] || 0;
      
      if (aPriority !== bPriority) return bPriority - aPriority;
      return (b.riskScore || 0) - (a.riskScore || 0);
    });

    // Generate summary statistics
    const summary = {
      totalAlerts: alerts.length,
      criticalAlerts: alerts.filter(a => a.priority === 'critical').length,
      highPriorityAlerts: alerts.filter(a => a.priority === 'high').length,
      next30Days: alerts.filter(a => a.daysUntilMaintenance <= 30 || a.daysUntil <= 30).length,
      totalEstimatedCost: alerts.reduce((sum, a) => sum + (a.estimatedCost || 0), 0),
      shipsRequiringAttention: [...new Set(alerts.map(a => a.shipId))].length
    };

    res.json({
      success: true,
      data: {
        alerts: alerts.slice(0, 50), // Limit to 50 alerts
        summary,
        aiPredictions: aiPredictions.length
      },
      message: `Found ${alerts.length} maintenance alerts`
    });

  } catch (error) {
    logger.error('Error fetching maintenance alerts:', error);
    next(error);
  }
};

/**
 * Get detailed maintenance forecast for a specific ship
 * GET /api/v1/maintenance/forecast/:shipId
 */
const getMaintenanceForecast = async (req, res, next) => {
  try {
    const { shipId } = req.params;

    // Get ship data
    const ship = await Ship.findOne({ shipId });
    if (!ship) {
      return res.status(404).json({
        success: false,
        error: 'Ship not found'
      });
    }

    // Generate mock usage data (in production, this would come from IoT sensors)
    const usageData = await generateMockUsageData(ship);

    // Get AI prediction
    const forecast = await maintenanceForecaster.predictMaintenance(ship, usageData);

    // Get existing maintenance records
    const existingMaintenance = await Maintenance.find({ 
      shipId, 
      status: { $in: ['scheduled', 'in-progress'] }
    }).sort({ scheduledDate: 1 });

    res.json({
      success: true,
      data: {
        ship: {
          shipId: ship.shipId,
          name: ship.name,
          engineType: ship.engineType,
          yearBuilt: ship.yearBuilt,
          lastMaintenance: ship.lastMaintenance
        },
        forecast,
        existingMaintenance,
        usageData
      }
    });

  } catch (error) {
    logger.error('Error getting maintenance forecast:', error);
    next(error);
  }
};

/**
 * Schedule maintenance based on AI recommendations
 * POST /api/v1/maintenance/schedule
 */
const scheduleMaintenance = async (req, res, next) => {
  try {
    const {
      shipId,
      componentType,
      scheduledDate,
      description,
      priority,
      estimatedCost,
      estimatedDuration
    } = req.body;

    // Validate required fields
    if (!shipId || !componentType || !scheduledDate || !description) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: shipId, componentType, scheduledDate, description'
      });
    }

    // Check if ship exists
    const ship = await Ship.findOne({ shipId });
    if (!ship) {
      return res.status(404).json({
        success: false,
        error: 'Ship not found'
      });
    }

    // Generate maintenance ID
    const maintenanceId = `MNT-${shipId}-${Date.now()}`;

    // Get AI prediction for this component if available
    let aiPrediction = null;
    try {
      const usageData = await generateMockUsageData(ship);
      const forecast = await maintenanceForecaster.predictMaintenance(ship, usageData);
      
      const componentPrediction = forecast.predictions.find(p => p.componentType === componentType);
      if (componentPrediction) {
        aiPrediction = {
          predictedFailureDate: componentPrediction.predictedFailureDate,
          riskScore: componentPrediction.riskScore,
          confidenceLevel: componentPrediction.confidence * 100,
          recommendedAction: componentPrediction.recommendedAction,
          factors: componentPrediction.recommendations
        };
      }
    } catch (error) {
      logger.warn('Could not get AI prediction for maintenance scheduling:', error.message);
    }

    // Create maintenance record
    const maintenanceData = {
      maintenanceId,
      shipId,
      type: 'scheduled',
      category: componentType,
      description,
      scheduledDate: new Date(scheduledDate),
      estimatedDuration: estimatedDuration || 8, // default 8 hours
      priority: priority || 'medium',
      cost: {
        estimated: estimatedCost || 0
      },
      aiPrediction,
      status: 'scheduled'
    };

    const maintenance = new Maintenance(maintenanceData);
    await maintenance.save();

    logger.info(`Maintenance scheduled: ${maintenanceId} for ship ${shipId}`);

    res.status(201).json({
      success: true,
      data: maintenance,
      message: 'Maintenance scheduled successfully'
    });

  } catch (error) {
    logger.error('Error scheduling maintenance:', error);
    next(error);
  }
};

/**
 * Update maintenance record
 * PUT /api/v1/maintenance/:maintenanceId
 */
const updateMaintenance = async (req, res, next) => {
  try {
    const { maintenanceId } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData.maintenanceId;
    delete updateData.shipId;
    delete updateData.createdAt;

    const maintenance = await Maintenance.findOneAndUpdate(
      { maintenanceId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!maintenance) {
      return res.status(404).json({
        success: false,
        error: 'Maintenance record not found'
      });
    }

    // If maintenance is completed, update AI models
    if (updateData.status === 'completed' && updateData.completedDate) {
      try {
        await maintenanceForecaster.updateWithMaintenanceData(maintenance);
      } catch (error) {
        logger.warn('Failed to update AI model with maintenance data:', error.message);
      }
    }

    res.json({
      success: true,
      data: maintenance,
      message: 'Maintenance record updated successfully'
    });

  } catch (error) {
    logger.error('Error updating maintenance record:', error);
    next(error);
  }
};

/**
 * Get maintenance history for a ship
 * GET /api/v1/maintenance/history/:shipId
 */
const getMaintenanceHistory = async (req, res, next) => {
  try {
    const { shipId } = req.params;
    const { page = 1, limit = 20, category, status } = req.query;

    // Build query
    const query = { shipId };
    if (category) query.category = category;
    if (status) query.status = status;

    // Execute query with pagination
    const maintenanceRecords = await Maintenance.find(query)
      .sort({ scheduledDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Maintenance.countDocuments(query);

    // Calculate maintenance statistics
    const stats = await calculateMaintenanceStats(shipId);

    res.json({
      success: true,
      data: {
        maintenanceHistory: maintenanceRecords,
        statistics: stats,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalRecords: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching maintenance history:', error);
    next(error);
  }
};

/**
 * Get maintenance analytics and insights
 * GET /api/v1/maintenance/analytics
 */
const getMaintenanceAnalytics = async (req, res, next) => {
  try {
    const { timeframe = '12months', shipId } = req.query;
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch (timeframe) {
    case '1month':
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case '3months':
      startDate.setMonth(startDate.getMonth() - 3);
      break;
    case '6months':
      startDate.setMonth(startDate.getMonth() - 6);
      break;
    case '12months':
    default:
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    }

    // Build query
    const query = {
      scheduledDate: { $gte: startDate, $lte: endDate }
    };
    if (shipId) query.shipId = shipId;

    // Get maintenance records
    const maintenanceRecords = await Maintenance.find(query);

    // Calculate analytics
    const analytics = {
      overview: {
        totalMaintenance: maintenanceRecords.length,
        completed: maintenanceRecords.filter(m => m.status === 'completed').length,
        scheduled: maintenanceRecords.filter(m => m.status === 'scheduled').length,
        overdue: maintenanceRecords.filter(m => 
          m.status === 'scheduled' && new Date(m.scheduledDate) < new Date()
        ).length
      },
      costs: calculateCostAnalytics(maintenanceRecords),
      trends: calculateMaintenanceTrends(maintenanceRecords, startDate, endDate),
      componentAnalysis: calculateComponentAnalysis(maintenanceRecords),
      aiAccuracy: await calculateAIAccuracy(maintenanceRecords)
    };

    res.json({
      success: true,
      data: analytics,
      timeframe: {
        start: startDate,
        end: endDate,
        period: timeframe
      }
    });

  } catch (error) {
    logger.error('Error fetching maintenance analytics:', error);
    next(error);
  }
};

/**
 * Generate mock usage data for AI predictions
 * In production, this would come from IoT sensors and ship management systems
 */
const generateMockUsageData = async (ship) => {
  const shipAge = new Date().getFullYear() - (ship.yearBuilt || 2010);
  
  return {
    engineHours: shipAge * 2000 + Math.random() * 1000, // Mock engine hours
    operatingHoursPerDay: 18 + Math.random() * 6, // 18-24 hours
    averageSpeed: 12 + Math.random() * 8, // 12-20 knots
    averageLoadFactor: 0.6 + Math.random() * 0.3, // 60-90%
    averageWaveHeight: 1 + Math.random() * 3, // 1-4 meters
    averageWindSpeed: 10 + Math.random() * 15, // 10-25 knots
    operatingTemperature: 20 + Math.random() * 20, // 20-40°C
    complexRoutes: Math.random() > 0.7, // 30% chance of complex routes
    lastMaintenanceDate: ship.lastMaintenance || new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) // 6 months ago
  };
};

/**
 * Calculate maintenance statistics for a ship
 */
const calculateMaintenanceStats = async (shipId) => {
  const allMaintenance = await Maintenance.find({ shipId });
  const completed = allMaintenance.filter(m => m.status === 'completed');
  
  if (completed.length === 0) {
    return {
      totalCost: 0,
      averageCost: 0,
      averageDuration: 0,
      maintenanceFrequency: 0,
      costByCategory: {}
    };
  }

  const totalCost = completed.reduce((sum, m) => sum + (m.cost?.actual || m.cost?.estimated || 0), 0);
  const totalDuration = completed.reduce((sum, m) => sum + (m.actualDuration || m.estimatedDuration || 0), 0);
  
  // Group by category
  const categoryStats = {};
  completed.forEach(m => {
    if (!categoryStats[m.category]) {
      categoryStats[m.category] = { count: 0, cost: 0 };
    }
    categoryStats[m.category].count++;
    categoryStats[m.category].cost += (m.cost?.actual || m.cost?.estimated || 0);
  });

  return {
    totalCost: Math.round(totalCost),
    averageCost: Math.round(totalCost / completed.length),
    averageDuration: Math.round(totalDuration / completed.length),
    maintenanceFrequency: completed.length / 12, // per month
    costByCategory: categoryStats
  };
};

/**
 * Calculate cost analytics
 */
const calculateCostAnalytics = (records) => {
  const completedRecords = records.filter(r => r.status === 'completed' && r.cost);
  
  if (completedRecords.length === 0) {
    return { total: 0, average: 0, byCategory: {} };
  }

  const totalCost = completedRecords.reduce((sum, r) => sum + (r.cost.actual || r.cost.estimated || 0), 0);
  
  const byCategory = {};
  completedRecords.forEach(r => {
    if (!byCategory[r.category]) byCategory[r.category] = 0;
    byCategory[r.category] += (r.cost.actual || r.cost.estimated || 0);
  });

  return {
    total: Math.round(totalCost),
    average: Math.round(totalCost / completedRecords.length),
    byCategory
  };
};

/**
 * Calculate maintenance trends
 */
const calculateMaintenanceTrends = (records, startDate, endDate) => {
  const monthlyData = {};
  const current = new Date(startDate);
  
  while (current <= endDate) {
    const monthKey = current.toISOString().substring(0, 7); // YYYY-MM
    monthlyData[monthKey] = { count: 0, cost: 0 };
    current.setMonth(current.getMonth() + 1);
  }

  records.forEach(r => {
    const monthKey = r.scheduledDate.toISOString().substring(0, 7);
    if (monthlyData[monthKey]) {
      monthlyData[monthKey].count++;
      monthlyData[monthKey].cost += (r.cost?.actual || r.cost?.estimated || 0);
    }
  });

  return Object.keys(monthlyData).map(month => ({
    month,
    maintenanceCount: monthlyData[month].count,
    totalCost: Math.round(monthlyData[month].cost)
  }));
};

/**
 * Calculate component analysis
 */
const calculateComponentAnalysis = (records) => {
  const analysis = {};
  
  records.forEach(r => {
    if (!analysis[r.category]) {
      analysis[r.category] = {
        count: 0,
        totalCost: 0,
        averageRiskScore: 0,
        urgentCount: 0
      };
    }
    
    analysis[r.category].count++;
    analysis[r.category].totalCost += (r.cost?.actual || r.cost?.estimated || 0);
    analysis[r.category].averageRiskScore += (r.aiPrediction?.riskScore || 0);
    
    if (r.priority === 'critical' || r.priority === 'high') {
      analysis[r.category].urgentCount++;
    }
  });

  // Calculate averages
  Object.keys(analysis).forEach(category => {
    const data = analysis[category];
    data.averageRiskScore = data.count > 0 ? Math.round(data.averageRiskScore / data.count) : 0;
    data.totalCost = Math.round(data.totalCost);
  });

  return analysis;
};

/**
 * Calculate AI prediction accuracy
 */
const calculateAIAccuracy = async (records) => {
  const recordsWithPredictions = records.filter(r => 
    r.aiPrediction && r.status === 'completed' && r.completedDate
  );

  if (recordsWithPredictions.length === 0) {
    return { accuracy: null, sampleSize: 0 };
  }

  let totalAccuracy = 0;
  recordsWithPredictions.forEach(r => {
    const predictedDate = new Date(r.aiPrediction.predictedFailureDate);
    const actualDate = new Date(r.completedDate);
    const daysDiff = Math.abs((actualDate - predictedDate) / (1000 * 60 * 60 * 24));
    
    // Accuracy decreases with larger differences
    const accuracy = Math.max(0, 1 - (daysDiff / 365)); // 1 year tolerance
    totalAccuracy += accuracy;
  });

  return {
    accuracy: Math.round((totalAccuracy / recordsWithPredictions.length) * 100),
    sampleSize: recordsWithPredictions.length
  };
};

module.exports = {
  getMaintenanceAlerts,
  getMaintenanceForecast,
  scheduleMaintenance,
  updateMaintenance,
  getMaintenanceHistory,
  getMaintenanceAnalytics
};
