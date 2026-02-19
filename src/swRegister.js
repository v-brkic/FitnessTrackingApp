// src/swRegister.js

export function registerServiceWorker(onUpdateAvailable) {
  // SW ima smisla samo u production buildu
  if (process.env.NODE_ENV !== "production") return;

  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("/service-worker.js");

      // helper: aktivira waiting SW odmah
      const applyUpdate = () => {
        if (reg.waiting) {
          // CRA/Workbox očekuje objekt s type
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
        }
      };

      // Ako je već nešto u "waiting" (npr. nakon refresh-a)
      if (reg.waiting && navigator.serviceWorker.controller) {
        if (typeof onUpdateAvailable === "function") {
          onUpdateAvailable(applyUpdate);
        } else {
          applyUpdate();
        }
      }

      // Kad se pronađe update
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          // installed znači: novi SW je skinut
          if (newWorker.state === "installed") {
            // Ako već postoji controller -> ovo je update (ne prvi install)
            if (navigator.serviceWorker.controller) {
              if (typeof onUpdateAvailable === "function") {
                onUpdateAvailable(applyUpdate);
              } else {
                applyUpdate();
              }
            }
          }
        });
      });

      // Kad novi SW preuzme kontrolu, reloadaj stranicu (da povuče novi bundle)
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });

      // (opcionalno) periodično provjeri update
      setInterval(() => {
        reg.update().catch(() => {});
      }, 60 * 60 * 1000); // svakih 1h
    } catch (err) {
      console.warn("Service worker registration failed:", err);
    }
  });
}

export function unregisterServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker.ready
    .then((reg) => reg.unregister())
    .catch(() => {});
}
