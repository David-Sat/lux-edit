import React from 'react';

export interface PricingCardProps {
  tier: string;
  price: string;
  features: string[];
  isPopular?: boolean;
}

export const PricingCard: React.FC<PricingCardProps> = ({ tier, price, features, isPopular }) => {
  return (
    <div
      id={`pricing-card-${tier.toLowerCase()}`}
      style={{
        background: isPopular ? '#1e1b4b' : '#1e293b',
        border: isPopular ? '2px solid #6366f1' : '1px solid #334155',
        borderRadius: '12px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        flex: '1',
        minWidth: '240px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#f8fafc' }}>{tier}</h3>
        {isPopular && (
          <span
            style={{
              background: '#6366f1',
              color: '#ffffff',
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '9999px',
              fontWeight: '700',
            }}
          >
            POPULAR
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
        <span style={{ fontSize: '32px', fontWeight: '800', color: '#f8fafc' }}>{price}</span>
        <span style={{ color: '#94a3b8', fontSize: '14px' }}>/month</span>
      </div>

      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {features.map((f, i) => (
          <li key={i} style={{ color: '#cbd5e1', fontSize: '13px', display: 'flex', gap: '8px' }}>
            <span style={{ color: '#22c55e' }}>✓</span> {f}
          </li>
        ))}
      </ul>

      <button
        style={{
          marginTop: 'auto',
          background: isPopular ? '#6366f1' : '#334155',
          color: '#ffffff',
          border: 'none',
          padding: '10px 16px',
          borderRadius: '6px',
          fontWeight: '600',
          cursor: 'pointer',
        }}
      >
        Choose {tier}
      </button>
    </div>
  );
};
