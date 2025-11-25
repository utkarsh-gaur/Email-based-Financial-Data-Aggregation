const { extractTablesToCSV } = require('./services/pdfService');
const path = require('path');
const fs = require('fs');

async function test() {
    const tempPdfsDir = path.join(__dirname, '../temp_pdfs');
    const allFiles = fs.readdirSync(tempPdfsDir);
    console.log(`All files in temp_pdfs: ${allFiles.join(', ')}\n`);
    
    const files = allFiles.filter(f => f.endsWith('_unlocked.pdf'));
    
    console.log(`Found ${files.length} unlocked PDFs`);
    
    if (files.length === 0) {
        // Try any PDF file
        const anyPdf = allFiles.find(f => f.endsWith('.pdf'));
        if (anyPdf) {
            console.log(`Using any PDF: ${anyPdf}\n`);
            const pdfPath = path.join(tempPdfsDir, anyPdf);
            const result = await extractTablesToCSV(pdfPath);
            console.log(JSON.stringify(result, null, 2));
            return;
        }
        console.log('No PDFs found at all');
        return;
    }
    
    const pdfPath = path.join(tempPdfsDir, files[0]);
    console.log(`Extracting tables from: ${files[0]}\n`);
    
    const result = await extractTablesToCSV(pdfPath);
    console.log(JSON.stringify(result, null, 2));
}

test().catch(console.error);
