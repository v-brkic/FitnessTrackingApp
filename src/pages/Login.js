import React, { useState } from "react";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { useNavigate, Link } from "react-router-dom";

export default function Login() {
  const auth = getAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      nav("/", { replace: true });
    } catch (e) {
      setErr(e.message || "Login error");
    }
  };

  return (
    <div className="auth">
      <div className="auth-card">
        <h1 className="auth-title">Log in</h1>
        {err && <div className="auth-error">{err}</div>}
        <form onSubmit={onSubmit} className="auth-form">
          <input className="input auth-input" type="email" placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} />
          <input className="input auth-input" type="password" placeholder="Password" value={pass} onChange={(e)=>setPass(e.target.value)} />
          <button className="btn-primary auth-btn">Log in</button>
        </form>
        <div className="auth-foot">
          You don't have account? <Link to="/register">Register</Link>
        </div>
      </div>
    </div>
  );
}
