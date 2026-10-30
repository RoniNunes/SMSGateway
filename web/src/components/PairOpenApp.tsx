'use client';

import { useEffect } from 'react';

export function PairOpenApp({ deepLink }: { deepLink: string }) {
  function openApp() {
    const statusEl = document.getElementById('pair-status');
    if (statusEl) statusEl.textContent = 'A abrir a app…';
    window.location.href = deepLink;
    setTimeout(() => {
      if (statusEl) {
        statusEl.textContent = 'Se a app não abriu, instale o APK e tente novamente.';
      }
    }, 2500);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      if (document.visibilityState === 'visible') openApp();
    }, 400);
    return () => clearTimeout(t);
  }, [deepLink]);

  return (
    <button type="button" className="btn btn-primary pair-btn-block" onClick={openApp}>
      Abrir na app SMS Gateway
    </button>
  );
}