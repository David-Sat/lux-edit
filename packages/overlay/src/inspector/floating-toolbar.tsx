import { h } from 'preact';
import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
import { computePosition, flip, shift, offset } from '@floating-ui/dom';
import { OverlayStateManager } from './state.js';
import { resolveSourceLocation } from '../source-locator/index.js';
import {
  AdaptiveTextEditor,
  ColorSwatchesRow,
  OriginSliderRow,
  getElementCleanText,
} from './toolbar-widgets.js';
import {
  ClassesTab,
  DomActionsTab,
  LayoutTab,
  SpacingTab,
  StyleTab,
  ToolbarTabId,
  TypographyTab,
} from './toolbar-tabs.js';

const DEFAULT_PALETTE = [
  '#6366f1',
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#0f172a',
  '#1e293b',
  '#f8fafc',
  '#ffffff',
];

const TOOLBAR_TABS: Array<{ id: ToolbarTabId; label: string; title: string }> = [
  { id: 'quick', label: 'Smart', title: 'Smart Context-Aware Controls' },
  { id: 'spacing', label: 'Spacing', title: 'Padding & Margin' },
  { id: 'type', label: 'Type', title: 'Typography & Fonts' },
  { id: 'layout', label: 'Layout', title: 'Flex, Grid, Display' },
  { id: 'style', label: 'Styles', title: 'Colors, Borders, Radius' },
  { id: 'class', label: 'Classes', title: 'Tailwind & CSS Classes' },
  { id: 'actions', label: 'DOM', title: 'DOM Tree Operations' },
];

function parseNumericPx(str?: string): number {
  if (!str) return 0;
  const num = parseFloat(str);
  return Number.isNaN(num) ? 0 : num;
}

export function FloatingToolbar() {
  const state = OverlayStateManager.getInstance();
  const [, setTick] = useState(0);
  const [activeTab, setActiveTab] = useState<ToolbarTabId>('quick');
  const [newClassInput, setNewClassInput] = useState('');
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return state.subscribe(() => setTick((t) => t + 1));
  }, [state]);

  const el = state.activeElement;

  const tag = el ? (el.tagName || '').toUpperCase() : '';
  const isButton = el
    ? tag === 'BUTTON' ||
      (tag === 'A' && el.children.length > 0) ||
      (tag === 'INPUT' && ['button', 'submit'].includes((el as HTMLInputElement).type))
    : false;
  const isText = el
    ? [
        'H1',
        'H2',
        'H3',
        'H4',
        'H5',
        'H6',
        'P',
        'SPAN',
        'BLOCKQUOTE',
        'STRONG',
        'EM',
        'LABEL',
        'B',
        'I',
        'TEXT',
        'TSPAN',
        'A',
        'LI',
        'TD',
        'TH',
        'CODE',
        'PRE',
      ].includes(tag) ||
      (!isButton && el.children.length === 0 && (el.textContent || el.innerText || '').trim().length > 0)
    : false;
  const isParagraphLike = el ? ['P', 'BLOCKQUOTE', 'ARTICLE', 'SECTION', 'PRE'].includes(tag) : false;
  const isHeading = el ? ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(tag) : false;
  const currentTextContent = el ? getElementCleanText(el) : '';
  const isMultilineText = isText && (isParagraphLike || currentTextContent.length > 60 || currentTextContent.includes('\n'));
  const isImage = el ? ['IMG', 'SVG', 'VIDEO', 'PICTURE', 'FIGURE'].includes(tag) : false;
  const isList = el ? ['UL', 'OL', 'LI'].includes(tag) : false;
  const isContainer = el ? !isText && !isButton && !isImage && !isList : true;

  const appColors = useMemo(() => {
    const colors = new Set<string>();
    const addVisibleColor = (color: string | undefined) => {
      if (color && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') {
        colors.add(color);
      }
    };

    try {
      if (el) {
        const activeCs = window.getComputedStyle(el);
        addVisibleColor(activeCs.backgroundColor);
        addVisibleColor(activeCs.color);
      }

      const rootStyles = window.getComputedStyle(document.documentElement);
      const bodyStyles = window.getComputedStyle(document.body);
      addVisibleColor(rootStyles.backgroundColor);
      addVisibleColor(bodyStyles.backgroundColor);
      addVisibleColor(rootStyles.color);
      addVisibleColor(bodyStyles.color);

      const sampleEls = document.querySelectorAll('button, h1, h2, a, [class*="bg-"], [class*="primary"]');
      sampleEls.forEach((sample, idx) => {
        if (idx > 15) return;
        const cs = window.getComputedStyle(sample);
        addVisibleColor(cs.backgroundColor);
        addVisibleColor(cs.color);
      });
    } catch (err) {
      console.debug('[lux] Failed to sample page color palette:', err);
    }

    DEFAULT_PALETTE.forEach((d) => colors.add(d));
    return Array.from(colors).slice(0, 8);
  }, [el]);

  useEffect(() => {
    if (!el || !toolbarRef.current) return;

    const updatePos = () => {
      if (!el || !toolbarRef.current) return;
      computePosition(el, toolbarRef.current, {
        strategy: 'fixed',
        placement: 'top-start',
        middleware: [offset(10), flip(), shift({ padding: 10 })],
      }).then(({ x, y }) => {
        if (toolbarRef.current) {
          toolbarRef.current.style.left = `${x}px`;
          toolbarRef.current.style.top = `${y}px`;
        }
      });
    };

    updatePos();
    window.addEventListener('scroll', updatePos, { passive: true });
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos);
      window.removeEventListener('resize', updatePos);
    };
  }, [el, activeTab]);

  if (state.activeTool !== 'edit') return null;
  if (!el || !document.body.contains(el)) return null;

  const sourceLoc = resolveSourceLocation(el);
  const computed = window.getComputedStyle(el);
  const snapshot = state.getSnapshotForElement(el);

  const toggleStyle = (prop: string, val: string) => {
    const currentVal = el.style.getPropertyValue(prop) || computed.getPropertyValue(prop);
    if (currentVal === val || el.style.getPropertyValue(prop) === val) {
      state.resetElementProperty(el, prop);
    } else {
      state.updateElementStyle(prop, val);
    }
  };

  const handleStyleChange = (prop: string, val: string) => {
    state.updateElementStyle(prop, val);
  };

  const hasDraftedEdits = state.mutations.some((m) => m.targetSelector === sourceLoc.selector);

  const fontSizeNum = parseNumericPx(el.style.fontSize || computed.fontSize);
  const originFontSize = parseNumericPx(snapshot?.styles['font-size']);

  const gapNum = parseNumericPx(el.style.gap || computed.gap);
  const originGap = parseNumericPx(snapshot?.styles['gap']);

  const radiusNum = parseNumericPx(el.style.borderRadius || computed.borderRadius);
  const originRadius = parseNumericPx(snapshot?.styles['border-radius']);

  const tabProps = { el, computed, state, toggleStyle, handleStyleChange };

  return (
    <div
      ref={toolbarRef}
      class={`ve-toolbar ${activeTab === 'quick' && isMultilineText ? 've-toolbar-wide' : ''}`}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Toolbar Header */}
      <div class="ve-toolbar-header">
        <div class="ve-toolbar-title-wrap">
          <span class="ve-target-tag">
            {sourceLoc.componentName ? `<${sourceLoc.componentName}>` : sourceLoc.tag}
            {sourceLoc.fileName ? ` (${sourceLoc.fileName.split('/').pop()}:${sourceLoc.lineNumber || 1})` : ''}
          </span>
          {hasDraftedEdits && <span class="ve-edited-pill">Edited</span>}
        </div>

        <button
          class="ve-close-btn"
          onClick={() => state.setActiveElement(null)}
          title="Deselect (Esc)"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Tabs Bar */}
      <div class="ve-toolbar-tabs">
        {TOOLBAR_TABS.map((tab) => (
          <button
            key={tab.id}
            class={`ve-tab-btn ${activeTab === tab.id ? 've-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            title={tab.title}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div class="ve-toolbar-content">
        {activeTab === 'quick' && (
          <div class="ve-toolbar-stack ve-toolbar-stack--lg">
            {/* Quick Text / Heading Options */}
            {isText && (
              <div class="ve-toolbar-stack">
                <AdaptiveTextEditor
                  key={sourceLoc.selector || el.tagName}
                  initialValue={getElementCleanText(el)}
                  isParagraphLike={isParagraphLike}
                  isHeading={isHeading}
                  tag={tag}
                  onUpdate={(val) => state.updateElementText(val)}
                />

                <OriginSliderRow
                  label="Size"
                  min={10}
                  max={72}
                  step={1}
                  value={fontSizeNum}
                  originValue={originFontSize}
                  resetTitle="Double-click to reset to original size"
                  onChange={(nextPx) => handleStyleChange('font-size', nextPx)}
                  onReset={() => state.resetElementProperty(el, 'font-size')}
                />

                {/* Weight Chips with Deselect Toggle */}
                <div class="ve-row">
                  <span class="ve-label">Weight</span>
                  <div class="ve-btn-group">
                    {[
                      { val: '400', label: 'Reg' },
                      { val: '500', label: 'Med' },
                      { val: '600', label: 'Semi' },
                      { val: '700', label: 'Bold' },
                    ].map((w) => (
                      <button
                        key={w.val}
                        class={`ve-mini-btn ${(el.style.fontWeight || computed.fontWeight) === w.val ? 've-active' : ''}`}
                        onClick={() => toggleStyle('font-weight', w.val)}
                        title="Click to apply, click again to reset"
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>
                </div>

                <ColorSwatchesRow
                  label="Color"
                  appColors={appColors}
                  currentColor={computed.color}
                  onToggleColor={(color) => toggleStyle('color', color)}
                  onChangeColor={(color) => handleStyleChange('color', color)}
                />
              </div>
            )}

            {/* Quick Button Options */}
            {isButton && (
              <div class="ve-toolbar-stack">
                <div class="ve-row">
                  <span class="ve-label">Label</span>
                  <input
                    class="ve-input"
                    key={sourceLoc.selector || el.tagName}
                    defaultValue={getElementCleanText(el)}
                    onInput={(e) => state.updateElementText((e.target as HTMLInputElement).value)}
                  />
                </div>

                <div class="ve-row">
                  <span class="ve-label">Shape</span>
                  <div class="ve-btn-group">
                    {[
                      { val: '0px', label: 'Square' },
                      { val: '8px', label: 'Rounded' },
                      { val: '9999px', label: 'Pill' },
                    ].map((r) => {
                      const curR = el.style.borderRadius || computed.borderRadius;
                      const curNum = parseFloat(curR) || 0;
                      let isActive = false;
                      if (r.val === '9999px') {
                        isActive = el.style.borderRadius === '9999px' || curNum >= 18;
                      } else if (r.val === '0px') {
                        isActive = el.style.borderRadius === '0px' || curNum === 0;
                      } else {
                        isActive = el.style.borderRadius === '8px' || el.style.borderRadius === '12px' || (curNum > 0 && curNum < 18);
                      }
                      return (
                        <button
                          key={r.val}
                          class={`ve-mini-btn ${isActive ? 've-active' : ''}`}
                          onClick={() => {
                            if (isActive) {
                              state.resetElementProperty(el, 'border-radius');
                            } else {
                              handleStyleChange('border-radius', r.val);
                            }
                          }}
                          title="Click to apply, click again to reset"
                        >
                          {r.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div class="ve-row">
                  <span class="ve-label">Padding</span>
                  <div class="ve-btn-group">
                    {[
                      { pt: '4px 10px', label: 'Compact' },
                      { pt: '8px 16px', label: 'Default' },
                      { pt: '14px 24px', label: 'Large' },
                    ].map((pad) => (
                      <button
                        key={pad.label}
                        class={`ve-mini-btn ${el.style.padding === pad.pt ? 've-active' : ''}`}
                        onClick={() => toggleStyle('padding', pad.pt)}
                        title="Click to apply, click again to reset"
                      >
                        {pad.label}
                      </button>
                    ))}
                  </div>
                </div>

                <ColorSwatchesRow
                  label="Background"
                  appColors={appColors}
                  currentColor={computed.backgroundColor}
                  onToggleColor={(color) => toggleStyle('background-color', color)}
                  onChangeColor={(color) => handleStyleChange('background-color', color)}
                />
              </div>
            )}

            {/* Quick Image / Media Options */}
            {isImage && (
              <div class="ve-toolbar-stack">
                {tag === 'IMG' && (
                  <div class="ve-row">
                    <span class="ve-label">Source</span>
                    <input
                      class="ve-input"
                      value={(el as HTMLImageElement).src || ''}
                      onChange={(e) => {
                        const val = (e.target as HTMLInputElement).value;
                        (el as HTMLImageElement).src = val;
                        state.syncMutationsForElement(el);
                      }}
                      placeholder="Paste Image URL..."
                    />
                  </div>
                )}

                <div class="ve-row">
                  <span class="ve-label">Shape</span>
                  <div class="ve-btn-group">
                    {[
                      { val: '0px', label: 'Square' },
                      { val: '12px', label: 'Rounded' },
                      { val: '50%', label: 'Circle' },
                    ].map((r) => (
                      <button
                        key={r.val}
                        class={`ve-mini-btn ${computed.borderRadius === r.val ? 've-active' : ''}`}
                        onClick={() => toggleStyle('border-radius', r.val)}
                        title="Click to toggle"
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div class="ve-row">
                  <span class="ve-label">Fit</span>
                  <div class="ve-btn-group">
                    {['cover', 'contain', 'fill'].map((fit) => (
                      <button
                        key={fit}
                        class={`ve-mini-btn ${computed.objectFit === fit ? 've-active' : ''}`}
                        onClick={() => toggleStyle('object-fit', fit)}
                        title="Click to toggle"
                      >
                        {fit}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Quick Container / Layout Block Options */}
            {isContainer && (
              <div class="ve-toolbar-stack">
                <div class="ve-row">
                  <span class="ve-label">Display</span>
                  <div class="ve-btn-group">
                    {[
                      { d: 'flex', label: 'Flex' },
                      { d: 'grid', label: 'Grid' },
                      { d: 'block', label: 'Block' },
                    ].map((mode) => (
                      <button
                        key={mode.d}
                        class={`ve-mini-btn ${computed.display === mode.d ? 've-active' : ''}`}
                        onClick={() => toggleStyle('display', mode.d)}
                        title="Click to toggle display"
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                {computed.display === 'flex' && (
                  <div class="ve-row">
                    <span class="ve-label">Direction</span>
                    <div class="ve-btn-group">
                      {['row', 'column'].map((dir) => (
                        <button
                          key={dir}
                          class={`ve-mini-btn ${computed.flexDirection === dir ? 've-active' : ''}`}
                          onClick={() => toggleStyle('flex-direction', dir)}
                          title="Click to toggle direction"
                        >
                          {dir}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <OriginSliderRow
                  label="Gap"
                  min={0}
                  max={64}
                  step={2}
                  value={gapNum}
                  originValue={originGap}
                  resetTitle="Double-click to reset gap"
                  onChange={(nextPx) => handleStyleChange('gap', nextPx)}
                  onReset={() => state.resetElementProperty(el, 'gap')}
                />

                <OriginSliderRow
                  label="Radius"
                  min={0}
                  max={48}
                  step={2}
                  value={radiusNum}
                  originValue={originRadius}
                  resetTitle="Double-click to reset radius"
                  onChange={(nextPx) => handleStyleChange('border-radius', nextPx)}
                  onReset={() => state.resetElementProperty(el, 'border-radius')}
                />
              </div>
            )}

            {/* Quick Action Ribbon with Clean Vector SVG Icons & Tooltips */}
            <div class="ve-action-ribbon">
              <button
                class="ve-mini-btn ve-icon-btn"
                onClick={() => state.moveElement('up')}
                title="Move element up (↑)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              </button>

              <button
                class="ve-mini-btn ve-icon-btn"
                onClick={() => state.moveElement('down')}
                title="Move element down (↓)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <polyline points="19 12 12 19 5 12" />
                </svg>
              </button>

              <button
                class="ve-mini-btn ve-icon-btn"
                onClick={() => state.duplicateElement()}
                title="Duplicate this element"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>

              <button
                class="ve-mini-btn ve-icon-btn ve-icon-btn--accent"
                onClick={() => {
                  state.setCommentTarget(el);
                  state.setActiveElement(null);
                }}
                title="Drop a comment pin on this element"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </button>

              <button
                class="ve-mini-btn ve-icon-btn ve-icon-btn--danger"
                onClick={() => state.deleteElement()}
                title="Delete this element"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          </div>
        )}
        {activeTab === 'spacing' && <SpacingTab {...tabProps} />}
        {activeTab === 'type' && <TypographyTab {...tabProps} />}
        {activeTab === 'layout' && <LayoutTab {...tabProps} />}
        {activeTab === 'style' && <StyleTab {...tabProps} />}
        {activeTab === 'class' && (
          <ClassesTab
            el={el}
            state={state}
            newClassInput={newClassInput}
            onChangeNewClassInput={setNewClassInput}
          />
        )}
        {activeTab === 'actions' && <DomActionsTab state={state} />}
      </div>
    </div>
  );
}
