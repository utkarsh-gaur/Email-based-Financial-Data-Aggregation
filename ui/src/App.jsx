import React, { useState, useEffect } from 'react'
import axios from 'axios'
import Dashboard from './Dashboard'

export default function App() {
  const [fullName, setFullName] = useState('')
  const [mobile, setMobile] = useState('')
  const [dob, setDob] = useState('')
  const [msg, setMsg] = useState('')
  const [userId, setUserId] = useState('')   // <-- store user_id here

  const [view, setView] = useState('home'); // 'home' or 'dashboard'

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'dashboard') {
      setView('dashboard');
      // Optional: Clean up URL
      window.history.replaceState({}, document.title, "/");
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const res = await axios.post('http://localhost:8000/users', {
        full_name: fullName,
        mobile,
        dob
      })

      setUserId(res.data.user_id)
      localStorage.setItem('user_id', res.data.user_id) // Persist
      setMsg('Saved user id: ' + res.data.user_id)

      setFullName('')
      setMobile('')
      setDob('')
    } catch (err) {
      console.error(err)
      setMsg('Error saving user')
    }
  }

  const handleGoogleLogin = () => {
    if (!userId) {
      alert("Please register first so a user_id is created.")
      return
    }

    // <-- send user_id to FastAPI backend
    window.location.href = `http://localhost:8000/auth?user_id=${userId}`
  }

  // Simple router
  if (view === 'dashboard') {
    return (
      <div>
        <button
          onClick={() => setView('home')}
          style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 100 }}
        >
          ← Back
        </button>
        <Dashboard />
      </div>
    )
  }

  return (
    <div className="container">
      <h1>Create Account</h1>
      <p>Start aggregating your financial data today.</p>

      <form onSubmit={handleSubmit} className="form">
        <label>
          Full Name
          <input
            type="text"
            placeholder="John Doe"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </label>

        <label>
          Phone Number
          <input
            type="tel"
            placeholder="+91 98765 43210"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            required
          />
        </label>

        <label>
          Date of Birth (DD/MM/YYYY)
          <input
            type="text"
            placeholder="DD/MM/YYYY"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            required
          />
        </label>

        <button type="submit">Register User</button>
      </form>

      {msg && <div className="msg">{msg}</div>}

      {userId && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
          <button className="google-btn" onClick={handleGoogleLogin}>
            <img
              src="https://developers.google.com/identity/images/g-logo.png"
              alt="Google Logo"
              style={{ width: "20px", height: "20px" }}
            />
            <span>Connect Gmail Account</span>
          </button>

          <button onClick={() => setView('dashboard')} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)' }}>
            View Documents & Analyze
          </button>
        </div>
      )}
    </div>
  )
}
