# UI (React) + Backend (Flask)

Quick steps to run the frontend and backend locally:

1) Backend (Python)

Install dependencies and run server (PowerShell):

```powershell
python -m pip install -r ui/requirements.txt
python ui/server.py
```

This starts the backend at `http://localhost:5000` and creates `ui/users.db`.

2) Frontend (React + Vite)

Install and start the dev server (PowerShell):

```powershell
cd ui
npm install
npm run dev
```

Open the URL printed by Vite (usually `http://localhost:5173`) and use the form to submit a user. The frontend POSTs to `http://localhost:5000/users`.
