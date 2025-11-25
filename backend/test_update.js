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

// Test UPDATE with a known user_id and bank
const testUserId = '071f5375-160a-4ab1-af54-621a89249243';
const testBank = 'bank of baroda';
const testPassword = 'TEST_PASSWORD_123';

console.log('\n=== Testing UPDATE query ===');
console.log(`user_id: ${testUserId}`);
console.log(`bank_name: ${testBank}`);
console.log(`password: ${testPassword}`);

db.run(
    'UPDATE user_banks SET password = ? WHERE user_id = ? AND bank_name = ?',
    [testPassword, testUserId, testBank],
    function (err) {
        if (err) {
            console.error('Error updating:', err);
        } else {
            console.log(`Rows affected: ${this.changes}`);

            // Verify the update
            db.get(
                'SELECT * FROM user_banks WHERE user_id = ? AND bank_name = ?',
                [testUserId, testBank],
                (err, row) => {
                    if (err) {
                        console.error('Error selecting:', err);
                    } else {
                        console.log('\nUpdated row:');
                        console.log(row);
                    }
                    db.close();
                }
            );
        }
    }
);
