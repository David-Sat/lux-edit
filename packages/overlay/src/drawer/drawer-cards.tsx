import { ComponentChildren, h } from 'preact';
import {
  CommentAnnotation,
  ElementVariantSet,
  MutationRecord,
  VariantDecision,
} from '@visual-edit/core';
import { normalizeRoute } from '../inspector/route-utils.js';

function CardActionSvg({ children }: { children: ComponentChildren }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.1"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function IconUndo() {
  return (
    <CardActionSvg>
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </CardActionSvg>
  );
}

function IconPencil() {
  return (
    <CardActionSvg>
      <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </CardActionSvg>
  );
}

function IconTrash() {
  return (
    <CardActionSvg>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </CardActionSvg>
  );
}

function IconClose() {
  return (
    <CardActionSvg>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </CardActionSvg>
  );
}

function scrollToSelector(selector: string): void {
  try {
    const el = document.querySelector(selector);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (err) {
    console.debug('[lux] Could not scroll to selector:', selector, err);
  }
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
    <span class={`ve-route-badge ${isCurrent ? 'is-current' : ''}`} title={`${prefix} ${pathname}`}>
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
      <div class="ve-card-top">
        <div class="ve-mut-target ve-card-target-wrap">
          <span>
            {m.sourceLocation?.componentName ? `<${m.sourceLocation.componentName}>` : m.targetSelector}
            {m.property ? ` • ${m.property}` : ''}
          </span>
          {m.pathname && <RouteBadge pathname={m.pathname} currentPath={currentPath} prefix="Modified on" />}
        </div>
        <button
          type="button"
          class="ve-card-icon-btn"
          onClick={() => onRevert(m.id)}
          aria-label={`Revert edit on ${m.sourceLocation?.componentName ? `<${m.sourceLocation.componentName}>` : m.targetSelector}`}
          title="Revert this visual change"
        >
          <IconUndo />
        </button>
      </div>

      <div class="ve-mut-diff">
        {m.type === 'TEXT_EDIT' && (
          <div class="ve-mut-stack">
            <span class="ve-mut-before">"{m.before}"</span>
            <span class="ve-mut-after">"{m.after}"</span>
          </div>
        )}

        {m.type === 'STYLE_CHANGE' && (
          <div>
            <span class="ve-mut-before">{m.before}</span> → <span class="ve-mut-after">{m.after}</span>
            {m.tailwindSuggestion && <span class="ve-mut-tw">({m.tailwindSuggestion})</span>}
          </div>
        )}

        {m.type === 'CLASS_CHANGE' && (
          <div>
            {m.details?.added && m.details.added.length > 0 && (
              <div class="ve-mut-added">+ {m.details.added.join(', ')}</div>
            )}
            {m.details?.removed && m.details.removed.length > 0 && (
              <div class="ve-mut-removed">- {m.details.removed.join(', ')}</div>
            )}
          </div>
        )}

        {m.type === 'DOM_INSERT' && <span class="ve-mut-added">+ Inserted element</span>}
        {m.type === 'DOM_REMOVE' && <span class="ve-mut-removed">- Deleted element</span>}
        {m.type === 'DOM_REORDER' && <span class="ve-mut-reordered">⇄ Reordered position</span>}
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
  const cardVariantClass = isVoice ? 've-card--voice' : isScreenshot ? 've-card--screenshot' : '';

  return (
    <div class={`ve-mutation-card ${cardVariantClass}`}>
      <div class="ve-card-top ve-card-top--center">
        <span class="ve-mut-target ve-card-target-wrap">
          {isVoice ? (
            <span class="ve-card-type-label ve-card-type-label--voice">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              </svg>
              Voice Walkthrough{' '}
              {ann.targets && ann.targets.length > 0 ? `(${ann.targets.length} target${ann.targets.length > 1 ? 's' : ''})` : ''}
            </span>
          ) : isScreenshot ? (
            <span class="ve-card-type-label ve-card-type-label--screenshot">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
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
        <div class="ve-card-actions">
          {!isEditing && (
            <button
              type="button"
              class="ve-card-icon-btn"
              onClick={onStartEdit}
              aria-label={`Edit comment ${idx + 1}`}
              title="Edit comment"
            >
              <IconPencil />
            </button>
          )}
          <button
            type="button"
            class="ve-card-icon-btn"
            onClick={onDelete}
            aria-label={`Delete comment ${idx + 1}`}
            title="Delete comment"
          >
            <IconTrash />
          </button>
        </div>
      </div>

      {ann.targets && ann.targets.length > 0 && (
        <div class="ve-target-chips">
          {ann.targets.map((t, tIdx) => {
            const label = t.sourceLocation?.componentName
              ? `<${t.sourceLocation.componentName}>`
              : t.targetSelector || `Target ${tIdx + 1}`;
            return (
              <span key={tIdx} class={`ve-target-chip ${isVoice ? 've-target-chip--voice' : ''}`}>
                {isVoice ? `Target ${tIdx + 1}: ${label}` : `${String.fromCharCode(65 + tIdx)}: ${label}`}
              </span>
            );
          })}
        </div>
      )}

      {ann.selectedText && <div class="ve-card-quote">"{ann.selectedText}"</div>}

      {isEditing ? (
        <div class="ve-card-edit-box">
          <textarea
            class="ve-card-edit-textarea"
            aria-label="Edit comment text"
            value={editingText}
            onInput={(e) => onChangeEditingText((e.target as HTMLTextAreaElement).value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                onSaveEdit();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                onCancelEdit();
              }
            }}
            autoFocus
          />
          <div class="ve-card-edit-actions">
            <button type="button" class="ve-card-link" onClick={onCancelEdit} aria-label="Cancel comment edit">
              Cancel
            </button>
            <button type="button" class="ve-card-save-btn" onClick={onSaveEdit} aria-label="Save comment edit">
              Save
            </button>
          </div>
        </div>
      ) : (
        <div class="ve-mut-stack">
          {ann.voiceSections && ann.voiceSections.length > 1 ? (
            ann.voiceSections.map((sec) => (
              <div key={sec.id} class="ve-voice-section">
                <div class="ve-voice-section-title">
                  Section #{sec.order} ({sec.targets.map((t) => t.targetSelector).join(', ') || 'General'})
                </div>
                <div class="ve-card-comment-text">{sec.transcript || '(Pinned without speech)'}</div>
              </div>
            ))
          ) : (
            <p class="ve-card-comment-text" onClick={onStartEdit} title="Click to edit">
              {ann.comment}
            </p>
          )}
        </div>
      )}

      {ann.screenshot && (
        <div class="ve-card-screenshot-wrap">
          <button
            type="button"
            class="ve-card-screenshot-btn"
            onClick={() => {
              window.open(ann.screenshot, '_blank');
            }}
            aria-label="Open full screenshot in new tab"
            title="Click to view full screenshot"
          >
            <img
              src={ann.screenshot}
              alt="Visual capture"
              class="ve-card-screenshot-img"
            />
          </button>
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
  const proposalTarget = set.label || set.targetSelector;
  return (
    <div class="ve-mutation-card ve-card--proposal">
      <div class="ve-card-top ve-card-top--center">
        <span class="ve-mut-target">{proposalTarget}</span>
        <button
          type="button"
          class="ve-card-icon-btn"
          onClick={() => onDismiss(set.id)}
          aria-label={`Dismiss proposal for ${proposalTarget}`}
          title="Dismiss proposal"
        >
          <IconClose />
        </button>
      </div>

      <div class="ve-proposal-meta">
        <span>{set.variants.length} options proposed</span>
        <button
          type="button"
          class="ve-card-pill-btn ve-card-pill-btn--accent"
          onClick={() => scrollToSelector(set.targetSelector)}
          aria-label={`Preview options on page for ${proposalTarget}`}
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
    <div class="ve-mutation-card ve-card--decision">
      <div class="ve-card-top ve-card-top--center">
        <div class="ve-mut-target ve-card-target-ellipsis">{vd.targetSelector}</div>
        <div class="ve-card-actions">
          <button
            type="button"
            class="ve-card-icon-btn"
            onClick={() => {
              onChangeOption(vd.setId);
              scrollToSelector(vd.targetSelector);
            }}
            aria-label={`Change variant option for ${vd.targetSelector}`}
            title="Change variant option"
          >
            <IconPencil />
          </button>
          <button
            type="button"
            class="ve-card-icon-btn"
            onClick={() => onDelete(vd.setId)}
            aria-label={`Delete variant selection for ${vd.targetSelector}`}
            title="Delete selection and restore original styles"
          >
            <IconTrash />
          </button>
        </div>
      </div>
      <div class="ve-decision-name">Selected: {vd.variantName}</div>
    </div>
  );
}
