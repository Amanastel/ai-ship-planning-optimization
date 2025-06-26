#!/bin/bash

# Production Deployment Script for Ship Planning AI System
# This script sets up the production environment

echo "🚢 Starting Ship Planning AI System Deployment..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create production environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating production environment file..."
    cp .env.example .env
    echo "⚠️  Please update the .env file with your production settings before running again."
    exit 1
fi

# Build and start services
echo "🏗️  Building Docker images..."
docker-compose build

echo "🚀 Starting services..."
docker-compose up -d

# Wait for MongoDB to be ready
echo "⏳ Waiting for MongoDB to be ready..."
sleep 10

# Initialize MongoDB with sample data
echo "📊 Initializing database..."
docker-compose exec mongo mongosh --eval "load('/docker-entrypoint-initdb.d/init-mongo.js')"

# Check if services are running
echo "🔍 Checking service status..."
docker-compose ps

echo "✅ Deployment completed!"
echo "🌐 API is available at: http://localhost:3000"
echo "📖 API Documentation: http://localhost:3000"
echo "🔧 Health Check: http://localhost:3000/health"

echo ""
echo "📋 Available Endpoints:"
echo "  • Voyages: http://localhost:3000/api/v1/voyages"
echo "  • Maintenance: http://localhost:3000/api/v1/maintenance"
echo "  • Ships: http://localhost:3000/api/v1/ships"

echo ""
echo "🛠️  To stop services: docker-compose down"
echo "📝 To view logs: docker-compose logs -f"
echo "🔄 To restart: docker-compose restart"
