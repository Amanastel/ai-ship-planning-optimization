const express = require('express');
const {
  getMaintenanceAlerts,
  getMaintenanceForecast,
  scheduleMaintenance,
  updateMaintenance,
  getMaintenanceHistory,
  getMaintenanceAnalytics
} = require('../controllers/maintenanceController');

const router = express.Router();

// @route   GET /api/v1/maintenance/alerts
// @desc    Get maintenance alerts and recommendations
// @access  Public
router.get('/alerts', getMaintenanceAlerts);

// @route   GET /api/v1/maintenance/forecast/:shipId
// @desc    Get detailed maintenance forecast for a specific ship
// @access  Public
router.get('/forecast/:shipId', getMaintenanceForecast);

// @route   POST /api/v1/maintenance/schedule
// @desc    Schedule maintenance based on AI recommendations
// @access  Public
router.post('/schedule', scheduleMaintenance);

// @route   PUT /api/v1/maintenance/:maintenanceId
// @desc    Update maintenance record
// @access  Public
router.put('/:maintenanceId', updateMaintenance);

// @route   GET /api/v1/maintenance/history/:shipId
// @desc    Get maintenance history for a ship
// @access  Public
router.get('/history/:shipId', getMaintenanceHistory);

// @route   GET /api/v1/maintenance/analytics
// @desc    Get maintenance analytics and insights
// @access  Public
router.get('/analytics', getMaintenanceAnalytics);

module.exports = router;
