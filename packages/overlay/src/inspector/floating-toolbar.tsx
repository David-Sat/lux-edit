import { h } from 'preact';
import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
import { computePosition, flip, shift, offset } from '@floating-ui/dom';
import { OverlayStateManager } from './state.js';
import { resolveSourceLocation } from '../source-locator/index.js';

export function FloatingToolbar() {
  const state = OverlayStateManager.getInstance();
  const [, setTick] = useState(0);
  const [activeTab, setActiveTab] = useState<'quick' | 'spacing' | 'type' | 'layout' | 'style' | 'class' | 'actions'>('quick');
  const [newClassInput, setNewClassInput] = useState('');
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return state.subscribe(() => setTick((t) => t + 1));
  }, []);

  const el = state.activeElement;

  // Detect element type category for Smart Start ribbon
  const tag = el ? el.tagName.toUpperCase() : '';
  const isButton = el ? tag === 'BUTTON' || tag === 'A' || (tag === 'INPUT' && ['button', 'submit'].includes((el as HTMLInputElement).type)) : false;
  const isText = el ? ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'SPAN', 'BLOCKQUOTE', 'STRONG', 'EM', 'LABEL', 'B', 'I'].includes(tag) || (!isButton && el.children.length === 0 && (el.innerText || '').trim().length > 0) : false;
  const isImage = el ? ['IMG', 'SVG', 'VIDEO', 'PICTURE', 'FIGURE'].includes(tag) : false;
  const isList = el ? ['UL', 'OL', 'LI'].includes(tag) : false;
  const isContainer = el ? !isText && !isButton && !isImage && !isList : true;

  // Extract App's Main Colors from CSS variables & DOM
  const appColors = useMemo(() => {
    const colors = new Set<string>();
    try {
      const rootStyles = window.getComputedStyle(document.documentElement);
      const bodyStyles = window.getComputedStyle(document.body);
      
      [rootStyles.backgroundColor, bodyStyles.backgroundColor, rootStyles.color, bodyStyles.color].forEach((c) => {
        if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') colors.add(c);
      });

      // Sample a few buttons and headers on the page
      const sampleEls = document.querySelectorAll('button, h1, h2, a, [class*="bg-"], [class*="primary"]');
      sampleEls.forEach((sample, idx) => {
        if (idx > 15) return;
        const cs = window.getComputedStyle(sample);
        if (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent') {
          colors.add(cs.backgroundColor);
        }
        if (cs.color && cs.color !== 'rgba(0, 0, 0, 0)' && cs.color !== 'transparent') {
          colors.add(cs.color);
        }
      });
    } catch (e) {}

    const defaults = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#0f172a', '#1e293b', '#f8fafc', '#ffffff'];
    defaults.forEach((d) => colors.add(d));

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

  const handleStyleChange = (prop: string, val: string) => {
    state.updateElementStyle(prop, val);
  };

  const hasDraftedEdits = state.mutations.some((m) => m.targetSelector === sourceLoc.selector);

  return (
    <div
      ref={toolbarRef}
      class="ve-toolbar"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Toolbar Header */}
      <div class="ve-toolbar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
          <span class="ve-target-tag">
            {sourceLoc.componentName ? `<${sourceLoc.componentName}>` : sourceLoc.tag}
            {sourceLoc.fileName ? ` (${sourceLoc.fileName.split('/').pop()}:${sourceLoc.lineNumber || 1})` : ''}
          </span>
          {hasDraftedEdits && (
            <span style={{ fontSize: '9px', background: '#3b82f6', color: '#fff', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
              Edited
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            class="ve-mini-btn"
            style={{
              width: '24px',
              height: '24px',
              padding: '0',
              flex: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={() => state.setActiveElement(null)}
            title="Deselect (Esc)"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div class="ve-toolbar-tabs">
        <button
          class={`ve-tab-btn ${activeTab === 'quick' ? 've-active' : ''}`}
          onClick={() => setActiveTab('quick')}
          title="Smart Context-Aware Controls"
        >
          Smart
        </button>
        <button
          class={`ve-tab-btn ${activeTab === 'spacing' ? 've-active' : ''}`}
          onClick={() => setActiveTab('spacing')}
          title="Padding & Margin"
        >
          Spacing
        </button>
        <button
          class={`ve-tab-btn ${activeTab === 'type' ? 've-active' : ''}`}
          onClick={() => setActiveTab('type')}
          title="Typography & Fonts"
        >
          Type
        </button>
        <button
          class={`ve-tab-btn ${activeTab === 'layout' ? 've-active' : ''}`}
          onClick={() => setActiveTab('layout')}
          title="Flex, Grid, Display"
        >
          Layout
        </button>
        <button
          class={`ve-tab-btn ${activeTab === 'style' ? 've-active' : ''}`}
          onClick={() => setActiveTab('style')}
          title="Colors, Borders, Radius"
        >
          Styles
        </button>
        <button
          class={`ve-tab-btn ${activeTab === 'class' ? 've-active' : ''}`}
          onClick={() => setActiveTab('class')}
          title="Tailwind & CSS Classes"
        >
          Classes
        </button>
        <button
          class={`ve-tab-btn ${activeTab === 'actions' ? 've-active' : ''}`}
          onClick={() => setActiveTab('actions')}
          title="DOM Tree Operations"
        >
          DOM
        </button>
      </div>

      {/* Tab Content */}
      <div class="ve-toolbar-content">
        {/* ================= SMART CONTEXT-AWARE START TAB ================= */}
        {activeTab === 'quick' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Quick Text / Heading Options */}
            {isText && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div class="ve-row">
                  <span class="ve-label">Text</span>
                  <input
                    class="ve-input"
                    value={el.innerText || ''}
                    onInput={(e) => state.updateElementText((e.target as HTMLInputElement).value)}
                    placeholder="Edit text content..."
                  />
                </div>

                <div class="ve-row">
                  <span class="ve-label">Size</span>
                  <div class="ve-btn-group">
                    {['12px', '14px', '16px', '20px', '28px', '36px'].map((sz, idx) => {
                      const labels = ['XS', 'SM', 'MD', 'LG', 'XL', '2XL'];
                      return (
                        <button
                          key={sz}
                          class={`ve-mini-btn ${computed.fontSize === sz ? 've-active' : ''}`}
                          onClick={() => handleStyleChange('font-size', sz)}
                          title={`Font Size: ${sz}`}
                        >
                          {labels[idx]}
                        </button>
                      );
                    })}
                  </div>
                </div>

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
                        onClick={() => handleStyleChange('font-weight', w.val)}
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div class="ve-row">
                  <span class="ve-label">Color</span>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flex: 1, overflowX: 'auto', padding: '2px 0' }}>
                    {appColors.map((color) => (
                      <button
                        key={color}
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '4px',
                          background: color,
                          border: computed.color === color ? '2px solid #38bdf8' : '1px solid rgba(255,255,255,0.2)',
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                        onClick={() => handleStyleChange('color', color)}
                        title={`Apply color: ${color}`}
                      />
                    ))}
                    <input
                      type="color"
                      style={{ width: '22px', height: '22px', border: 'none', background: 'none', cursor: 'pointer', flexShrink: 0 }}
                      value={computed.color}
                      onChange={(e) => handleStyleChange('color', (e.target as HTMLInputElement).value)}
                      title="Custom Color"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Quick Button Options */}
            {isButton && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div class="ve-row">
                  <span class="ve-label">Label</span>
                  <input
                    class="ve-input"
                    value={el.innerText || ''}
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
                    ].map((r) => (
                      <button
                        key={r.val}
                        class={`ve-mini-btn ${computed.borderRadius === r.val ? 've-active' : ''}`}
                        onClick={() => handleStyleChange('border-radius', r.val)}
                      >
                        {r.label}
                      </button>
                    ))}
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
                        class="ve-mini-btn"
                        onClick={() => handleStyleChange('padding', pad.pt)}
                      >
                        {pad.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div class="ve-row">
                  <span class="ve-label">Background</span>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flex: 1, overflowX: 'auto' }}>
                    {appColors.map((color) => (
                      <button
                        key={color}
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '4px',
                          background: color,
                          border: computed.backgroundColor === color ? '2px solid #38bdf8' : '1px solid rgba(255,255,255,0.2)',
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                        onClick={() => handleStyleChange('background-color', color)}
                        title={`Apply background: ${color}`}
                      />
                    ))}
                    <input
                      type="color"
                      style={{ width: '22px', height: '22px', border: 'none', background: 'none', cursor: 'pointer', flexShrink: 0 }}
                      value={computed.backgroundColor}
                      onChange={(e) => handleStyleChange('background-color', (e.target as HTMLInputElement).value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Quick Image / Media Options */}
            {isImage && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {tag === 'IMG' && (
                  <div class="ve-row">
                    <span class="ve-label">Image Source</span>
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
                  <span class="ve-label">Radius</span>
                  <div class="ve-btn-group">
                    {[
                      { val: '0px', label: 'Square' },
                      { val: '12px', label: 'Rounded' },
                      { val: '50%', label: 'Circle' },
                    ].map((r) => (
                      <button
                        key={r.val}
                        class={`ve-mini-btn ${computed.borderRadius === r.val ? 've-active' : ''}`}
                        onClick={() => handleStyleChange('border-radius', r.val)}
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
                        onClick={() => handleStyleChange('object-fit', fit)}
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                        onClick={() => handleStyleChange('display', mode.d)}
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
                          onClick={() => handleStyleChange('flex-direction', dir)}
                        >
                          {dir}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div class="ve-row">
                  <span class="ve-label">Gap</span>
                  <div class="ve-btn-group">
                    {['4px', '8px', '16px', '24px', '32px'].map((g) => (
                      <button
                        key={g}
                        class={`ve-mini-btn ${computed.gap === g ? 've-active' : ''}`}
                        onClick={() => handleStyleChange('gap', g)}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                <div class="ve-row">
                  <span class="ve-label">Radius</span>
                  <div class="ve-btn-group">
                    {['0px', '8px', '16px', '24px'].map((rad) => (
                      <button
                        key={rad}
                        class={`ve-mini-btn ${computed.borderRadius === rad ? 've-active' : ''}`}
                        onClick={() => handleStyleChange('border-radius', rad)}
                      >
                        {rad}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Quick Action Ribbon */}
            <div style={{ borderTop: '1px solid #334155', paddingTop: '8px', display: 'flex', gap: '6px' }}>
              <button
                class="ve-mini-btn"
                onClick={() => state.duplicateElement()}
                title="Duplicate this element"
              >
                Duplicate
              </button>
              <button
                class="ve-mini-btn"
                style={{ color: '#f43f5e' }}
                onClick={() => state.deleteElement()}
                title="Delete this element"
              >
                Delete
              </button>
              <button
                class="ve-mini-btn"
                style={{ color: '#a855f7' }}
                onClick={() => {
                  state.setCommentTarget(el);
                  state.setActiveElement(null);
                }}
                title="Drop a comment pin on this element"
              >
                Comment
              </button>
            </div>
          </div>
        )}

        {/* ================= SPACING TAB ================= */}
        {activeTab === 'spacing' && (
          <div>
            <div class="ve-box-model">
              <div class="ve-box-field">
                <span>Padding Top</span>
                <input
                  class="ve-input"
                  value={el.style.paddingTop || computed.paddingTop}
                  onChange={(e) => handleStyleChange('padding-top', (e.target as HTMLInputElement).value)}
                />
              </div>
              <div class="ve-box-field">
                <span>Padding Bottom</span>
                <input
                  class="ve-input"
                  value={el.style.paddingBottom || computed.paddingBottom}
                  onChange={(e) => handleStyleChange('padding-bottom', (e.target as HTMLInputElement).value)}
                />
              </div>
              <div class="ve-box-field">
                <span>Padding Left</span>
                <input
                  class="ve-input"
                  value={el.style.paddingLeft || computed.paddingLeft}
                  onChange={(e) => handleStyleChange('padding-left', (e.target as HTMLInputElement).value)}
                />
              </div>
              <div class="ve-box-field">
                <span>Padding Right</span>
                <input
                  class="ve-input"
                  value={el.style.paddingRight || computed.paddingRight}
                  onChange={(e) => handleStyleChange('padding-right', (e.target as HTMLInputElement).value)}
                />
              </div>
            </div>

            <div class="ve-box-model" style={{ marginTop: '8px' }}>
              <div class="ve-box-field">
                <span>Margin Top</span>
                <input
                  class="ve-input"
                  value={el.style.marginTop || computed.marginTop}
                  onChange={(e) => handleStyleChange('margin-top', (e.target as HTMLInputElement).value)}
                />
              </div>
              <div class="ve-box-field">
                <span>Margin Bottom</span>
                <input
                  class="ve-input"
                  value={el.style.marginBottom || computed.marginBottom}
                  onChange={(e) => handleStyleChange('margin-bottom', (e.target as HTMLInputElement).value)}
                />
              </div>
              <div class="ve-box-field">
                <span>Margin Left</span>
                <input
                  class="ve-input"
                  value={el.style.marginLeft || computed.marginLeft}
                  onChange={(e) => handleStyleChange('margin-left', (e.target as HTMLInputElement).value)}
                />
              </div>
              <div class="ve-box-field">
                <span>Margin Right</span>
                <input
                  class="ve-input"
                  value={el.style.marginRight || computed.marginRight}
                  onChange={(e) => handleStyleChange('margin-right', (e.target as HTMLInputElement).value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* ================= TYPOGRAPHY TAB ================= */}
        {activeTab === 'type' && (
          <div>
            <div class="ve-row">
              <span class="ve-label">Font Size</span>
              <input
                class="ve-input"
                value={el.style.fontSize || computed.fontSize}
                onChange={(e) => handleStyleChange('font-size', (e.target as HTMLInputElement).value)}
              />
            </div>
            <div class="ve-row" style={{ marginTop: '8px' }}>
              <span class="ve-label">Weight</span>
              <div class="ve-btn-group">
                {['400', '500', '600', '700'].map((w) => (
                  <button
                    key={w}
                    class={`ve-mini-btn ${(el.style.fontWeight || computed.fontWeight) === w ? 've-active' : ''}`}
                    onClick={() => handleStyleChange('font-weight', w)}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
            <div class="ve-row" style={{ marginTop: '8px' }}>
              <span class="ve-label">Color</span>
              <input
                type="color"
                style={{ width: '32px', height: '26px', border: 'none', background: 'none', cursor: 'pointer' }}
                value={computed.color}
                onChange={(e) => handleStyleChange('color', (e.target as HTMLInputElement).value)}
              />
              <input
                class="ve-input"
                value={el.style.color || computed.color}
                onChange={(e) => handleStyleChange('color', (e.target as HTMLInputElement).value)}
              />
            </div>
            <div class="ve-row" style={{ marginTop: '8px' }}>
              <span class="ve-label">Align</span>
              <div class="ve-btn-group">
                {['left', 'center', 'right'].map((al) => (
                  <button
                    key={al}
                    class={`ve-mini-btn ${(el.style.textAlign || computed.textAlign) === al ? 've-active' : ''}`}
                    onClick={() => handleStyleChange('text-align', al)}
                  >
                    {al}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= LAYOUT TAB ================= */}
        {activeTab === 'layout' && (
          <div>
            <div class="ve-row">
              <span class="ve-label">Display</span>
              <div class="ve-btn-group">
                {['block', 'flex', 'grid', 'inline-block'].map((d) => (
                  <button
                    key={d}
                    class={`ve-mini-btn ${(el.style.display || computed.display) === d ? 've-active' : ''}`}
                    onClick={() => handleStyleChange('display', d)}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div class="ve-row" style={{ marginTop: '8px' }}>
              <span class="ve-label">Direction</span>
              <div class="ve-btn-group">
                {['row', 'column'].map((dir) => (
                  <button
                    key={dir}
                    class={`ve-mini-btn ${(el.style.flexDirection || computed.flexDirection) === dir ? 've-active' : ''}`}
                    onClick={() => handleStyleChange('flex-direction', dir)}
                  >
                    {dir}
                  </button>
                ))}
              </div>
            </div>
            <div class="ve-row" style={{ marginTop: '8px' }}>
              <span class="ve-label">Gap</span>
              <input
                class="ve-input"
                value={el.style.gap || computed.gap}
                onChange={(e) => handleStyleChange('gap', (e.target as HTMLInputElement).value)}
              />
            </div>
            <div class="ve-row" style={{ marginTop: '8px' }}>
              <span class="ve-label">Justify</span>
              <div class="ve-btn-group">
                {['flex-start', 'center', 'space-between'].map((j) => (
                  <button
                    key={j}
                    class={`ve-mini-btn ${(el.style.justifyContent || computed.justifyContent) === j ? 've-active' : ''}`}
                    onClick={() => handleStyleChange('justify-content', j)}
                  >
                    {j.replace('flex-', '')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= STYLES TAB ================= */}
        {activeTab === 'style' && (
          <div>
            <div class="ve-row">
              <span class="ve-label">Background</span>
              <input
                type="color"
                style={{ width: '32px', height: '26px', border: 'none', background: 'none', cursor: 'pointer' }}
                value={computed.backgroundColor}
                onChange={(e) => handleStyleChange('background-color', (e.target as HTMLInputElement).value)}
              />
              <input
                class="ve-input"
                value={el.style.backgroundColor || computed.backgroundColor}
                onChange={(e) => handleStyleChange('background-color', (e.target as HTMLInputElement).value)}
              />
            </div>
            <div class="ve-row" style={{ marginTop: '8px' }}>
              <span class="ve-label">Radius</span>
              <input
                class="ve-input"
                value={el.style.borderRadius || computed.borderRadius}
                onChange={(e) => handleStyleChange('border-radius', (e.target as HTMLInputElement).value)}
              />
            </div>
            <div class="ve-row" style={{ marginTop: '8px' }}>
              <span class="ve-label">Border</span>
              <input
                class="ve-input"
                value={el.style.borderWidth || computed.borderWidth}
                onChange={(e) => handleStyleChange('border-width', (e.target as HTMLInputElement).value)}
              />
            </div>
          </div>
        )}

        {/* ================= CLASSES TAB ================= */}
        {activeTab === 'class' && (
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
              {Array.from(el.classList).map((c) => (
                <span
                  key={c}
                  style={{
                    fontSize: '11px',
                    background: '#1e293b',
                    border: '1px solid #475569',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {c}
                  <button
                    style={{ background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer', fontSize: '11px', padding: 0 }}
                    onClick={() => state.removeClass(c)}
                    title="Remove class"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div class="ve-row">
              <input
                class="ve-input"
                placeholder="Add class (e.g. shadow-lg, text-center)..."
                value={newClassInput}
                onInput={(e) => setNewClassInput((e.target as HTMLInputElement).value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newClassInput.trim()) {
                    state.addClass(newClassInput.trim());
                    setNewClassInput('');
                  }
                }}
              />
              <button
                class="ve-mini-btn primary"
                style={{ flex: 'none', padding: '5px 10px' }}
                onClick={() => {
                  if (newClassInput.trim()) {
                    state.addClass(newClassInput.trim());
                    setNewClassInput('');
                  }
                }}
              >
                Add
              </button>
            </div>
          </div>
        )}

        {/* ================= DOM ACTIONS TAB ================= */}
        {activeTab === 'actions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                class="ve-mini-btn"
                onClick={() => state.moveElement('up')}
                title="Move element before previous sibling"
              >
                ↑ Move Up
              </button>
              <button
                class="ve-mini-btn"
                onClick={() => state.moveElement('down')}
                title="Move element after next sibling"
              >
                ↓ Move Down
              </button>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                class="ve-mini-btn"
                onClick={() => state.duplicateElement()}
                title="Create clone of this element"
              >
                Duplicate
              </button>
              <button
                class="ve-mini-btn"
                style={{ color: '#f43f5e' }}
                onClick={() => state.deleteElement()}
                title="Remove element from page"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
