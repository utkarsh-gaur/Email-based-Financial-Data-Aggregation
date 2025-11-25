# Quick setup script for Email-based Financial Data Aggregation (Windows)

Write-Host "🚀 Setting up Email-based Financial Data Aggregation..." -ForegroundColor Cyan
Write-Host ""

# Check prerequisites
Write-Host "📋 Checking prerequisites..." -ForegroundColor Yellow

# Check Python
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✅ Python found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Python is not installed. Please install Python 3.8 or higher." -ForegroundColor Red
    exit 1
}

# Check Node.js
try {
    $nodeVersion = node --version 2>&1
    Write-Host "✅ Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js is not installed. Please install Node.js 16 or higher." -ForegroundColor Red
    exit 1
}

# Check Redis
try {
    $redisCheck = redis-server --version 2>&1
    Write-Host "✅ Redis found" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Redis not found. Please install Redis server." -ForegroundColor Yellow
    Write-Host "   Download from: https://redis.io/download" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📦 Installing Python dependencies..." -ForegroundColor Yellow
Write-Host "   (Only pikepdf is needed for PDF unlocking)" -ForegroundColor Gray
python -m pip install pikepdf

Write-Host ""
Write-Host "📦 Installing backend dependencies..." -ForegroundColor Yellow
Set-Location backend
npm install
Set-Location ..

Write-Host ""
Write-Host "📦 Installing frontend dependencies..." -ForegroundColor Yellow
Set-Location ui
npm install
Set-Location ..

Write-Host ""
Write-Host "✅ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Cyan
Write-Host "1. Create .env file with your GEMINI_API_KEY"
Write-Host "2. Add credentials.json from Google Cloud Console"
Write-Host "3. Start Redis: redis-server"
Write-Host "4. Start backend: cd backend; npm start"
Write-Host "5. Start frontend: cd ui; npm run dev"
Write-Host ""
Write-Host "📚 See README.md for detailed instructions" -ForegroundColor Cyan
