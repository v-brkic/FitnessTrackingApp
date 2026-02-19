// src/components/GlobalHeader.js
import React from "react";

export default function GlobalHeader() {
  return (
    <div className="app-header">
      <h1 className="app-title">
        Fitness <span style={{ color: "var(--primary)" }}>App</span>
      </h1>
      {/*}<div className="global-logo" title="Logo">{*/}
        <img
          src="/brkicLogo.png"
          alt="Logo"
          id="adjust"
          onError={(e) => {
            // ako nema slike, pokaži emoji
            e.currentTarget.replaceWith(document.createTextNode("🏋️"));
          }}
        />
      {/*}</div>{*/}
    </div>
  );
}
