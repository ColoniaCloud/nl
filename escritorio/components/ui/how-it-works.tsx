'use client';

import { motion, type Variants } from 'framer-motion';
import { MessageSquare, Sparkles, Globe } from 'lucide-react';

const STEPS = [
  {
    number: '01',
    icon: <MessageSquare size={28} />,
    title: 'Describís tu negocio',
    description:
      'Chateás con Manu Dev y le contás qué necesitás. Sin formularios, sin briefs técnicos. Solo una conversación.',
  },
  {
    number: '02',
    icon: <Sparkles size={28} />,
    title: 'La IA genera tu sitio',
    description:
      'En minutos, código Next.js real adaptado a tu identidad y contenido. No templates genéricos, código tuyo.',
  },
  {
    number: '03',
    icon: <Globe size={28} />,
    title: 'Tu sitio queda live',
    description:
      'Desplegado automáticamente en tusitio.nl360.site con SSL incluido. Listo para compartir desde el primer minuto.',
  },
];

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.18 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
};

export function HowItWorks() {
  return (
    <section
      style={{
        background: '#0a0a0a',
        padding: 'clamp(5rem, 10vw, 8rem) clamp(1.5rem, 6vw, 6rem)',
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          style={{ textAlign: 'center', marginBottom: 'clamp(3rem, 6vw, 5rem)' }}
        >
          <p
            style={{
              color: 'rgba(100,220,100,0.85)',
              fontSize: '0.72rem',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              fontFamily: 'var(--font-montserrat)',
              marginBottom: '1rem',
            }}
          >
            Cómo funciona
          </p>
          <h2
            style={{
              fontFamily: 'var(--font-syne)',
              fontWeight: 700,
              fontSize: 'clamp(2rem, 4vw, 3rem)',
              color: 'white',
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            De la idea al sitio live
            <br />
            en minutos
          </h2>
        </motion.div>

        {/* Steps grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '1.5rem',
          }}
        >
          {STEPS.map((step) => (
            <motion.div
              key={step.number}
              variants={itemVariants}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '16px',
                padding: '2.5rem 2rem',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Huge watermark number */}
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: '-0.5rem',
                  right: '1rem',
                  fontFamily: 'var(--font-syne)',
                  fontWeight: 800,
                  fontSize: '6.5rem',
                  color: 'rgba(255,255,255,0.035)',
                  lineHeight: 1,
                  userSelect: 'none',
                  pointerEvents: 'none',
                }}
              >
                {step.number}
              </div>

              {/* Icon badge */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '52px',
                  height: '52px',
                  borderRadius: '12px',
                  background: 'rgba(100,220,100,0.1)',
                  color: 'rgba(100,220,100,0.9)',
                  marginBottom: '1.5rem',
                }}
              >
                {step.icon}
              </div>

              <h3
                style={{
                  fontFamily: 'var(--font-syne)',
                  fontWeight: 700,
                  fontSize: '1.125rem',
                  color: 'white',
                  margin: '0 0 0.75rem',
                }}
              >
                {step.title}
              </h3>

              <p
                style={{
                  fontFamily: 'var(--font-montserrat)',
                  fontSize: '0.9rem',
                  color: 'rgba(255,255,255,0.5)',
                  lineHeight: 1.75,
                  margin: 0,
                }}
              >
                {step.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
