'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

interface AgentCardTiltProps {
  image: string;
  title: string;
  description: string;
  href: string;
}

const MAX_TILT = 12; // grados

const BASE_SHADOW = `
  0 0 0 1px rgba(180,180,180,0.5),
  inset 0 1px 0 rgba(255,255,255,0.8),
  0 2px 8px rgba(0,0,0,0.06)
`;

export function AgentCardTilt({ image, title, description, href }: AgentCardTiltProps) {
  const [transform, setTransform] = useState(
    'perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)'
  );
  const [shadow, setShadow] = useState(BASE_SHADOW);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 a 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTransform(
      `perspective(800px) rotateX(${-y * MAX_TILT}deg) rotateY(${x * MAX_TILT}deg) scale(1.02)`
    );
    // Luz direccional según el tilt
    setShadow(`
      0 0 0 1px rgba(180,180,180,0.6),
      inset 0 1px 0 rgba(255,255,255,0.9),
      ${x * 14}px ${y * 14}px 22px rgba(0,0,0,0.10)
    `);
  };

  const handleMouseLeave = () => {
    setTransform('perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)');
    setShadow(BASE_SHADOW);
  };

  return (
    <a href={href} style={{ textDecoration: 'none', display: 'block' }}>
      <div
        style={{
          position: 'relative',
          background: 'white',
          borderRadius: '12px',
          boxShadow: shadow,
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          transform,
          transformStyle: 'preserve-3d',
          cursor: 'pointer',
          padding: '2rem',
          height: '100%',
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <motion.div
            initial={{ opacity: 0, filter: 'blur(8px)', rotate: -30, scale: 0.75 }}
            whileInView={{ opacity: 1, filter: 'blur(0px)', rotate: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            style={{ width: '64px', height: '64px', flexShrink: 0 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="" width={64} height={64} style={{ objectFit: 'contain' }} />
          </motion.div>
          <div>
            <div
              style={{
                fontFamily: 'var(--font-syne)',
                fontWeight: 700,
                fontSize: '1.125rem',
                color: '#111',
              }}
            >
              {title}
            </div>
            <div
              style={{
                fontSize: '0.875rem',
                color: '#666',
                marginTop: '0.375rem',
                lineHeight: 1.5,
              }}
            >
              {description}
            </div>
          </div>
        </div>
      </div>
    </a>
  );
}

export default AgentCardTilt;
