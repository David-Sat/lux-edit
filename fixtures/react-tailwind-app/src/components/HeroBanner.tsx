import React from 'react';

export interface HeroBannerProps {
  title: string;
  subtitle: string;
  ctaText: string;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ title, subtitle, ctaText }) => {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', maxWidth: '800px', margin: '0 auto' }}>
      <span
        style={{
          display: 'inline-block',
          background: 'rgba(56, 189, 248, 0.15)',
          color: '#38bdf8',
          padding: '4px 12px',
          borderRadius: '9999px',
          fontSize: '12px',
          fontWeight: '600',
          marginBottom: '16px',
        }}
      >
        React Fiber Aware
      </span>
      <h1
        id="hero-heading"
        style={{
          fontSize: '42px',
          fontWeight: '800',
          marginBottom: '16px',
          color: '#f8fafc',
          lineHeight: '1.2',
        }}
      >
        {title}
      </h1>
      <p
        style={{
          fontSize: '18px',
          color: '#94a3b8',
          marginBottom: '32px',
          lineHeight: '1.6',
        }}
      >
        {subtitle}
      </p>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
        <button
          id="hero-cta-btn"
          style={{
            background: '#3b82f6',
            color: '#ffffff',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          {ctaText}
        </button>
        <button
          style={{
            background: '#1e293b',
            color: '#f8fafc',
            border: '1px solid #334155',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          View Documentation
        </button>
      </div>
    </div>
  );
};
