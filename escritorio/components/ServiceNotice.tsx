"use client";

import { useState } from "react";

export default function ServiceNotice() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-xs rounded-2xl border border-amber-400/20 bg-black/40 px-4 py-3 text-sm text-white/70 shadow-[var(--shadow-lg)] backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
        <p className="flex-1 leading-snug text-xs text-white/60">
          El servidor puede presentar demoras mientras se construyen nuevas funcionalidades.
          La IA sigue activa.
        </p>
        <button
          onClick={() => setVisible(false)}
          className="ml-1 shrink-0 rounded-full p-0.5 text-white/40 hover:text-white/80 transition-colors"
          aria-label="Cerrar aviso"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
