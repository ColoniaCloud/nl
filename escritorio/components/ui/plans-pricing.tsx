'use client';

import { useState } from 'react';

type PlanItem = {
  id: string;
  name: string;
  description: string;
  monthlyUsd: number;
  annualUsd: number;
};

export function PlansPricing({ plans }: { plans: PlanItem[] }) {
  const [annual, setAnnual] = useState(false);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
          marginBottom: '2.5rem',
        }}
      >
        <h3
          style={{
            fontFamily: 'var(--font-syne)',
            fontWeight: 700,
            fontSize: '1.75rem',
            color: '#111',
            margin: 0,
          }}
        >
          Nuestros planes
        </h3>

        {/* Switch Mensual / Anual */}
        <div
          role="group"
          aria-label="Ciclo de facturación"
          style={{
            display: 'inline-flex',
            padding: '3px',
            borderRadius: '9999px',
            background: '#f1f1f1',
            border: '1px solid #e4e4e4',
          }}
        >
          {(['monthly', 'annual'] as const).map((cycle) => {
            const active = (cycle === 'annual') === annual;
            return (
              <button
                key={cycle}
                type="button"
                onClick={() => setAnnual(cycle === 'annual')}
                style={{
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: '9999px',
                  padding: '0.4rem 0.9rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  transition: 'background 0.15s ease, color 0.15s ease',
                  background: active ? '#111' : 'transparent',
                  color: active ? 'white' : '#666',
                }}
              >
                {cycle === 'annual' ? 'Anual' : 'Mensual'}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
        {plans.map((plan, i) => {
          const primary = annual
            ? `$${plan.annualUsd} / año`
            : `$${plan.monthlyUsd} / mes`;
          const secondary = annual
            ? `$${plan.monthlyUsd} / mes`
            : `$${plan.annualUsd} / año`;
          const showSecondary = plan.monthlyUsd > 0;

          return (
            <div
              key={plan.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                padding: '1.5rem 0',
                borderBottom: i < plans.length - 1 ? '1px solid #f0f0f0' : 'none',
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-syne)',
                    fontWeight: 700,
                    fontSize: '1.05rem',
                    color: '#111',
                  }}
                >
                  {plan.name}
                </div>
                <div style={{ color: '#888', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                  {plan.description}
                </div>
              </div>

              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '1rem' }}>
                <div
                  style={{
                    fontFamily: 'var(--font-syne)',
                    fontWeight: 700,
                    fontSize: '1.1rem',
                    color: '#111',
                  }}
                >
                  {primary}
                </div>
                {showSecondary && (
                  <div
                    style={{
                      fontSize: '0.78rem',
                      color: '#16a34a',
                      marginTop: '0.15rem',
                      fontWeight: 600,
                    }}
                  >
                    {secondary}
                  </div>
                )}
                <a
                  href="/precio"
                  style={{
                    display: 'inline-block',
                    marginTop: '0.5rem',
                    fontSize: '0.8rem',
                    color: '#111',
                    textDecoration: 'underline',
                    textUnderlineOffset: '3px',
                  }}
                >
                  Comprar
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PlansPricing;
