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
        const args = [pythonScript, filePath, ...candidates];
        const { stdout, stderr } = await execFileAsync('python', args, {
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

/**
 * Extract tables from PDF to CSV using pdfplumber
 */
async function extractTablesToCSV(filePath, outputDir = null, redisClient = null) {
    const pythonScript = path.join(__dirname, 'extract_tables.py');
    
    // Default output directory is temp_csv in project root
    const defaultOutputDir = path.join(__dirname, '../../temp_csv');
    const finalOutputDir = outputDir || defaultOutputDir;
    
    // Ensure temp_csv directory exists
    if (!fs.existsSync(finalOutputDir)) {
        fs.mkdirSync(finalOutputDir, { recursive: true });
    }
    
    try {
        // Prepare arguments
        const args = [pythonScript, filePath];
        if (outputDir) {
            args.push(outputDir);
        }
        
        // Call Python script
        const { stdout, stderr } = await execFileAsync('python', args, {
            maxBuffer: 1024 * 1024 * 10 // 10MB buffer
        });
        
        if (stderr) {
            console.error('Python stderr:', stderr);
        }
        
        console.log('Python stdout:', stdout.trim());
        const result = JSON.parse(stdout.trim());
        
        if (result.success && redisClient && result.csv_file) {
            // Cache the single CSV file in Redis
            try {
                const { v4: uuidv4 } = require('uuid');
                const csvId = uuidv4();
                
                // Store CSV metadata in Redis with 1 hour expiration
                await redisClient.setEx(`csv:${csvId}`, 3600, JSON.stringify({
                    path: result.csv_file.path,
                    filename: result.csv_file.filename,
                    sourcePdf: path.basename(filePath),
                    tables_combined: result.csv_file.tables_combined,
                    total_rows: result.total_rows,
                    createdAt: new Date().toISOString()
                }));
                
                // Add Redis ID to the result for reference
                result.csv_file.redis_id = csvId;
                
                console.log(`Cached CSV in Redis: csv:${csvId}`);
            } catch (redisError) {
                console.error('Redis cache error for CSV:', redisError);
                // Continue even if Redis fails
            }
        }
        
        if (result.success) {
            console.log(`Successfully extracted ${result.total_tables} table(s) from PDF`);
            console.log(`CSV files saved to: ${result.output_dir}`);
        }
        
        return result;
    } catch (error) {
        console.error('Python table extraction error:', error.message);
        if (error.stdout) console.error('stdout:', error.stdout);
        if (error.stderr) console.error('stderr:', error.stderr);
        return { 
            success: false, 
            error: error.message,
            total_tables: 0,
            csv_files: []
        };
    }
}

module.exports = { listPdfs, unlockPdf, extractText, extractTablesToCSV };
