'use client';

import { useEffect, useRef } from 'react';

type InteractiveGradientBackgroundProps = {
  className?: string;
  children?: React.ReactNode;
  intensity?: number;
  interactive?: boolean;
  initialOffset?: { x?: number; y?: number };
  dark?: boolean;
};

export default function InteractiveGradientBackground({
  className = '',
  children,
  intensity = 1,
  interactive = true,
  initialOffset,
  dark = false,
}: InteractiveGradientBackgroundProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const pos = useRef({ x: 0, y: 0 });
  const returning = useRef(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const initX = initialOffset?.x ?? 0;
    const initY = initialOffset?.y ?? 0;
    pos.current = { x: initX, y: initY };

    const setVars = (x: number, y: number) => {
      host.style.setProperty('--posX', String(x | 0));
      host.style.setProperty('--posY', String(y | 0));
    };

    setVars(initX, initY);

    if (!interactive) return;

    const prefersReduced =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const smoothReturn = () => {
      returning.current = true;
      const tick = () => {
        pos.current.x = lerp(pos.current.x, 0, 0.07);
        pos.current.y = lerp(pos.current.y, 0, 0.07);
        setVars(pos.current.x, pos.current.y);

        if (Math.abs(pos.current.x) > 0.5 || Math.abs(pos.current.y) > 0.5) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          setVars(0, 0);
          pos.current = { x: 0, y: 0 };
          returning.current = false;
          rafRef.current = null;
        }
      };
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      if (!e.isPrimary) return;

      if (returning.current) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        returning.current = false;
      }

      const rect = host.getBoundingClientRect();
      const k = prefersReduced ? 0.05 : intensity;
      pos.current.x = (e.clientX - rect.left - rect.width / 2) * k;
      pos.current.y = (e.clientY - rect.top - rect.height / 2) * k;

      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          setVars(pos.current.x, pos.current.y);
        });
      }
    };

    const onLeave = () => smoothReturn();
    const onUp = (e: PointerEvent) => {
      if (e.pointerType === 'touch') smoothReturn();
    };

    host.addEventListener('pointermove', onMove, { passive: true });
    host.addEventListener('pointerleave', onLeave);
    host.addEventListener('pointerup', onUp);

    return () => {
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
      host.removeEventListener('pointerup', onUp);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [interactive, intensity, initialOffset?.x, initialOffset?.y]);

  return (
    <div
      ref={hostRef}
      aria-label="Interactive gradient background"
      role="img"
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        overflow: 'hidden',
        touchAction: 'pan-y',
        // @ts-ignore
        '--posX': '0',
        '--posY': '0',
      }}
    >
      {/* Light mode */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          opacity: dark ? 0 : 1,
          transition: 'opacity 0.5s ease',
          background: `
            linear-gradient(115deg, rgb(20 55 30), rgb(0 0 0)),
            radial-gradient(90% 100% at calc(50% + var(--posX)*1px) calc(0% + var(--posY)*1px), rgb(70 70 90), rgb(8 0 18)),
            radial-gradient(100% 100% at calc(80% - var(--posX)*1px) calc(0% - var(--posY)*1px), rgb(100 110 0), rgb(12 0 0)),
            radial-gradient(150% 210% at calc(100% + var(--posX)*1px) calc(0% + var(--posY)*1px), rgb(8 90 65), rgb(0 4 130)),
            radial-gradient(100% 100% at calc(100% - var(--posX)*1px) calc(30% - var(--posY)*1px), rgb(140 40 0), rgb(0 100 130)),
            linear-gradient(60deg, rgb(130 0 0), rgb(55 35 180))
          `,
          backgroundBlendMode:
            'overlay, overlay, difference, difference, difference, normal',
        }}
      />

      {/* Dark mode */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          opacity: dark ? 1 : 0,
          transition: 'opacity 0.5s ease',
          background: `
            linear-gradient(115deg, rgb(8 18 12), rgb(0 0 0)),
            radial-gradient(90% 100% at calc(50% + var(--posX)*1px) calc(0% + var(--posY)*1px), rgb(40 40 60), rgb(4 0 12)),
            radial-gradient(100% 100% at calc(80% - var(--posX)*1px) calc(0% - var(--posY)*1px), rgb(60 70 0), rgb(8 0 0)),
            radial-gradient(150% 210% at calc(100% + var(--posX)*1px) calc(0% + var(--posY)*1px), rgb(4 40 30), rgb(0 2 65)),
            radial-gradient(100% 100% at calc(100% - var(--posX)*1px) calc(30% - var(--posY)*1px), rgb(65 20 0), rgb(0 55 80)),
            linear-gradient(60deg, rgb(65 0 0), rgb(32 20 100))
          `,
          backgroundBlendMode:
            'overlay, overlay, difference, difference, difference, normal',
        }}
      />

      {/* Contrast veil */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(to bottom, rgba(0,0,0,0.40) 0%, rgba(0,0,0,0.18) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Content */}
      {children ? (
        <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
      ) : null}
    </div>
  );
}

export { InteractiveGradientBackground };
