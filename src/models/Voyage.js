const mongoose = require('mongoose');

const voyageSchema = new mongoose.Schema({
  voyageId: {
    type: String,
    required: true,
    unique: true
  },
  shipId: {
    type: String,
    required: true,
    ref: 'Ship'
  },
  origin: {
    name: {
      type: String,
      required: true
    },
    coordinates: {
      latitude: {
        type: Number,
        required: true,
        min: -90,
        max: 90
      },
      longitude: {
        type: Number,
        required: true,
        min: -180,
        max: 180
      }
    },
    port: String
  },
  destination: {
    name: {
      type: String,
      required: true
    },
    coordinates: {
      latitude: {
        type: Number,
        required: true,
        min: -90,
        max: 90
      },
      longitude: {
        type: Number,
        required: true,
        min: -180,
        max: 180
      }
    },
    port: String
  },
  departureTime: {
    type: Date,
    required: true
  },
  estimatedArrival: Date,
  actualArrival: Date,
  cargoLoad: {
    weight: {
      type: Number,
      required: true,
      min: 0
    },
    type: {
      type: String,
      required: true
    },
    value: Number
  },
  weatherForecast: [{
    timestamp: Date,
    conditions: String,
    windSpeed: Number,
    waveHeight: Number,
    temperature: Number,
    visibility: Number
  }],
  plannedRoute: {
    waypoints: [{
      latitude: Number,
      longitude: Number,
      timestamp: Date,
      speed: Number
    }],
    totalDistance: Number,
    estimatedDuration: Number
  },
  actualRoute: {
    waypoints: [{
      latitude: Number,
      longitude: Number,
      timestamp: Date,
      speed: Number
    }],
    totalDistance: Number,
    actualDuration: Number
  },
  fuelPrediction: {
    estimatedConsumption: Number,
    actualConsumption: Number,
    efficiency: Number
  },
  optimizationMetrics: {
    routeEfficiency: Number,
    fuelEfficiency: Number,
    timeEfficiency: Number,
    costSavings: Number
  },
  status: {
    type: String,
    enum: ['planned', 'in-progress', 'completed', 'cancelled', 'delayed'],
    default: 'planned'
  },
  aiRecommendations: {
    optimalSpeed: Number,
    alternativeRoutes: [{
      route: [{ latitude: Number, longitude: Number }],
      estimatedTime: Number,
      estimatedFuel: Number,
      riskFactor: Number
    }],
    weatherAlerts: [String],
    maintenanceFlags: [String]
  }
}, {
  timestamps: true
});

// Indexes
voyageSchema.index({ shipId: 1 });
voyageSchema.index({ status: 1 });
voyageSchema.index({ departureTime: 1 });

module.exports = mongoose.model('Voyage', voyageSchema);
