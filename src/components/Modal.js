import React, { useEffect } from "react";

export default function Modal({ open, onClose, title, footer, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const stop = (e) => e.stopPropagation();

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={stop} role="dialog" aria-modal="true" aria-label={title || "Modal"}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Zatvori">✕</button>
        </div>

        {/* Tijelo je skrolabilno */}
        <div className="modal-body">
          {children}
        </div>

        {/* Footer je sticky i uvijek vidljiv */}
        <div className="modal-footer">
          {footer}
        </div>
      </div>
    </div>
  );
}
