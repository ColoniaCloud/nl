'use client';

const ITEMS = [
  'Anthropic Claude', 'Google Gemini', 'OpenAI GPT-4', 'NVIDIA NIM', 'Venice AI',
  'Next.js 16', 'React 19', 'TypeScript', 'Tailwind CSS', 'Docker',
  'Ethereum', 'Polygon', 'Base', 'Arbitrum',
  'Stripe', 'Resend', 'ClickUp', 'Unsplash',
];

export function TechTicker() {
  return (
    <div
      style={{
        background: '#111',
        overflow: 'hidden',
        padding: '0.875rem 0',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          width: 'max-content',
          animation: 'marquee 35s linear infinite',
        }}
      >
        {[...ITEMS, ...ITEMS].map((item, i) => (
          <span
            key={i}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '1.5rem',
              paddingRight: '3rem',
              color: 'rgba(255,255,255,0.45)',
              fontSize: '0.72rem',
              fontFamily: 'var(--font-montserrat)',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              whiteSpace: 'nowrap',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                background: 'rgba(100,220,100,0.7)',
                flexShrink: 0,
              }}
            />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
