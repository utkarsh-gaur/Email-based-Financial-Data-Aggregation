const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.resolve(__dirname, '../../users.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database ' + DB_PATH, err.message);
  } else {
    console.log('Connected to the SQLite database.');
    initDb();
  }
});

function initDb() {
  db.serialize(() => {
    // Users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        full_name TEXT,
        dob TEXT,
        mobile TEXT
      )
    `);

    // User banks table
    db.run(`
      CREATE TABLE IF NOT EXISTS user_banks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        bank_name TEXT NOT NULL,
        password TEXT,
        first_seen_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(user_id),
        UNIQUE(user_id, bank_name)
      )
    `);

    // Ensure password column exists (migration logic from python)
    db.all("PRAGMA table_info('user_banks')", (err, rows) => {
      if (err) {
        console.error("Error checking table info", err);
        return;
      }
      const cols = rows.map(r => r.name);
      if (!cols.includes('password')) {
        db.run('ALTER TABLE user_banks ADD COLUMN password TEXT', (err) => {
          if (err) console.error("Error adding password column", err);
          else console.log("Added password column to user_banks");
        });
      }
    });
  });
}

module.exports = db;
