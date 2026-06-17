import { cookies } from 'next/headers';
import { Code2, Megaphone, MessageSquare, GraduationCap, ArrowRight } from 'lucide-react';
import { GradientDots } from '@/components/ui/gradient-dots';
import { AgentCardTilt } from '@/components/ui/agent-card-tilt';
import { LogoRotating } from '@/components/ui/logo-rotating';
import { HeroLoginForm } from '@/components/ui/hero-login-form';
import { IntroIllustration } from '@/components/ui/intro-illustration';
import { PlansPricing } from '@/components/ui/plans-pricing';
import { PLANS as BILLING_PLANS } from '@/lib/billing-plans';

// ─── Datos estáticos ─────────────────────────────────────────────────────────

const AGENTS = [
  {
    icon: <Code2 size={36} />,
    title: 'Manu Dev',
    description: 'Creá tu sitio web con IA en minutos',
    href: '/services/manu-dev',
  },
  {
    icon: <Megaphone size={36} />,
    title: 'Margarita',
    description: 'Estrategia y contenido para redes sociales',
    href: '/services/margarita',
  },
  {
    icon: <MessageSquare size={36} />,
    title: 'Jordan',
    description: 'Tu asistente conversacional inteligente',
    href: '/services/grant',
  },
  {
    icon: <GraduationCap size={36} />,
    title: 'MentorIA',
    description: 'Coaching y conocimiento a tu ritmo',
    href: '/services/mentoria',
  },
];

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    description: 'Acceso básico a la plataforma',
    monthlyUsd: BILLING_PLANS.free.monthlyUsd,
    annualUsd: BILLING_PLANS.free.annualUsd,
  },
  {
    id: 'basic',
    name: 'Basic',
    description: 'Herramientas esenciales para empezar',
    monthlyUsd: BILLING_PLANS.basic.monthlyUsd,
    annualUsd: BILLING_PLANS.basic.annualUsd,
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Suite completa de agentes IA',
    monthlyUsd: BILLING_PLANS.pro.monthlyUsd,
    annualUsd: BILLING_PLANS.pro.annualUsd,
  },
  {
    id: 'elite',
    name: 'Elite',
    description: 'Acceso ilimitado a todos los módulos',
    monthlyUsd: BILLING_PLANS.elite.monthlyUsd,
    annualUsd: BILLING_PLANS.elite.annualUsd,
  },
];

// ─── Sub-componentes inline ───────────────────────────────────────────────────

function AgentList() {
  const glassStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.08)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: '16px',
    padding: '1.5rem',
    width: '100%',
    maxWidth: '420px',
  };

  return (
    <div style={glassStyle}>
      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>
        Tus agentes
      </p>
      {AGENTS.map((agent) => (
        <a
          key={agent.href}
          href={agent.href}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            padding: '0.875rem',
            borderRadius: '10px',
            color: 'white',
            textDecoration: 'none',
            transition: 'background 0.15s ease',
            marginBottom: '0.25rem',
          }}
          className="hover:bg-white/10"
        >
          <span style={{ opacity: 0.85 }}>{agent.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-syne)', fontWeight: 700, fontSize: '0.95rem' }}>
              {agent.title}
            </div>
            <div style={{ fontSize: '0.8rem', opacity: 0.65, marginTop: '0.1rem' }}>
              {agent.description}
            </div>
          </div>
          <ArrowRight size={16} style={{ opacity: 0.5 }} />
        </a>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const cookieStore = await cookies();
  const jwt = cookieStore.get('nl360_jwt');
  const isLoggedIn = !!jwt?.value;

  return (
    <main
      style={{
        background: 'white',
        minHeight: '100vh',
        // Full-bleed: rompe el contenedor max-w-5xl del layout (public)
        // y cancela su pt-24 (6rem) para que el hero arranque arriba.
        width: '100vw',
        marginLeft: 'calc(-50vw + 50%)',
        marginTop: '-6rem',
        overflowX: 'hidden',
      }}
    >

      {/* ── HERO ── */}
      <section style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden' }}>
        {/* Fondo animado de puntos con gradiente */}
        <GradientDots duration={20} />

        {/* Velo sutil para legibilidad del texto */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.55) 100%)',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            minHeight: '100vh',
            display: 'grid',
            gap: '2rem',
            padding: 'clamp(5rem, 10vw, 8rem) clamp(1.5rem, 6vw, 6rem)',
            alignItems: 'center',
          }}
          className="grid-cols-1 lg:grid-cols-2"
        >
          {/* Col 1 */}
          <div style={{ color: 'white' }}>
            <h1
              style={{
                fontSize: 'clamp(2.5rem, 5.5vw, 4.5rem)',
                lineHeight: 1.05,
                fontFamily: 'var(--font-syne)',
                fontWeight: 700,
                margin: 0,
              }}
            >
              Pone tu negocio en automático
            </h1>
            <p
              style={{
                fontSize: 'clamp(1rem, 2vw, 1.25rem)',
                marginTop: '1.5rem',
                opacity: 0.85,
                lineHeight: 1.65,
                maxWidth: '42ch',
              }}
            >
              Con nuestras herramientas de desarrollo, marketing y conocimiento
            </p>
          </div>

          {/* Col 2: condicional */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            {isLoggedIn ? <AgentList /> : <HeroLoginForm />}
          </div>
        </div>
      </section>

      {/* ── SECCIÓN 1 — Cards de agentes ── */}
      <section style={{ padding: 'clamp(4rem, 8vw, 6rem) clamp(1.5rem, 6vw, 6rem)', background: 'white' }}>
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'grid',
            gap: '1.5rem',
          }}
          className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        >
          {AGENTS.map((agent) => (
            <AgentCardTilt
              key={agent.href}
              icon={agent.icon}
              title={agent.title}
              description={agent.description}
              href={agent.href}
            />
          ))}
        </div>
      </section>

      {/* ── SECCIÓN 2 — Globalización + Globe ── */}
      <section style={{ padding: 'clamp(4rem, 8vw, 6rem) clamp(1.5rem, 6vw, 6rem)', background: 'white' }}>
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'grid',
            gap: '3rem',
            alignItems: 'center',
          }}
          className="grid-cols-1 lg:grid-cols-2"
        >
          {/* Col 1 — texto */}
          <div>
            <h2
              style={{
                fontSize: 'clamp(2rem, 4vw, 3.5rem)',
                fontFamily: 'var(--font-syne)',
                fontWeight: 800,
                background: 'linear-gradient(135deg, #777 0%, #111 40%, #aaa 70%, #333 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                backgroundSize: '200% auto',
                animation: 'gradientShift 5s linear infinite',
                margin: 0,
              }}
            >
              Digitaliza eficientemente
            </h2>
            <p
              style={{
                marginTop: '1.5rem',
                color: '#555',
                lineHeight: 1.75,
                fontSize: '1.1rem',
                maxWidth: '44ch',
              }}
            >
              La suite de NL360 te provee de herramientas y conocimientos para que puedas
              poner en marcha la identidad digital de tu negocio.
            </p>
          </div>

          {/* Col 2 — ilustración intro (floating + color por scroll) */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <IntroIllustration />
          </div>
        </div>
      </section>

      {/* ── SECCIÓN 3 — Planes + Logo ── */}
      <section style={{ padding: 'clamp(4rem, 8vw, 6rem) clamp(1.5rem, 6vw, 6rem)', background: 'white' }}>
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'grid',
            gap: '3rem',
            alignItems: 'center',
          }}
          className="grid-cols-1 lg:grid-cols-2"
        >
          {/* Col 1 — Planes */}
          <PlansPricing plans={PLANS} />

          {/* Col 2 — Logo */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <LogoRotating />
          </div>
        </div>
      </section>

    </main>
  );
}
