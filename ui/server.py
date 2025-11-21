from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import uuid
import os

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DB_PATH = os.path.join(PROJECT_ROOT, "users.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # Users table with only user_id as PK
    c.execute('''
    CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        full_name TEXT,
        dob TEXT,
        mobile TEXT
    )
    ''')

    # User banks table (many banks per user)
    c.execute('''
    CREATE TABLE IF NOT EXISTS user_banks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        bank_name TEXT NOT NULL,
        first_seen_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(user_id)
    )
    ''')

    # Prevent duplicates (user_id + bank_name)
    c.execute('''
    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_bank_unique
    ON user_banks (user_id, bank_name)
    ''')

    conn.commit()
    conn.close()


app = Flask(__name__)
CORS(app)

init_db()


@app.route('/users', methods=['POST'])
def create_user():
    data = request.get_json() or {}
    full_name = data.get('full_name')
    dob = data.get('dob')
    mobile = data.get('mobile')

    if not full_name or not mobile or not dob:
        return jsonify({'error': 'missing required fields'}), 400

    user_id = str(uuid.uuid4())

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # Insert user only
    c.execute(
        'INSERT INTO users (user_id, full_name, dob, mobile) VALUES (?, ?, ?, ?)',
        (user_id, full_name, dob, mobile)
    )

    conn.commit()
    conn.close()

    return jsonify({'status': 'ok', 'user_id': user_id}), 201


@app.route('/users', methods=['GET'])
def list_users():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    c.execute('SELECT user_id, full_name, dob, mobile FROM users')
    rows = c.fetchall()

    users = []
    for row in rows:
        user_id = row[0]

        # Fetch banks for the user
        c.execute('SELECT bank_name FROM user_banks WHERE user_id=?', (user_id,))
        banks = [b[0] for b in c.fetchall()]

        users.append({
            'user_id': user_id,
            'full_name': row[1],
            'dob': row[2],
            'mobile': row[3],
            'banks': banks
        })

    conn.close()
    return jsonify(users)


@app.route('/users/<user_id>', methods=['GET'])
def get_user(user_id):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # Fetch user
    c.execute('SELECT user_id, full_name, dob, mobile FROM users WHERE user_id=?', (user_id,))
    row = c.fetchone()

    if not row:
        conn.close()
        return jsonify({'error': 'user not found'}), 404

    # Fetch banks
    c.execute('SELECT bank_name FROM user_banks WHERE user_id=?', (user_id,))
    banks = [b[0] for b in c.fetchall()]

    conn.close()

    return jsonify({
        'user_id': row[0],
        'full_name': row[1],
        'dob': row[2],
        'mobile': row[3],
        'banks': banks
    })


if __name__ == '__main__':
    init_db()
    app.run(port=5000, debug=True)
