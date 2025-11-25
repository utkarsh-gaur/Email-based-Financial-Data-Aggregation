#!/bin/bash
# Quick setup script for Email-based Financial Data Aggregation

echo "🚀 Setting up Email-based Financial Data Aggregation..."
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check Python
if ! command -v python &> /dev/null && ! command -v python3 &> /dev/null; then
    echo "❌ Python is not installed. Please install Python 3.8 or higher."
    exit 1
fi

PYTHON_CMD="python"
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
fi

echo "✅ Python found: $($PYTHON_CMD --version)"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16 or higher."
    exit 1
fi
echo "✅ Node.js found: $(node --version)"

# Check Redis
if ! command -v redis-server &> /dev/null; then
    echo "⚠️  Redis not found. Please install Redis server."
    echo "   Ubuntu/Debian: sudo apt-get install redis-server"
    echo "   macOS: brew install redis"
    echo "   Windows: Download from https://redis.io/download"
fi

echo ""
echo "📦 Installing Python dependencies..."
echo "   (Only pikepdf is needed for PDF unlocking)"
$PYTHON_CMD -m pip install pikepdf

echo ""
echo "📦 Installing backend dependencies..."
cd backend
npm install
cd ..

echo ""
echo "📦 Installing frontend dependencies..."
cd ui
npm install
cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Create .env file with your GEMINI_API_KEY"
echo "2. Add credentials.json from Google Cloud Console"
echo "3. Start Redis: redis-server"
echo "4. Start backend: cd backend && npm start"
echo "5. Start frontend: cd ui && npm run dev"
echo ""
echo "📚 See README.md for detailed instructions"
