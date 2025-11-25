const fs = require('fs');
const path = require('path');
const PDFParser = require('pdf2json');

async function testUnlock() {
    // Get the first PDF from temp_pdfs
    const TEMP_DIR = path.join(__dirname, '../temp_pdfs');
    const files = fs.readdirSync(TEMP_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));

    if (files.length === 0) {
        console.log('No PDFs found in temp_pdfs');
        return;
    }

    const pdfPath = path.join(TEMP_DIR, files[0]);
    console.log(`Testing PDF: ${files[0]}`);

    // Test 1: Try without password
    console.log('\n--- Test 1: No password ---');
    try {
        const pdfParser = new PDFParser();
        const parsePromise = new Promise((resolve, reject) => {
            pdfParser.on("pdfParser_dataReady", () => resolve(true));
            pdfParser.on("pdfParser_dataError", (err) => reject(err));
        });

        pdfParser.loadPDF(pdfPath);
        await parsePromise;
        console.log('✓ PDF is not encrypted');
        return;
    } catch (e) {
        console.log('✗ PDF is password protected');
    }

    // Test 2: Try with the password
    console.log('\n--- Test 2: With password ---');
    const testPassword = process.argv[2] || 'YOUR_PASSWORD_HERE';
    console.log(`Trying password: "${testPassword}"`);

    try {
        const pdfParser = new PDFParser(null, null, testPassword);
        const parsePromise = new Promise((resolve, reject) => {
            pdfParser.on("pdfParser_dataReady", (pdfData) => {
                resolve(pdfData);
            });
            pdfParser.on("pdfParser_dataError", (err) => reject(err));
        });

        pdfParser.loadPDF(pdfPath);
        const pdfData = await parsePromise;

        console.log('✓ Successfully unlocked PDF with pdf2json!');
        console.log(`  Pages: ${pdfData.Pages ? pdfData.Pages.length : 0}`);

        // Test text extraction
        console.log('\n--- Test 3: Text extraction ---');
        let sampleText = '';
        if (pdfData.Pages && pdfData.Pages[0] && pdfData.Pages[0].Texts) {
            const firstTexts = pdfData.Pages[0].Texts.slice(0, 3);
            firstTexts.forEach(text => {
                if (text.R && text.R[0] && text.R[0].T) {
                    sampleText += decodeURIComponent(text.R[0].T) + ' ';
                }
            });
        }
        console.log(`  First few words: "${sampleText}..."`);
        console.log('✓ Text extraction working!');

    } catch (e) {
        console.log('✗ Failed to unlock:', e.message);
    }
}

testUnlock().catch(console.error);
