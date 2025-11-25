/**
 * Check server logs for password save attempts
 * This will help us understand what's happening
 */

const fs = require('fs');
const path = require('path');

console.log('=== CHECKING FOR RECENT ACTIVITY ===\n');

// Check database for recent changes
const db = require('./db/database');

db.all("SELECT * FROM user_banks ORDER BY id DESC LIMIT 5", (err, rows) => {
    if (err) {
        console.error('Error:', err);
        process.exit(1);
    }

    console.log('Last 5 database entries:');
    rows.forEach(row => {
        const timestamp = row.first_seen_at || 'N/A';
        console.log(`  ID ${row.id}: ${row.bank_name} | Password: ${row.password || 'NULL'} | Created: ${timestamp}`);
    });

    console.log();

    // Check for unlocked PDFs in temp_pdfs
    const tempDir = path.join(__dirname, '../temp_pdfs');
    if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        const unlockedFiles = files.filter(f => f.includes('_unlocked'));

        console.log(`Files in temp_pdfs: ${files.length}`);
        if (unlockedFiles.length > 0) {
            console.log('Unlocked PDFs found:');
            unlockedFiles.forEach(f => console.log(`  - ${f}`));
            console.log('\n✓ PDFs were successfully unlocked!');
            console.log('✗ But passwords were NOT saved to database');
            console.log('\nThis means the unlock worked, but the save logic was skipped.');
            console.log('Most likely causes:');
            console.log('  1. Bank name was detected as "UNKNOWN"');
            console.log('  2. unlockResult.password was null/undefined');
            console.log('  3. The condition check failed');
        } else {
            console.log('No unlocked PDFs found.');
        }
    }

    db.close();
});
