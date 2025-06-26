const Ship = require('../models/Ship');
const Voyage = require('../models/Voyage');
const Maintenance = require('../models/Maintenance');
const logger = require('../utils/logger');

/**
 * Create a new ship
 * POST /api/v1/ships
 */
const createShip = async (req, res, next) => {
  try {
    const shipData = req.body;

    // Check if ship with same shipId already exists
    const existingShip = await Ship.findOne({ shipId: shipData.shipId });
    if (existingShip) {
      return res.status(400).json({
        success: false,
        error: 'Ship with this ID already exists'
      });
    }

    const ship = new Ship(shipData);
    await ship.save();

    logger.info(`New ship created: ${ship.shipId}`);

    res.status(201).json({
      success: true,
      data: ship,
      message: 'Ship created successfully'
    });

  } catch (error) {
    logger.error('Error creating ship:', error);
    next(error);
  }
};

/**
 * Get all ships with optional filtering
 * GET /api/v1/ships
 */
const getShips = async (req, res, next) => {
  try {
    const {
      status,
      engineType,
      owner,
      page = 1,
      limit = 20,
      search
    } = req.query;

    // Build query
    const query = {};
    if (status) query.status = status;
    if (engineType) query.engineType = engineType;
    if (owner) query.owner = new RegExp(owner, 'i');
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { shipId: new RegExp(search, 'i') },
        { owner: new RegExp(search, 'i') }
      ];
    }

    // Execute query with pagination
    const ships = await Ship.find(query)
      .sort({ name: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Ship.countDocuments(query);

    // Add summary statistics for each ship
    const shipsWithStats = await Promise.all(
      ships.map(async (ship) => {
        const stats = await getShipSummaryStats(ship.shipId);
        return {
          ...ship,
          stats
        };
      })
    );

    res.json({
      success: true,
      data: {
        ships: shipsWithStats,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalShips: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching ships:', error);
    next(error);
  }
};

/**
 * Get ship by ID with detailed information
 * GET /api/v1/ships/:shipId
 */
const getShipById = async (req, res, next) => {
  try {
    const { shipId } = req.params;

    const ship = await Ship.findOne({ shipId }).lean();
    if (!ship) {
      return res.status(404).json({
        success: false,
        error: 'Ship not found'
      });
    }

    // Get additional details
    const [voyageStats, maintenanceStats, recentVoyages, upcomingMaintenance] = await Promise.all([
      getVoyageStatistics(shipId),
      getMaintenanceStatistics(shipId),
      getRecentVoyages(shipId, 5),
      getUpcomingMaintenance(shipId, 5)
    ]);

    res.json({
      success: true,
      data: {
        ship,
        statistics: {
          voyages: voyageStats,
          maintenance: maintenanceStats
        },
        recentActivity: {
          voyages: recentVoyages,
          maintenance: upcomingMaintenance
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching ship details:', error);
    next(error);
  }
};

/**
 * Update ship information
 * PUT /api/v1/ships/:shipId
 */
const updateShip = async (req, res, next) => {
  try {
    const { shipId } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated
    delete updateData.shipId;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    const ship = await Ship.findOneAndUpdate(
      { shipId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!ship) {
      return res.status(404).json({
        success: false,
        error: 'Ship not found'
      });
    }

    logger.info(`Ship updated: ${shipId}`);

    res.json({
      success: true,
      data: ship,
      message: 'Ship updated successfully'
    });

  } catch (error) {
    logger.error('Error updating ship:', error);
    next(error);
  }
};

/**
 * Delete ship (soft delete by setting status to decommissioned)
 * DELETE /api/v1/ships/:shipId
 */
const deleteShip = async (req, res, next) => {
  try {
    const { shipId } = req.params;

    // Check for active voyages
    const activeVoyages = await Voyage.countDocuments({
      shipId,
      status: { $in: ['planned', 'in-progress'] }
    });

    if (activeVoyages > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete ship with active voyages. Complete or cancel all active voyages first.'
      });
    }

    // Soft delete by updating status
    const ship = await Ship.findOneAndUpdate(
      { shipId },
      { status: 'decommissioned' },
      { new: true }
    );

    if (!ship) {
      return res.status(404).json({
        success: false,
        error: 'Ship not found'
      });
    }

    logger.info(`Ship decommissioned: ${shipId}`);

    res.json({
      success: true,
      message: 'Ship decommissioned successfully'
    });

  } catch (error) {
    logger.error('Error decommissioning ship:', error);
    next(error);
  }
};

/**
 * Update ship location
 * PUT /api/v1/ships/:shipId/location
 */
const updateShipLocation = async (req, res, next) => {
  try {
    const { shipId } = req.params;
    const { latitude, longitude, port } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude are required'
      });
    }

    const ship = await Ship.findOneAndUpdate(
      { shipId },
      {
        currentLocation: {
          latitude,
          longitude,
          port,
          timestamp: new Date()
        }
      },
      { new: true }
    );

    if (!ship) {
      return res.status(404).json({
        success: false,
        error: 'Ship not found'
      });
    }

    res.json({
      success: true,
      data: {
        shipId,
        currentLocation: ship.currentLocation
      },
      message: 'Ship location updated successfully'
    });

  } catch (error) {
    logger.error('Error updating ship location:', error);
    next(error);
  }
};

/**
 * Get ship fleet overview and analytics
 * GET /api/v1/ships/analytics/fleet
 */
const getFleetAnalytics = async (req, res, next) => {
  try {
    const { owner } = req.query;

    // Build query
    const query = { status: { $ne: 'decommissioned' } };
    if (owner) query.owner = owner;

    // Get ships
    const ships = await Ship.find(query).lean();

    // Calculate fleet statistics
    const analytics = {
      overview: {
        totalShips: ships.length,
        activeShips: ships.filter(s => s.status === 'active').length,
        inMaintenanceShips: ships.filter(s => s.status === 'maintenance').length,
        averageAge: ships.length > 0 ? 
          Math.round(ships.reduce((sum, s) => sum + (new Date().getFullYear() - (s.yearBuilt || 2010)), 0) / ships.length) : 0
      },
      capacity: {
        totalCapacity: ships.reduce((sum, s) => sum + (s.capacity || 0), 0),
        averageCapacity: ships.length > 0 ? 
          Math.round(ships.reduce((sum, s) => sum + (s.capacity || 0), 0) / ships.length) : 0
      },
      engineTypes: calculateEngineTypeDistribution(ships),
      ageDistribution: calculateAgeDistribution(ships),
      utilizationMetrics: await calculateFleetUtilization(ships)
    };

    // Get recent fleet activity
    const recentActivity = await getFleetActivity(ships.map(s => s.shipId));

    res.json({
      success: true,
      data: {
        analytics,
        recentActivity,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error fetching fleet analytics:', error);
    next(error);
  }
};

/**
 * Helper function to get ship summary statistics
 */
const getShipSummaryStats = async (shipId) => {
  const [voyageCount, maintenanceCount, lastVoyage] = await Promise.all([
    Voyage.countDocuments({ shipId }),
    Maintenance.countDocuments({ shipId }),
    Voyage.findOne({ shipId }, {}, { sort: { departureTime: -1 } })
  ]);

  return {
    totalVoyages: voyageCount,
    totalMaintenance: maintenanceCount,
    lastVoyageDate: lastVoyage?.departureTime || null,
    status: 'operational' // This could be enhanced with real-time status
  };
};

/**
 * Helper function to get voyage statistics
 */
const getVoyageStatistics = async (shipId) => {
  const voyages = await Voyage.find({ shipId }).lean();
  
  if (voyages.length === 0) {
    return {
      total: 0,
      completed: 0,
      inProgress: 0,
      planned: 0,
      totalDistance: 0,
      averageEfficiency: 0
    };
  }

  const completed = voyages.filter(v => v.status === 'completed');
  const totalDistance = voyages.reduce((sum, v) => sum + (v.plannedRoute?.totalDistance || 0), 0);
  const averageEfficiency = completed.length > 0 ? 
    completed.reduce((sum, v) => sum + (v.optimizationMetrics?.fuelEfficiency || 0), 0) / completed.length : 0;

  return {
    total: voyages.length,
    completed: completed.length,
    inProgress: voyages.filter(v => v.status === 'in-progress').length,
    planned: voyages.filter(v => v.status === 'planned').length,
    totalDistance: Math.round(totalDistance),
    averageEfficiency: Math.round(averageEfficiency)
  };
};

/**
 * Helper function to get maintenance statistics
 */
const getMaintenanceStatistics = async (shipId) => {
  const maintenanceRecords = await Maintenance.find({ shipId }).lean();
  
  if (maintenanceRecords.length === 0) {
    return {
      total: 0,
      completed: 0,
      scheduled: 0,
      overdue: 0,
      totalCost: 0,
      averageDowntime: 0
    };
  }

  const completed = maintenanceRecords.filter(m => m.status === 'completed');
  const scheduled = maintenanceRecords.filter(m => m.status === 'scheduled');
  const overdue = scheduled.filter(m => new Date(m.scheduledDate) < new Date());
  
  const totalCost = completed.reduce((sum, m) => sum + (m.cost?.actual || m.cost?.estimated || 0), 0);
  const averageDowntime = completed.length > 0 ? 
    completed.reduce((sum, m) => sum + (m.actualDuration || m.estimatedDuration || 0), 0) / completed.length : 0;

  return {
    total: maintenanceRecords.length,
    completed: completed.length,
    scheduled: scheduled.length,
    overdue: overdue.length,
    totalCost: Math.round(totalCost),
    averageDowntime: Math.round(averageDowntime)
  };
};

/**
 * Helper function to get recent voyages
 */
const getRecentVoyages = async (shipId, limit = 5) => {
  return await Voyage.find({ shipId })
    .sort({ departureTime: -1 })
    .limit(limit)
    .select('voyageId origin destination departureTime status')
    .lean();
};

/**
 * Helper function to get upcoming maintenance
 */
const getUpcomingMaintenance = async (shipId, limit = 5) => {
  return await Maintenance.find({ 
    shipId, 
    status: 'scheduled',
    scheduledDate: { $gte: new Date() }
  })
    .sort({ scheduledDate: 1 })
    .limit(limit)
    .select('maintenanceId category scheduledDate priority description')
    .lean();
};

/**
 * Calculate engine type distribution
 */
const calculateEngineTypeDistribution = (ships) => {
  const distribution = {};
  ships.forEach(ship => {
    const engineType = ship.engineType || 'unknown';
    distribution[engineType] = (distribution[engineType] || 0) + 1;
  });
  return distribution;
};

/**
 * Calculate age distribution
 */
const calculateAgeDistribution = (ships) => {
  const currentYear = new Date().getFullYear();
  const ageGroups = {
    '0-5': 0,
    '6-10': 0,
    '11-15': 0,
    '16-20': 0,
    '20+': 0
  };

  ships.forEach(ship => {
    const age = currentYear - (ship.yearBuilt || currentYear);
    if (age <= 5) ageGroups['0-5']++;
    else if (age <= 10) ageGroups['6-10']++;
    else if (age <= 15) ageGroups['11-15']++;
    else if (age <= 20) ageGroups['16-20']++;
    else ageGroups['20+']++;
  });

  return ageGroups;
};

/**
 * Calculate fleet utilization metrics
 */
const calculateFleetUtilization = async (ships) => {
  const shipIds = ships.map(s => s.shipId);
  
  // Get voyages in the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const recentVoyages = await Voyage.find({
    shipId: { $in: shipIds },
    departureTime: { $gte: thirtyDaysAgo }
  }).lean();

  const activeShips = new Set(recentVoyages.map(v => v.shipId));
  const utilizationRate = ships.length > 0 ? (activeShips.size / ships.length) * 100 : 0;

  return {
    utilizationRate: Math.round(utilizationRate),
    activeShipsLast30Days: activeShips.size,
    totalVoyagesLast30Days: recentVoyages.length,
    averageVoyagesPerShip: activeShips.size > 0 ? 
      Math.round(recentVoyages.length / activeShips.size) : 0
  };
};

/**
 * Get recent fleet activity
 */
const getFleetActivity = async (shipIds) => {
  const [recentVoyages, recentMaintenance] = await Promise.all([
    Voyage.find({ shipId: { $in: shipIds } })
      .sort({ departureTime: -1 })
      .limit(10)
      .select('voyageId shipId origin destination departureTime status')
      .lean(),
    Maintenance.find({ shipId: { $in: shipIds } })
      .sort({ scheduledDate: -1 })
      .limit(10)
      .select('maintenanceId shipId category scheduledDate status priority')
      .lean()
  ]);

  return {
    recentVoyages,
    recentMaintenance
  };
};

module.exports = {
  createShip,
  getShips,
  getShipById,
  updateShip,
  deleteShip,
  updateShipLocation,
  getFleetAnalytics
};
