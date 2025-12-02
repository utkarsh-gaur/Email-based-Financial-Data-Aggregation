require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const db = require('./db/database');
const { autoProcessStatements, redisClient } = require('./services/gmailService');
const { listPdfs, unlockPdf, extractText } = require('./services/pdfService');
const { generatePasswordCandidates } = require('./services/passwordGenerator');
const { analyzeWithGemini } = require('./services/analysisService');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT ? Number(process.env.PORT) : 8000;
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

// --- Helper functions for async DB access ---
function dbGetAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbAllAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function dbRunAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

// --- Serve Vite build (if exists) ---
const UI_DIST = path.join(__dirname, '../ui/dist');
if (fs.existsSync(UI_DIST)) {
    app.use(express.static(UI_DIST));
    app.get('*', (req, res, next) => {
        const apiPrefixes = ['/users', '/auth', '/oauth', '/pdfs', '/analyze'];
        if (apiPrefixes.some(prefix => req.path.startsWith(prefix))) return next();
        res.sendFile(path.join(UI_DIST, 'index.html'));
    });
} else {
    console.warn('UI dist folder not found. Run `cd ui && npm run build`');
}

// --- User Routes ---
app.post('/users', async (req, res) => {
    try {
        const { full_name, dob, mobile } = req.body;
        if (!full_name || !dob || !mobile) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const user_id = uuidv4();
        await dbRunAsync(
            'INSERT INTO users (user_id, full_name, dob, mobile) VALUES (?, ?, ?, ?)',
            [user_id, full_name, dob, mobile]
        );
        res.status(201).json({ status: 'ok', user_id });
    } catch (err) {
        console.error('/users POST error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/users', async (req, res) => {
    try {
        const rows = await dbAllAsync('SELECT user_id, full_name, dob, mobile FROM users');
        if (!rows || rows.length === 0) return res.json([]);

        const users = [];
        for (const row of rows) {
            const banks = await dbAllAsync('SELECT bank_name FROM user_banks WHERE user_id = ?', [row.user_id]);
            users.push({
                ...row,
                banks: banks ? banks.map(b => b.bank_name) : []
            });
        }
        res.json(users);
    } catch (err) {
        console.error('/users GET error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/users/:user_id', async (req, res) => {
    try {
        const { user_id } = req.params;
        const row = await dbGetAsync('SELECT user_id, full_name, dob, mobile FROM users WHERE user_id = ?', [user_id]);
        if (!row) return res.status(404).json({ error: 'User not found' });

        const banks = await dbAllAsync('SELECT bank_name FROM user_banks WHERE user_id = ?', [user_id]);
        res.json({
            ...row,
            banks: banks ? banks.map(b => b.bank_name) : []
        });
    } catch (err) {
        console.error('/users/:user_id GET error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Auth Routes ---
app.get('/auth', async (req, res) => {
    try {
        const { user_id, client_type } = req.query;
        if (!user_id) return res.status(400).json({ error: 'Missing user_id' });

        const credentialsFile = client_type === 'android' ? 'credentials_android.json' : 'credentials.json';
        const CREDENTIALS_PATH = path.join(__dirname, credentialsFile);

        let credentials;
        try {
            credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
        } catch (err) {
            console.error('Error loading credentials:', err);
            return res.status(500).json({ error: 'Failed to load credentials' });
        }

        const { client_secret, client_id } = credentials.installed || credentials.web;
        const REDIRECT_URI = `${BASE_URL}/oauth/callback`;
        const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, REDIRECT_URI);

        await redisClient.setEx(`auth_details:${user_id}`, 600, JSON.stringify({ client_id, client_secret, client_type }));
        await redisClient.setEx('current_user_id', 600, user_id);

        const authUrl = oAuth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES, prompt: 'consent' });
        res.redirect(authUrl);
    } catch (err) {
        console.error('/auth error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/oauth/callback', async (req, res) => {
    try {
        const { code } = req.query;
        if (!code) return res.status(400).json({ error: 'Missing code' });

        const userId = await redisClient.get('current_user_id');
        if (!userId) return res.status(400).json({ error: 'User session expired' });

        const authDetailsString = await redisClient.get(`auth_details:${userId}`);
        if (!authDetailsString) return res.status(400).json({ error: 'Auth details missing' });

        const { client_id, client_secret, client_type } = JSON.parse(authDetailsString);
        const REDIRECT_URI = `${BASE_URL}/oauth/callback`;
        const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, REDIRECT_URI);

        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);

        await redisClient.set(`gmail_tokens:${userId}`, JSON.stringify(tokens));
        await autoProcessStatements(oAuth2Client, userId);

        const redirectUrl = client_type === 'android'
            ? 'com.emailbasedfinancialdataaggregation:/oauth/callback'
            : `${BASE_URL}/?view=dashboard`;

        res.redirect(redirectUrl);
    } catch (err) {
        console.error('/oauth/callback error:', err);
        res.status(500).json({ error: 'Authentication failed' });
    }
});

// --- PDF Analysis ---
app.get('/pdfs', (req, res) => {
    try {
        const pdfs = listPdfs();
        res.json(pdfs);
    } catch (err) {
        console.error('/pdfs error:', err);
        res.status(500).json({ error: 'Failed to list PDFs' });
    }
});

app.post('/analyze', async (req, res) => {
    try {
        const { user_id } = req.body;
        if (!user_id) return res.status(400).json({ error: 'Missing user_id' });

        const TEMP_DIR = path.join(__dirname, '../temp_pdfs');
        if (!fs.existsSync(TEMP_DIR)) return res.json({ error: 'No PDFs found' });

        const files = fs.readdirSync(TEMP_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));
        if (files.length === 0) return res.json({ error: 'No PDFs found' });

        const user = await dbGetAsync('SELECT full_name, dob, mobile FROM users WHERE user_id = ?', [user_id]);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const banks = await dbAllAsync('SELECT bank_name, password FROM user_banks WHERE user_id = ?', [user_id]);
        const bankNames = banks.length ? banks.map(b => b.bank_name) : ['default'];
        const savedPasswords = banks.filter(b => b.password).map(b => b.password);

        let allCandidates = [...savedPasswords];
        for (const bank of bankNames) allCandidates.push(...generatePasswordCandidates(user.full_name, user.mobile, user.dob, bank));
        allCandidates = [...new Set(allCandidates)];

        const consolidated = { documents: [] };
        for (const filename of files) {
            try {
                const filePath = path.join(TEMP_DIR, filename);
                const unlockResult = await unlockPdf(filePath, allCandidates);
                if (!unlockResult.success && !unlockResult.decryptedPath) {
                    consolidated.documents.push({ filename, error: 'Could not unlock' });
                    continue;
                }

                if (unlockResult.success && unlockResult.password) {
                    const { getBankFromFilename } = require('./services/bankDetection');
                    let detectedBank = getBankFromFilename(filename);

                    if (detectedBank === 'UNKNOWN') {
                        try {
                            const uuidMatch = filename.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
                            if (uuidMatch) {
                                const uuid = uuidMatch[1];
                                const cachedData = await redisClient.get(`pdf:${uuid}`);
                                if (cachedData) {
                                    const pdfInfo = JSON.parse(cachedData);
                                    if (pdfInfo.bank && pdfInfo.bank !== 'UNKNOWN') detectedBank = pdfInfo.bank;
                                }
                            }
                        } catch (e) { console.error('Redis bank error:', e); }
                    }

                    if (detectedBank && detectedBank !== 'UNKNOWN') {
                        const updateResult = await dbRunAsync(
                            'UPDATE user_banks SET password = ? WHERE user_id = ? AND bank_name = ?',
                            [unlockResult.password, user_id, detectedBank]
                        );

                        if (updateResult.changes === 0) {
                            await dbRunAsync(
                                'INSERT OR IGNORE INTO user_banks (user_id, bank_name, password) VALUES (?, ?, ?)',
                                [user_id, detectedBank, unlockResult.password]
                            );
                        }
                    }
                }

                const targetPath = unlockResult.decryptedPath || path.join(TEMP_DIR, filename);
                const extraction = await extractText(targetPath);
                consolidated.documents.push({
                    filename,
                    text: extraction.text || '',
                    unlocked_with: unlockResult.password || null
                });
            } catch (err) {
                console.error('PDF processing error:', err);
                consolidated.documents.push({ filename, error: 'Processing failed' });
            }
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

        const analysis = await analyzeWithGemini(consolidated, apiKey);
        res.json(analysis);
    } catch (err) {
        console.error('/analyze error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Server startup & cleanup ---
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} (BASE_URL=${BASE_URL})`);
    const TEMP_DIR = path.join(__dirname, '../temp_pdfs');
    if (fs.existsSync(TEMP_DIR)) {
        fs.readdirSync(TEMP_DIR).forEach(file => {
            try { fs.unlinkSync(path.join(TEMP_DIR, file)); } catch { }
        });
        console.log('Cleaned temp_pdfs directory');
    } else {
        fs.mkdirSync(TEMP_DIR, { recursive: true });
    }
});

const shutdown = () => {
    console.log('Shutting down server...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
