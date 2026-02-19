import React, { useMemo } from "react";

/**
 * Pull bar (range) za težinu.
 * value: 0–5 (integer). Ako želiš finije korake, promijeni max/step.
 * readOnly: prikazuje samo puni bar (bez interakcije).
 */
export default function DifficultySlider({
  value = 0,
  onChange,
  min = 0,
  max = 5,
  step = 1,
  readOnly = false,
  size = "md", // 'sm' | 'md'
}) {
  const pct = useMemo(() => {
    const span = max - min || 1;
    const clamped = Math.min(max, Math.max(min, Number(value || 0)));
    return ((clamped - min) / span) * 100;
  }, [value, min, max]);

  if (readOnly) {
    return (
      <div className={`diff-readonly ${size}`}>
        <div className="diff-bg" />
        <div className="diff-fill" style={{ width: `${pct}%` }} />
      </div>
    );
  }

  return (
    <div className={`diff-slider ${size}`}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value ?? 0}
        onChange={(e) => onChange?.(Number(e.target.value))}
        className="diff-range"
        aria-label="Težina"
      />
      <div className="diff-meter">
        <div className="diff-bg" />
        <div className="diff-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="diff-labels">
        <span>0</span>
        <span>5</span>
      </div>
    </div>
  );
}
