/**
 * Test script to debug password saving issue
 * This simulates the analyze endpoint flow
 */

const path = require('path');
const db = require('./db/database');
const { generatePasswordCandidates } = require('./services/passwordGenerator');
const { getBankFromFilename } = require('./services/bankDetection');

// Test data
const testUserId = 'd7758506-d2a0-4f2b-a0e9-3e6e3e3e3e3e'; // Use the latest user from DB
const testFilename = 'baroda_statement.pdf'; // Simulate a Bank of Baroda PDF
const testPassword = 'test123'; // Simulated password that unlocked the PDF

console.log('=== SIMULATING PASSWORD SAVE FLOW ===\n');

// Step 1: Detect bank from filename
const detectedBank = getBankFromFilename(testFilename);
console.log(`Step 1: Bank Detection`);
console.log(`  Filename: ${testFilename}`);
console.log(`  Detected Bank: ${detectedBank}`);
console.log();

// Step 2: Check if this would pass the condition
if (detectedBank && detectedBank !== 'UNKNOWN') {
    console.log(`Step 2: Bank is valid, proceeding with save...`);
    console.log();

    // Step 3: Try UPDATE
    console.log(`Step 3: Attempting UPDATE...`);
    db.run(
        'UPDATE user_banks SET password = ? WHERE user_id = ? AND bank_name = ?',
        [testPassword, testUserId, detectedBank],
        function (err) {
            if (err) {
                console.error('  ERROR:', err);
            } else {
                console.log(`  Rows affected: ${this.changes}`);

                if (this.changes === 0) {
                    console.log(`  WARNING: No rows updated!`);
                    console.log();

                    // Step 4: Try INSERT
                    console.log(`Step 4: Attempting INSERT...`);
                    db.run(
                        'INSERT OR IGNORE INTO user_banks (user_id, bank_name, password) VALUES (?, ?, ?)',
                        [testUserId, detectedBank, testPassword],
                        function (err) {
                            if (err) {
                                console.error('  ERROR:', err);
                            } else {
                                console.log(`  INSERT successful!`);
                                console.log(`  Last ID: ${this.lastID}`);
                            }

                            // Verify
                            verifyResult();
                        }
                    );
                } else {
                    console.log(`  UPDATE successful!`);
                    verifyResult();
                }
            }
        }
    );
} else {
    console.log(`Step 2: Bank is UNKNOWN or invalid, would skip save`);
    console.log(`  This is likely the problem!`);
    db.close();
}

function verifyResult() {
    console.log();
    console.log(`Step 5: Verifying result...`);
    db.get(
        'SELECT * FROM user_banks WHERE user_id = ? AND bank_name = ?',
        [testUserId, detectedBank],
        (err, row) => {
            if (err) {
                console.error('  ERROR:', err);
            } else if (row) {
                console.log(`  SUCCESS! Found entry:`);
                console.log(`    ID: ${row.id}`);
                console.log(`    User ID: ${row.user_id}`);
                console.log(`    Bank: ${row.bank_name}`);
                console.log(`    Password: ${row.password}`);
            } else {
                console.log(`  ERROR: No entry found!`);
            }
            db.close();
        }
    );
}
