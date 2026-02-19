import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { registerServiceWorker } from "./swRegister";

// primjer malog toasta kad je dostupna nova verzija:
registerServiceWorker((applyUpdate) => {
  // minimalistički prompt koji radi svugdje
  if (window.confirm("Dostupna je nova verzija aplikacije. Osvježi sad?")) {
    applyUpdate(); // pošalje SKIP_WAITING; nakon toga se stranica automatski reloada (controllerchange)
  }
});


const root = createRoot(document.getElementById('root'));
root.render(<App />);
