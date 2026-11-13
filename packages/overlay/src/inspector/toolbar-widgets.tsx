import { h } from 'preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';

export function getElementCleanText(el: HTMLElement | null): string {
  if (!el) return '';
  const raw = el.textContent || el.innerText || '';
  if (/^\s*[\r\n]/.test(raw)) {
    return (el.innerText || raw).trim();
  }
  return raw;
}

export interface AdaptiveTextEditorProps {
  initialValue: string;
  isParagraphLike: boolean;
  isHeading: boolean;
  tag: string;
  onUpdate: (val: string) => void;
}

export function AdaptiveTextEditor({
  initialValue,
  isParagraphLike,
  isHeading,
  tag,
  onUpdate,
}: AdaptiveTextEditorProps) {
  const [value, setValue] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setValue(initialValue);
    }
  }, [initialValue]);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const isMulti = isParagraphLike || value.length > 60 || value.includes('\n');
    const minHeight = isParagraphLike ? 84 : isHeading ? 34 : isMulti ? 68 : 34;
    const maxHeight = 240;
    const computedHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
    textarea.style.height = `${computedHeight}px`;
  }, [value, isParagraphLike, isHeading]);

  useEffect(() => {
    adjustHeight();
  }, [adjustHeight]);

  const isMulti = isParagraphLike || value.length > 60 || value.includes('\n');
  const label = isParagraphLike ? 'Paragraph' : isHeading ? `Heading (${tag})` : 'Text';

  if (!isMulti && !isParagraphLike) {
    return (
      <div class="ve-row" style={{ alignItems: 'flex-start' }}>
        <span class="ve-label" style={{ paddingTop: '6px' }}>
          {label}
        </span>
        <textarea
          ref={textareaRef}
          class="ve-textarea-adaptive"
          rows={1}
          value={value}
          placeholder="Edit text content..."
          onFocus={() => {
            isFocusedRef.current = true;
          }}
          onBlur={() => {
            isFocusedRef.current = false;
          }}
          onInput={(e) => {
            const nextVal = (e.target as HTMLTextAreaElement).value;
            setValue(nextVal);
            onUpdate(nextVal);
          }}
          style={{ minHeight: '32px', maxHeight: '80px' }}
        />
      </div>
    );
  }

  return (
    <div class="ve-field-group">
      <div class="ve-field-header">
        <span class="ve-label">{label}</span>
        <div class="ve-toolbar-title-wrap">
          <span class="ve-badge-subtle">{value.length} chars</span>
          {tag && (
            <span class="ve-badge-subtle" style={{ textTransform: 'uppercase' }}>
              {tag}
            </span>
          )}
        </div>
      </div>
      <textarea
        ref={textareaRef}
        class="ve-textarea-adaptive"
        rows={isParagraphLike ? 4 : 2}
        value={value}
        placeholder="Edit text content..."
        onFocus={() => {
          isFocusedRef.current = true;
        }}
        onBlur={() => {
          isFocusedRef.current = false;
        }}
        onInput={(e) => {
          const nextVal = (e.target as HTMLTextAreaElement).value;
          setValue(nextVal);
          onUpdate(nextVal);
        }}
        style={{ minHeight: isParagraphLike ? '84px' : '64px' }}
      />
    </div>
  );
}

export function OriginSliderRow({
  label,
  min,
  max,
  step,
  value,
  originValue,
  resetTitle,
  onChange,
  onReset,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  originValue: number;
  resetTitle: string;
  onChange: (nextPx: string) => void;
  onReset: () => void;
}) {
  return (
    <div class="ve-slider-row">
      <span class="ve-label" title={resetTitle} onDblClick={onReset} style={{ cursor: 'pointer' }}>
        {label}
      </span>
      <div class="ve-slider-wrap">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          class="ve-slider"
          value={value}
          onInput={(e) => onChange(`${(e.target as HTMLInputElement).value}px`)}
        />
        {originValue >= min && originValue <= max && (
          <div
            class="ve-origin-tick"
            style={{ left: `${((originValue - min) / (max - min)) * 100}%` }}
            title={`Original: ${originValue}px`}
          />
        )}
      </div>
      <span class="ve-slider-val" title="Double-click to reset" onDblClick={onReset}>
        {value}px
      </span>
    </div>
  );
}

export function ColorSwatchesRow({
  label,
  appColors,
  currentColor,
  onToggleColor,
  onChangeColor,
}: {
  label: string;
  appColors: string[];
  currentColor: string;
  onToggleColor: (color: string) => void;
  onChangeColor: (color: string) => void;
}) {
  return (
    <div class="ve-row">
      <span class="ve-label">{label}</span>
      <div class="ve-swatch-row">
        {appColors.map((color) => (
          <button
            key={color}
            class={`ve-swatch ${currentColor === color ? 'is-active' : ''}`}
            style={{ background: color }}
            onClick={() => onToggleColor(color)}
            title={`Apply ${label.toLowerCase()}: ${color} (click again to reset)`}
          />
        ))}
        <input
          type="color"
          class="ve-color-picker ve-color-picker--sm"
          value={currentColor}
          onChange={(e) => onChangeColor((e.target as HTMLInputElement).value)}
          title={`Custom ${label}`}
        />
      </div>
    </div>
  );
}
