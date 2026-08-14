import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { computePosition, flip, shift, offset } from '@floating-ui/dom';
import { OverlayStateManager } from './state.js';
import { resolveSourceLocation } from '../source-locator/index.js';
import { mapStyleToTailwind } from '@visual-edit/core';

export function FloatingToolbar() {
  const state = OverlayStateManager.getInstance();
  const [, setTick] = useState(0);
  const [activeTab, setActiveTab] = useState<'spacing' | 'type' | 'layout' | 'style' | 'class' | 'actions'>('spacing');
  const [newClassInput, setNewClassInput] = useState('');
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return state.subscribe(() => setTick((t) => t + 1));
  }, []);

  const el = state.activeElement;

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

  const insertMockElement = (type: 'button' | 'heading' | 'card' | 'text') => {
    if (!el || !el.parentElement) return;
    let newEl: HTMLElement;

    if (type === 'button') {
      const btn = document.createElement('button');
      btn.innerText = 'New Action Button';
      btn.style.padding = '8px 16px';
      btn.style.backgroundColor = '#3b82f6';
      btn.style.color = '#ffffff';
      btn.style.borderRadius = '6px';
      btn.style.border = 'none';
      btn.style.fontWeight = '600';
      btn.style.cursor = 'pointer';
      newEl = btn;
    } else if (type === 'heading') {
      const h2 = document.createElement('h2');
      h2.innerText = 'New Section Title';
      h2.style.fontSize = '24px';
      h2.style.fontWeight = '700';
      h2.style.marginBottom = '12px';
      newEl = h2;
    } else if (type === 'card') {
      const card = document.createElement('div');
      card.style.padding = '16px';
      card.style.borderRadius = '8px';
      card.style.border = '1px solid #cbd5e1';
      card.style.backgroundColor = '#f8fafc';
      card.innerHTML = '<h3 style="font-weight: 600; margin-bottom: 8px;">Card Title</h3><p style="color: #64748b;">Card descriptive content goes here.</p>';
      newEl = card;
    } else {
      const p = document.createElement('p');
      p.innerText = 'New paragraph text content with updated information.';
      p.style.lineHeight = '1.6';
      p.style.marginBottom = '8px';
      newEl = p;
    }

    el.parentElement.insertBefore(newEl, el.nextSibling);
    state.setActiveElement(newEl);
  };

  return (
    <div
      ref={toolbarRef}
      class="ve-toolbar"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div class="ve-toolbar-header">
        <span class="ve-target-tag">
          {sourceLoc.componentName ? `<${sourceLoc.componentName}>` : sourceLoc.tag}
          {sourceLoc.fileName ? ` (${sourceLoc.fileName.split('/').pop()}:${sourceLoc.lineNumber || 1})` : ''}
        </span>
        <button
          class="ve-mini-btn"
          style={{ width: '22px', flex: 'none' }}
          onClick={() => state.setActiveElement(null)}
          title="Deselect (Esc)"
        >
          ✕
        </button>
      </div>

      <div class="ve-toolbar-tabs">
        <button
          class={`ve-tab-btn ${activeTab === 'spacing' ? 've-active' : ''}`}
          onClick={() => setActiveTab('spacing')}
        >
          Spacing
        </button>
        <button
          class={`ve-tab-btn ${activeTab === 'type' ? 've-active' : ''}`}
          onClick={() => setActiveTab('type')}
        >
          Type
        </button>
        <button
          class={`ve-tab-btn ${activeTab === 'layout' ? 've-active' : ''}`}
          onClick={() => setActiveTab('layout')}
        >
          Layout
        </button>
        <button
          class={`ve-tab-btn ${activeTab === 'style' ? 've-active' : ''}`}
          onClick={() => setActiveTab('style')}
        >
          Styles
        </button>
        <button
          class={`ve-tab-btn ${activeTab === 'class' ? 've-active' : ''}`}
          onClick={() => setActiveTab('class')}
        >
          Classes
        </button>
        <button
          class={`ve-tab-btn ${activeTab === 'actions' ? 've-active' : ''}`}
          onClick={() => setActiveTab('actions')}
        >
          DOM
        </button>
      </div>

      <div class="ve-toolbar-content">
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
                style={{ width: '40px', height: '28px', border: 'none', background: 'none', cursor: 'pointer' }}
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
                    {j === 'flex-start' ? 'start' : j === 'space-between' ? 'between' : j}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'style' && (
          <div>
            <div class="ve-row">
              <span class="ve-label">Background</span>
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
              <span class="ve-label">Border W</span>
              <input
                class="ve-input"
                value={el.style.borderWidth || computed.borderWidth}
                onChange={(e) => handleStyleChange('border-width', (e.target as HTMLInputElement).value)}
              />
            </div>
          </div>
        )}

        {activeTab === 'class' && (
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
              {Array.from(el.classList).map((cls) => (
                <span
                  key={cls}
                  style={{
                    background: '#334155',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {cls}
                  <button
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                    onClick={() => state.removeClass(cls)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div class="ve-row">
              <input
                class="ve-input"
                placeholder="Add class (e.g. shadow-lg, rounded-xl)..."
                value={newClassInput}
                onInput={(e) => setNewClassInput((e.target as HTMLInputElement).value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newClassInput.trim()) {
                    state.addClass(newClassInput);
                    setNewClassInput('');
                  }
                }}
              />
              <button
                class="ve-mini-btn"
                style={{ flex: 'none', padding: '4px 12px' }}
                onClick={() => {
                  if (newClassInput.trim()) {
                    state.addClass(newClassInput);
                    setNewClassInput('');
                  }
                }}
              >
                Add
              </button>
            </div>
          </div>
        )}

        {activeTab === 'actions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button class="ve-mini-btn" onClick={() => state.moveElement('up')}>
                ▲ Move Up
              </button>
              <button class="ve-mini-btn" onClick={() => state.moveElement('down')}>
                ▼ Move Down
              </button>
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button class="ve-mini-btn" onClick={() => state.duplicateElement()}>
                ⧉ Duplicate
              </button>
              <button
                class="ve-mini-btn"
                style={{ background: '#7f1d1d', borderColor: '#991b1b', color: '#fecaca' }}
                onClick={() => state.deleteElement()}
              >
                🗑 Delete
              </button>
            </div>
            <span style={{ fontSize: '10px', color: '#64748b', marginTop: '4px', textTransform: 'uppercase' }}>
              Insert Mock Sibling
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
              <button class="ve-mini-btn" onClick={() => insertMockElement('button')}>
                + Button
              </button>
              <button class="ve-mini-btn" onClick={() => insertMockElement('heading')}>
                + Heading
              </button>
              <button class="ve-mini-btn" onClick={() => insertMockElement('card')}>
                + Card
              </button>
              <button class="ve-mini-btn" onClick={() => insertMockElement('text')}>
                + Paragraph
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
