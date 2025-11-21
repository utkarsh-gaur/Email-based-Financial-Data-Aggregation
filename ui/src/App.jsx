import React, { useState } from 'react'
import axios from 'axios'

export default function App() {
  const [fullName, setFullName] = useState('')
  const [mobile, setMobile] = useState('')
  const [dob, setDob] = useState('')
  const [msg, setMsg] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const res = await axios.post('http://localhost:5000/users', {
        full_name: fullName,
        mobile,
        dob
      })
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
    window.location.href = 'http://localhost:8000/auth'
  }

  return (
    <div className="container">
      <h1>User Registration</h1>

      <form onSubmit={handleSubmit} className="form">
        <label>
          Full Name
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </label>

        <label>
          Phone Number
          <input value={mobile} onChange={(e) => setMobile(e.target.value)} required />
        </label>

        <label>
          Date of Birth
          <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} required />
        </label>

        <button type="submit">Submit</button>
      </form>

      {msg && <p className="msg">{msg}</p>}

      <hr />

      {/* CLEAN GOOGLE LOGIN BUTTON */}
      <div style={{ marginTop: "20px" }}>
        <button
          onClick={handleGoogleLogin}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "10px 18px",
            backgroundColor: "white",
            border: "1px solid #dadce0",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "15px",
            fontWeight: "500",
            fontFamily: "Arial, sans-serif",
            boxShadow: "0 1px 2px rgba(0,0,0,0.1)"
          }}
        >
          <img
            src="https://developers.google.com/identity/images/g-logo.png"
            alt="Google Logo"
            style={{ width: "20px", height: "20px" }}
          />
          <span>Sign in with Google</span>
        </button>
      </div>

    </div>
  )
}
