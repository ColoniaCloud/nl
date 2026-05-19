"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type VoiceInputProps = {
  onText: (text: string) => void;
  disabled?: boolean;
  lang?: string; // "es-ES"
};

/**
 * Tipos mínimos para Web Speech API (para que TS no rompa).
 * Mantenerlo acá hace que sea 100% borrable luego.
 */
type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string; confidence?: number };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onstart: null | (() => void);
  onend: null | (() => void);
  onerror: null | ((e: any) => void);
  onresult: null | ((e: SpeechRecognitionEventLike) => void);
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionCtor;
    SpeechRecognition?: SpeechRecognitionCtor;
  }
}

export default function VoiceInput({ onText, disabled, lang = "es-ES" }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string>("");
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  const supported = useMemo(() => {
    if (typeof window === "undefined") return false;
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }, []);

  useEffect(() => {
    if (!supported) return;

    const Ctor = (window.SpeechRecognition || window.webkitSpeechRecognition) as SpeechRecognitionCtor;
    const rec = new Ctor();

    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false;

    rec.onstart = () => {
      setError("");
      setIsListening(true);
    };

    rec.onend = () => {
      setIsListening(false);
    };

    rec.onerror = (e: any) => {
      setError(e?.error ? String(e.error) : "voice_error");
      setIsListening(false);
    };

    rec.onresult = (event: SpeechRecognitionEventLike) => {
      let finalText = "";
      let interimText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const chunk = res?.[0]?.transcript ?? "";
        if (res.isFinal) finalText += chunk;
        else interimText += chunk;
      }

      if (finalText.trim().length > 0) {
        onText(finalText.trim());
        try {
          rec.stop();
        } catch {}
      }
    };

    recRef.current = rec;

    return () => {
      try {
        rec.stop();
      } catch {}
      recRef.current = null;
    };
  }, [supported, lang, onText]);

  function start() {
    setError("");
    if (!recRef.current) return;
    try {
      recRef.current.start();
    } catch (e: any) {
      setError(e?.message ?? "start_failed");
      setIsListening(false);
    }
  }

  function stop() {
    if (!recRef.current) return;
    try {
      recRef.current.stop();
    } catch {}
    setIsListening(false);
  }

  if (!supported) {
    return (
      <div className="text-xs text-muted-foreground">
        Voz no soportada en este navegador. (Tip: Chrome)
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => (isListening ? stop() : start())}
        className="rounded-md border px-3 py-2 text-sm hover:bg-muted/50 disabled:opacity-50"
        title={isListening ? "Detener" : "Hablar"}
      >
        {isListening ? "🎙️ Escuchando…" : "🎙️ Hablar"}
      </button>

      {error && <div className="text-xs text-red-500">Voz: {error}</div>}
    </div>
  );
}
