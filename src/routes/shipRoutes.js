const express = require('express');
const {
  createShip,
  getShips,
  getShipById,
  updateShip,
  deleteShip,
  updateShipLocation,
  getFleetAnalytics
} = require('../controllers/shipController');

const router = express.Router();

// @route   GET /api/v1/ships/analytics/fleet
// @desc    Get ship fleet overview and analytics
// @access  Public
router.get('/analytics/fleet', getFleetAnalytics);

// @route   POST /api/v1/ships
// @desc    Create a new ship
// @access  Public
router.post('/', createShip);

// @route   GET /api/v1/ships
// @desc    Get all ships with optional filtering
// @access  Public
router.get('/', getShips);

// @route   GET /api/v1/ships/:shipId
// @desc    Get ship by ID with detailed information
// @access  Public
router.get('/:shipId', getShipById);

// @route   PUT /api/v1/ships/:shipId
// @desc    Update ship information
// @access  Public
router.put('/:shipId', updateShip);

// @route   DELETE /api/v1/ships/:shipId
// @desc    Delete ship (soft delete)
// @access  Public
router.delete('/:shipId', deleteShip);

// @route   PUT /api/v1/ships/:shipId/location
// @desc    Update ship location
// @access  Public
router.put('/:shipId/location', updateShipLocation);

module.exports = router;
