'use client';

import { motion, useScroll, useTransform } from 'framer-motion';

/**
 * Ilustración de intro con dos efectos:
 *  - Floating: sube/baja en loop infinito.
 *  - Color por scroll: el color por defecto es lila (#6c63ff de la SVG) y va
 *    rotando el matiz a medida que el usuario hace scroll por la página.
 */
export function IntroIllustration() {
  const { scrollYProgress } = useScroll();
  // 0 (arriba del todo) → lila por defecto; al bajar, el matiz va girando.
  const filter = useTransform(
    scrollYProgress,
    [0, 1],
    ['hue-rotate(0deg)', 'hue-rotate(300deg)']
  );

  return (
    <div
      style={{
        width: 'clamp(280px, 40vw, 480px)',
        maxWidth: '100%',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <motion.img
        src="/front/intro.svg"
        alt="Ilustración NL360"
        style={{
          width: '100%',
          height: 'auto',
          filter,
          willChange: 'transform, filter',
        }}
        animate={{ y: [0, -18, 0] }}
        transition={{
          duration: 5,
          ease: 'easeInOut',
          repeat: Number.POSITIVE_INFINITY,
        }}
      />
    </div>
  );
}

export default IntroIllustration;
