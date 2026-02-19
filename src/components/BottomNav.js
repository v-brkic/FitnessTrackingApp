import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function BottomNav(){
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const go = (p)=>()=>navigate(p);

  return (
    <nav className="bottom-nav">
      <button className={`bn-item ${pathname === "/" ? "active":""}`} onClick={go("/")}>
        {/*}<span className="bn-icon">🏠</span>{*/}
        <span>Home</span>
      </button>
      <button className={`bn-item ${pathname.startsWith("/workouts") ? "active":""}`} onClick={go("/workouts")}>
        {/*}<span className="bn-icon">💪</span>{*/}
        <span>Workouts</span>
      </button>
      <button className={`bn-item ${pathname.startsWith("/stats") ? "active":""}`} onClick={go("/stats")}>
        {/*}<span className="bn-icon">📈</span>{*/}
        <span>Statistics</span>
      </button>
    </nav>
  );
}
