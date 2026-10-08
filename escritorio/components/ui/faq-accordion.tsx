'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

const FAQ_ITEMS = [
  {
    q: '¿El sitio generado tiene código real o es un template?',
    a: 'Código Next.js real, generado por IA específicamente para tu negocio. No partimos de un template genérico: el agente Manu Dev escribe cada archivo a medida según tu brief y tu identidad.',
  },
  {
    q: '¿Puedo usar mi propio dominio personalizado?',
    a: 'Sí. Con los planes Pro y Elite podés configurar un dominio propio (tusitio.com) además del subdominio gratuito en .nl360.site. El proceso es guiado dentro del panel de workspace.',
  },
  {
    q: '¿Qué diferencia hay entre los agentes?',
    a: 'Manu Dev construye y deploya sitios web. Margarita gestiona tu estrategia de contenido y redes sociales. Jordan es tu asistente conversacional para consultas y procesos. MentorIA te capacita en emprendimiento y desarrollo personal con una suite de coaches IA.',
  },
  {
    q: '¿Los agentes hablan en español rioplatense?',
    a: 'Sí, todos los agentes están configurados en español rioplatense. Si le decís "che, necesito una landing page", te entiende perfectamente y responde en el mismo registro.',
  },
  {
    q: '¿Qué pasa si quiero editar el sitio después de generarlo?',
    a: 'Podés volver a chatear con Manu Dev en cualquier momento para hacer cambios, agregar secciones o actualizar contenido. Cada iteración regenera y redeploya el código automáticamente.',
  },
  {
    q: '¿Cómo funciona el pago? ¿Aceptan cripto?',
    a: 'Aceptamos tarjeta de crédito/débito vía Stripe y pagos en criptomonedas vía Coinbase Commerce. Los planes son mensuales o anuales (con descuento en anual).',
  },
];

export function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section
      style={{
        background: 'white',
        padding: 'clamp(5rem, 10vw, 8rem) clamp(1.5rem, 6vw, 6rem)',
      }}
    >
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.55 }}
          style={{ textAlign: 'center', marginBottom: 'clamp(3rem, 6vw, 4rem)' }}
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
            Preguntas frecuentes
          </p>
          <h2
            style={{
              fontFamily: 'var(--font-syne)',
              fontWeight: 700,
              fontSize: 'clamp(2rem, 4vw, 3rem)',
              color: '#111',
              margin: 0,
            }}
          >
            ¿Tenés dudas?
          </h2>
        </motion.div>

        <div style={{ borderTop: '1px solid #f0f0f0' }}>
          {FAQ_ITEMS.map((item, i) => (
            <div key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
              <button
                onClick={() => setOpen(open === i ? null : i)}
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '1.5rem',
                  padding: '1.5rem 0',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-syne)',
                    fontWeight: 700,
                    fontSize: 'clamp(0.9rem, 1.5vw, 1rem)',
                    color: '#111',
                    lineHeight: 1.4,
                  }}
                >
                  {item.q}
                </span>
                <motion.div
                  animate={{ rotate: open === i ? 180 : 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  style={{ flexShrink: 0, color: '#bbb' }}
                >
                  <ChevronDown size={20} />
                </motion.div>
              </button>

              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    style={{ overflow: 'hidden' }}
                  >
                    <p
                      style={{
                        fontFamily: 'var(--font-montserrat)',
                        fontSize: '0.9rem',
                        color: '#666',
                        lineHeight: 1.8,
                        margin: 0,
                        paddingBottom: '1.5rem',
                      }}
                    >
                      {item.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
