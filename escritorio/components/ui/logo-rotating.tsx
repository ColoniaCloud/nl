'use client';

import { useRef, useState } from 'react';

export function LogoRotating() {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: x * 10, y: y * 10 });
  };

  const handleMouseLeave = () => setTilt({ x: 0, y: 0 });

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        width: 'clamp(200px, 30vw, 300px)',
        height: 'clamp(200px, 30vw, 300px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform 0.12s ease',
        transform: `perspective(800px) rotateX(${-tilt.y}deg) rotateY(${tilt.x}deg)`,
        cursor: 'default',
      }}
    >
      {/* El img tiene rotación continua + shimmer via CSS animation */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://api.nl360.site/wp-content/uploads/2026/01/Isotipo-NL360-Black.svg"
        alt="NL360 isotipo"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          animation: 'logoSpin 14s linear infinite, metallicShimmer 14s linear infinite',
          transformOrigin: 'center center',
        }}
      />
    </div>
  );
}

export default LogoRotating;
