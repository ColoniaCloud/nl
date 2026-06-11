"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";

type Accent = "emerald" | "sky" | "amber" | "primary" | "violet" | "rose";

const IDLE_CLASSES: Record<Accent, string> = {
  emerald: "hover:text-emerald-400 hover:border-emerald-500/40 hover:bg-emerald-500/10",
  sky:     "hover:text-sky-400 hover:border-sky-500/40 hover:bg-sky-500/10",
  amber:   "hover:text-amber-400 hover:border-amber-500/40 hover:bg-amber-500/10",
  primary: "hover:text-primary hover:border-primary/40 hover:bg-primary/10",
  violet:  "hover:text-violet-400 hover:border-violet-500/40 hover:bg-violet-500/10",
  rose:    "hover:text-rose-400 hover:border-rose-500/40 hover:bg-rose-500/10",
};

interface Props {
  onText: (text: string) => void;
  disabled?: boolean;
  accent?: Accent;
}

export default function VoiceMicButton({ onText, disabled = false, accent = "primary" }: Props) {
  const [supported, setSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recRef = useRef<any>(null);
  // Keep onText stable in the recognition handler without recreating it
  const onTextRef = useRef(onText);
  useEffect(() => { onTextRef.current = onText; }, [onText]);

  useEffect(() => {
    const Ctor =
      (typeof window !== "undefined" &&
        (window.SpeechRecognition || (window as any).webkitSpeechRecognition)) || null;
    if (!Ctor) return;
    setSupported(true);

    const rec = new (Ctor as any)();
    rec.lang = "es-AR";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onstart = () => setIsListening(true);
    rec.onend   = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);
    rec.onresult = (e: any) => {
      const transcript: string = e.results?.[0]?.[0]?.transcript ?? "";
      if (transcript.trim()) onTextRef.current(transcript.trim());
    };
    recRef.current = rec;

    return () => {
      try { rec.stop(); } catch {}
      recRef.current = null;
    };
  }, []);

  if (!supported) return null;

  function toggle() {
    const rec = recRef.current;
    if (!rec) return;
    try {
      if (isListening) rec.stop();
      else rec.start();
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      title={isListening ? "Detener grabación" : "Dictar mensaje"}
      className={[
        "nl-send-btn flex items-center justify-center rounded-full border transition-colors disabled:opacity-40",
        isListening
          ? "bg-red-500/20 border-red-500/40 text-red-400 animate-pulse"
          : `border-border text-muted-foreground ${IDLE_CLASSES[accent]}`,
      ].join(" ")}
    >
      {isListening ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
    </button>
  );
}
