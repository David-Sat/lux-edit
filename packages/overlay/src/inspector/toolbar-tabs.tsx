import { h } from 'preact';
import { OverlayStateManager } from './state.js';
import { handleControlGroupArrowKey } from './toolbar-widgets.js';

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
      <div class="ve-box-model" role="group" aria-label="Padding">
        {fields.slice(0, 4).map((f) => (
          <div key={f.prop} class="ve-box-field">
            <span>{f.label}</span>
            <input
              class="ve-input"
              aria-label={f.label}
              value={f.value}
              onChange={(e) => handleStyleChange(f.prop, (e.target as HTMLInputElement).value)}
            />
          </div>
        ))}
      </div>
      <div class="ve-box-model ve-row--spaced" role="group" aria-label="Margin">
        {fields.slice(4).map((f) => (
          <div key={f.prop} class="ve-box-field">
            <span>{f.label}</span>
            <input
              class="ve-input"
              aria-label={f.label}
              value={f.value}
              onChange={(e) => handleStyleChange(f.prop, (e.target as HTMLInputElement).value)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TypographyTab({ el, computed, toggleStyle, handleStyleChange }: ToolbarTabProps) {
  const currentWeight = el.style.fontWeight || computed.fontWeight;
  const currentAlign = el.style.textAlign || computed.textAlign;

  return (
    <div>
      <div class="ve-row">
        <span class="ve-label">Font Size</span>
        <input
          class="ve-input"
          aria-label="Font size"
          value={el.style.fontSize || computed.fontSize}
          onChange={(e) => handleStyleChange('font-size', (e.target as HTMLInputElement).value)}
        />
      </div>
      <div class="ve-row ve-row--spaced">
        <span class="ve-label">Weight</span>
        <div
          class="ve-btn-group"
          role="group"
          aria-label="Font weight"
          onKeyDown={(e) => handleControlGroupArrowKey(e, e.currentTarget as HTMLElement)}
        >
          {['400', '500', '600', '700'].map((w) => (
            <button
              key={w}
              type="button"
              class={`ve-mini-btn ${currentWeight === w ? 've-active' : ''}`}
              aria-pressed={currentWeight === w}
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
          aria-label="Text color picker"
          value={computed.color}
          onChange={(e) => handleStyleChange('color', (e.target as HTMLInputElement).value)}
        />
        <input
          class="ve-input"
          aria-label="Text color value"
          value={el.style.color || computed.color}
          onChange={(e) => handleStyleChange('color', (e.target as HTMLInputElement).value)}
        />
      </div>
      <div class="ve-row ve-row--spaced">
        <span class="ve-label">Align</span>
        <div
          class="ve-btn-group"
          role="group"
          aria-label="Text alignment"
          onKeyDown={(e) => handleControlGroupArrowKey(e, e.currentTarget as HTMLElement)}
        >
          {['left', 'center', 'right'].map((al) => (
            <button
              key={al}
              type="button"
              class={`ve-mini-btn ${currentAlign === al ? 've-active' : ''}`}
              aria-pressed={currentAlign === al}
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
  const currentDisplay = el.style.display || computed.display;
  const currentDirection = el.style.flexDirection || computed.flexDirection;
  const currentJustify = el.style.justifyContent || computed.justifyContent;

  return (
    <div>
      <div class="ve-row">
        <span class="ve-label">Display</span>
        <div
          class="ve-btn-group"
          role="group"
          aria-label="Display mode"
          onKeyDown={(e) => handleControlGroupArrowKey(e, e.currentTarget as HTMLElement)}
        >
          {['block', 'flex', 'grid', 'inline-block'].map((d) => (
            <button
              key={d}
              type="button"
              class={`ve-mini-btn ${currentDisplay === d ? 've-active' : ''}`}
              aria-pressed={currentDisplay === d}
              onClick={() => toggleStyle('display', d)}
            >
              {d}
            </button>
          ))}
        </div>
      </div>
      <div class="ve-row ve-row--spaced">
        <span class="ve-label">Direction</span>
        <div
          class="ve-btn-group"
          role="group"
          aria-label="Flex direction"
          onKeyDown={(e) => handleControlGroupArrowKey(e, e.currentTarget as HTMLElement)}
        >
          {['row', 'column'].map((dir) => (
            <button
              key={dir}
              type="button"
              class={`ve-mini-btn ${currentDirection === dir ? 've-active' : ''}`}
              aria-pressed={currentDirection === dir}
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
          aria-label="Layout gap"
          value={el.style.gap || computed.gap}
          onChange={(e) => handleStyleChange('gap', (e.target as HTMLInputElement).value)}
        />
      </div>
      <div class="ve-row ve-row--spaced">
        <span class="ve-label">Justify</span>
        <div
          class="ve-btn-group"
          role="group"
          aria-label="Justify content"
          onKeyDown={(e) => handleControlGroupArrowKey(e, e.currentTarget as HTMLElement)}
        >
          {['flex-start', 'center', 'space-between'].map((j) => (
            <button
              key={j}
              type="button"
              class={`ve-mini-btn ${currentJustify === j ? 've-active' : ''}`}
              aria-pressed={currentJustify === j}
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
          aria-label="Background color picker"
          value={computed.backgroundColor}
          onChange={(e) => handleStyleChange('background-color', (e.target as HTMLInputElement).value)}
        />
        <input
          class="ve-input"
          aria-label="Background color value"
          value={el.style.backgroundColor || computed.backgroundColor}
          onChange={(e) => handleStyleChange('background-color', (e.target as HTMLInputElement).value)}
        />
      </div>
      <div class="ve-row ve-row--spaced">
        <span class="ve-label">Radius</span>
        <input
          class="ve-input"
          aria-label="Border radius"
          value={el.style.borderRadius || computed.borderRadius}
          onChange={(e) => handleStyleChange('border-radius', (e.target as HTMLInputElement).value)}
        />
      </div>
      <div class="ve-row ve-row--spaced">
        <span class="ve-label">Border</span>
        <input
          class="ve-input"
          aria-label="Border width"
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
      <div class="ve-class-list" role="list" aria-label="Applied CSS classes">
        {Array.from(el.classList).map((c) => (
          <span key={c} class="ve-class-chip" role="listitem">
            {c}
            <button
              type="button"
              class="ve-class-chip-remove"
              onClick={() => state.removeClass(c)}
              aria-label={`Remove class ${c}`}
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
          aria-label="Add CSS class"
          placeholder="Add class (e.g. shadow-lg, text-center)..."
          value={newClassInput}
          onInput={(e) => onChangeNewClassInput((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
          }}
        />
        <button
          type="button"
          class="ve-mini-btn primary"
          style={{ flex: 'none', padding: '5px 10px' }}
          onClick={handleAdd}
        >
          Add
        </button>
      </div>
    </div>
  );
}

export function DomActionsTab({ state }: { state: OverlayStateManager }) {
  return (
    <div class="ve-toolbar-stack">
      <div
        class="ve-btn-group"
        role="group"
        aria-label="Reorder element"
        style={{ gap: '6px' }}
        onKeyDown={(e) => handleControlGroupArrowKey(e, e.currentTarget as HTMLElement)}
      >
        <button
          type="button"
          class="ve-mini-btn"
          onClick={() => state.moveElement('up')}
          aria-label="Move element up"
          title="Move element before previous sibling"
        >
          ↑ Move Up
        </button>
        <button
          type="button"
          class="ve-mini-btn"
          onClick={() => state.moveElement('down')}
          aria-label="Move element down"
          title="Move element after next sibling"
        >
          ↓ Move Down
        </button>
      </div>
      <div
        class="ve-btn-group"
        role="group"
        aria-label="Element actions"
        style={{ gap: '6px' }}
        onKeyDown={(e) => handleControlGroupArrowKey(e, e.currentTarget as HTMLElement)}
      >
        <button
          type="button"
          class="ve-mini-btn"
          onClick={() => state.duplicateElement()}
          aria-label="Duplicate element"
          title="Create clone of this element"
        >
          Duplicate
        </button>
        <button
          type="button"
          class="ve-mini-btn ve-icon-btn--danger"
          onClick={() => state.deleteElement()}
          aria-label="Delete element"
          title="Remove element from page"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
