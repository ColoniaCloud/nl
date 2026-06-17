'use client';

import { motion, type Variants } from 'framer-motion';
import { ExternalLink, Globe } from 'lucide-react';

export interface ShowcaseSite {
  subdomain: string;
  status: string;
  created_at: Date | string;
}

interface SitesShowcaseProps {
  sites: ShowcaseSite[];
  total: number;
}

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, scale: 0.97 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.35, ease: 'easeOut' } },
};

export function SitesShowcase({ sites, total }: SitesShowcaseProps) {
  if (!sites || sites.length === 0) return null;

  return (
    <section
      style={{
        background: '#f7f7f7',
        padding: 'clamp(5rem, 10vw, 8rem) clamp(1.5rem, 6vw, 6rem)',
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

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
            Generados con NL360
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
            {total}+ sitios ya en producción
          </h2>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
            gap: '0.875rem',
          }}
        >
          {sites.map((site) => (
            <motion.a
              key={site.subdomain}
              href={`https://${site.subdomain}.nl360.site`}
              target="_blank"
              rel="noopener noreferrer"
              variants={cardVariants}
              whileHover={{ y: -3, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', transition: { duration: 0.15 } }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                background: 'white',
                border: '1px solid #eee',
                borderRadius: '10px',
                padding: '0.875rem 1rem',
                textDecoration: 'none',
                color: 'inherit',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: '#f3f3f3',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: '#aaa',
                }}
              >
                <Globe size={15} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: 'var(--font-syne)',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    color: '#111',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {site.subdomain}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-montserrat)',
                    fontSize: '0.7rem',
                    color: '#bbb',
                    marginTop: '0.1rem',
                  }}
                >
                  .nl360.site
                </div>
              </div>
              <ExternalLink size={13} style={{ color: '#ddd', flexShrink: 0 }} />
            </motion.a>
          ))}
        </motion.div>

        {total > sites.length && (
          <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
            <a
              href="/workspace"
              style={{
                fontFamily: 'var(--font-montserrat)',
                fontSize: '0.85rem',
                color: '#888',
                textDecoration: 'underline',
                textUnderlineOffset: '3px',
              }}
            >
              Ver todos los sitios →
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
