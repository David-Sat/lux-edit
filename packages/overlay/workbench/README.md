# LUX Overlay — UX State Workbench

A lightweight, zero-dependency Vite development workbench for inspecting and polishing every UI state of [`@visual-edit/overlay`](../package.json) inside its real `<visual-edit-overlay>` Shadow DOM over switchable host page backdrops.

## Why a custom Vite workbench?

Off-the-shelf component explorers (Storybook, Ladle, Histoire) are awkward fits for `packages/overlay` because:
1. **Shadow DOM & `:host` isolation**: Components render inside `<visual-edit-overlay>`'s `ShadowRoot` with `:host { all: initial; ... }` and fixed viewport positioning.
2. **Live host-page anchoring**: `SelectionBox`, `FloatingToolbar`, `CommentComposer`, `CommentPins`, `VoicePins`, `VariantSwitcher`, and `VerificationHalo` query and anchor to real DOM nodes outside the Shadow DOM (`@floating-ui/dom`, `getBoundingClientRect()`, `document.querySelector()`).
3. **Liquid Glass contrast testing**: `OVERLAY_STYLES` uses translucent frosted surfaces (`--ve-glass-bg`, `--ve-glass-backdrop`) that must be checked against light, dark, and colorful host pages.

Using Vite 6 + Preact 10 directly gives instant HMR with zero extra dependencies and zero impact on the production `dist/overlay.js` library bundle.

## Quickstart

From the repository root:

```bash
pnpm workbench
```

Or directly inside `packages/overlay`:

```bash
pnpm --filter @visual-edit/overlay run workbench
```

By default Vite serves at `http://localhost:4173/`.

## Controls & Shortcuts

| Control / Key | Action |
| --- | --- |
| **Backdrop** (`Light` / `Dark` / `Gradient`) | Switch the host page theme behind the Shadow DOM overlay |
| **Dock** (`Side` / `Anchor`) | Toggle dock corner (`left`/`right`, `top`/`bottom`) |
| `[` / `]` | Step to the previous / next preset |
| `Cmd/Ctrl + \` | Hide or show the workbench sidebar for unobstructed visual review |
| `↻` | Re-mount the mock host DOM and re-apply the current preset |

### URL Query Parameters

The workbench syncs the active view to the URL so specific states can be bookmarked or opened directly:

```text
http://localhost:4173/?preset=drawer-rich-draft&backdrop=light&chrome=0
```

- `preset`: Preset ID from [`presets.ts`](./presets.ts)
- `backdrop`: `light` | `dark` | `gradient`
- `chrome`: `1` (sidebar visible) | `0` (sidebar collapsed)

## Architecture

- [`setup.ts`](./setup.ts): Imported first by [`workbench.tsx`](./workbench.tsx) to call `OverlayStateManager.setWorkbenchMode(true)` before `src/index.ts` registers and mounts `<visual-edit-overlay>`.
- **Offline isolation**: In workbench mode, [`OverlayStateManager`](../src/inspector/state.ts) skips `localStorage`/`sessionStorage`, WebSocket connections, and `/__visual_edit__/api/edits` fetches while keeping local state interactions active. [`VoiceRecorder.setWorkbenchState()`](../src/inspector/voice-recorder.ts) allows previewing live recording states without microphone access.
- [`mock-host.tsx`](./mock-host.tsx): Renders deterministic host target elements (`#wb-hero-eyebrow`, `#wb-hero-title`, `#wb-hero-copy`, `#wb-primary-cta`, `#wb-pricing-card`, `#wb-edge-top-right`, `#wb-feature-1..3`).
- [`presets.ts`](./presets.ts): Defines grouped presets across **Dock & Voice**, **Toolbar & Selection**, **Comments & Pins**, **Variants & Verification**, and **Review Drawer**.

## Adding a New Preset

1. Add or reuse a deterministic target element in [`mock-host.tsx`](./mock-host.tsx) if needed.
2. Add a `WorkbenchPreset` entry in [`presets.ts`](./presets.ts):
   ```ts
   {
     id: 'my-new-state',
     group: 'Toolbar & Selection',
     title: 'My New State',
     description: 'What this state verifies.',
     apply: (state, doc) => {
       state.resetForWorkbench();
       // Seed OverlayStateManager (and VoiceRecorder if needed)
       state.notify();
     },
   }
   ```
3. Run `pnpm --filter @visual-edit/overlay run typecheck:workbench` to verify types.
