<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# AI-Powered Ship Planning & Optimization System

## Project Overview
This is a backend service for an AI-powered ship planning and optimization system that uses machine learning models to improve operational efficiency and optimize voyage planning, fuel usage, and maintenance scheduling for commercial vessels.

## Architecture
- **Backend**: Node.js with Express.js
- **Database**: MongoDB with Mongoose ODM
- **AI/ML**: TensorFlow.js for neural networks
- **Containerization**: Docker and Docker Compose
- **CI/CD**: GitHub Actions

## Key Components
1. **Route Optimization AI**: Neural network for optimizing ship routes based on weather, cargo, and operational constraints
2. **Fuel Prediction AI**: Machine learning model for predicting fuel consumption with high accuracy
3. **Maintenance Forecasting AI**: Predictive maintenance system using usage analytics and component lifecycle data

## API Endpoints
- `/api/v1/voyages/*` - Voyage planning and optimization
- `/api/v1/maintenance/*` - Maintenance alerts and forecasting
- `/api/v1/ships/*` - Ship management and fleet analytics

## Development Guidelines
- Follow RESTful API design principles
- Use async/await for asynchronous operations
- Implement proper error handling and logging
- Write comprehensive JSDoc comments
- Use MongoDB aggregation pipelines for complex queries
- Implement rate limiting and security best practices

## AI Model Guidelines
- Use TensorFlow.js for consistency across the platform
- Implement continuous learning capabilities
- Normalize input data appropriately
- Include confidence scores in predictions
- Handle model initialization and training gracefully

## Testing
- Write unit tests for controllers and services
- Use supertest for API endpoint testing
- Mock external dependencies and AI models in tests
- Maintain good test coverage
