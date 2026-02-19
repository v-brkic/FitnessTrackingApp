import React, { useState } from "react";

/** Interaktivne zvjezdice (radi i na mobitelu) */
export default function StarRating({
  value = 0,
  onChange,
  size = 18,
  readOnly = false,
}) {
  const [hover, setHover] = useState(0);
  const active = hover || value;

  const StarBtn = ({ idx }) => {
    const filled = active >= idx;
    return (
      <button
        type="button"
        className={`star-btn ${filled ? "filled" : ""} ${
          readOnly ? "ro" : ""
        }`}
        style={{ width: size + 6, height: size + 6 }}
        onMouseEnter={() => !readOnly && setHover(idx)}
        onMouseLeave={() => !readOnly && setHover(0)}
        onClick={() => !readOnly && onChange?.(idx)}
        aria-label={`${idx} star`}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            d="M12 17.3l-5.5 3 1.1-6.3L3 9.8l6.3-.9L12 3l2.7 5.9 6.3.9-4.6 4.2 1.1 6.3z"
            fill="currentColor"
          />
        </svg>
      </button>
    );
  };

  return (
    <div className={`stars ${readOnly ? "readonly" : ""}`} role="img">
      {[1, 2, 3, 4, 5].map((i) => (
        <StarBtn key={i} idx={i} />
      ))}
    </div>
  );
}
