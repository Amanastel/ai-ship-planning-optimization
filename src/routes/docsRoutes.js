const express = require('express');
const router = express.Router();

/**
 * API Documentation endpoint
 * GET /api/docs
 */
router.get('/', (req, res) => {
  const documentation = {
    title: '🚢 AI-Powered Ship Planning & Optimization System API',
    version: '1.0.0',
    description: 'RESTful APIs for voyage planning, fuel optimization, and maintenance scheduling using AI/ML models',
    baseUrl: `${req.protocol}://${req.get('host')}`,
    authentication: 'None (for demo purposes)',
    
    endpoints: {
      health: {
        path: '/health',
        method: 'GET',
        description: 'Health check endpoint',
        response: {
          status: 'OK',
          timestamp: '2025-06-27T00:00:00.000Z',
          uptime: 123.45,
          environment: 'production'
        }
      },
      
      voyages: {
        basePath: '/api/v1/voyages',
        endpoints: {
          planVoyage: {
            path: '/plan-voyage',
            method: 'POST',
            description: 'Plan an optimized voyage using AI',
            requestBody: {
              shipId: 'SHIP-001',
              origin: {
                name: 'New York',
                coordinates: { latitude: 40.7128, longitude: -74.0060 }
              },
              destination: {
                name: 'London',
                coordinates: { latitude: 51.5074, longitude: -0.1278 }
              },
              departureTime: '2025-07-01T10:00:00Z',
              cargoLoad: {
                weight: 15000,
                type: 'containers'
              }
            }
          },
          
          getPlanHistory: {
            path: '/plan-history',
            method: 'GET',
            description: 'Get voyage planning history',
            queryParams: {
              shipId: 'string (optional)',
              status: 'string (optional): planned|in-progress|completed|cancelled',
              limit: 'number (optional, default: 50)',
              page: 'number (optional, default: 1)'
            }
          },
          
          submitFeedback: {
            path: '/feedback',
            method: 'POST',
            description: 'Submit voyage feedback for AI model improvement',
            requestBody: {
              voyageId: 'string',
              actualRoute: 'object',
              actualFuelConsumption: 'number',
              actualDuration: 'number',
              actualArrival: 'ISO date string'
            }
          },
          
          getVoyageById: {
            path: '/:voyageId',
            method: 'GET',
            description: 'Get specific voyage details'
          },
          
          updateVoyageStatus: {
            path: '/:voyageId/status',
            method: 'PUT',
            description: 'Update voyage status',
            requestBody: {
              status: 'string: planned|in-progress|completed|cancelled',
              currentLocation: 'object (optional)'
            }
          }
        }
      },
      
      maintenance: {
        basePath: '/api/v1/maintenance',
        endpoints: {
          getAlerts: {
            path: '/alerts',
            method: 'GET',
            description: 'Get maintenance alerts and recommendations',
            queryParams: {
              shipId: 'string (optional)',
              priority: 'string (optional): low|medium|high|critical'
            }
          },
          
          getForecast: {
            path: '/forecast/:shipId',
            method: 'GET',
            description: 'Get detailed maintenance forecast for a specific ship'
          },
          
          scheduleMaintenance: {
            path: '/schedule',
            method: 'POST',
            description: 'Schedule maintenance based on AI recommendations',
            requestBody: {
              shipId: 'string',
              type: 'string: scheduled|preventive|corrective|emergency|overhaul|inspection',
              category: 'string: engine|hull|electrical|navigation|safety|deck',
              scheduledDate: 'ISO date string',
              description: 'string'
            }
          },
          
          updateMaintenance: {
            path: '/:maintenanceId',
            method: 'PUT',
            description: 'Update maintenance record'
          },
          
          getHistory: {
            path: '/history',
            method: 'GET',
            description: 'Get maintenance history',
            queryParams: {
              shipId: 'string (optional)',
              status: 'string (optional)',
              limit: 'number (optional)',
              page: 'number (optional)'
            }
          },
          
          getAnalytics: {
            path: '/analytics',
            method: 'GET',
            description: 'Get maintenance analytics and insights',
            queryParams: {
              timeframe: 'string (optional): 1month|3months|6months|12months',
              shipId: 'string (optional)'
            }
          }
        }
      },
      
      ships: {
        basePath: '/api/v1/ships',
        endpoints: {
          getShips: {
            path: '/',
            method: 'GET',
            description: 'Get list of ships',
            queryParams: {
              status: 'string (optional): active|maintenance|decommissioned',
              owner: 'string (optional)',
              engineType: 'string (optional): diesel|gas-turbine|hybrid|electric',
              limit: 'number (optional)',
              page: 'number (optional)'
            }
          },
          
          getShipById: {
            path: '/:shipId',
            method: 'GET',
            description: 'Get specific ship details'
          },
          
          createShip: {
            path: '/',
            method: 'POST',
            description: 'Register a new ship',
            requestBody: {
              shipId: 'string',
              name: 'string',
              engineType: 'string: diesel|gas-turbine|hybrid|electric',
              capacity: 'number',
              maxSpeed: 'number',
              fuelTankCapacity: 'number',
              owner: 'string'
            }
          },
          
          updateShip: {
            path: '/:shipId',
            method: 'PUT',
            description: 'Update ship information'
          },
          
          getFleetAnalytics: {
            path: '/analytics/fleet',
            method: 'GET',
            description: 'Get fleet analytics and insights',
            queryParams: {
              owner: 'string (optional)'
            }
          }
        }
      }
    },
    
    aiFeatures: {
      routeOptimization: {
        description: 'Neural network-based route optimization considering weather, cargo, and operational constraints',
        features: [
          'Real-time weather integration',
          'Fuel efficiency optimization',
          'Dynamic waypoint adjustment',
          'Risk assessment and mitigation'
        ]
      },
      
      fuelPrediction: {
        description: 'Machine learning model for accurate fuel consumption prediction',
        features: [
          'Historical consumption analysis',
          'Weather impact modeling',
          'Load and speed optimization',
          'Cost estimation and savings calculation'
        ]
      },
      
      maintenanceForecasting: {
        description: 'Predictive maintenance system using usage analytics and component lifecycle data',
        features: [
          'Component failure prediction',
          'Maintenance scheduling optimization',
          'Cost-benefit analysis',
          'Risk scoring and prioritization'
        ]
      }
    },
    
    responseFormat: {
      success: {
        success: true,
        data: 'Response data object',
        message: 'Optional success message'
      },
      error: {
        success: false,
        error: 'Error message',
        details: 'Optional error details'
      }
    },
    
    statusCodes: {
      200: 'Success',
      201: 'Created',
      400: 'Bad Request - Invalid input',
      404: 'Not Found - Resource not found',
      500: 'Internal Server Error'
    },
    
    examples: {
      planVoyage: {
        request: 'POST /api/v1/voyages/plan-voyage',
        body: {
          shipId: 'SHIP-001',
          origin: {
            name: 'New York',
            coordinates: { latitude: 40.7128, longitude: -74.0060 }
          },
          destination: {
            name: 'London', 
            coordinates: { latitude: 51.5074, longitude: -0.1278 }
          },
          departureTime: '2025-07-01T10:00:00Z',
          cargoLoad: {
            weight: 15000,
            type: 'containers'
          }
        },
        response: {
          success: true,
          data: {
            voyageId: 'VOY-20250701-001',
            plannedRoute: {
              waypoints: [
                { latitude: 40.7128, longitude: -74.0060, timestamp: '2025-07-01T10:00:00Z' }
              ],
              totalDistance: 3459.2,
              estimatedDuration: 168
            },
            fuelPrediction: {
              estimatedConsumption: 245.8,
              efficiency: 87.5
            },
            optimizationMetrics: {
              routeEfficiency: 92.1,
              fuelEfficiency: 87.5,
              timeEfficiency: 85.0,
              costSavings: 12.5
            }
          }
        }
      }
    },
    
    technology: {
      backend: 'Node.js with Express.js',
      database: 'MongoDB with Mongoose ODM',
      aiFramework: 'TensorFlow.js',
      containerization: 'Docker and Docker Compose',
      cicd: 'GitHub Actions'
    },
    
    supportContact: {
      developer: 'Aman Kumar',
      email: 'support@ship-planning-ai.com',
      github: 'https://github.com/username/ship-planning-ai'
    }
  };
  
  res.json(documentation);
});

module.exports = router;
