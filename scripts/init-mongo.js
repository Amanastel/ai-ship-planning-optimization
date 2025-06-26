// MongoDB initialization script
// This script runs when the MongoDB container starts for the first time

db = db.getSiblingDB('ship-planning');

// Create collections with validation
db.createCollection('ships', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['shipId', 'name', 'engineType', 'capacity'],
      properties: {
        shipId: {
          bsonType: 'string',
          description: 'Unique ship identifier'
        },
        name: {
          bsonType: 'string',
          description: 'Ship name'
        },
        engineType: {
          bsonType: 'string',
          enum: ['diesel', 'gas-turbine', 'hybrid', 'electric'],
          description: 'Type of ship engine'
        },
        capacity: {
          bsonType: 'number',
          minimum: 0,
          description: 'Ship cargo capacity in tons'
        }
      }
    }
  }
});

db.createCollection('voyages', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['voyageId', 'shipId', 'origin', 'destination'],
      properties: {
        voyageId: {
          bsonType: 'string',
          description: 'Unique voyage identifier'
        },
        shipId: {
          bsonType: 'string',
          description: 'Reference to ship'
        }
      }
    }
  }
});

db.createCollection('maintenance', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['maintenanceId', 'shipId', 'type', 'category'],
      properties: {
        maintenanceId: {
          bsonType: 'string',
          description: 'Unique maintenance identifier'
        },
        shipId: {
          bsonType: 'string',
          description: 'Reference to ship'
        },
        type: {
          bsonType: 'string',
          enum: ['scheduled', 'preventive', 'corrective', 'emergency', 'overhaul', 'inspection'],
          description: 'Type of maintenance'
        }
      }
    }
  }
});

// Create indexes for performance
db.ships.createIndex({ shipId: 1 }, { unique: true });
db.ships.createIndex({ status: 1 });
db.ships.createIndex({ owner: 1 });

db.voyages.createIndex({ voyageId: 1 }, { unique: true });
db.voyages.createIndex({ shipId: 1 });
db.voyages.createIndex({ status: 1 });
db.voyages.createIndex({ departureTime: -1 });

db.maintenance.createIndex({ maintenanceId: 1 }, { unique: true });
db.maintenance.createIndex({ shipId: 1, scheduledDate: 1 });
db.maintenance.createIndex({ status: 1 });
db.maintenance.createIndex({ priority: 1 });

db.fuellogs.createIndex({ shipId: 1, timestamp: -1 });
db.fuellogs.createIndex({ voyageId: 1 });

// Insert sample data
db.ships.insertMany([
  {
    shipId: 'SHIP-001',
    name: 'Atlantic Pioneer',
    engineType: 'diesel',
    capacity: 25000,
    maxSpeed: 22,
    fuelTankCapacity: 1500,
    specifications: {
      length: 180,
      width: 28,
      draft: 10,
      grossTonnage: 15000,
      deadweight: 25000
    },
    owner: 'Maritime Logistics Corp',
    yearBuilt: 2015,
    status: 'active',
    currentLocation: {
      latitude: 40.7128,
      longitude: -74.0060,
      port: 'New York',
      timestamp: new Date()
    }
  },
  {
    shipId: 'SHIP-002',
    name: 'Pacific Explorer',
    engineType: 'hybrid',
    capacity: 35000,
    maxSpeed: 20,
    fuelTankCapacity: 2000,
    specifications: {
      length: 200,
      width: 32,
      draft: 12,
      grossTonnage: 20000,
      deadweight: 35000
    },
    owner: 'Global Shipping Inc',
    yearBuilt: 2018,
    status: 'active',
    currentLocation: {
      latitude: 34.0522,
      longitude: -118.2437,
      port: 'Los Angeles',
      timestamp: new Date()
    }
  }
]);

print('MongoDB initialization completed successfully!');
