import {
  CommentAnnotation,
  ElementVariantSet,
  MutationRecord,
  VariantDecision,
  VoiceReviewWalkthrough,
  VoiceTargetPin,
} from '@visual-edit/core';
import { OverlayStateManager } from '../src/inspector/state.js';
import { VoiceRecorder } from '../src/inspector/voice-recorder.js';

export type PresetGroup =
  | 'Dock & Voice'
  | 'Toolbar & Selection'
  | 'Comments & Pins'
  | 'Variants & Verification'
  | 'Review Drawer';

export interface WorkbenchPreset {
  id: string;
  group: PresetGroup;
  title: string;
  description: string;
  apply: (state: OverlayStateManager, doc: Document) => void;
}

const MOCK_SCREENSHOT_DATA_URL =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#1e293b"/>
        </linearGradient>
      </defs>
      <rect width="320" height="180" rx="12" fill="url(#g)"/>
      <rect x="20" y="22" width="110" height="18" rx="9" fill="#38bdf8" fill-opacity="0.22"/>
      <rect x="20" y="54" width="240" height="22" rx="6" fill="#f8fafc" fill-opacity="0.9"/>
      <rect x="20" y="88" width="275" height="12" rx="4" fill="#94a3b8" fill-opacity="0.55"/>
      <rect x="20" y="108" width="210" height="12" rx="4" fill="#94a3b8" fill-opacity="0.4"/>
      <rect x="20" y="134" width="104" height="28" rx="8" fill="#38bdf8"/>
      <rect x="136" y="134" width="104" height="28" rx="8" fill="#ffffff" fill-opacity="0.12" stroke="#ffffff" stroke-opacity="0.24"/>
    </svg>`
  );

function queryEl(doc: Document, selector: string): HTMLElement | null {
  return doc.querySelector(selector) as HTMLElement | null;
}

function boundsFor(el: HTMLElement | null) {
  if (!el) return { x: 160, y: 160, width: 240, height: 48 };
  const r = el.getBoundingClientRect();
  const scrollX = typeof window !== 'undefined' ? window.scrollX || 0 : 0;
  const scrollY = typeof window !== 'undefined' ? window.scrollY || 0 : 0;
  return {
    x: Math.round(r.left + scrollX),
    y: Math.round(r.top + scrollY),
    width: Math.round(r.width),
    height: Math.round(r.height),
  };
}

function makeSampleMutations(doc: Document): MutationRecord[] {
  const path = typeof window !== 'undefined' ? window.location.pathname : '/';
  const titleEl = queryEl(doc, '#wb-hero-title');
  const ctaEl = queryEl(doc, '#wb-primary-cta');
  return [
    {
      id: 'mut_wb_1',
      type: 'TEXT_EDIT',
      targetSelector: '#wb-hero-title',
      pathname: path,
      sourceLocation: {
        fileName: 'src/components/HeroSection.tsx',
        lineNumber: 42,
        componentName: 'HeroHeading',
        framework: 'react',
        selector: '#wb-hero-title',
        tag: 'h1',
        id: 'wb-hero-title',
      },
      htmlSnippet: titleEl?.outerHTML.slice(0, 120),
      before: 'Ship pixel-accurate UI without guessing CSS',
      after: 'Ship pixel-accurate UI in half the time',
    },
    {
      id: 'mut_wb_2',
      type: 'STYLE_CHANGE',
      targetSelector: '#wb-primary-cta',
      pathname: path,
      property: 'border-radius',
      sourceLocation: {
        fileName: 'src/components/HeroSection.tsx',
        lineNumber: 68,
        componentName: 'PrimaryButton',
        framework: 'react',
        selector: '#wb-primary-cta',
        tag: 'button',
        id: 'wb-primary-cta',
      },
      before: '10px',
      after: '999px',
      tailwindSuggestion: 'rounded-full',
    },
    {
      id: 'mut_wb_3',
      type: 'STYLE_CHANGE',
      targetSelector: '#wb-primary-cta',
      pathname: path,
      property: 'padding-left',
      sourceLocation: {
        fileName: 'src/components/HeroSection.tsx',
        lineNumber: 68,
        componentName: 'PrimaryButton',
        framework: 'react',
        selector: '#wb-primary-cta',
        tag: 'button',
        id: 'wb-primary-cta',
      },
      before: '20px',
      after: '28px',
      tailwindSuggestion: 'px-7',
      htmlSnippet: ctaEl?.outerHTML.slice(0, 120),
    },
  ];
}

function makeSampleAnnotations(doc: Document): CommentAnnotation[] {
  const path = typeof window !== 'undefined' ? window.location.pathname : '/';
  const eyebrow = queryEl(doc, '#wb-hero-eyebrow');
  const copy = queryEl(doc, '#wb-hero-copy');
  const f1 = queryEl(doc, '#wb-feature-1');
  const f2 = queryEl(doc, '#wb-feature-2');
  const f3 = queryEl(doc, '#wb-feature-3');

  return [
    {
      id: 'ann_wb_1',
      timestamp: Date.now() - 120_000,
      type: 'element',
      targetSelector: '#wb-hero-eyebrow',
      pathname: path,
      bounds: boundsFor(eyebrow),
      sourceLocation: {
        fileName: 'src/components/HeroSection.tsx',
        lineNumber: 29,
        componentName: 'ReleaseBadge',
        framework: 'react',
        selector: '#wb-hero-eyebrow',
        tag: 'span',
        id: 'wb-hero-eyebrow',
      },
      comment: 'Increase subtle border contrast so this pill holds up against bright hero gradients.',
    },
    {
      id: 'ann_wb_2',
      timestamp: Date.now() - 90_000,
      type: 'text',
      targetSelector: '#wb-hero-copy',
      pathname: path,
      bounds: boundsFor(copy),
      selectedText: 'stream structured feedback straight to your coding agent',
      comment: 'Tighten line-height slightly (1.5) and emphasize "structured feedback".',
    },
    {
      id: 'ann_wb_3',
      timestamp: Date.now() - 45_000,
      type: 'multi',
      targetSelector: '#wb-feature-1',
      pathname: path,
      bounds: boundsFor(f1),
      targets: [
        { targetSelector: '#wb-feature-1', bounds: boundsFor(f1), pathname: path },
        { targetSelector: '#wb-feature-2', bounds: boundsFor(f2), pathname: path },
        { targetSelector: '#wb-feature-3', bounds: boundsFor(f3), pathname: path },
      ],
      comment: 'Equalize card heights and align card footers across this 3-column grid.',
      screenshot: MOCK_SCREENSHOT_DATA_URL,
    },
  ];
}

function makeSampleVariantSets(): ElementVariantSet[] {
  return [
    {
      id: 'vset_wb_pricing',
      targetSelector: '#wb-pricing-card',
      label: 'Pro Plan Card — Surface & Accent Exploration',
      createdAt: Date.now() - 30_000,
      status: 'pending',
      variants: [
        {
          id: 'var_subtle',
          name: 'Elevated Border',
          rationale: 'Crisp hairline highlight with subtle cyan glow around CTA.',
          styles: {
            border: '1px solid rgba(56, 189, 248, 0.55)',
            boxShadow: '0 18px 40px -12px rgba(56, 189, 248, 0.25)',
          },
        },
        {
          id: 'var_indigo',
          name: 'Indigo Tint',
          rationale: 'Soft indigo gradient backing to separate Pro tier visually.',
          styles: {
            background: 'linear-gradient(155deg, rgba(99, 102, 241, 0.22), rgba(56, 189, 248, 0.14))',
            border: '1px solid rgba(129, 140, 248, 0.45)',
          },
        },
        {
          id: 'var_compact',
          name: 'Compact Padding',
          rationale: 'Tighter vertical rhythm so pricing aligns cleanly with the hero CTAs.',
          styles: {
            padding: '18px 20px',
            borderRadius: '12px',
          },
        },
      ],
    },
  ];
}

function makeSampleVoiceReviews(doc: Document): VoiceReviewWalkthrough[] {
  const path = typeof window !== 'undefined' ? window.location.pathname : '/';
  const f1 = queryEl(doc, '#wb-feature-1');
  const f2 = queryEl(doc, '#wb-feature-2');
  const pins: VoiceTargetPin[] = [
    {
      id: 'vpin_wb_1',
      order: 1,
      targetSelector: '#wb-feature-1',
      bounds: boundsFor(f1),
      timestampMs: 1200,
      pathname: path,
    },
    {
      id: 'vpin_wb_2',
      order: 2,
      targetSelector: '#wb-feature-2',
      bounds: boundsFor(f2),
      timestampMs: 4100,
      pathname: path,
    },
  ];

  return [
    {
      id: 'voice_wb_1',
      timestamp: Date.now() - 60_000,
      durationMs: 14_200,
      pathname: path,
      transcript:
        'On these first two feature cards, bump the icon spacing and match the corner radius to the pricing card above.',
      annotatedTranscript:
        'On these first two feature cards [@1: #wb-feature-1] bump the icon spacing and match the corner radius [@2: #wb-feature-2] to the pricing card above.',
      pins,
      sections: [
        {
          id: 'vsec_wb_1',
          order: 1,
          targets: [
            { targetSelector: '#wb-feature-1', bounds: boundsFor(f1), pathname: path },
            { targetSelector: '#wb-feature-2', bounds: boundsFor(f2), pathname: path },
          ],
          transcript:
            'On these first two feature cards, bump the icon spacing and match the corner radius to the pricing card above.',
          timestampMs: 4100,
          startTimeMs: 0,
          endTimeMs: 14_200,
        },
      ],
    },
  ];
}

export const WORKBENCH_PRESETS: WorkbenchPreset[] = [
  // ── Dock & Voice ──────────────────────────────────────────────────────────
  {
    id: 'dock-launcher-idle',
    group: 'Dock & Voice',
    title: 'Launcher (Collapsed, Idle)',
    description: 'Default minimized floating launcher button anchored bottom-right.',
    apply: (state) => {
      state.resetForWorkbench();
    },
  },
  {
    id: 'dock-launcher-badge',
    group: 'Dock & Voice',
    title: 'Launcher (Collapsed + Badge Count)',
    description: 'Minimized launcher showing the pending edits/comments count badge.',
    apply: (state, doc) => {
      state.resetForWorkbench();
      state.mutations = makeSampleMutations(doc);
      state.annotations = makeSampleAnnotations(doc).slice(0, 2);
      state.notify();
    },
  },
  {
    id: 'dock-expanded-batch',
    group: 'Dock & Voice',
    title: 'Dock Expanded (Batch Mode)',
    description: 'Expanded tool dock with Batch mode active and draft item count.',
    apply: (state, doc) => {
      state.resetForWorkbench();
      state.isDockMenuOpen = true;
      state.reviewMode = 'batch';
      state.mutations = makeSampleMutations(doc).slice(0, 2);
      state.notify();
    },
  },
  {
    id: 'dock-expanded-live',
    group: 'Dock & Voice',
    title: 'Dock Expanded (Live Mode + Edit Tool)',
    description: 'Live streaming toggle lit green with Visual Edit tool active.',
    apply: (state) => {
      state.resetForWorkbench();
      state.isDockMenuOpen = true;
      state.reviewMode = 'live';
      state.activeTool = 'edit';
      state.hookLease = {
        connected: true,
        harness: 'claude-code',
        agentState: 'listening',
        seenCursor: 2,
        latestCursor: 2,
      };
      state.notify();
    },
  },
  {
    id: 'dock-left-top',
    group: 'Dock & Voice',
    title: 'Dock Anchored Left + Top',
    description: 'Tests edge-snapped dock & panel positioning on the top-left corner.',
    apply: (state, doc) => {
      state.resetForWorkbench();
      state.dockPosition = { side: 'left', verticalAnchor: 'top', offsetY: 24 };
      state.isDockMenuOpen = true;
      state.isDrawerOpen = true;
      state.annotations = makeSampleAnnotations(doc).slice(0, 1);
      state.notify();
    },
  },
  {
    id: 'voice-connecting',
    group: 'Dock & Voice',
    title: 'Voice Pill (Connecting Mic)',
    description: 'Initial amber connecting pulse before SpeechRecognition starts.',
    apply: (state) => {
      state.resetForWorkbench();
      state.activeTool = 'voice';
      VoiceRecorder.getInstance().setWorkbenchState({
        isRecording: true,
        isReady: false,
        durationMs: 0,
      });
      state.notify();
    },
  },
  {
    id: 'voice-recording-active',
    group: 'Dock & Voice',
    title: 'Voice Pill (Active + Pins + Interim)',
    description: 'Live red recording pill with timer, interim transcript, and 2 numbered pins.',
    apply: (state, doc) => {
      state.resetForWorkbench();
      state.activeTool = 'voice';
      const f1 = queryEl(doc, '#wb-feature-1');
      const f2 = queryEl(doc, '#wb-feature-2');
      const path = window.location.pathname;
      const pins: VoiceTargetPin[] = [
        { id: 'vp_1', order: 1, targetSelector: '#wb-feature-1', bounds: boundsFor(f1), pathname: path },
        { id: 'vp_2', order: 2, targetSelector: '#wb-feature-2', bounds: boundsFor(f2), pathname: path },
      ];
      state.activeVoicePins = pins;
      VoiceRecorder.getInstance().setWorkbenchState({
        isRecording: true,
        isReady: true,
        durationMs: 18_400,
        transcript: 'Tighten the padding between these two cards',
        interimTranscript: 'and boost the heading contrast slightly',
        pins,
        sections: [
          {
            id: 'vs_1',
            order: 1,
            targets: [{ targetSelector: '#wb-feature-1', bounds: boundsFor(f1), pathname: path }],
            transcript: 'Tighten the padding',
            timestampMs: 4200,
          },
          {
            id: 'vs_2',
            order: 2,
            targets: [{ targetSelector: '#wb-feature-2', bounds: boundsFor(f2), pathname: path }],
            transcript: 'between these two cards',
            timestampMs: 11500,
          },
        ],
      });
      state.notify();
    },
  },
  {
    id: 'voice-finishing',
    group: 'Dock & Voice',
    title: 'Voice Pill (Finishing Spinner)',
    description: 'Post-stop processing spinner while finalizing transcript.',
    apply: (state) => {
      state.resetForWorkbench();
      state.activeTool = 'voice';
      state.isStoppingVoice = true;
      VoiceRecorder.getInstance().setWorkbenchState({
        isRecording: true,
        isReady: true,
        durationMs: 24_000,
        transcript: 'Finalize card spacing across the pricing grid.',
      });
      state.notify();
    },
  },

  // ── Toolbar & Selection ───────────────────────────────────────────────────
  {
    id: 'toolbar-button',
    group: 'Toolbar & Selection',
    title: 'Toolbar: Button / Short Text',
    description: 'FloatingToolbar anchored to #wb-primary-cta with single-line text & style controls.',
    apply: (state, doc) => {
      state.resetForWorkbench();
      state.isDockMenuOpen = true;
      state.activeTool = 'edit';
      state.activeElement = queryEl(doc, '#wb-primary-cta');
      state.hoveredElement = queryEl(doc, '#wb-secondary-cta');
      state.notify();
    },
  },
  {
    id: 'toolbar-heading',
    group: 'Toolbar & Selection',
    title: 'Toolbar: Heading (H1)',
    description: 'FloatingToolbar anchored to #wb-hero-title showing Heading (H1) mode.',
    apply: (state, doc) => {
      state.resetForWorkbench();
      state.isDockMenuOpen = true;
      state.activeTool = 'edit';
      state.activeElement = queryEl(doc, '#wb-hero-title');
      state.notify();
    },
  },
  {
    id: 'toolbar-paragraph',
    group: 'Toolbar & Selection',
    title: 'Toolbar: Long Paragraph',
    description: 'FloatingToolbar anchored to #wb-hero-copy showing adaptive multiline editor & char badge.',
    apply: (state, doc) => {
      state.resetForWorkbench();
      state.isDockMenuOpen = true;
      state.activeTool = 'edit';
      state.activeElement = queryEl(doc, '#wb-hero-copy');
      state.notify();
    },
  },
  {
    id: 'toolbar-edge-flip',
    group: 'Toolbar & Selection',
    title: 'Toolbar: Viewport Edge Flip (Top-Right)',
    description: 'Tests @floating-ui/dom flip + shift when targeting #wb-edge-top-right near viewport corner.',
    apply: (state, doc) => {
      state.resetForWorkbench();
      state.isDockMenuOpen = true;
      state.activeTool = 'edit';
      state.activeElement = queryEl(doc, '#wb-edge-top-right');
      state.notify();
    },
  },
  {
    id: 'selection-hover-screenshot',
    group: 'Toolbar & Selection',
    title: 'Selection Box (Screenshot Snap Hover)',
    description: 'Hover highlight badge in screenshot capture mode.',
    apply: (state, doc) => {
      state.resetForWorkbench();
      state.isDockMenuOpen = true;
      state.activeTool = 'screenshot';
      state.hoveredElement = queryEl(doc, '#wb-pricing-card');
      state.notify();
    },
  },

  // ── Comments & Pins ───────────────────────────────────────────────────────
  {
    id: 'composer-element',
    group: 'Comments & Pins',
    title: 'Comment Composer (Element Target)',
    description: 'CommentComposer popover anchored below #wb-hero-eyebrow.',
    apply: (state, doc) => {
      state.resetForWorkbench();
      state.isDockMenuOpen = true;
      state.activeTool = 'comment';
      state.commentTargetElement = queryEl(doc, '#wb-hero-eyebrow');
      state.commentDraftText = 'Can we give this pill a hairline border for light backgrounds?';
      state.notify();
    },
  },
  {
    id: 'composer-text-quote',
    group: 'Comments & Pins',
    title: 'Comment Composer (Text Selection)',
    description: 'CommentComposer targeting a highlighted text snippet inside #wb-hero-copy.',
    apply: (state, doc) => {
      state.resetForWorkbench();
      state.isDockMenuOpen = true;
      state.activeTool = 'comment';
      const copy = queryEl(doc, '#wb-hero-copy');
      state.commentTargetElement = copy;
      state.commentTargetSelectedText = 'stream structured feedback straight to your coding agent';
      state.commentTargetBounds = boundsFor(copy);
      state.commentDraftText = 'Reword this phrase to sound more direct.';
      state.notify();
    },
  },
  {
    id: 'composer-multi-target',
    group: 'Comments & Pins',
    title: 'Comment Composer (Multi-Element)',
    description: 'Shift-click grouped comment across 3 feature cards.',
    apply: (state, doc) => {
      state.resetForWorkbench();
      state.isDockMenuOpen = true;
      state.activeTool = 'comment';
      const f1 = queryEl(doc, '#wb-feature-1');
      const f2 = queryEl(doc, '#wb-feature-2');
      const f3 = queryEl(doc, '#wb-feature-3');
      state.commentTargetElements = [f1, f2, f3].filter((el): el is HTMLElement => Boolean(el));
      state.commentTargetElement = f3 || f1;
      state.commentDraftText = 'Make all three cards equal height with 16px internal gap.';
      state.notify();
    },
  },
  {
    id: 'composer-with-screenshot',
    group: 'Comments & Pins',
    title: 'Comment Composer (With Screenshot)',
    description: 'CommentComposer displaying an attached visual capture thumbnail.',
    apply: (state, doc) => {
      state.resetForWorkbench();
      state.isDockMenuOpen = true;
      state.activeTool = 'comment';
      state.commentTargetElement = queryEl(doc, '#wb-pricing-card');
      state.commentPendingScreenshot = MOCK_SCREENSHOT_DATA_URL;
      state.commentDraftText = 'Notice the CTA contrast vs the card surface here.';
      state.notify();
    },
  },
  {
    id: 'comment-pins-all',
    group: 'Comments & Pins',
    title: 'Comment Pins (Single + Multi + Connector)',
    description: 'Displays pinned badges & SVG connectors for active annotations on the page.',
    apply: (state, doc) => {
      state.resetForWorkbench();
      state.isDockMenuOpen = true;
      state.annotations = makeSampleAnnotations(doc);
      state.notify();
    },
  },

  // ── Variants & Verification ───────────────────────────────────────────────
  {
    id: 'variant-switcher-pending',
    group: 'Variants & Verification',
    title: 'Variant Switcher (3 Pending Options)',
    description: 'Live A/B/C variant comparison bar anchored to #wb-pricing-card.',
    apply: (state) => {
      state.resetForWorkbench();
      state.isDockMenuOpen = true;
      state.variantSets = makeSampleVariantSets();
      state.notify();
    },
  },
  {
    id: 'variant-switcher-decided',
    group: 'Variants & Verification',
    title: 'Variant Switcher (Option Decided)',
    description: 'Post-selection decided state with undo/change affordance.',
    apply: (state) => {
      state.resetForWorkbench();
      state.isDockMenuOpen = true;
      const sets = makeSampleVariantSets();
      sets[0].status = 'decided';
      sets[0].selectedVariantId = 'var_indigo';
      const decision: VariantDecision = {
        id: 'vdec_wb_1',
        setId: sets[0].id,
        targetSelector: sets[0].targetSelector,
        label: sets[0].label,
        selectedVariantId: 'var_indigo',
        variantName: 'Indigo Tint',
        rationale: sets[0].variants[1].rationale,
        variant: sets[0].variants[1],
        timestamp: Date.now() - 10_000,
      };
      state.variantSets = sets;
      state.variantDecisions = [decision];
      state.previewVariant(sets[0].id, 'var_indigo');
      state.notify();
    },
  },
  {
    id: 'verification-halo',
    group: 'Variants & Verification',
    title: 'Verification Halo (Agent Updated)',
    description: 'Green verification halo rings over elements updated by the agent.',
    apply: (state, doc) => {
      state.resetForWorkbench();
      state.isDockMenuOpen = true;
      state.verificationTargets = [
        {
          selector: '#wb-primary-cta',
          bounds: boundsFor(queryEl(doc, '#wb-primary-cta')),
          label: 'Updated border-radius & padding',
          timestamp: Date.now(),
        },
        {
          selector: '#wb-pricing-card',
          bounds: boundsFor(queryEl(doc, '#wb-pricing-card')),
          label: 'Applied Indigo Tint variant',
          timestamp: Date.now(),
        },
      ];
      state.notify();
    },
  },

  // ── Review Drawer ─────────────────────────────────────────────────────────
  {
    id: 'drawer-empty',
    group: 'Review Drawer',
    title: 'Drawer: Empty State',
    description: 'Review drawer open with zero drafted changes.',
    apply: (state) => {
      state.resetForWorkbench();
      state.isDockMenuOpen = true;
      state.isDrawerOpen = true;
      state.notify();
    },
  },
  {
    id: 'drawer-rich-draft',
    group: 'Review Drawer',
    title: 'Drawer: Rich Batch Draft',
    description: 'Drawer populated with edits, comments (+ screenshot), voice walkthrough, and pending variants.',
    apply: (state, doc) => {
      state.resetForWorkbench();
      state.isDockMenuOpen = true;
      state.isDrawerOpen = true;
      state.mutations = makeSampleMutations(doc);
      state.annotations = makeSampleAnnotations(doc);
      state.voiceReviews = makeSampleVoiceReviews(doc);
      state.variantSets = makeSampleVariantSets();
      state.userPrompt = 'Keep mobile spacing compact and preserve dark mode contrast.';
      state.notify();
    },
  },
  {
    id: 'drawer-live-agent-replies',
    group: 'Review Drawer',
    title: 'Drawer: Live Mode + Agent Replies',
    description: 'Live mode drawer with connected hook lease and streaming agent replies.',
    apply: (state, doc) => {
      state.resetForWorkbench();
      state.isDockMenuOpen = true;
      state.isDrawerOpen = true;
      state.reviewMode = 'live';
      state.sessionStatus = 'in_progress';
      state.hookLease = {
        connected: true,
        harness: 'claude-code',
        agentState: 'implementing',
        seenCursor: 3,
        latestCursor: 4,
      };
      state.mutations = makeSampleMutations(doc).slice(0, 1);
      state.annotations = makeSampleAnnotations(doc).slice(0, 1);
      state.agentReplies = [
        {
          id: 'rep_1',
          timestamp: Date.now() - 40_000,
          agentId: 'claude-code',
          message: 'Picked up your batch — updating HeroSection.tsx heading copy and badge border.',
        },
        {
          id: 'rep_2',
          timestamp: Date.now() - 8_000,
          agentId: 'claude-code',
          message: 'Updated HeroSection.tsx (lines 29–44). Running typecheck before sending verification halo.',
        },
      ];
      state.notify();
    },
  },
  {
    id: 'drawer-offroute-and-update',
    group: 'Review Drawer',
    title: 'Drawer: Off-Route Badges + Update Pill',
    description: 'Shows route badges for annotations on other pages plus the CLI update pill.',
    apply: (state, doc) => {
      state.resetForWorkbench();
      state.isDockMenuOpen = true;
      state.isDrawerOpen = true;
      state.sessionStatus = 'submitted';
      state.updateInfo = {
        currentVersion: '0.15.1',
        latestVersion: '0.16.0',
        updateAvailable: true,
        changelogUrl: 'https://github.com/daveluk/lux-edit/releases',
      };
      const anns = makeSampleAnnotations(doc);
      anns[1] = {
        ...anns[1],
        pathname: '/settings/billing',
        comment: 'Align invoice table header with the primary CTA margin on /settings/billing.',
      };
      state.annotations = anns.slice(0, 2);
      state.mutations = makeSampleMutations(doc).slice(0, 1);
      state.notify();
    },
  },
];
