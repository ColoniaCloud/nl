'use client';

import { motion, type Variants } from 'framer-motion';
import { Rocket, Building2, Briefcase } from 'lucide-react';

const AUDIENCES = [
  {
    icon: <Rocket size={32} />,
    title: 'Emprendedores',
    description:
      'Lanzá tu presencia digital profesional sin pagar una agencia ni esperar semanas. Tu negocio online, en horas.',
    iconBg: 'rgba(100,220,100,0.12)',
    iconColor: 'rgba(100,220,100,0.9)',
  },
  {
    icon: <Building2 size={32} />,
    title: 'Agencias',
    description:
      'Ofrecé sitios IA como servicio diferenciado a tus clientes. Escalá tu producción sin escalar tu equipo.',
    iconBg: 'rgba(100,150,255,0.12)',
    iconColor: 'rgba(100,150,255,0.9)',
  },
  {
    icon: <Briefcase size={32} />,
    title: 'Consultores',
    description:
      'Generá propuestas digitales reales en minutos. Mostrá resultados concretos desde la primera reunión.',
    iconBg: 'rgba(255,180,100,0.12)',
    iconColor: 'rgba(255,180,100,0.9)',
  },
];

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.14 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' as const } },
};

export function AudienceSection() {
  return (
    <section
      style={{
        background: 'white',
        padding: 'clamp(5rem, 10vw, 8rem) clamp(1.5rem, 6vw, 6rem)',
      }}
    >
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.55 }}
          style={{ textAlign: 'center', marginBottom: 'clamp(3rem, 6vw, 5rem)' }}
        >
          <p
            style={{
              color: '#bbb',
              fontSize: '0.72rem',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              fontFamily: 'var(--font-montserrat)',
              marginBottom: '1rem',
            }}
          >
            ¿Para quién es NL360?
          </p>
          <h2
            style={{
              fontFamily: 'var(--font-syne)',
              fontWeight: 700,
              fontSize: 'clamp(2rem, 4vw, 3rem)',
              color: '#111',
              margin: 0,
              maxWidth: '24ch',
              marginInline: 'auto',
            }}
          >
            Construido para quienes hacen las cosas
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
          {AUDIENCES.map((item) => (
            <motion.div
              key={item.title}
              variants={cardVariants}
              whileHover={{ y: -6, boxShadow: '0 12px 32px rgba(0,0,0,0.08)', transition: { duration: 0.2 } }}
              style={{
                border: '1px solid #f0f0f0',
                borderRadius: '16px',
                padding: '2.5rem 2rem',
                background: 'white',
                cursor: 'default',
                boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '56px',
                  height: '56px',
                  borderRadius: '14px',
                  background: item.iconBg,
                  color: item.iconColor,
                  marginBottom: '1.5rem',
                }}
              >
                {item.icon}
              </div>
              <h3
                style={{
                  fontFamily: 'var(--font-syne)',
                  fontWeight: 700,
                  fontSize: '1.25rem',
                  color: '#111',
                  margin: '0 0 0.75rem',
                }}
              >
                {item.title}
              </h3>
              <p
                style={{
                  fontFamily: 'var(--font-montserrat)',
                  fontSize: '0.9rem',
                  color: '#666',
                  lineHeight: 1.75,
                  margin: 0,
                }}
              >
                {item.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
