
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

const PORT = 8000;
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

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
    const { user_id, client_type } = req.query;
    if (!user_id) return res.status(400).json({ error: 'Missing user_id' });

    const credentialsFile = client_type === 'android' ? 'credentials_android.json' : 'credentials.json';
    const CREDENTIALS_PATH = path.join(__dirname, credentialsFile);

    let credentials;
    try {
        const content = fs.readFileSync(CREDENTIALS_PATH);
        credentials = JSON.parse(content);
    } catch (err) {
        console.error(`Error loading client secret file: ${credentialsFile}`, err);
        return res.status(500).json({ error: 'Could not load credentials for the specified client type' });
    }

    const { client_secret, client_id } = credentials.installed || credentials.web;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, "http://localhost:8000/oauth/callback");

    // Store the specific client details for the callback
    await redisClient.setEx(`auth_details:${user_id}`, 600, JSON.stringify({ client_id, client_secret, client_type }));
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
    if (!userId) return res.status(400).json({ error: 'User session expired or missing' });

    const authDetailsString = await redisClient.get(`auth_details:${userId}`);
    if (!authDetailsString) return res.status(400).json({ error: 'Auth details expired or missing' });

    const { client_id, client_secret, client_type } = JSON.parse(authDetailsString);
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, "http://localhost:8000/oauth/callback");

    try {
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);

        await redisClient.set(`gmail_tokens:${userId}`, JSON.stringify(tokens));

        await autoProcessStatements(oAuth2Client, userId);

        const redirectUrl = client_type === 'android'
            ? 'com.emailbasedfinancialdataaggregation:/oauth/callback' // A custom scheme for the mobile app
            : 'http://localhost:5173/?view=dashboard';

        res.redirect(redirectUrl);
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

    const TEMP_DIR = path.join(__dirname, '../temp_pdfs');

    if (!fs.existsSync(TEMP_DIR)) {
        return res.json({ error: "No PDFs found to analyze." });
    }

    const files = fs.readdirSync(TEMP_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));
    if (files.length === 0) {
        return res.json({ error: "No PDFs found to analyze." });
    }

    db.get('SELECT full_name, dob, mobile FROM users WHERE user_id = ?', [user_id], async (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'User not found' });

        db.all('SELECT bank_name, password FROM user_banks WHERE user_id = ?', [user_id], async (err, banks) => {
            const bankNames = banks ? banks.map(b => b.bank_name) : ['default'];
            if (bankNames.length === 0) bankNames.push('default');

            const savedPasswords = banks ? banks.filter(b => b.password).map(b => b.password) : [];

            let allCandidates = [...savedPasswords];
            for (const bank of bankNames) {
                const candidates = generatePasswordCandidates(user.full_name, user.mobile, user.dob, bank);
                allCandidates.push(...candidates);
            }
            allCandidates = [...new Set(allCandidates)];

            const consolidated = { documents: [] };

            for (const filename of files) {
                const filePath = path.join(TEMP_DIR, filename);
                const unlockResult = await unlockPdf(filePath, allCandidates);

                if (!unlockResult.success && !unlockResult.decryptedPath) {
                    consolidated.documents.push({ filename, error: "Could not unlock" });
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
                                    if (pdfInfo.bank && pdfInfo.bank !== 'UNKNOWN') {
                                        detectedBank = pdfInfo.bank;
                                    }
                                }
                            }
                        } catch (e) {
                            console.error('Error retrieving bank from Redis:', e);
                        }
                    }

                    if (detectedBank && detectedBank !== 'UNKNOWN') {
                        db.run(
                            'UPDATE user_banks SET password = ? WHERE user_id = ? AND bank_name = ?',
                            [unlockResult.password, user_id, detectedBank],
                            function (err) {
                                if (err) {
                                    console.error('Error saving password:', err);
                                } else if (this.changes === 0) {
                                    db.run(
                                        'INSERT OR IGNORE INTO user_banks (user_id, bank_name, password) VALUES (?, ?, ?)',
                                        [user_id, detectedBank, unlockResult.password]
                                    );
                                }
                            }
                        );
                    }
                }

                const targetPath = unlockResult.decryptedPath || filePath;
                const extraction = await extractText(targetPath);
                consolidated.documents.push({
                    filename,
                    text: extraction.text || "",
                    unlocked_with: unlockResult.password
                });
            }

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

const shutdown = () => {
    console.log('Shutting down server...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
