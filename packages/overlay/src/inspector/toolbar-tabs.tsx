import { h } from 'preact';
import { OverlayStateManager } from './state.js';

export type ToolbarTabId = 'quick' | 'spacing' | 'type' | 'layout' | 'style' | 'class' | 'actions';

export interface ToolbarTabProps {
  el: HTMLElement;
  computed: CSSStyleDeclaration;
  state: OverlayStateManager;
  toggleStyle: (prop: string, val: string) => void;
  handleStyleChange: (prop: string, val: string) => void;
}

export function SpacingTab({ el, computed, handleStyleChange }: ToolbarTabProps) {
  const fields: Array<{ label: string; prop: string; value: string }> = [
    { label: 'Padding Top', prop: 'padding-top', value: el.style.paddingTop || computed.paddingTop },
    { label: 'Padding Bottom', prop: 'padding-bottom', value: el.style.paddingBottom || computed.paddingBottom },
    { label: 'Padding Left', prop: 'padding-left', value: el.style.paddingLeft || computed.paddingLeft },
    { label: 'Padding Right', prop: 'padding-right', value: el.style.paddingRight || computed.paddingRight },
    { label: 'Margin Top', prop: 'margin-top', value: el.style.marginTop || computed.marginTop },
    { label: 'Margin Bottom', prop: 'margin-bottom', value: el.style.marginBottom || computed.marginBottom },
    { label: 'Margin Left', prop: 'margin-left', value: el.style.marginLeft || computed.marginLeft },
    { label: 'Margin Right', prop: 'margin-right', value: el.style.marginRight || computed.marginRight },
  ];

  return (
    <div>
      <div class="ve-box-model">
        {fields.slice(0, 4).map((f) => (
          <div key={f.prop} class="ve-box-field">
            <span>{f.label}</span>
            <input class="ve-input" value={f.value} onChange={(e) => handleStyleChange(f.prop, (e.target as HTMLInputElement).value)} />
          </div>
        ))}
      </div>
      <div class="ve-box-model ve-row--spaced">
        {fields.slice(4).map((f) => (
          <div key={f.prop} class="ve-box-field">
            <span>{f.label}</span>
            <input class="ve-input" value={f.value} onChange={(e) => handleStyleChange(f.prop, (e.target as HTMLInputElement).value)} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TypographyTab({ el, computed, toggleStyle, handleStyleChange }: ToolbarTabProps) {
  return (
    <div>
      <div class="ve-row">
        <span class="ve-label">Font Size</span>
        <input
          class="ve-input"
          value={el.style.fontSize || computed.fontSize}
          onChange={(e) => handleStyleChange('font-size', (e.target as HTMLInputElement).value)}
        />
      </div>
      <div class="ve-row ve-row--spaced">
        <span class="ve-label">Weight</span>
        <div class="ve-btn-group">
          {['400', '500', '600', '700'].map((w) => (
            <button
              key={w}
              class={`ve-mini-btn ${(el.style.fontWeight || computed.fontWeight) === w ? 've-active' : ''}`}
              onClick={() => toggleStyle('font-weight', w)}
            >
              {w}
            </button>
          ))}
        </div>
      </div>
      <div class="ve-row ve-row--spaced">
        <span class="ve-label">Color</span>
        <input
          type="color"
          class="ve-color-picker"
          value={computed.color}
          onChange={(e) => handleStyleChange('color', (e.target as HTMLInputElement).value)}
        />
        <input
          class="ve-input"
          value={el.style.color || computed.color}
          onChange={(e) => handleStyleChange('color', (e.target as HTMLInputElement).value)}
        />
      </div>
      <div class="ve-row ve-row--spaced">
        <span class="ve-label">Align</span>
        <div class="ve-btn-group">
          {['left', 'center', 'right'].map((al) => (
            <button
              key={al}
              class={`ve-mini-btn ${(el.style.textAlign || computed.textAlign) === al ? 've-active' : ''}`}
              onClick={() => toggleStyle('text-align', al)}
            >
              {al}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LayoutTab({ el, computed, toggleStyle, handleStyleChange }: ToolbarTabProps) {
  return (
    <div>
      <div class="ve-row">
        <span class="ve-label">Display</span>
        <div class="ve-btn-group">
          {['block', 'flex', 'grid', 'inline-block'].map((d) => (
            <button
              key={d}
              class={`ve-mini-btn ${(el.style.display || computed.display) === d ? 've-active' : ''}`}
              onClick={() => toggleStyle('display', d)}
            >
              {d}
            </button>
          ))}
        </div>
      </div>
      <div class="ve-row ve-row--spaced">
        <span class="ve-label">Direction</span>
        <div class="ve-btn-group">
          {['row', 'column'].map((dir) => (
            <button
              key={dir}
              class={`ve-mini-btn ${(el.style.flexDirection || computed.flexDirection) === dir ? 've-active' : ''}`}
              onClick={() => toggleStyle('flex-direction', dir)}
            >
              {dir}
            </button>
          ))}
        </div>
      </div>
      <div class="ve-row ve-row--spaced">
        <span class="ve-label">Gap</span>
        <input
          class="ve-input"
          value={el.style.gap || computed.gap}
          onChange={(e) => handleStyleChange('gap', (e.target as HTMLInputElement).value)}
        />
      </div>
      <div class="ve-row ve-row--spaced">
        <span class="ve-label">Justify</span>
        <div class="ve-btn-group">
          {['flex-start', 'center', 'space-between'].map((j) => (
            <button
              key={j}
              class={`ve-mini-btn ${(el.style.justifyContent || computed.justifyContent) === j ? 've-active' : ''}`}
              onClick={() => toggleStyle('justify-content', j)}
            >
              {j.replace('flex-', '')}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function StyleTab({ el, computed, handleStyleChange }: ToolbarTabProps) {
  return (
    <div>
      <div class="ve-row">
        <span class="ve-label">Background</span>
        <input
          type="color"
          class="ve-color-picker"
          value={computed.backgroundColor}
          onChange={(e) => handleStyleChange('background-color', (e.target as HTMLInputElement).value)}
        />
        <input
          class="ve-input"
          value={el.style.backgroundColor || computed.backgroundColor}
          onChange={(e) => handleStyleChange('background-color', (e.target as HTMLInputElement).value)}
        />
      </div>
      <div class="ve-row ve-row--spaced">
        <span class="ve-label">Radius</span>
        <input
          class="ve-input"
          value={el.style.borderRadius || computed.borderRadius}
          onChange={(e) => handleStyleChange('border-radius', (e.target as HTMLInputElement).value)}
        />
      </div>
      <div class="ve-row ve-row--spaced">
        <span class="ve-label">Border</span>
        <input
          class="ve-input"
          value={el.style.borderWidth || computed.borderWidth}
          onChange={(e) => handleStyleChange('border-width', (e.target as HTMLInputElement).value)}
        />
      </div>
    </div>
  );
}

export function ClassesTab({
  el,
  state,
  newClassInput,
  onChangeNewClassInput,
}: {
  el: HTMLElement;
  state: OverlayStateManager;
  newClassInput: string;
  onChangeNewClassInput: (val: string) => void;
}) {
  const handleAdd = () => {
    if (newClassInput.trim()) {
      state.addClass(newClassInput.trim());
      onChangeNewClassInput('');
    }
  };

  return (
    <div>
      <div class="ve-class-list">
        {Array.from(el.classList).map((c) => (
          <span key={c} class="ve-class-chip">
            {c}
            <button class="ve-class-chip-remove" onClick={() => state.removeClass(c)} title="Remove class">
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
          onInput={(e) => onChangeNewClassInput((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
          }}
        />
        <button class="ve-mini-btn primary" style={{ flex: 'none', padding: '5px 10px' }} onClick={handleAdd}>
          Add
        </button>
      </div>
    </div>
  );
}

export function DomActionsTab({ state }: { state: OverlayStateManager }) {
  return (
    <div class="ve-toolbar-stack">
      <div style={{ display: 'flex', gap: '6px' }}>
        <button class="ve-mini-btn" onClick={() => state.moveElement('up')} title="Move element before previous sibling">
          ↑ Move Up
        </button>
        <button class="ve-mini-btn" onClick={() => state.moveElement('down')} title="Move element after next sibling">
          ↓ Move Down
        </button>
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        <button class="ve-mini-btn" onClick={() => state.duplicateElement()} title="Create clone of this element">
          Duplicate
        </button>
        <button class="ve-mini-btn ve-icon-btn--danger" onClick={() => state.deleteElement()} title="Remove element from page">
          Delete
        </button>
      </div>
    </div>
  );
}
