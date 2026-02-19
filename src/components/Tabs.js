import React, { useState } from 'react';

export default function Tabs({ tabs }) {
  const [active, setActive] = useState(tabs?.[0]?.id || '');
  const current = tabs.find(t => t.id === active);
  return (
    <div className="tabs">
      <div className="tab-headers">
        {tabs.map(t => (
          <button key={t.id}
            className={`tab ${t.id === active ? 'active':''}`}
            onClick={()=>setActive(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="tab-content">{current?.content}</div>
    </div>
  );
}
