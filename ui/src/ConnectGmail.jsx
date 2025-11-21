import React from "react";

export default function ConnectGmail() {
  const userId = localStorage.getItem("user_id");

  const handleGoogleLogin = () => {
    if (!userId) {
      alert("Missing user id");
      return;
    }

    window.location.href = `http://localhost:8000/auth?user_id=${userId}`;
  };

  return (
    <div className="container">
      <h1>Connect Your Gmail</h1>
      <p>Your user ID: {userId}</p>

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
          fontFamily: "Arial",
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
  );
}
