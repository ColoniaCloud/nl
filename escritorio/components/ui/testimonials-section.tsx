'use client';

import { motion, type Variants } from 'framer-motion';
import { Quote } from 'lucide-react';

const TESTIMONIALS = [
  {
    quote:
      'En 10 minutos tenía mi landing page funcionando. Nunca imaginé que podía ser tan fácil lanzar un sitio profesional desde cero.',
    name: 'Agustín R.',
    role: 'Emprendedor',
    location: 'Buenos Aires',
    initials: 'AR',
    avatarBg: 'rgba(100,220,100,0.25)',
  },
  {
    quote:
      'Margarita me armó el calendario de contenidos para todo el mes. Le ahorré horas de trabajo a todo mi equipo de marketing.',
    name: 'Luciana M.',
    role: 'Directora de Marketing',
    location: 'Córdoba',
    initials: 'LM',
    avatarBg: 'rgba(100,150,255,0.25)',
  },
  {
    quote:
      'Monté la tienda de mi emprendimiento con Nubia en una tarde. El nivel de detalle del sitio generado me sorprendió gratamente.',
    name: 'Tomás E.',
    role: 'Dueño de e-commerce',
    location: 'Rosario',
    initials: 'TE',
    avatarBg: 'rgba(255,180,100,0.25)',
  },
];

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
};

export function TestimonialsSection() {
  return (
    <section
      style={{
        background: '#0a0a0a',
        padding: 'clamp(5rem, 10vw, 8rem) clamp(1.5rem, 6vw, 6rem)',
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.55 }}
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
            Lo que dicen nuestros usuarios
          </p>
          <h2
            style={{
              fontFamily: 'var(--font-syne)',
              fontWeight: 800,
              fontSize: 'clamp(2rem, 4vw, 3rem)',
              color: 'white',
              margin: 0,
            }}
          >
            Resultados reales
          </h2>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem',
          }}
        >
          {TESTIMONIALS.map((t) => (
            <motion.div
              key={t.name}
              variants={cardVariants}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '16px',
                padding: '2.5rem 2rem',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Quote
                size={22}
                style={{ color: 'rgba(255,255,255,0.18)', marginBottom: '1.25rem', flexShrink: 0 }}
              />

              <p
                style={{
                  fontFamily: 'var(--font-montserrat)',
                  fontSize: '0.9rem',
                  color: 'rgba(255,255,255,0.7)',
                  lineHeight: 1.8,
                  margin: 0,
                  flex: 1,
                }}
              >
                {t.quote}
              </p>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.875rem',
                  marginTop: '2rem',
                  paddingTop: '1.5rem',
                  borderTop: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: t.avatarBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-syne)',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    color: 'rgba(255,255,255,0.9)',
                    flexShrink: 0,
                  }}
                >
                  {t.initials}
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: 'var(--font-syne)',
                      fontWeight: 700,
                      fontSize: '0.875rem',
                      color: 'white',
                    }}
                  >
                    {t.name}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-montserrat)',
                      fontSize: '0.72rem',
                      color: 'rgba(255,255,255,0.35)',
                      marginTop: '0.15rem',
                    }}
                  >
                    {t.role} · {t.location}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
