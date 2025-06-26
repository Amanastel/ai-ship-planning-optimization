const mongoose = require('mongoose');

const maintenanceSchema = new mongoose.Schema({
  maintenanceId: {
    type: String,
    required: true,
    unique: true
  },
  shipId: {
    type: String,
    required: true,
    ref: 'Ship'
  },
  type: {
    type: String,
    required: true,
    enum: [
      'scheduled',
      'preventive',
      'corrective',
      'emergency',
      'overhaul',
      'inspection'
    ]
  },
  category: {
    type: String,
    required: true,
    enum: [
      'engine',
      'hull',
      'navigation',
      'safety',
      'electrical',
      'propulsion',
      'deck-equipment',
      'accommodation'
    ]
  },
  description: {
    type: String,
    required: true
  },
  scheduledDate: {
    type: Date,
    required: true
  },
  completedDate: Date,
  estimatedDuration: {
    type: Number, // in hours
    required: true
  },
  actualDuration: Number,
  status: {
    type: String,
    enum: ['scheduled', 'in-progress', 'completed', 'cancelled', 'overdue'],
    default: 'scheduled'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  cost: {
    estimated: Number,
    actual: Number,
    currency: {
      type: String,
      default: 'USD'
    }
  },
  parts: [{
    name: String,
    quantity: Number,
    cost: Number
  }],
  technician: {
    name: String,
    certification: String,
    contact: String
  },
  aiPrediction: {
    predictedFailureDate: Date,
    riskScore: {
      type: Number,
      min: 0,
      max: 100
    },
    confidenceLevel: {
      type: Number,
      min: 0,
      max: 100
    },
    recommendedAction: String,
    factors: [String]
  },
  inspection: {
    preInspectionNotes: String,
    postInspectionNotes: String,
    findings: [String],
    recommendations: [String]
  },
  downtime: {
    estimated: Number, // in hours
    actual: Number
  }
}, {
  timestamps: true
});

// Indexes
maintenanceSchema.index({ shipId: 1, scheduledDate: 1 });
maintenanceSchema.index({ status: 1 });
maintenanceSchema.index({ priority: 1 });
maintenanceSchema.index({ 'aiPrediction.riskScore': -1 });

module.exports = mongoose.model('Maintenance', maintenanceSchema);
