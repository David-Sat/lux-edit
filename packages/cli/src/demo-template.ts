export const DEMO_HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lux: Spot the Difference</title>
  <style>
    :root {
      --bg: #0d0f14;
      --surface: #141720;
      --surface-subtle: #191d28;
      --border: rgba(255, 255, 255, 0.08);
      --border-strong: rgba(255, 255, 255, 0.16);
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --text-dim: #6b7280;
      --accent: #3b82f6;
      --accent-soft: rgba(59, 130, 246, 0.12);
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }

    @media (prefers-color-scheme: light) {
      :root {
        --bg: #f8f7f4;
        --surface: #ffffff;
        --surface-subtle: #f1efe9;
        --border: rgba(0, 0, 0, 0.08);
        --border-strong: rgba(0, 0, 0, 0.16);
        --text: #18181b;
        --text-muted: #52525b;
        --text-dim: #a1a1aa;
        --accent: #2563eb;
        --accent-soft: rgba(37, 99, 235, 0.1);
        --success: #059669;
        --warning: #d97706;
        --danger: #dc2626;
      }
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: var(--font-sans);
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
      padding: 32px 24px 80px;
    }

    .wrapper {
      max-width: 1080px;
      margin: 0 auto;
    }

    /* Top Bar */
    header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-bottom: 1px solid var(--border);
      padding-bottom: 20px;
      margin-bottom: 32px;
      gap: 16px;
      flex-wrap: wrap;
    }

    .brand {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .game-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--accent);
      background: var(--accent-soft);
      padding: 3px 8px;
      border-radius: 4px;
      align-self: flex-start;
    }

    .title {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .subtitle {
      font-size: 14px;
      color: var(--text-muted);
    }

    .hud-controls {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      background: var(--surface);
      border: 1px solid var(--border-strong);
      padding: 6px 14px;
      border-radius: 9999px;
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--text-muted);
    }

    .hud-key {
      color: var(--text);
      font-weight: 700;
      background: var(--surface-subtle);
      border: 1px solid var(--border);
      padding: 2px 6px;
      border-radius: 4px;
      margin-right: 4px;
    }

    /* Comparison Grid */
    .arena {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 40px;
    }

    @media (max-width: 820px) {
      .arena {
        grid-template-columns: 1fr;
      }
    }

    .column {
      display: flex;
      flex-direction: column;
    }

    .column-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding: 0 4px;
    }

    .column-label {
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .dot-target {
      background: var(--success);
      box-shadow: 0 0 8px rgba(16, 185, 129, 0.4);
    }

    .dot-live {
      background: var(--warning);
      box-shadow: 0 0 8px rgba(245, 158, 11, 0.4);
    }

    .column-tag {
      font-size: 11px;
      color: var(--text-dim);
      font-family: var(--font-mono);
    }

    /* Spec & Live Cards */
    .device-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 28px;
      display: flex;
      flex-direction: column;
      flex: 1;
      position: relative;
    }

    .target-card {
      opacity: 0.92;
      border-style: dashed;
    }

    .watermark {
      position: absolute;
      top: 14px;
      right: 14px;
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-dim);
      border: 1px solid var(--border);
      padding: 2px 8px;
      border-radius: 4px;
    }

    .visual-preview {
      height: 120px;
      background: var(--surface-subtle);
      border: 1px solid var(--border);
      border-radius: 8px;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      position: relative;
    }

    .soundwave {
      display: flex;
      align-items: center;
      gap: 5px;
      height: 48px;
    }

    .bar {
      width: 4px;
      background: var(--text-dim);
      border-radius: 2px;
      height: 24px;
    }

    .bar:nth-child(2) { height: 38px; }
    .bar:nth-child(3) { height: 18px; }
    .bar:nth-child(4) { height: 46px; }
    .bar:nth-child(5) { height: 30px; }
    .bar:nth-child(6) { height: 12px; }

    /* Metadata & Typography */
    .card-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .category {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 600;
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    /* Target badge */
    .pill-clean {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 600;
      color: var(--accent);
      background: var(--accent-soft);
      padding: 3px 8px;
      border-radius: 4px;
    }

    /* Flawed live badge */
    #live-badge {
      font-family: sans-serif;
      font-size: 13px;
      font-weight: 800;
      color: #fff;
      background: #dc2626;
      padding: 10px 16px;
      border-radius: 20px;
      letter-spacing: 1px;
      display: inline-block;
    }

    .product-title {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin-bottom: 10px;
    }

    .product-desc {
      font-size: 13.5px;
      color: var(--text-muted);
      line-height: 1.6;
      margin-bottom: 24px;
    }

    /* Metrics Grid */
    .specs-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 28px;
    }

    .spec-item {
      background: var(--surface-subtle);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px;
      text-align: center;
      display: flex;
      flex-direction: column;
      justify-content: center;
      height: 68px;
    }

    .spec-value {
      font-family: var(--font-mono);
      font-size: 13px;
      font-weight: 700;
      color: var(--text);
    }

    .spec-label {
      font-size: 11px;
      color: var(--text-dim);
      margin-top: 2px;
    }

    /* Flawed metric in live card */
    #live-broken-spec {
      background: transparent;
      border: 2px dashed #ef4444;
      border-radius: 0;
      height: 94px;
      margin-top: -13px;
      padding: 6px;
    }

    /* Action Buttons */
    .cta-button {
      margin-top: auto;
      width: 100%;
      padding: 12px 18px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
      font-family: var(--font-sans);
    }

    .btn-target {
      background: var(--text);
      color: var(--bg);
      border: none;
    }

    #live-cta-btn {
      background: transparent;
      color: var(--accent);
      border: 2px solid var(--accent);
    }

    /* Footer Banner */
    .action-banner {
      background: var(--surface);
      border: 1px solid var(--border-strong);
      border-radius: 8px;
      padding: 18px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }

    .action-text {
      font-size: 13px;
      color: var(--text-muted);
    }

    .action-text strong {
      color: var(--text);
    }

    .badge-run {
      font-family: var(--font-mono);
      font-size: 12px;
      background: var(--accent);
      color: #fff;
      padding: 6px 12px;
      border-radius: 4px;
      font-weight: 700;
    }
  </style>
</head>
<body>

  <div class="wrapper">
    <header>
      <div class="brand">
        <div class="game-badge">Visual QA Challenge</div>
        <h1 class="title">Spot the Difference</h1>
        <p class="subtitle">Production doesn&#39;t match the design spec. Spot the flaws on the right, pin or edit them, then let AI fix the code.</p>
      </div>
      <div class="hud-controls">
        <span><span class="hud-key">E</span>Edit</span>
        <span><span class="hud-key">C</span>Comment</span>
        <span><span class="hud-key">⇧+Click</span>Pin Multi</span>
      </div>
    </header>

    <div class="arena">
      <!-- LEFT: TARGET FIGMA SPEC (READ ONLY) -->
      <div class="column">
        <div class="column-header">
          <div class="column-label">
            <span class="status-dot dot-target"></span>
            Figma Target Spec
          </div>
          <span class="column-tag">REFERENCE ONLY</span>
        </div>

        <div class="device-card target-card">
          <div class="watermark">DESIGN SPEC</div>

          <div class="visual-preview">
            <div class="soundwave">
              <div class="bar"></div>
              <div class="bar"></div>
              <div class="bar"></div>
              <div class="bar"></div>
              <div class="bar"></div>
              <div class="bar"></div>
            </div>
          </div>

          <div class="card-meta">
            <span class="category">Analog Audio</span>
            <span class="pill-clean">Studio Grade</span>
          </div>

          <h2 class="product-title">Apollo Field Recorder</h2>
          <p class="product-desc">Precision-balanced audio interface engineered for zero-latency studio monitoring, field recording, and analog synthesis.</p>

          <div class="specs-grid">
            <div class="spec-item">
              <span class="spec-value">32-Bit</span>
              <span class="spec-label">Float Resolution</span>
            </div>
            <div class="spec-item">
              <span class="spec-value">&lt; 1.2ms</span>
              <span class="spec-label">Roundtrip Latency</span>
            </div>
            <div class="spec-item">
              <span class="spec-value">18 Hours</span>
              <span class="spec-label">Battery Endurance</span>
            </div>
          </div>

          <button class="cta-button btn-target" tabindex="-1">Reserve Unit &bull; $490</button>
        </div>
      </div>

      <!-- RIGHT: LIVE BUILD (INTERACTIVE WITH BUGS) -->
      <div class="column" id="live-build">
        <div class="column-header">
          <div class="column-label">
            <span class="status-dot dot-live"></span>
            Live Build (lux-demo/index.html)
          </div>
          <span class="column-tag">FLAWS TO SPOT</span>
        </div>

        <div class="device-card">
          <div class="visual-preview">
            <div class="soundwave">
              <div class="bar"></div>
              <div class="bar"></div>
              <div class="bar"></div>
              <div class="bar"></div>
              <div class="bar"></div>
              <div class="bar"></div>
            </div>
          </div>

          <div class="card-meta">
            <span class="category">Analog Audio</span>
            <!-- FLAW 1: Obnoxious loud misaligned badge -->
            <span id="live-badge">HOT NEW BETA!!!</span>
          </div>

          <!-- FLAW 2: Embarrassing headline typo -->
          <h2 class="product-title" id="live-product-title">Appolo Feild Recurder</h2>
          
          <p class="product-desc" id="live-product-desc">Precision-balanced audio interface engineered for zero-latency studio monitoring, field recording, and analog synthesis.</p>

          <div class="specs-grid" id="live-specs-grid">
            <div class="spec-item" id="live-spec-1">
              <span class="spec-value">32-Bit</span>
              <span class="spec-label">Float Resolution</span>
            </div>
            <!-- FLAW 3: Disjointed broken metric card with shifted margin & dashed border -->
            <div class="spec-item" id="live-broken-spec">
              <span class="spec-value">&lt; 1.2ms</span>
              <span class="spec-label">Roundtrip Latency</span>
            </div>
            <div class="spec-item" id="live-spec-3">
              <span class="spec-value">18 Hours</span>
              <span class="spec-label">Battery Endurance</span>
            </div>
          </div>

          <button class="cta-button" id="live-cta-btn">Reserve Unit &bull; $490</button>
        </div>
      </div>
    </div>

    <div class="action-banner">
      <div class="action-text">
        <strong>Spotted the differences?</strong> Tag them using the Lux overlay, then return to your AI coding chat.
      </div>
      <div class="badge-run">Run /lux to apply fixes</div>
    </div>
  </div>

</body>
</html>
`;
