const mongoose = require('mongoose');

const shipSchema = new mongoose.Schema({
  shipId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  engineType: {
    type: String,
    required: true,
    enum: ['diesel', 'gas-turbine', 'hybrid', 'electric'],
    default: 'diesel'
  },
  capacity: {
    type: Number,
    required: true,
    min: 0
  },
  maxSpeed: {
    type: Number,
    required: true,
    min: 0
  },
  fuelTankCapacity: {
    type: Number,
    required: true,
    min: 0
  },
  specifications: {
    length: Number,
    width: Number,
    draft: Number,
    grossTonnage: Number,
    deadweight: Number
  },
  owner: {
    type: String,
    required: true
  },
  yearBuilt: {
    type: Number,
    min: 1900,
    max: new Date().getFullYear()
  },
  status: {
    type: String,
    enum: ['active', 'maintenance', 'decommissioned'],
    default: 'active'
  },
  currentLocation: {
    latitude: {
      type: Number,
      min: -90,
      max: 90
    },
    longitude: {
      type: Number,
      min: -180,
      max: 180
    },
    port: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  lastMaintenance: {
    type: Date
  },
  nextScheduledMaintenance: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for performance
shipSchema.index({ status: 1 });
shipSchema.index({ owner: 1 });

module.exports = mongoose.model('Ship', shipSchema);
