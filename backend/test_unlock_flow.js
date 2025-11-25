/**
 * Test the actual PDF unlock flow to see what's being returned
 */

const { unlockPdf } = require('./services/pdfService');
const path = require('path');
const fs = require('fs');

async function testUnlock() {
    // Check if there are any PDFs to test with
    const tempDir = path.join(__dirname, '../temp_pdfs');

    if (!fs.existsSync(tempDir)) {
        console.log('temp_pdfs directory does not exist');
        console.log('Creating it...');
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const pdfs = fs.readdirSync(tempDir).filter(f => f.toLowerCase().endsWith('.pdf'));

    if (pdfs.length === 0) {
        console.log('No PDFs found in temp_pdfs directory');
        console.log('Please add a test PDF to:', tempDir);
        console.log('\nTo test the password save functionality:');
        console.log('1. Add a password-protected PDF to temp_pdfs/');
        console.log('2. Run this script again');
        return;
    }

    console.log(`Found ${pdfs.length} PDF(s):`);
    pdfs.forEach(pdf => console.log(`  - ${pdf}`));
    console.log();

    // Test with first PDF
    const testPdf = path.join(tempDir, pdfs[0]);
    console.log(`Testing unlock with: ${pdfs[0]}`);
    console.log();

    // Test passwords
    const testPasswords = [
        '71636200698',
        'test123',
        'password',
        '123456'
    ];

    console.log(`Trying ${testPasswords.length} password candidates...`);
    const result = await unlockPdf(testPdf, testPasswords);

    console.log('\n=== UNLOCK RESULT ===');
    console.log('Success:', result.success);
    console.log('Password:', result.password);
    console.log('Decrypted Path:', result.decryptedPath);
    console.log();

    if (result.success && result.password) {
        console.log('✓ PDF was unlocked with a password!');
        console.log('  This password SHOULD be saved to the database');
    } else if (result.success && !result.password) {
        console.log('✓ PDF was not encrypted (no password needed)');
        console.log('  No password to save');
    } else {
        console.log('✗ Failed to unlock PDF');
        console.log('  Try adding the correct password to testPasswords array');
    }
}

testUnlock().catch(console.error);
