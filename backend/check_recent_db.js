const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.resolve(__dirname, '../users.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    }
    console.log('Connected to database:', DB_PATH);
});

// Check the most recent entries
db.all("SELECT * FROM user_banks ORDER BY id DESC LIMIT 10", (err, rows) => {
    if (err) {
        console.error('Error:', err);
        process.exit(1);
    }
    console.log('\n=== Last 10 user_banks entries ===');
    rows.forEach(row => {
        console.log(`ID: ${row.id}, User: ${row.user_id.substring(0, 8)}..., Bank: ${row.bank_name}, Password: ${row.password || 'NULL'}`);
    });

    // Count entries with passwords
    db.get("SELECT COUNT(*) as count FROM user_banks WHERE password IS NOT NULL", (err, result) => {
        if (err) {
            console.error('Error:', err);
        } else {
            console.log(`\n=== Total entries with passwords: ${result.count} ===`);
        }
        db.close();
    });
});
