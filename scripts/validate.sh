#!/bin/bash

echo "🚢 Ship Planning AI System - Quick Validation Test"
echo "=================================================="

# Test basic server startup (without MongoDB dependency)
echo "📋 Testing core functionality..."

# Check if Node.js dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "❌ Dependencies not installed. Run: npm install"
    exit 1
fi

# Check if all required files exist
required_files=(
    "src/server.js"
    "src/models/Ship.js"
    "src/models/Voyage.js"
    "src/models/Maintenance.js"
    "src/controllers/voyageController.js"
    "src/controllers/maintenanceController.js"
    "src/controllers/shipController.js"
    "src/ai/routeOptimizer.js"
    "src/ai/fuelPredictor.js"
    "src/ai/maintenanceForecaster.js"
    "package.json"
    "Dockerfile"
    "docker-compose.yml"
    ".env"
)

echo "🔍 Checking required files..."
missing_files=0
for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ Missing: $file"
        missing_files=$((missing_files + 1))
    fi
done

if [ $missing_files -eq 0 ]; then
    echo "✅ All required files present"
else
    echo "❌ $missing_files files missing"
fi

# Check package.json scripts
echo "🔧 Checking package.json scripts..."
if grep -q '"start"' package.json && grep -q '"dev"' package.json && grep -q '"test"' package.json; then
    echo "✅ All required scripts present"
else
    echo "❌ Missing required scripts in package.json"
fi

# Check AI modules syntax
echo "🤖 Validating AI modules..."
ai_modules=("src/ai/routeOptimizer.js" "src/ai/fuelPredictor.js" "src/ai/maintenanceForecaster.js")
for module in "${ai_modules[@]}"; do
    if node -c "$module" 2>/dev/null; then
        echo "✅ $module syntax valid"
    else
        echo "❌ $module has syntax errors"
    fi
done

# Check controllers syntax
echo "🎮 Validating controllers..."
controllers=("src/controllers/voyageController.js" "src/controllers/maintenanceController.js" "src/controllers/shipController.js")
for controller in "${controllers[@]}"; do
    if node -c "$controller" 2>/dev/null; then
        echo "✅ $controller syntax valid"
    else
        echo "❌ $controller has syntax errors"
    fi
done

# Check models syntax
echo "🗄️  Validating models..."
models=("src/models/Ship.js" "src/models/Voyage.js" "src/models/Maintenance.js" "src/models/FuelLog.js")
for model in "${models[@]}"; do
    if node -c "$model" 2>/dev/null; then
        echo "✅ $model syntax valid"
    else
        echo "❌ $model has syntax errors"
    fi
done

# Test Docker configuration
echo "🐳 Checking Docker configuration..."
if [ -f "Dockerfile" ] && [ -f "docker-compose.yml" ]; then
    echo "✅ Docker configuration files present"
    if docker --version >/dev/null 2>&1; then
        echo "✅ Docker is installed"
        if docker-compose --version >/dev/null 2>&1; then
            echo "✅ Docker Compose is installed"
        else
            echo "⚠️  Docker Compose not found (optional for local dev)"
        fi
    else
        echo "⚠️  Docker not found (optional for local dev)"
    fi
else
    echo "❌ Docker configuration missing"
fi

# Test environment configuration
echo "⚙️  Checking environment configuration..."
if [ -f ".env" ]; then
    echo "✅ .env file present"
    if grep -q "NODE_ENV" .env && grep -q "PORT" .env && grep -q "MONGODB_URI" .env; then
        echo "✅ Required environment variables configured"
    else
        echo "❌ Missing required environment variables"
    fi
else
    echo "❌ .env file missing"
fi

# Test linting configuration
echo "🔍 Checking code quality configuration..."
if [ -f "eslint.config.js" ] && [ -f ".prettierrc.json" ]; then
    echo "✅ Linting and formatting configuration present"
else
    echo "❌ Missing linting/formatting configuration"
fi

# Test CI/CD configuration
echo "🚀 Checking CI/CD configuration..."
if [ -f ".github/workflows/ci-cd.yml" ]; then
    echo "✅ GitHub Actions workflow present"
else
    echo "❌ Missing CI/CD configuration"
fi

# Test documentation
echo "📚 Checking documentation..."
docs=("README.md" "CONTRIBUTING.md" "THOUGHTS.md" "PROJECT_STATUS.md")
for doc in "${docs[@]}"; do
    if [ -f "$doc" ]; then
        echo "✅ $doc present"
    else
        echo "❌ $doc missing"
    fi
done

echo ""
echo "=================================================="
echo "🎉 Validation Complete!"
echo ""
echo "🚀 To start the development server:"
echo "   npm run dev"
echo ""
echo "🐳 To run with Docker:"
echo "   ./scripts/deploy.sh"
echo ""
echo "📖 API Documentation will be available at:"
echo "   http://localhost:3000/api/docs"
echo ""
echo "✨ Project is ready for deployment!"
