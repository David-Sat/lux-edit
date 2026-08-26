# Changelog

## [0.5.0](https://github.com/David-Sat/lux-edit/compare/lux-edit-v0.4.1...lux-edit-v0.5.0) (2026-08-26)


### Features

* add multi-agent init support, inline text editing, and text selection comments ([87c738f](https://github.com/David-Sat/lux-edit/commit/87c738fb89cf22f13ea006be9306728038bfd764))
* add packages/cli/README.md for npm, prepack sync, and multi-instance port fallback ([019869a](https://github.com/David-Sat/lux-edit/commit/019869aaef1cb3e62ea45a99a8c1492135afc7c6))
* **cli:** add lux uninstall command and auto-clean legacy configs on update ([0df68e8](https://github.com/David-Sat/lux-edit/commit/0df68e8e092937706982419a13a01eaf2714efea))


### Bug Fixes

* inject overlay script in static directory target mode ([3fe59c5](https://github.com/David-Sat/lux-edit/commit/3fe59c5bb547668a93dc4f826273e7a198abcc2f))

## [0.4.1](https://github.com/David-Sat/lux-edit/compare/lux-edit-v0.4.0...lux-edit-v0.4.1) (2026-08-24)


### Bug Fixes

* add --base-path reverse proxy support, proxy mode file watching, and dynamic CLI version ([0fc6a85](https://github.com/David-Sat/lux-edit/commit/0fc6a8558d6a3b2b43fd2a297a34528ba9a62cb4))

## [0.4.0](https://github.com/David-Sat/lux-edit/compare/lux-edit-v0.3.0...lux-edit-v0.4.0) (2026-08-24)


### Features

* unify agent skill under single /lux command and update init generator ([a1a26d1](https://github.com/David-Sat/lux-edit/commit/a1a26d1888e3509c78d28367b45cc118bd36d5db))

## [0.3.0](https://github.com/David-Sat/lux-edit/compare/lux-edit-v0.2.0...lux-edit-v0.3.0) (2026-08-23)


### Features

* **cli:** add -g / --global flag to init command for machine-wide agent configuration ([fef294a](https://github.com/David-Sat/lux-edit/commit/fef294a383a18403fbb66051248b8ca0ab41cbb4))
* streamline MCP review flow and refine overlay interactions ([8038757](https://github.com/David-Sat/lux-edit/commit/8038757a7c1f614bee8940312e9c9ab5a0d5da76))

## [0.2.0](https://github.com/David-Sat/lux-edit/compare/lux-edit-v0.1.0...lux-edit-v0.2.0) (2026-08-18)


### Features

* add lux_wait_for_review blocking MCP tool and Send to Agent trigger ([a5fd095](https://github.com/David-Sat/lux-edit/commit/a5fd0954211d1dc886a2f5280f0389d258999cda))
* compact icon-only pill dock, keyboard shortcuts (V, C, R, Esc), and emoji-free vector UI ([2327251](https://github.com/David-Sat/lux-edit/commit/232725190091dea01046ace7764aa3b294dd0ec8))
* initial release of Live Visual Edit Overlay (MCP) ([8e1f538](https://github.com/David-Sat/lux-edit/commit/8e1f538c329d4ef5a51288ee8bf21a1614536378))
* **inspector:** smart context-aware start options ribbon by element type and dynamic app color palette swatches ([27bb951](https://github.com/David-Sat/lux-edit/commit/27bb95140da93700e5bbe0adcc0af15aaffd74f9))
* **modes:** default to passive chat mode with copy prompt, hide agent trigger unless requested ([0719259](https://github.com/David-Sat/lux-edit/commit/0719259cfc7aa940c74fecf6c7947db2e92c0134))
* **pins:** add instant resolve button to pin tooltip and clean up implemented session states ([7634402](https://github.com/David-Sat/lux-edit/commit/76344024f409a99ef158feb435742c99e0e68d49))
* **standard:** add Agent Plugins 1.0.0 manifest, standardized mcp.json, portable skills, and lux init wizard ([f5b8db5](https://github.com/David-Sat/lux-edit/commit/f5b8db55ce113b7b064ad2b8c224441b93c39b3f))
* toggle deselect to restore snapshot origin, sliders with origin ticks & dblclick reset, clean icon actions, and global app theme tokens panel ([f1110ed](https://github.com/David-Sat/lux-edit/commit/f1110ed32ee97ab01b34cd8cc16107be95def14b))
* **ui:** enlarge dock icons to 20px (matching launcher) and ensure Escape closes drawer/composer anywhere ([8482d6d](https://github.com/David-Sat/lux-edit/commit/8482d6dc510526c681c56649e763ede773fc4dab))
* **ui:** update visual edit icon to clear pen/edit vector icon and set launcher icon to layers ([c156173](https://github.com/David-Sat/lux-edit/commit/c15617333d4f1fc0d0e87f5fb03ca3179873a472))
* **ux:** stepped escape key behavior and position review panel floating directly above pill dock ([809d450](https://github.com/David-Sat/lux-edit/commit/809d450f7f1f2829c74f44efacfcfcba910ebd23))


### Bug Fixes

* **ci:** sync pnpm-lock.yaml and fix Release Please root package config ([4539465](https://github.com/David-Sat/lux-edit/commit/4539465e3491f1dd8436c496f5ad605a83b1934a))
* cross-process disk synchronization for waitForSubmission and add connector arrows ([1a30910](https://github.com/David-Sat/lux-edit/commit/1a30910684f3f1aa6e1c19dd6cafdfb632262df1))
* instant active button shape state in overlay UI and live real-time theme reset in revertMutation and revertAll ([21f9645](https://github.com/David-Sat/lux-edit/commit/21f96451e2e234b7da3b58f6eb5870f060d9c3a7))
* **overlay:** sync session status on websocket connect to immediately clear resolved comment pins ([05e7472](https://github.com/David-Sat/lux-edit/commit/05e7472a3ff8a87e292edecdaf2adb7795cd1d0c))
* **sync:** reset session on implemented status and refine waitForSubmission timestamp filter ([10a13ce](https://github.com/David-Sat/lux-edit/commit/10a13ced57abf1a9954309d9d18c469e68ae56bd))
* **ui:** center deselect cross icon, fix revert mutation state restoration, and add multi-page URL tracking ([8f5ce55](https://github.com/David-Sat/lux-edit/commit/8f5ce55661bb7770935a5591d82ba259e8b4a527))
* **ui:** fix input overflow on floating toolbar spacing grid and ensure proper box-sizing and min-width ([64d3cfa](https://github.com/David-Sat/lux-edit/commit/64d3cfa5e46ac1d338acbfd0b44f3bc035652742))
