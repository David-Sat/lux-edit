import { h } from 'preact';
import {
  CommentAnnotation,
  ElementVariantSet,
  MutationRecord,
  VariantDecision,
} from '@visual-edit/core';
import { normalizeRoute } from '../inspector/route-utils.js';

function scrollToSelector(selector: string): void {
  try {
    const el = document.querySelector(selector);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch {}
}

export function RouteBadge({
  pathname,
  currentPath,
  prefix,
}: {
  pathname: string;
  currentPath: string;
  prefix: string;
}) {
  const isCurrent = normalizeRoute(pathname) === normalizeRoute(currentPath);
  return (
    <span
      style={{
        fontSize: '10px',
        padding: '1px 5px',
        borderRadius: '4px',
        background: isCurrent ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.08)',
        color: isCurrent ? 'var(--ve-accent-text, #38bdf8)' : 'var(--ve-text-muted, #94a3b8)',
        fontFamily: 'monospace',
      }}
      title={`${prefix} ${pathname}`}
    >
      {pathname}
    </span>
  );
}

export function MutationCard({
  mutation: m,
  currentPath,
  onRevert,
}: {
  mutation: MutationRecord;
  currentPath: string;
  onRevert: (id: string) => void;
}) {
  return (
    <div class="ve-mutation-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div class="ve-mut-target" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span>
            {m.sourceLocation?.componentName ? `<${m.sourceLocation.componentName}>` : m.targetSelector}
            {m.property ? ` • ${m.property}` : ''}
          </span>
          {m.pathname && <RouteBadge pathname={m.pathname} currentPath={currentPath} prefix="Modified on" />}
        </div>
        <button
          style={{
            background: 'none',
            border: 'none',
            color: '#f43f5e',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: '600',
            padding: '0 4px',
          }}
          onClick={() => onRevert(m.id)}
          title="Revert this visual change"
        >
          Revert
        </button>
      </div>

      <div class="ve-mut-diff">
        {m.type === 'TEXT_EDIT' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span class="ve-mut-before">"{m.before}"</span>
            <span class="ve-mut-after">"{m.after}"</span>
          </div>
        )}

        {m.type === 'STYLE_CHANGE' && (
          <div>
            <span class="ve-mut-before">{m.before}</span> → <span class="ve-mut-after">{m.after}</span>
            {m.tailwindSuggestion && (
              <span style={{ color: 'var(--ve-accent-text, #0284c7)', marginLeft: '6px', fontSize: '11px' }}>
                ({m.tailwindSuggestion})
              </span>
            )}
          </div>
        )}

        {m.type === 'CLASS_CHANGE' && (
          <div>
            {m.details?.added && m.details.added.length > 0 && (
              <div style={{ color: '#22c55e' }}>+ {m.details.added.join(', ')}</div>
            )}
            {m.details?.removed && m.details.removed.length > 0 && (
              <div style={{ color: '#ef4444' }}>- {m.details.removed.join(', ')}</div>
            )}
          </div>
        )}

        {m.type === 'DOM_INSERT' && <span style={{ color: '#22c55e' }}>+ Inserted element</span>}
        {m.type === 'DOM_REMOVE' && <span style={{ color: '#ef4444' }}>- Deleted element</span>}
        {m.type === 'DOM_REORDER' && (
          <span style={{ color: 'var(--ve-accent-text, #0284c7)' }}>⇄ Reordered position</span>
        )}
      </div>
    </div>
  );
}

export function AnnotationCard({
  annotation: ann,
  index: idx,
  currentPath,
  isEditing,
  editingText,
  onStartEdit,
  onChangeEditingText,
  onSaveEdit,
  onCancelEdit,
  onDelete,
}: {
  annotation: CommentAnnotation;
  index: number;
  currentPath: string;
  isEditing: boolean;
  editingText: string;
  onStartEdit: () => void;
  onChangeEditingText: (text: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
}) {
  const isVoice = ann.type === 'voice';
  const isScreenshot = ann.type === 'screenshot' || Boolean(ann.screenshot);

  return (
    <div
      class="ve-mutation-card"
      style={
        isVoice
          ? { background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)' }
          : isScreenshot
            ? { background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)' }
            : undefined
      }
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <span class="ve-mut-target" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {isVoice ? (
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              </svg>
              Voice Walkthrough{' '}
              {ann.targets && ann.targets.length > 0 ? `(${ann.targets.length} target${ann.targets.length > 1 ? 's' : ''})` : ''}
            </span>
          ) : isScreenshot ? (
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              Screenshot {ann.targetSelector ? `• ${ann.targetSelector}` : ''}
            </span>
          ) : ann.targets && ann.targets.length > 1 ? (
            `Pin #${idx + 1} • Linked (${ann.targets.length} elements)`
          ) : (
            `Pin #${idx + 1} ${ann.targetSelector ? `• ${ann.targetSelector}` : ''}`
          )}
          {!isVoice && !isScreenshot && ann.selectedText ? ' • [Text Selection]' : ''}
          {ann.pathname && <RouteBadge pathname={ann.pathname} currentPath={currentPath} prefix="Created on" />}
        </span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {!isEditing && (
            <button
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--ve-text-muted, #94a3b8)',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: '600',
              }}
              onClick={onStartEdit}
            >
              Edit
            </button>
          )}
          <button
            style={{
              background: 'none',
              border: 'none',
              color: '#f43f5e',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: '600',
            }}
            onClick={onDelete}
          >
            Delete
          </button>
        </div>
      </div>

      {ann.targets && ann.targets.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
          {ann.targets.map((t, tIdx) => {
            const label = t.sourceLocation?.componentName
              ? `<${t.sourceLocation.componentName}>`
              : t.targetSelector || `Target ${tIdx + 1}`;
            return (
              <span
                key={tIdx}
                style={{
                  fontSize: '10px',
                  fontFamily: 'ui-monospace, monospace',
                  background: isVoice ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.12)',
                  border: isVoice ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(56, 189, 248, 0.3)',
                  color: isVoice ? '#fca5a5' : 'var(--ve-accent-text, #38bdf8)',
                  padding: '1px 5px',
                  borderRadius: '4px',
                }}
              >
                {isVoice ? `Target ${tIdx + 1}: ${label}` : `${String.fromCharCode(65 + tIdx)}: ${label}`}
              </span>
            );
          })}
        </div>
      )}

      {ann.selectedText && (
        <div
          style={{
            fontSize: '11px',
            color: 'var(--ve-amber-text, #d97706)',
            background: 'rgba(251, 191, 36, 0.14)',
            borderLeft: '2px solid var(--ve-amber-text, #d97706)',
            padding: '3px 6px',
            borderRadius: '2px',
            marginBottom: '4px',
            fontStyle: 'italic',
            wordBreak: 'break-word',
          }}
        >
          "{ann.selectedText}"
        </div>
      )}

      {isEditing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
          <textarea
            style={{
              background: 'rgba(0, 0, 0, 0.45)',
              color: 'var(--ve-text-primary, #f8fafc)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              borderRadius: '6px',
              padding: '6px',
              fontSize: '12px',
              fontFamily: 'inherit',
              resize: 'vertical',
              minHeight: '48px',
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box',
            }}
            value={editingText}
            onInput={(e) => onChangeEditingText((e.target as HTMLTextAreaElement).value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                onSaveEdit();
              } else if (e.key === 'Escape') {
                onCancelEdit();
              }
            }}
            autoFocus
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
            <button
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--ve-text-muted, #94a3b8)',
                fontSize: '11px',
                cursor: 'pointer',
                padding: '2px 6px',
              }}
              onClick={onCancelEdit}
            >
              Cancel
            </button>
            <button
              onClick={onSaveEdit}
              style={{
                background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.28) 0%, rgba(255, 255, 255, 0.12) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.7)',
                color: '#ffffff',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '600',
                cursor: 'pointer',
                padding: '3px 10px',
              }}
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {ann.voiceSections && ann.voiceSections.length > 1 ? (
            ann.voiceSections.map((sec) => (
              <div
                key={sec.id}
                style={{
                  background: 'rgba(0,0,0,0.22)',
                  padding: '4px 6px',
                  borderRadius: '4px',
                  fontSize: '11px',
                }}
              >
                <div style={{ color: '#fca5a5', fontWeight: 600, fontSize: '10px' }}>
                  Section #{sec.order} ({sec.targets.map((t) => t.targetSelector).join(', ') || 'General'})
                </div>
                <div style={{ color: 'var(--ve-text-primary, #f8fafc)' }}>
                  {sec.transcript || '(Pinned without speech)'}
                </div>
              </div>
            ))
          ) : (
            <p
              style={{ color: 'var(--ve-text-primary, #f8fafc)', fontSize: '12px', cursor: 'pointer' }}
              onClick={onStartEdit}
              title="Click to edit"
            >
              {ann.comment}
            </p>
          )}
        </div>
      )}

      {ann.screenshot && (
        <div style={{ marginTop: '6px', marginBottom: '4px' }}>
          <img
            src={ann.screenshot}
            alt="Visual capture"
            style={{
              width: '100%',
              maxHeight: '140px',
              objectFit: 'contain',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              background: 'rgba(0, 0, 0, 0.4)',
              cursor: 'zoom-in',
              display: 'block',
            }}
            onClick={() => {
              window.open(ann.screenshot, '_blank');
            }}
            title="Click to view full screenshot"
          />
        </div>
      )}
    </div>
  );
}

export function VariantProposalCard({
  variantSet: set,
  onDismiss,
}: {
  variantSet: ElementVariantSet;
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      class="ve-mutation-card"
      style={{
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        gap: '8px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span class="ve-mut-target" style={{ fontWeight: 600, color: '#f1f5f9' }}>
          {set.label || set.targetSelector}
        </span>
        <button
          style={{
            background: 'none',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 600,
          }}
          onClick={() => onDismiss(set.id)}
          title="Dismiss proposal"
        >
          Dismiss
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          fontSize: '11px',
          color: '#94a3b8',
        }}
      >
        <span>{set.variants.length} options proposed</span>
        <button
          style={{
            background: 'rgba(56, 189, 248, 0.16)',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            color: '#38bdf8',
            borderRadius: '5px',
            padding: '2px 8px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
          onClick={() => scrollToSelector(set.targetSelector)}
          title="Scroll to element to preview and pick options"
        >
          Preview on Page
        </button>
      </div>
    </div>
  );
}

export function VariantDecisionCard({
  decision: vd,
  onChangeOption,
  onDelete,
}: {
  decision: VariantDecision;
  onChangeOption: (setId: string) => void;
  onDelete: (setId: string) => void;
}) {
  return (
    <div class="ve-mutation-card" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div
          class="ve-mut-target"
          style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {vd.targetSelector}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <button
            style={{
              background: 'rgba(59, 130, 246, 0.18)',
              border: '1px solid rgba(96, 165, 250, 0.35)',
              color: '#93c5fd',
              borderRadius: '5px',
              padding: '3px 8px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.1s ease',
            }}
            onClick={() => {
              onChangeOption(vd.setId);
              scrollToSelector(vd.targetSelector);
            }}
            title="Revert to test different options"
          >
            Change Option
          </button>
          <button
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(248, 113, 113, 0.3)',
              color: '#fca5a5',
              borderRadius: '5px',
              padding: '3px 8px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.1s ease',
            }}
            onClick={() => onDelete(vd.setId)}
            title="Delete variant decision and restore original styles"
          >
            Delete
          </button>
        </div>
      </div>
      <div style={{ fontSize: '12px', color: '#4ade80', fontWeight: 600 }}>Selected: {vd.variantName}</div>
    </div>
  );
}
