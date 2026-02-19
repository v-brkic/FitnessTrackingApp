import React from "react";
import { NavLink } from "react-router-dom";

export default function TopBar() {
  return (
    <div className="container" style={{paddingTop:12}}>
      <div className="topbar">
        <h1 className="app-title">Fitness <span style={{color:"var(--primary)"}}>App</span></h1>
        <div className="top-links">
          <NavLink to="/" className={({isActive})=>`top-link ${isActive?'active':''}`}>Početna</NavLink>
          <NavLink to="/workouts" className={({isActive})=>`top-link ${isActive?'active':''}`}>Workouts</NavLink>
          <NavLink to="/stats" className={({isActive})=>`top-link ${isActive?'active':''}`}>Statistika</NavLink>
        </div>
      </div>
    </div>
  );
}
