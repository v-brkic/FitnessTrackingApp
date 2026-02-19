import React, { useEffect, useState } from "react";

const TIPS = [
  "Drži se progresivnog opterećenja – mala povećanja su ok.",
  "Zagrijavanje 5–10 min prije težih setova smanjuje rizik ozljede.",
  "Proteini: ciljaj 1.6–2.2 g/kg tjelesne mase dnevno.",
  "Kvalitetan san je jednako bitan kao i trening.",
  "Bilježi kilaže i setove – lakše vidiš napredak.",
];

export default function TipsBar() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI(v => (v + 1) % TIPS.length), 10000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="advice-box" role="note" aria-live="polite">
      <div className="advice-box-inner">
        <span className="advice-label" style={{color:"#60a5fa"}}>Tip</span>
        <span className="advice-text">{TIPS[i]}</span>
      </div>
    </div>
  );
}
