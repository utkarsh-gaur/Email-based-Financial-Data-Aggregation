
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const db = require('./db/database');
const { autoProcessStatements, redisClient } = require('./services/gmailService');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 8000; // Using 8000 to match existing Google OAuth config
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');

// Load credentials
let credentials;
try {
    const content = fs.readFileSync(CREDENTIALS_PATH);
    credentials = JSON.parse(content);
} catch (err) {
    console.error('Error loading client secret file:', err);
}

const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, "http://localhost:8000/oauth/callback");

// --- User Routes ---

app.post('/users', (req, res) => {
    const { full_name, dob, mobile } = req.body;
    if (!full_name || !dob || !mobile) {
        return res.status(400).json({ error: 'missing required fields' });
    }

    const user_id = uuidv4();
    db.run(
        'INSERT INTO users (user_id, full_name, dob, mobile) VALUES (?, ?, ?, ?)',
        [user_id, full_name, dob, mobile],
        (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Database error' });
            }
            res.status(201).json({ status: 'ok', user_id });
        }
    );
});

app.get('/users', (req, res) => {
    db.all('SELECT user_id, full_name, dob, mobile FROM users', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        // For each user, get banks (this is N+1 but simple for migration)
        const users = [];
        let completed = 0;
        if (rows.length === 0) return res.json([]);

        rows.forEach(row => {
            db.all('SELECT bank_name FROM user_banks WHERE user_id = ?', [row.user_id], (err, banks) => {
                if (err) console.error(err);
                users.push({
                    ...row,
                    banks: banks ? banks.map(b => b.bank_name) : []
                });
                completed++;
                if (completed === rows.length) {
                    res.json(users);
                }
            });
        });
    });
});

app.get('/users/:user_id', (req, res) => {
    const { user_id } = req.params;
    db.get('SELECT user_id, full_name, dob, mobile FROM users WHERE user_id = ?', [user_id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'user not found' });

        db.all('SELECT bank_name FROM user_banks WHERE user_id = ?', [user_id], (err, banks) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({
                ...row,
                banks: banks.map(b => b.bank_name)
            });
        });
    });
});

// --- Auth Routes ---

app.get('/auth', async (req, res) => {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'Missing user_id' });

    await redisClient.setEx('current_user_id', 600, user_id);

    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent'
    });
    res.redirect(authUrl);
});

app.get('/oauth/callback', async (req, res) => {
    const { code } = req.query;
    const userId = await redisClient.get('current_user_id');

    if (!userId) {
        return res.status(400).json({ error: 'User ID expired or missing' });
    }

    try {
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);

        // Store tokens in Redis (as per original logic)
        await redisClient.set('gmail_tokens', JSON.stringify({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            client_id: client_id,
            client_secret: client_secret
        }));

        const results = await autoProcessStatements(oAuth2Client, userId);

        // Redirect to frontend dashboard
        res.redirect('http://localhost:5173/?view=dashboard');
    } catch (error) {
        console.error('Error retrieving access token', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
});

// --- PDF Analysis Routes ---

const { listPdfs, unlockPdf, extractText } = require('./services/pdfService');
const { generatePasswordCandidates } = require('./services/passwordGenerator');
const { analyzeWithGemini } = require('./services/analysisService');

app.get('/pdfs', (req, res) => {
    const pdfs = listPdfs();
    res.json(pdfs);
});

app.post('/analyze', async (req, res) => {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'Missing user_id' });

    // Fix: server.js is in backend/, so temp_pdfs is in ../temp_pdfs
    const TEMP_DIR = path.join(__dirname, '../temp_pdfs');

    if (!fs.existsSync(TEMP_DIR)) {
        return res.json({ error: "No PDFs found to analyze." });
    }

    const files = fs.readdirSync(TEMP_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));
    if (files.length === 0) {
        return res.json({ error: "No PDFs found to analyze." });
    }

    // Get user info for password generation
    db.get('SELECT full_name, dob, mobile FROM users WHERE user_id = ?', [user_id], async (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'User not found' });

        // Generate candidates once for the user
        // We'll try all known banks for the user + default
        db.all('SELECT bank_name, password FROM user_banks WHERE user_id = ?', [user_id], async (err, banks) => {
            const bankNames = banks ? banks.map(b => b.bank_name) : ['default'];
            if (bankNames.length === 0) bankNames.push('default');

            // Collect saved passwords first (these should be tried first!)
            const savedPasswords = banks
                ? banks.filter(b => b.password).map(b => b.password)
                : [];

            console.log(`[PASSWORD CANDIDATES] Found ${savedPasswords.length} saved passwords`);
            if (savedPasswords.length > 0) {
                console.log(`[PASSWORD CANDIDATES] Saved passwords:`, savedPasswords);
            }

            let allCandidates = [...savedPasswords]; // Start with saved passwords
            for (const bank of bankNames) {
                console.log(`Generating passwords for bank: ${bank}`);
                const candidates = generatePasswordCandidates(user.full_name, user.mobile, user.dob, bank);
                allCandidates.push(...candidates);
            }
            allCandidates = [...new Set(allCandidates)]; // Remove duplicates
            console.log(`Total unique password candidates: ${allCandidates.length}`);
            console.log('Candidates:', allCandidates); // Uncommented for debugging

            const consolidated = { documents: [] };

            // Process each file
            for (const filename of files) {
                const filePath = path.join(TEMP_DIR, filename);

                // Unlock
                const unlockResult = await unlockPdf(filePath, allCandidates);
                // If unlock failed and it was encrypted, we skip or mark error. 
                // If it wasn't encrypted, unlockResult.success is true.

                if (!unlockResult.success && !unlockResult.decryptedPath) {
                    consolidated.documents.push({ filename, error: "Could not unlock" });
                    continue;
                }

                // Debug logging for unlock result
                console.log(`[UNLOCK RESULT] Filename: ${filename}`);
                console.log(`[UNLOCK RESULT] Success: ${unlockResult.success}`);
                console.log(`[UNLOCK RESULT] Password: ${unlockResult.password}`);
                console.log(`[UNLOCK RESULT] Decrypted Path: ${unlockResult.decryptedPath}`);

                // If we successfully unlocked with a password, save it to the database
                if (unlockResult.success && unlockResult.password) {
                    // Try multiple methods to detect the bank
                    const { getBankFromFilename } = require('./services/bankDetection');
                    let detectedBank = getBankFromFilename(filename);

                    // If bank is UNKNOWN, try to get it from Redis cache (for Gmail-downloaded PDFs)
                    if (detectedBank === 'UNKNOWN') {
                        try {
                            // Extract UUID from filename (format: UUID_originalname.pdf)
                            const uuidMatch = filename.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
                            if (uuidMatch) {
                                const uuid = uuidMatch[1];
                                const cachedData = await redisClient.get(`pdf:${uuid}`);
                                if (cachedData) {
                                    try {
                                        const pdfInfo = JSON.parse(cachedData);
                                        if (pdfInfo.bank && pdfInfo.bank !== 'UNKNOWN') {
                                            detectedBank = pdfInfo.bank;
                                            console.log(`[PASSWORD SAVE] Retrieved bank from Redis cache: ${detectedBank}`);
                                        }
                                    } catch (e) {
                                        // Old format - just the path string
                                        console.log(`[PASSWORD SAVE] Redis cache in old format, cannot extract bank`);
                                    }
                                }
                            }
                        } catch (e) {
                            console.error('[PASSWORD SAVE] Error retrieving bank from Redis:', e);
                        }
                    }

                    console.log(`[PASSWORD SAVE] Filename: ${filename}`);
                    console.log(`[PASSWORD SAVE] Detected bank: ${detectedBank}`);
                    console.log(`[PASSWORD SAVE] Password: ${unlockResult.password}`);
                    console.log(`[PASSWORD SAVE] User ID: ${user_id}`);

                    if (detectedBank && detectedBank !== 'UNKNOWN') {
                        console.log(`[PASSWORD SAVE] Attempting to save password for bank: ${detectedBank}`);
                        db.run(
                            'UPDATE user_banks SET password = ? WHERE user_id = ? AND bank_name = ?',
                            [unlockResult.password, user_id, detectedBank],
                            function (err) {
                                if (err) {
                                    console.error('[PASSWORD SAVE] Error saving password:', err);
                                } else {
                                    console.log(`[PASSWORD SAVE] Rows affected: ${this.changes}`);
                                    if (this.changes === 0) {
                                        console.log(`[PASSWORD SAVE] WARNING: No rows updated. Bank entry might not exist for user.`);
                                        console.log(`[PASSWORD SAVE] Attempting INSERT instead...`);
                                        db.run(
                                            'INSERT OR IGNORE INTO user_banks (user_id, bank_name, password) VALUES (?, ?, ?)',
                                            [user_id, detectedBank, unlockResult.password],
                                            function (err) {
                                                if (err) {
                                                    console.error('[PASSWORD SAVE] Error inserting password:', err);
                                                } else {
                                                    console.log(`[PASSWORD SAVE] Successfully inserted new bank entry with password`);
                                                }
                                            }
                                        );
                                    } else {
                                        console.log(`[PASSWORD SAVE] Password saved successfully for ${detectedBank}`);
                                    }
                                }
                            }
                        );
                    } else {
                        console.log(`[PASSWORD SAVE] Skipping save - bank is UNKNOWN or not detected`);
                    }
                } else {
                    // Explain why we're not saving
                    if (!unlockResult.success) {
                        console.log(`[PASSWORD SAVE] Skipping - unlock was not successful`);
                    } else if (!unlockResult.password) {
                        console.log(`[PASSWORD SAVE] Skipping - PDF was not encrypted (no password needed)`);
                    }
                }

                // Use the unlocked PDF for extraction
                const targetPath = unlockResult.decryptedPath || filePath;
                console.log(`Extracting text from: ${targetPath}`);
                console.log(`Original file: ${filePath}`);
                console.log(`Decrypted path: ${unlockResult.decryptedPath}`);

                // Extract text from the unlocked PDF
                const extraction = await extractText(targetPath);
                consolidated.documents.push({
                    filename,
                    text: extraction.text || "",
                    unlocked_with: unlockResult.password
                });
            }

            // Analyze Consolidated
            try {
                const apiKey = process.env.GEMINI_API_KEY;
                if (!apiKey) {
                    return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server.' });
                }

                const analysis = await analyzeWithGemini(consolidated, apiKey);
                res.json(analysis);

            } catch (e) {
                res.status(500).json({ error: 'Analysis failed: ' + e.message });
            }
        });
    });
});

const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);

    // Cleanup temp_pdfs on startup
    const TEMP_DIR = path.join(__dirname, '../temp_pdfs');
    if (fs.existsSync(TEMP_DIR)) {
        fs.readdirSync(TEMP_DIR).forEach(file => {
            const curPath = path.join(TEMP_DIR, file);
            fs.unlinkSync(curPath);
        });
        console.log('Cleaned up temp_pdfs directory');
    } else {
        fs.mkdirSync(TEMP_DIR);
    }
});

// Graceful shutdown
const shutdown = () => {
    console.log('Shutting down server...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
