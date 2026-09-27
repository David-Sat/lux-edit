export const DEMO_HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lux Interactive Playground</title>
  <style>
    :root {
      --bg: #090a0f;
      --surface: #12141c;
      --surface-hover: #181b26;
      --border: rgba(255, 255, 255, 0.1);
      --border-focus: rgba(255, 255, 255, 0.25);
      --text-main: #f1f5f9;
      --text-muted: #94a3b8;
      --text-dim: #64748b;
      --accent: #0284c7;
      --accent-soft: rgba(2, 132, 199, 0.15);
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }

    @media (prefers-color-scheme: light) {
      :root {
        --bg: #f8fafc;
        --surface: #ffffff;
        --surface-hover: #f1f5f9;
        --border: rgba(0, 0, 0, 0.1);
        --border-focus: rgba(0, 0, 0, 0.25);
        --text-main: #0f172a;
        --text-muted: #475569;
        --text-dim: #94a3b8;
        --accent: #0284c7;
        --accent-soft: rgba(2, 132, 199, 0.1);
      }
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg);
      color: var(--text-main);
      font-family: var(--font-sans);
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
      padding: 40px 20px 100px;
    }

    .container {
      max-width: 760px;
      margin: 0 auto;
    }

    .header-tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--accent);
      background: var(--accent-soft);
      padding: 4px 10px;
      border-radius: 4px;
      margin-bottom: 16px;
    }

    .main-title {
      font-size: 32px;
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1.2;
      margin-bottom: 12px;
    }

    .subtitle {
      font-size: 16px;
      color: var(--text-muted);
      margin-bottom: 48px;
    }

    .station-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 28px;
      margin-bottom: 32px;
      position: relative;
    }

    .station-number {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--text-dim);
      margin-bottom: 8px;
    }

    .station-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 12px;
    }

    .station-instructions {
      font-size: 13px;
      color: var(--text-muted);
      background: rgba(0, 0, 0, 0.03);
      border-left: 3px solid var(--accent);
      padding: 10px 14px;
      border-radius: 0 6px 6px 0;
      margin-bottom: 24px;
    }

    /* Station 01: Deliberate Typo & Awkward Badge */
    #demo-headline {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.01em;
      margin-bottom: 12px;
      color: var(--text-main);
    }

    #demo-badge {
      display: inline-block;
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 600;
      border: 2px solid #ef4444;
      color: #ef4444;
      padding: 1px 24px 12px 4px;
      border-radius: 2px;
      margin-bottom: 12px;
    }

    /* Station 02: Awkward Marketing Text */
    #demo-paragraph {
      font-size: 15px;
      color: var(--text-muted);
      line-height: 1.7;
    }

    /* Station 03: Metric Cards Grid */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      align-items: flex-start;
    }

    .metric-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 18px 16px;
      height: 110px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .metric-label {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--text-dim);
    }

    .metric-value {
      font-size: 26px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    /* Intentional misalignment bug on Card 2 */
    #metric-card-2 {
      height: 150px;
      margin-top: -12px;
      border-radius: 0px;
      border-color: #f59e0b;
      background: rgba(245, 158, 11, 0.05);
    }

    /* Station 04: Next Steps Banner */
    .station-handoff {
      background: var(--surface-hover);
      border: 1px dashed var(--border-focus);
      border-radius: 12px;
      padding: 24px;
      text-align: center;
    }

    .station-handoff h3 {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 6px;
    }

    .station-handoff p {
      font-size: 14px;
      color: var(--text-muted);
      max-width: 520px;
      margin: 0 auto;
    }

    .code-pill {
      display: inline-block;
      font-family: var(--font-mono);
      font-size: 12px;
      background: var(--border);
      padding: 2px 6px;
      border-radius: 4px;
      color: var(--text-main);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header-tag">Interactive Playground</div>
    <h1 class="main-title">Lux Playground &amp; Walkthrough</h1>
    <p class="subtitle">Complete the 3 quick tasks below using the Lux overlay, then return to your AI agent chat to apply them.</p>

    <!-- STATION 01 -->
    <section class="station-card">
      <div class="station-number">Station 01 // Direct Visual Editing</div>
      <h2 class="station-title">Fix Typos &amp; Adjust Element Styles</h2>
      <div class="station-instructions">
        Press <strong>E</strong> (or click <strong>Edit</strong> in the bottom dock). Double-click the headline below to fix the typo (&quot;DEVLOPMENT&quot; &rarr; &quot;DEVELOPMENT&quot;). Then click the red badge to adjust its asymmetric padding and border color in the Style Inspector.
      </div>

      <div id="demo-badge">BETA v0.9</div>
      <h3 id="demo-headline">HYPERFAST DEVLOPMENT ENGINE</h3>
    </section>

    <!-- STATION 02 -->
    <section class="station-card">
      <div class="station-number">Station 02 // Inline Text Selection</div>
      <h2 class="station-title">Highlight Specific Words &amp; Comment</h2>
      <div class="station-instructions">
        Press <strong>C</strong> (or click <strong>Comment</strong> in the dock). Drag with your cursor to highlight the jargon phrase <em>&quot;quantum-grade paradigm synergies&quot;</em> in the paragraph below, and leave a comment asking the agent to rewrite it.
      </div>

      <p id="demo-paragraph">
        Our high-performance architecture harnesses quantum-grade paradigm synergies to accelerate delivery cycles across engineering teams with predictable latency.
      </p>
    </section>

    <!-- STATION 03 -->
    <section class="station-card">
      <div class="station-number">Station 03 // Multi-Element Pins</div>
      <h2 class="station-title">Connect Multiple Elements with Shift + Click</h2>
      <div class="station-instructions">
        In Comment mode, click Card 1, then hold <strong>Shift</strong> and click Card 2 and Card 3. Notice the linked pin connectors (1A, 1B, 1C). Leave a comment: <em>&quot;Align the height, borders, and margins across all 3 cards.&quot;</em>
      </div>

      <div class="metrics-grid">
        <div class="metric-card" id="metric-card-1">
          <div class="metric-label">Latency</div>
          <div class="metric-value">1.2ms</div>
        </div>

        <div class="metric-card" id="metric-card-2">
          <div class="metric-label">Throughput</div>
          <div class="metric-value">98k</div>
        </div>

        <div class="metric-card" id="metric-card-3">
          <div class="metric-label">Uptime</div>
          <div class="metric-value">99.9%</div>
        </div>
      </div>
    </section>

    <!-- STATION 04 -->
    <div class="station-handoff">
      <h3>Station 04 // Complete the Loop</h3>
      <p>
        When you are done with your edits, open the drawer to review them or simply switch back to your coding agent chat and type <span class="code-pill">/lux</span>. Watch your agent apply your changes directly to the HTML!
      </p>
    </div>
  </div>
</body>
</html>
`;
