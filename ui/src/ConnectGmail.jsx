import React from "react";
import { API_BASE_URL } from './config';

export default function ConnectGmail() {
  const userId = localStorage.getItem("user_id");

  const handleGoogleLogin = () => {
    if (!userId) {
      alert("Missing user id");
      return;
    }

    window.location.href = `${API_BASE_URL}/auth?user_id=${userId}`;
  };

  return (
    <div className="container">
      <h1>Connect Gmail</h1>
      <p>Link your account to fetch financial statements automatically.</p>

      <div style={{
        background: 'rgba(255,255,255,0.1)',
        padding: '15px',
        borderRadius: '10px',
        marginBottom: '20px',
        textAlign: 'center',
        fontSize: '0.9rem',
        color: '#a29bfe'
      }}>
        User ID: {userId}
      </div>

      <button className="google-btn" onClick={handleGoogleLogin}>
        <img
          src="https://developers.google.com/identity/images/g-logo.png"
          alt="Google Logo"
          style={{ width: "20px", height: "20px" }}
        />
        <span>Sign in with Google</span>
      </button>
    </div>
  );
}
