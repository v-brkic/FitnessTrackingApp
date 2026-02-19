import React, { useEffect, useState } from "react";
import { onAuthStateChanged, getAuth } from "firebase/auth";
import { useLocation, useNavigate } from "react-router-dom";
import { auth } from "../firebaseConfig";

export default function RequireAuth({ children }) {
  const auth = getAuth();
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const navigate = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthed(!!user);
      setReady(true);
      if (!user) {
        navigate("/login", { replace: true, state: { from: loc.pathname } });
      }
    });
    return () => unsub();
  }, [auth, navigate, loc.pathname]);

  if (!ready) return null;
  if (!authed) return null;

  return <>{children}</>;
}
