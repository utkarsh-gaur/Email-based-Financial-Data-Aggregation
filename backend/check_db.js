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

// Check schema
db.all("PRAGMA table_info('user_banks')", (err, rows) => {
    if (err) {
        console.error('Error:', err);
        process.exit(1);
    }
    console.log('\n=== user_banks schema ===');
    console.log(rows);
});

// Check data
db.all("SELECT * FROM user_banks", (err, rows) => {
    if (err) {
        console.error('Error:', err);
        process.exit(1);
    }
    console.log('\n=== user_banks data ===');
    console.log(rows);
    db.close();
});
