import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import RequireAuth from "./components/RequireAuth";
import TopBar from "./components/TopBar";
import TipsBar from "./components/TipsBar";
import Advice from "./components/Advice";
import Home from "./pages/Home";
import Workouts from "./pages/Workouts";
import WorkoutDetails from "./pages/WorkoutDetails";
import Stats from "./pages/Stats";
import Login from "./pages/Login";
import Register from "./pages/Register";
import GlobalHeader from "./components/GlobalHeader"; // ⬅️ DODANO

export default function App() {
  return (
    <BrowserRouter>
      {/* Postojeći topbar (desktop) */}
      <TopBar />

      {/* Globalni naslov + logo na svim stranicama */}
      <GlobalHeader />

      <Routes>
        {/* auth */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        

        {/* app */}
        <Route
          path="/"
          element={
            <RequireAuth>
              <Home />
            </RequireAuth>
          }
        />
        <Route
          path="/workouts"
          element={
            <RequireAuth>
              <Workouts />
            </RequireAuth>
          }
        />
        <Route
          path="/workouts/:id"
          element={
            <RequireAuth>
              <WorkoutDetails />
            </RequireAuth>
          }
        />
        <Route
          path="/stats"
          element={
            <RequireAuth>
              <Stats />
            </RequireAuth>
          }
        />

        {/* fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
