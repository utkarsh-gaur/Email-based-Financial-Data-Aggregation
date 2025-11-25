# Email-based Financial Data Aggregation

A comprehensive system for aggregating and analyzing financial data from bank statement PDFs received via email. The system automatically fetches PDFs from Gmail, unlocks password-protected files, extracts transaction data, and provides AI-powered financial analysis.

## 🌟 Features

- **Gmail Integration**: Automatically fetches bank statement PDFs from Gmail
- **Smart PDF Unlocking**: Generates password candidates based on user information and successfully unlocks encrypted PDFs
- **Password Management**: Automatically saves successful passwords for faster future unlocking
- **Bank Detection**: Identifies banks from email subjects, filenames, and PDF content
- **Text Extraction**: Extracts text from PDFs with fallback to OCR for scanned documents
- **AI Analysis**: Uses Google Gemini AI to analyze financial statements and extract insights
- **User Management**: SQLite database for managing users and their bank associations
- **Redis Caching**: Efficient caching of PDF metadata and authentication tokens
- **React Frontend**: Modern UI for user interaction and data visualization

## 🏗️ Architecture

```
Email-based-Financial-Data-Aggregation/
├── backend/                 # Node.js Express backend
│   ├── server.js           # Main server with API endpoints
│   ├── db/                 # Database configuration
│   │   └── database.js     # SQLite setup and migrations
│   └── services/           # Core services
│       ├── gmailService.js      # Gmail API integration
│       ├── pdfService.js        # PDF processing
│       ├── unlock_pdf.py        # Python PDF unlocking script
│       ├── passwordGenerator.js # Password candidate generation
│       ├── bankDetection.js     # Bank identification
│       └── analysisService.js   # AI analysis integration
├── ui/                     # React frontend
├── temp_pdfs/             # Temporary storage for downloaded PDFs
├── users.db               # SQLite database
└── credentials.json       # Google OAuth credentials
```

## 📋 Prerequisites

### Required Software
- **Node.js** (v16 or higher)
- **Python** (v3.8 or higher)
- **Redis** server
- **Tesseract OCR** (optional, for scanned PDFs)
  - Windows: https://github.com/tesseract-ocr/tesseract
  - Linux: `sudo apt-get install tesseract-ocr`
  - macOS: `brew install tesseract`

### API Keys
- **Google Cloud Project** with Gmail API enabled
- **Google Gemini API** key for AI analysis

## 🚀 Installation

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/Email-based-Financial-Data-Aggregation.git
cd Email-based-Financial-Data-Aggregation
```

### 2. Backend Setup

#### Install Python Dependencies
The project uses Python only for PDF unlocking via `pikepdf`.

```bash
# Install pikepdf (required for PDF unlocking)
pip install pikepdf

# Or use requirements.txt
pip install -r requirements.txt
```

**Note**: No virtual environment is strictly necessary since we only need one package, but you can use one if preferred:
```bash
python -m venv .venv
# Windows
.\.venv\Scripts\Activate.ps1
# Linux/macOS
source .venv/bin/activate

pip install -r requirements.txt
```

#### Install Node.js Dependencies
```bash
cd backend
npm install
```

#### Configure Environment Variables
Create a `.env` file in the root directory:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

#### Setup Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Gmail API
4. Create OAuth 2.0 credentials
5. Download credentials and save as `credentials.json` in the root directory
6. Add authorized redirect URI: `http://localhost:8000/oauth/callback`

### 3. Frontend Setup
```bash
cd ui
npm install
```

### 4. Start Redis Server
```bash
# Windows (if installed via MSI)
redis-server

# Linux/macOS
redis-server

# Or using Docker
docker run -d -p 6379:6379 redis
```

## 🎯 Usage

### Start the Backend Server
```bash
cd backend
npm start
# Server runs on http://localhost:8000
```

### Start the Frontend
```bash
cd ui
npm run dev
# UI runs on http://localhost:5173
```

### API Endpoints

#### User Management
- `POST /users` - Create a new user
  ```json
  {
    "full_name": "John Doe",
    "dob": "1990-01-15",
    "mobile": "9876543210"
  }
  ```
- `GET /users` - Get all users
- `GET /users/:user_id` - Get specific user

#### Authentication & PDF Processing
- `GET /auth?user_id=<user_id>` - Initiate Gmail OAuth flow
- `GET /oauth/callback` - OAuth callback (automatic)
- `POST /analyze` - Analyze PDFs for a user
  ```json
  {
    "user_id": "user-uuid-here"
  }
  ```

#### PDF Management
- `GET /pdfs` - List all PDFs in temp directory

## 🔐 Password Generation

The system generates password candidates using:
- User's full name (first name, last name, initials)
- Date of birth (various formats)
- Mobile number (last 4 digits, full number)
- Bank-specific patterns

### Supported Banks
- HDFC Bank
- State Bank of India (SBI)
- ICICI Bank
- Kotak Mahindra Bank
- Bank of Baroda
- Axis Bank
- And 15+ more Indian banks

## 💾 Database Schema

### Users Table
```sql
CREATE TABLE users (
    user_id TEXT PRIMARY KEY,
    full_name TEXT,
    dob TEXT,
    mobile TEXT
)
```

### User Banks Table
```sql
CREATE TABLE user_banks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    password TEXT,
    first_seen_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    UNIQUE(user_id, bank_name)
)
```

## 🔄 How It Works

### 1. Gmail Authentication Flow
1. User initiates OAuth flow via `/auth` endpoint
2. System redirects to Google for authentication
3. User grants Gmail access
4. System receives tokens and stores in Redis
5. Automatically fetches emails with PDF attachments
6. Detects bank from email subject/sender
7. Downloads PDFs with UUID filenames
8. Stores PDF metadata (path, bank, filename) in Redis

### 2. PDF Analysis Flow
1. User triggers `/analyze` endpoint
2. System retrieves user information from database
3. Generates password candidates based on user data
4. Attempts to unlock each PDF:
   - Tries saved passwords first (if available)
   - Then tries generated candidates
5. On successful unlock:
   - Detects bank from filename or Redis cache
   - Saves password to database for future use
6. Extracts text from unlocked PDF
7. Sends consolidated text to Gemini AI for analysis
8. Returns financial insights and transaction data

### 3. Password Saving Logic
- When a PDF is successfully unlocked with a password
- System detects the bank name from:
  1. Filename keywords (e.g., "hdfc", "sbi")
  2. Redis cache (for Gmail-downloaded PDFs)
- Saves password to `user_banks` table
- Future analyses try saved passwords first

## 🛠️ Development

### Running Tests
```bash
# Test password save logic
cd backend
node test_password_save.js

# Test PDF unlock flow
node test_unlock_flow.js

# Check database status
node check_recent_db.js
```

### Debugging
The system includes comprehensive logging:
- `[PASSWORD SAVE]` - Password saving operations
- `[UNLOCK RESULT]` - PDF unlock attempts
- `[PASSWORD CANDIDATES]` - Generated password lists

Enable debug mode by checking server console output.

## 📝 Configuration

### Adding New Banks
Edit `backend/services/bankDetection.js`:
```javascript
const bankKeywords = {
    "your bank name": ["keyword1", "keyword2"],
    // ...
};
```

### Customizing Password Generation
Edit `backend/services/passwordGenerator.js` to add new password patterns.

## 🔒 Security Considerations

- **OAuth Tokens**: Stored securely in Redis with expiration
- **Passwords**: Stored in local SQLite database (consider encryption for production)
- **PDF Files**: Automatically cleaned up on server restart
- **API Access**: Consider adding authentication for production use

## 🐛 Troubleshooting

### Passwords Not Saving
1. Ensure server is restarted after code changes
2. Check that PDFs are from Gmail (bank info in Redis)
3. Verify bank is detected (check logs for `[PASSWORD SAVE]`)
4. Ensure Redis is running

### PDF Unlock Fails
1. Verify Python is installed and accessible
2. Check that `pikepdf` is installed: `pip list | grep pikepdf`
3. Review password generation logic
4. Check server logs for Python errors

### Gmail Authentication Issues
1. Verify `credentials.json` is valid
2. Check redirect URI matches: `http://localhost:8000/oauth/callback`
3. Ensure Gmail API is enabled in Google Cloud Console

## 📄 License

This project is for educational and personal use. Ensure you have authorization to access and process financial documents.

## 🤝 Contributing

Contributions are welcome! Please ensure:
- Code follows existing patterns
- Add appropriate logging
- Test thoroughly before submitting PRs

## 📧 Support

For issues and questions, please open a GitHub issue.

## 🔮 Future Enhancements

- [ ] Encrypt stored passwords
- [ ] Add user authentication
- [ ] Support for more banks
- [ ] Export analysis to CSV/Excel
- [ ] Email notifications for new statements
- [ ] Multi-user support with role-based access
- [ ] Dashboard with financial visualizations
- [ ] Scheduled automatic processing
