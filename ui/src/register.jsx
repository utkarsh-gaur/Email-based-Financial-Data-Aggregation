import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from "react-router-dom";

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [dob, setDob] = useState('');
  const [msg, setMsg] = useState('');

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await axios.post('http://localhost:5000/users', {
        full_name: fullName,
        mobile,
        dob
      });

      const userId = res.data.user_id;
      localStorage.setItem("user_id", userId);

      navigate("/connect-gmail");
    } catch (err) {
      console.error(err);
      setMsg('Error saving user');
    }
  };

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

      {msg && <p>{msg}</p>}
    </div>
  );
}
