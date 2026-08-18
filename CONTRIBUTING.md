# Contributing to LUX

Thank you for your interest in contributing to LUX (Live User eXperience)! We welcome contributions from the community.

## Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/David-Sat/lux-edit.git
   cd lux-edit
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Build all packages:**
   ```bash
   pnpm build
   ```

4. **Run tests:**
   ```bash
   pnpm test
   ```

5. **Start the test fixture:**
   ```bash
   pnpm --filter react-tailwind-app dev
   ```

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/) for automated release management via Release Please:

- `feat: ...` for new features (triggers MINOR version bump)
- `fix: ...` for bug fixes (triggers PATCH version bump)
- `docs: ...` for documentation changes
- `chore: ...` for maintenance or refactors

## Submitting a Pull Request

1. Fork the repo and create your branch from `master`.
2. Ensure `pnpm build` and `pnpm test` pass.
3. Submit a Pull Request describing your changes.
