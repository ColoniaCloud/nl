'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';

type RevealProps = HTMLMotionProps<'div'> & {
  /** Retraso de entrada en segundos (para escalonar) */
  delay?: number;
  /** Desplazamiento vertical inicial en px */
  y?: number;
};

/**
 * Wrapper de animación de entrada: fade + slide-up al entrar en viewport.
 * `viewport.once` evita que se repita al volver a scrollear.
 */
export function Reveal({ delay = 0, y = 28, children, ...props }: RevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export default Reveal;
