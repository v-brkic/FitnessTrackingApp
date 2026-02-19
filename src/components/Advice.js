import React, { useEffect, useState } from "react";

const DEFAULT_TIPS = [
  "Warm-up 5–10 min i aktiviraj core.",
  "Drži tempo: 2–3 s ekscentrično, 1 s koncentrično.",
  "Pij vodu između serija.",
  "Bilježi setove i napredak.",
  "Dodaj 1–2 serije tjedno (overload).",
  "Ne preskači mobilnost i istezanje.",
];

export default function Advice({ tips = DEFAULT_TIPS, intervalMs = 10000 }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % tips.length), intervalMs);
    return () => clearInterval(id);
  }, [tips, intervalMs]);

  return (
    <div className="advice-box">
      <div className="advice-box-inner">
        <div className="advice-label">Tip</div>
        <div key={i} className="advice-text">{tips[i]}</div>
      </div>
    </div>
  );
}
