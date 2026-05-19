"use client";

import React, { useEffect, useRef } from "react";

type DotGridProps = {
  /** color base de dots */
  baseColor?: string;
  /** color interactivo (rgba base) */
  accentRgb?: [number, number, number];
  /** separación entre puntos */
  spacing?: number;
  /** radio base del punto */
  dotSize?: number;
  /** radio de influencia del mouse */
  mouseRadius?: number;
  /** opacidad base del efecto */
  accentMinAlpha?: number;
};

export default function DotGrid({
  baseColor = "rgba(255,255,255,0.08)",
  accentRgb = [139, 92, 246],
  spacing = 28,
  dotSize = 1.5,
  mouseRadius = 120,
  accentMinAlpha = 0.4,
}: DotGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const mouse = useRef({ x: -1000, y: -1000 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = parentRef.current;
    if (!canvas || !parent) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;

    let dots: { x: number; y: number; ox: number; oy: number }[] = [];

    const resize = () => {
      const rect = parent.getBoundingClientRect();

      // Canvas size real (CSS px)
      canvas.width = Math.max(1, Math.floor(rect.width));
      canvas.height = Math.max(1, Math.floor(rect.height));

      dots = [];
      for (let x = spacing / 2; x < canvas.width; x += spacing) {
        for (let y = spacing / 2; y < canvas.height; y += spacing) {
          dots.push({ x, y, ox: x, oy: y });
        }
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const dot of dots) {
        const dx = mouse.current.x - dot.ox;
        const dy = mouse.current.y - dot.oy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;

        let color = baseColor;
        let size = dotSize;

        if (dist < mouseRadius) {
          const ratio = 1 - dist / mouseRadius;

          dot.x = dot.ox + (dx / dist) * (ratio * 5);
          dot.y = dot.oy + (dy / dist) * (ratio * 5);

          const [r, g, b] = accentRgb;
          const a = Math.min(1, accentMinAlpha + ratio * (1 - accentMinAlpha));
          color = `rgba(${r}, ${g}, ${b}, ${a})`;
          size = dotSize + ratio * 2;
        } else {
          dot.x = dot.ox;
          dot.y = dot.oy;
        }

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = parent.getBoundingClientRect();
      mouse.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    // Observa cambios de tamaño del contenedor (mejor que window resize)
    const ro = new ResizeObserver(() => resize());

    ro.observe(parent);
    window.addEventListener("mousemove", onMouseMove);

    resize();
    draw();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, [accentMinAlpha, accentRgb, baseColor, dotSize, mouseRadius, spacing]);

  return (
    <div ref={parentRef} className="absolute inset-0 -z-10">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full pointer-events-none"
      />
    </div>
  );
}
