import React, { useState } from "react";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { useNavigate, Link } from "react-router-dom";

export default function Register() {
  const auth = getAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      await createUserWithEmailAndPassword(auth, email, pass);
      nav("/", { replace: true });
    } catch (e) {
      setErr(e.message || "Register error");
    }
  };

  return (
    <div className="auth">
      <div className="auth-card">
        <h1 className="auth-title">Registration</h1>
        {err && <div className="auth-error">{err}</div>}
        <form onSubmit={onSubmit} className="auth-form">
          <input className="input auth-input" type="email" placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} />
          <input className="input auth-input" type="password" placeholder="Password" value={pass} onChange={(e)=>setPass(e.target.value)} />
          <button className="btn-primary auth-btn">Register!</button>
        </form>
        <div className="auth-foot">
          Already have account? <Link to="/login">Log in</Link>
        </div>
      </div>
    </div>
  );
}
