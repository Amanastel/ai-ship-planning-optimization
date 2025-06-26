const express = require('express');
const {
  planVoyage,
  getPlanHistory,
  submitFeedback,
  getVoyageById,
  updateVoyageStatus
} = require('../controllers/voyageController');

const router = express.Router();

// @route   POST /api/v1/voyages/plan-voyage
// @desc    Plan a new voyage with AI optimization
// @access  Public
router.post('/plan-voyage', planVoyage);

// @route   GET /api/v1/voyages/plan-history
// @desc    Get voyage history with performance metrics
// @access  Public
router.get('/plan-history', getPlanHistory);

// @route   POST /api/v1/voyages/feedback
// @desc    Submit voyage feedback for AI learning
// @access  Public
router.post('/feedback', submitFeedback);

// @route   GET /api/v1/voyages/:voyageId
// @desc    Get voyage details by ID
// @access  Public
router.get('/:voyageId', getVoyageById);

// @route   PUT /api/v1/voyages/:voyageId/status
// @desc    Update voyage status
// @access  Public
router.put('/:voyageId/status', updateVoyageStatus);

module.exports = router;
