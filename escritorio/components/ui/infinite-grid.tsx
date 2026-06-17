'use client';

import { useRef, useEffect } from 'react';
import {
  motion,
  useMotionValue,
  useMotionTemplate,
  useAnimationFrame,
  type MotionValue,
} from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * Patrón SVG del grid, desplazable vía motion values.
 */
function GridPattern({
  offsetX,
  offsetY,
  size,
}: {
  offsetX: MotionValue<number>;
  offsetY: MotionValue<number>;
  size: number;
}) {
  return (
    <svg className="w-full h-full">
      <defs>
        <motion.pattern
          id="infinite-grid-pattern"
          width={size}
          height={size}
          patternUnits="userSpaceOnUse"
          x={offsetX}
          y={offsetY}
        >
          <path
            d={`M ${size} 0 L 0 0 0 ${size}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            className="text-muted-foreground"
          />
        </motion.pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#infinite-grid-pattern)" />
    </svg>
  );
}

/**
 * Fondo decorativo: grid que se desplaza infinitamente + una capa que se
 * revela con un efecto "flashlight" siguiendo el cursor + esferas de blur.
 *
 * Se posiciona absoluto y llena su contenedor padre (que debe ser
 * position:relative). Es pointer-events:none para no interferir con el
 * contenido superpuesto. El cursor se trackea sobre el padre, así el
 * flashlight funciona aunque el mouse esté sobre el contenido.
 */
export function InfiniteGrid({
  gridSize = 40,
  className,
}: {
  gridSize?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const mouseX = useMotionValue(-1000);
  const mouseY = useMotionValue(-1000);
  const gridOffsetX = useMotionValue(0);
  const gridOffsetY = useMotionValue(0);

  useEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    const onMove = (e: MouseEvent) => {
      const r = parent.getBoundingClientRect();
      mouseX.set(e.clientX - r.left);
      mouseY.set(e.clientY - r.top);
    };
    parent.addEventListener('mousemove', onMove);
    return () => parent.removeEventListener('mousemove', onMove);
  }, [mouseX, mouseY]);

  useAnimationFrame(() => {
    // Reset en el ancho del patrón para simular infinito.
    gridOffsetX.set((gridOffsetX.get() + 0.5) % gridSize);
    gridOffsetY.set((gridOffsetY.get() + 0.5) % gridSize);
  });

  const maskImage = useMotionTemplate`radial-gradient(300px circle at ${mouseX}px ${mouseY}px, black, transparent)`;

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn(
        'absolute inset-0 overflow-hidden pointer-events-none',
        className
      )}
    >
      {/* Capa 1: grid sutil siempre visible */}
      <div className="absolute inset-0 opacity-[0.06]">
        <GridPattern offsetX={gridOffsetX} offsetY={gridOffsetY} size={gridSize} />
      </div>

      {/* Capa 2: grid resaltado revelado por el cursor */}
      <motion.div
        className="absolute inset-0 opacity-40"
        style={{ maskImage, WebkitMaskImage: maskImage }}
      >
        <GridPattern offsetX={gridOffsetX} offsetY={gridOffsetY} size={gridSize} />
      </motion.div>

      {/* Esferas de blur decorativas (suaves sobre fondo claro) */}
      <div className="absolute inset-0">
        <div className="absolute right-[-15%] top-[-20%] w-[40%] h-[40%] rounded-full bg-orange-500/15 blur-[120px]" />
        <div className="absolute right-[10%] top-[-10%] w-[22%] h-[22%] rounded-full bg-violet-500/15 blur-[100px]" />
        <div className="absolute left-[-10%] bottom-[-20%] w-[40%] h-[40%] rounded-full bg-blue-500/15 blur-[120px]" />
      </div>
    </div>
  );
}

export default InfiniteGrid;
