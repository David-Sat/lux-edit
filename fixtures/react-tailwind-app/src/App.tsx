import React from 'react';
import { HeroBanner } from './components/HeroBanner.js';
import { PricingCard } from './components/PricingCard.js';

export function App() {
  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '20px',
          borderBottom: '1px solid #334155',
        }}
      >
        <div style={{ fontSize: '20px', fontWeight: '800', color: '#38bdf8' }}>
          🚀 React Live Studio
        </div>
        <nav style={{ display: 'flex', gap: '20px' }}>
          <a href="#features" style={{ color: '#94a3b8', textDecoration: 'none' }}>
            Features
          </a>
          <a href="#pricing" style={{ color: '#94a3b8', textDecoration: 'none' }}>
            Pricing
          </a>
        </nav>
      </header>

      <main>
        <HeroBanner
          title="Visual UI Engineering with Coding Agents"
          subtitle="Directly manipulate React components on your live dev server and pipe structured AST diffs into Claude Code or Codex."
          ctaText="Start Visual Review"
        />

        <section id="pricing" style={{ marginTop: '40px' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '32px', fontSize: '28px', fontWeight: '700' }}>
            Flexible Plans
          </h2>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <PricingCard
              tier="Starter"
              price="$0"
              features={['Local-first MCP sync', 'Inline text editing', 'Basic style inspector']}
            />
            <PricingCard
              tier="Pro"
              price="$29"
              isPopular={true}
              features={[
                'React Fiber source mapping',
                'Tailwind class sync',
                'Multi-agent concurrent leases',
                'Priority MCP streaming',
              ]}
            />
            <PricingCard
              tier="Enterprise"
              price="$99"
              features={['Custom design token exports', 'CI visual regression suite', 'Dedicated team hub']}
            />
          </div>
        </section>
      </main>

      <footer
        style={{
          marginTop: '60px',
          padding: '24px 0',
          borderTop: '1px solid #334155',
          textAlign: 'center',
          color: '#64748b',
          fontSize: '13px',
        }}
      >
        © 2026 lux-edit. Built for AI coding agents.
      </footer>
    </div>
  );
}
