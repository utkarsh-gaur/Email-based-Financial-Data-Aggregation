from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import uuid
import os

BASE_DIR = os.path.dirname(__file__)
DB_PATH = os.path.join(BASE_DIR, 'users.db')

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
    CREATE TABLE IF NOT EXISTS users (
       user_id TEXT PRIMARY KEY,
       full_name TEXT,
       dob TEXT,
       mobile TEXT,
       bank TEXT
    )
    ''')
    conn.commit()
    conn.close()

app = Flask(__name__)
CORS(app)

# Initialize the database at import time to avoid relying on
# Flask's `before_first_request` decorator which may not be
# available in some environments/Flask builds.
init_db()

@app.route('/users', methods=['POST'])
def create_user():
    data = request.get_json() or {}
    full_name = data.get('full_name')
    dob = data.get('dob')
    mobile = data.get('mobile')
    bank = data.get('bank', '')

    if not full_name or not mobile or not dob:
        return jsonify({'error': 'missing required fields'}), 400

    user_id = str(uuid.uuid4())

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('INSERT INTO users (user_id, full_name, dob, mobile, bank) VALUES (?, ?, ?, ?, ?)',
              (user_id, full_name, dob, mobile, bank))
    conn.commit()
    conn.close()

    return jsonify({'status': 'ok', 'user_id': user_id}), 201

@app.route('/users', methods=['GET'])
def list_users():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('SELECT user_id, full_name, dob, mobile, bank FROM users')
    rows = c.fetchall()
    conn.close()
    users = [{'user_id': r[0], 'full_name': r[1], 'dob': r[2], 'mobile': r[3], 'bank': r[4]} for r in rows]
    return jsonify(users)

if __name__ == '__main__':
    init_db()
    app.run(port=5000, debug=True)
