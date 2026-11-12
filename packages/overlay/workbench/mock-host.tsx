import { h } from 'preact';

export type WorkbenchBackdrop = 'light' | 'dark' | 'gradient';

interface ThemeTokens {
  pageBg: string;
  textPrimary: string;
  textMuted: string;
  cardBg: string;
  cardBorder: string;
  badgeBg: string;
  badgeText: string;
  btnPrimaryBg: string;
  btnPrimaryText: string;
  btnSecondaryBg: string;
  btnSecondaryText: string;
  btnSecondaryBorder: string;
}

const BACKDROP_THEMES: Record<WorkbenchBackdrop, ThemeTokens> = {
  light: {
    pageBg: 'linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)',
    textPrimary: '#0f172a',
    textMuted: '#475569',
    cardBg: '#ffffff',
    cardBorder: 'rgba(15, 23, 42, 0.1)',
    badgeBg: '#e0f2fe',
    badgeText: '#0369a1',
    btnPrimaryBg: '#0f172a',
    btnPrimaryText: '#ffffff',
    btnSecondaryBg: '#ffffff',
    btnSecondaryText: '#1e293b',
    btnSecondaryBorder: 'rgba(15, 23, 42, 0.16)',
  },
  dark: {
    pageBg: 'radial-gradient(circle at 20% 0%, #1e293b 0%, #090d16 70%)',
    textPrimary: '#f8fafc',
    textMuted: '#94a3b8',
    cardBg: 'rgba(30, 41, 59, 0.72)',
    cardBorder: 'rgba(255, 255, 255, 0.12)',
    badgeBg: 'rgba(56, 189, 248, 0.16)',
    badgeText: '#38bdf8',
    btnPrimaryBg: '#38bdf8',
    btnPrimaryText: '#082f49',
    btnSecondaryBg: 'rgba(255, 255, 255, 0.06)',
    btnSecondaryText: '#f1f5f9',
    btnSecondaryBorder: 'rgba(255, 255, 255, 0.18)',
  },
  gradient: {
    pageBg:
      'radial-gradient(at 15% 15%, #f43f5e 0%, transparent 45%), radial-gradient(at 85% 20%, #3b82f6 0%, transparent 45%), radial-gradient(at 60% 85%, #10b981 0%, transparent 50%), #0f172a',
    textPrimary: '#ffffff',
    textMuted: 'rgba(255, 255, 255, 0.82)',
    cardBg: 'rgba(255, 255, 255, 0.12)',
    cardBorder: 'rgba(255, 255, 255, 0.24)',
    badgeBg: 'rgba(255, 255, 255, 0.2)',
    badgeText: '#ffffff',
    btnPrimaryBg: '#ffffff',
    btnPrimaryText: '#0f172a',
    btnSecondaryBg: 'rgba(15, 23, 42, 0.35)',
    btnSecondaryText: '#ffffff',
    btnSecondaryBorder: 'rgba(255, 255, 255, 0.3)',
  },
};

export function MockHostPage({
  backdrop,
  sidebarOffsetPx,
}: {
  backdrop: WorkbenchBackdrop;
  sidebarOffsetPx: number;
}) {
  const t = BACKDROP_THEMES[backdrop];

  return (
    <main
      id="wb-host-canvas"
      style={{
        minHeight: '100vh',
        background: t.pageBg,
        color: t.textPrimary,
        paddingLeft: `${sidebarOffsetPx + 40}px`,
        paddingRight: '48px',
        paddingTop: '28px',
        paddingBottom: '120px',
        transition: 'padding-left 0.2s ease',
      }}
    >
      {/* Top nav with edge-positioned target for Floating UI flip/shift testing */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '48px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, fontSize: '15px' }}>
          <span
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #38bdf8, #6366f1)',
              display: 'inline-block',
            }}
          />
          <span>Acme Studio</span>
        </div>

        <nav style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <a href="#features" onClick={(e) => e.preventDefault()} style={{ color: t.textMuted, textDecoration: 'none', fontSize: '14px' }}>
            Features
          </a>
          <a href="#pricing" onClick={(e) => e.preventDefault()} style={{ color: t.textMuted, textDecoration: 'none', fontSize: '14px' }}>
            Pricing
          </a>
          <button
            id="wb-edge-top-right"
            style={{
              background: t.btnSecondaryBg,
              color: t.btnSecondaryText,
              border: `1px solid ${t.btnSecondaryBorder}`,
              borderRadius: '8px',
              padding: '7px 14px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Sign In
          </button>
        </nav>
      </header>

      {/* Hero Section */}
      <section
        style={{
          maxWidth: '920px',
          display: 'grid',
          gridTemplateColumns: '1.25fr 0.95fr',
          gap: '32px',
          alignItems: 'start',
          marginBottom: '48px',
        }}
      >
        <div>
          <span
            id="wb-hero-eyebrow"
            style={{
              display: 'inline-block',
              padding: '4px 10px',
              borderRadius: '999px',
              background: t.badgeBg,
              color: t.badgeText,
              fontSize: '12px',
              fontWeight: 600,
              marginBottom: '14px',
            }}
          >
            Release 2.4 • Visual Editing
          </span>

          <h1
            id="wb-hero-title"
            style={{
              margin: '0 0 14px 0',
              fontSize: '40px',
              lineHeight: 1.12,
              letterSpacing: '-0.025em',
              fontWeight: 800,
            }}
          >
            Ship pixel-accurate UI without guessing CSS
          </h1>

          <p
            id="wb-hero-copy"
            style={{
              margin: '0 0 24px 0',
              fontSize: '16px',
              lineHeight: 1.6,
              color: t.textMuted,
            }}
          >
            Point directly at any element in your running app, tweak spacing and typography live, pin comments to exact source files, and stream structured feedback straight to your coding agent.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              id="wb-primary-cta"
              style={{
                background: t.btnPrimaryBg,
                color: t.btnPrimaryText,
                border: 'none',
                borderRadius: '10px',
                padding: '11px 20px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Start Free Trial
            </button>

            <button
              id="wb-secondary-cta"
              style={{
                background: t.btnSecondaryBg,
                color: t.btnSecondaryText,
                border: `1px solid ${t.btnSecondaryBorder}`,
                borderRadius: '10px',
                padding: '11px 18px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Watch Walkthrough
            </button>
          </div>
        </div>

        {/* Pricing Card target (used by VariantSwitcher / VerificationHalo) */}
        <div
          id="wb-pricing-card"
          style={{
            background: t.cardBg,
            border: `1px solid ${t.cardBorder}`,
            borderRadius: '16px',
            padding: '24px',
            backdropFilter: backdrop === 'gradient' ? 'blur(12px)' : undefined,
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: t.badgeText, marginBottom: '6px' }}>PRO PLAN</div>
          <div style={{ fontSize: '32px', fontWeight: 800, marginBottom: '8px' }}>
            $29 <span style={{ fontSize: '14px', fontWeight: 500, color: t.textMuted }}>/ month</span>
          </div>
          <p style={{ margin: '0 0 18px 0', fontSize: '13px', color: t.textMuted, lineHeight: 1.5 }}>
            Unlimited visual batches, voice walkthroughs, and multi-variant A/B previews across local & staging servers.
          </p>
          <button
            style={{
              width: '100%',
              background: t.btnPrimaryBg,
              color: t.btnPrimaryText,
              border: 'none',
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Upgrade Workspace
          </button>
        </div>
      </section>

      {/* Feature Cards Grid (used for multi-element targets, comment pins, voice pins) */}
      <section
        id="wb-feature-grid"
        style={{
          maxWidth: '920px',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
        }}
      >
        {[
          {
            id: 'wb-feature-1',
            title: 'Source-Mapped Inspector',
            desc: 'Resolves React fiber & HTML locations automatically.',
          },
          {
            id: 'wb-feature-2',
            title: 'Anchored Pins & Snaps',
            desc: 'Attach text quotes, element bounds, or cropped screenshots.',
          },
          {
            id: 'wb-feature-3',
            title: 'Live Agent Streaming',
            desc: 'Watch agent progress, replies, and verification halos.',
          },
        ].map((card) => (
          <article
            key={card.id}
            id={card.id}
            style={{
              background: t.cardBg,
              border: `1px solid ${t.cardBorder}`,
              borderRadius: '14px',
              padding: '18px',
              backdropFilter: backdrop === 'gradient' ? 'blur(12px)' : undefined,
            }}
          >
            <h3 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: 700 }}>{card.title}</h3>
            <p style={{ margin: 0, fontSize: '13px', color: t.textMuted, lineHeight: 1.5 }}>{card.desc}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
