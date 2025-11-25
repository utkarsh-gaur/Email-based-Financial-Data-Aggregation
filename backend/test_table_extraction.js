const { extractTablesToCSV } = require('./services/pdfService');
const path = require('path');
const fs = require('fs');

async function test() {
    // Get first PDF from temp_pdfs
    const tempPdfsDir = path.join(__dirname, '../temp_pdfs');
    const files = fs.readdirSync(tempPdfsDir).filter(f => f.includes('unlocked'));
    
    if (files.length === 0) {
        console.log('No unlocked PDFs found');
        return;
    }
    
    const pdfPath = path.join(tempPdfsDir, files[0]);
    console.log(`Testing extraction on: ${files[0]}`);
    
    const result = await extractTablesToCSV(pdfPath);
    console.log(JSON.stringify(result, null, 2));
}

test();
