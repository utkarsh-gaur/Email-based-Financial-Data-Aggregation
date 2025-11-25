const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const PDFParser = require('pdf2json');
const Tesseract = require('tesseract.js');

const execFileAsync = promisify(execFile);

const TEMP_DIR = path.join(__dirname, '../../temp_pdfs');

if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

function listPdfs() {
    if (!fs.existsSync(TEMP_DIR)) return [];
    return fs.readdirSync(TEMP_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));
}

/**
 * Unlock PDF using Python pikepdf script
 */
async function unlockPdf(filePath, candidates) {
    const pythonScript = path.join(__dirname, 'unlock_pdf.py');

    try {
        // Call Python script with file path and all password candidates
        const args = ['-3.11', pythonScript, filePath, ...candidates];
        const { stdout, stderr } = await execFileAsync('py', args, {
            maxBuffer: 1024 * 1024 * 10 // 10MB buffer
        });

        if (stderr) {
            console.error('Python stderr:', stderr);
        }

        console.log('Python stdout:', stdout.trim());
        const result = JSON.parse(stdout.trim());

        // Convert Python snake_case to JavaScript camelCase
        if (result.decrypted_path) {
            result.decryptedPath = result.decrypted_path;
        }

        if (result.success && result.password) {
            console.log(`Successfully unlocked with password: ${result.password}`);
            console.log(`Decrypted path: ${result.decryptedPath}`);
        }

        return result;
    } catch (error) {
        console.error('Python unlock error:', error.message);
        if (error.stdout) console.error('stdout:', error.stdout);
        if (error.stderr) console.error('stderr:', error.stderr);
        return { success: false, password: null, decryptedPath: null };
    }
}

/**
 * Extract text from PDF using pdf2json (works with unlocked PDFs)
 */
async function extractText(filePath) {
    try {
        const pdfParser = new PDFParser();

        const parsePromise = new Promise((resolve, reject) => {
            pdfParser.on("pdfParser_dataReady", (pdfData) => {
                let fullText = '';
                if (pdfData && pdfData.Pages) {
                    pdfData.Pages.forEach(page => {
                        if (page.Texts) {
                            page.Texts.forEach(text => {
                                if (text.R) {
                                    text.R.forEach(r => {
                                        if (r.T) {
                                            fullText += decodeURIComponent(r.T) + ' ';
                                        }
                                    });
                                }
                            });
                            fullText += '\n';
                        }
                    });
                }
                resolve(fullText);
            });

            pdfParser.on("pdfParser_dataError", (err) => reject(err));
        });

        pdfParser.loadPDF(filePath);
        const text = await parsePromise;

        if (text && text.trim().length > 0) {
            return { text, method: 'pdf2json' };
        }
    } catch (e) {
        console.error("pdf2json extraction failed:", e.message);
    }

    // Fallback to OCR
    console.log("Falling back to OCR for", filePath);

    try {
        const { data: { text } } = await Tesseract.recognize(filePath, 'eng');
        return { text, method: 'ocr' };
    } catch (err) {
        return { text: "", error: err.message };
    }
}

module.exports = { listPdfs, unlockPdf, extractText };
