import { OverlayStateManager } from '../src/inspector/state.js';

// Must run before ../src/index.js registers and mounts <visual-edit-overlay>
OverlayStateManager.setWorkbenchMode(true);
