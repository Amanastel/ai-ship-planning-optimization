const mongoose = require('mongoose');

const fuelLogSchema = new mongoose.Schema({
  shipId: {
    type: String,
    required: true,
    ref: 'Ship'
  },
  voyageId: {
    type: String,
    ref: 'Voyage'
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now
  },
  fuelType: {
    type: String,
    required: true,
    enum: ['diesel', 'heavy-fuel-oil', 'marine-gas-oil', 'lng', 'methanol']
  },
  consumption: {
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    unit: {
      type: String,
      default: 'liters',
      enum: ['liters', 'gallons', 'tons']
    }
  },
  efficiency: {
    type: Number,
    min: 0
  },
  location: {
    latitude: Number,
    longitude: Number
  },
  operatingConditions: {
    speed: Number,
    engineLoad: Number,
    weatherConditions: String,
    seaState: Number
  },
  cost: {
    pricePerUnit: Number,
    totalCost: Number,
    currency: {
      type: String,
      default: 'USD'
    }
  }
}, {
  timestamps: true
});

// Indexes
fuelLogSchema.index({ shipId: 1, timestamp: -1 });
fuelLogSchema.index({ voyageId: 1 });

module.exports = mongoose.model('FuelLog', fuelLogSchema);
