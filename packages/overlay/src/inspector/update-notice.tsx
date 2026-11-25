import { h } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { GlassChrome } from './liquid-glass-defs.js';

export function buildUpdateAgentPrompt(latestVersion?: string): string {
  return latestVersion
    ? `Please update lux-edit to v${latestVersion} (run "lux update").`
    : 'Please update lux-edit to the latest version (run "lux update").';
}

export async function copyUpdateAgentPrompt(latestVersion?: string): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      return false;
    }
    await navigator.clipboard.writeText(buildUpdateAgentPrompt(latestVersion));
    return true;
  } catch (err) {
    console.debug('[lux] Clipboard copy failed:', err);
    return false;
  }
}

export function UpdateBadgeIcon() {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}

export function useUpdateNoticePopover(latestVersion?: string) {
  const [showPopover, setShowPopover] = useState(false);
  const [copied, setCopied] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const copiedTimerRef = useRef<number | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const openPopover = useCallback(() => {
    clearCloseTimer();
    setShowPopover(true);
  }, [clearCloseTimer]);

  const scheduleClosePopover = useCallback(() => {
    clearCloseTimer();
    if (typeof window === 'undefined') {
      setShowPopover(false);
      return;
    }
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setShowPopover(false);
    }, 150);
  }, [clearCloseTimer]);

  const closePopoverImmediately = useCallback(() => {
    clearCloseTimer();
    setShowPopover(false);
  }, [clearCloseTimer]);

  const handleCopy = useCallback(async () => {
    const ok = await copyUpdateAgentPrompt(latestVersion);
    if (!ok) return;
    setCopied(true);
    if (typeof window !== 'undefined') {
      if (copiedTimerRef.current !== null) {
        window.clearTimeout(copiedTimerRef.current);
      }
      copiedTimerRef.current = window.setTimeout(() => {
        copiedTimerRef.current = null;
        setCopied(false);
      }, 2500);
    }
  }, [latestVersion]);

  useEffect(() => {
    return () => {
      clearCloseTimer();
      if (copiedTimerRef.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(copiedTimerRef.current);
      }
    };
  }, [clearCloseTimer]);

  return {
    showPopover,
    copied,
    openPopover,
    scheduleClosePopover,
    closePopoverImmediately,
    handleCopy,
  };
}

export interface UpdateNoticePopoverProps {
  currentVersion?: string;
  latestVersion: string;
  changelogUrl?: string;
  placement: 'above' | 'below';
  align: 'start' | 'end';
  copied: boolean;
  onCopy: () => void;
  onDismiss?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onChildFocus?: () => void;
  onChildBlur?: () => void;
}

export function UpdateNoticePopover({
  currentVersion,
  latestVersion,
  changelogUrl,
  placement,
  align,
  copied,
  onCopy,
  onDismiss,
  onMouseEnter,
  onMouseLeave,
  onChildFocus,
  onChildBlur,
}: UpdateNoticePopoverProps) {
  const showVersionDiff = Boolean(currentVersion && currentVersion !== latestVersion);
  const hasSafeChangelogUrl = Boolean(changelogUrl && /^https?:\/\//i.test(changelogUrl));

  return (
    <div
      role="region"
      aria-label={`LUX v${latestVersion} update available`}
      class={`ve-update-popover ve-update-popover--${placement} ve-update-popover--align-${align}`}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <GlassChrome />
      <div class="ve-update-popover-header">
        <div class="ve-update-popover-title-wrap">
          <span class="ve-update-popover-title">LUX v{latestVersion} available</span>
          {showVersionDiff && (
            <span class="ve-update-version-chip">
              v{currentVersion} → v{latestVersion}
            </span>
          )}
        </div>

        {onDismiss && (
          <button
            type="button"
            class="ve-card-icon-btn ve-update-dismiss-btn"
            aria-label={`Dismiss v${latestVersion} update notice`}
            title="Dismiss for this version"
            onClick={onDismiss}
            onFocus={onChildFocus}
            onBlur={onChildBlur}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      <p class="ve-update-popover-body">
        Tell your coding agent to update LUX, or run <code>lux update</code>.
      </p>

      <div class="ve-update-popover-actions">
        <button
          type="button"
          class="ve-update-copy-btn"
          onClick={onCopy}
          onFocus={onChildFocus}
          onBlur={onChildBlur}
        >
          {copied ? (
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.1"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
          <span>{copied ? 'Copied!' : 'Copy Agent Prompt'}</span>
        </button>

        {hasSafeChangelogUrl && (
          <a
            class="ve-update-changelog-link"
            href={changelogUrl}
            target="_blank"
            rel="noopener noreferrer"
            onFocus={onChildFocus}
            onBlur={onChildBlur}
          >
            Notes ↗
          </a>
        )}
      </div>
    </div>
  );
}
