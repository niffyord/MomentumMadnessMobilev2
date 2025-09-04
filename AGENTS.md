# Repository Guidelines

This document guides contributors working on the Expo/React Native app in this repository.

## Project Structure & Module Organization
- `app/`: Expo Router screens and layouts (e.g., `_layout.tsx`, `(tabs)/`, `sign-in.tsx`).
- `components/`: Reusable UI and feature components (PascalCase files; domains like `demo/`, `solana/`, `settings/`).
- `services/`: API, WebSocket, and on-chain clients/config (`apiService.ts`, `websocketService.ts`).
- `store/`: Client state and persistence (e.g., `useRaceStore.ts`, MMKV helpers).
- `assets/`: `fonts/`, `images/`, `sounds/`.
- `constants/`, `utils/`, `hooks/`: App constants, helpers, and React hooks.
- Native/config: `android/`, `app.json`, `eas.json`, `expo-env.d.ts`.

## Build, Test, and Development Commands
- `npm install`: Install dependencies.
- `npm run dev` or `npm start`: Start Expo dev server (Metro, QR for devices/simulators).
- `npm run android` / `npm run ios`: Build and run on Android/iOS (requires local toolchains).
- `npm run web`: Run the app in a web browser.
- `npm run build`: Type-check (`tsc --noEmit`) and prebuild Android.
- `npm run ci`: Type-check, lint check, format check, and Android prebuild.
- `npm run lint` / `npm run lint:check`: Lint with or without auto-fixes.
- `npm run fmt` / `npm run fmt:check`: Prettier format / verify formatting.

## Coding Style & Naming Conventions
- TypeScript: strict mode with alias `@/*`.
- Prettier: single quotes, no semicolons, trailing commas, width 120.
- ESLint: `eslint-config-expo` base rules.
- Files: Components `PascalCase.tsx` (e.g., `NeonButton.tsx`); hooks `use-*.ts`; route files kebab-case (e.g., `sign-in.tsx`); utilities lower-case hyphen (e.g., `ellipsify.ts`).

## Testing Guidelines
- No test runner configured yet.
- If adding tests, prefer Jest + `@testing-library/react-native`. Name tests `*.test.ts(x)` co-located or in `__tests__/`. Keep tests fast and deterministic.

## Commit & Pull Request Guidelines
- History shows short, imperative subjects; occasional `fix:`; PR merge commits reference numbers.
- Prefer Conventional Commits when practical (`feat:`, `fix:`, `chore:`). Limit subject to ~72 chars.
- PRs: clear description, linked issues (`Closes #123`), steps to test, screenshots/GIFs for UI changes, and passing `npm run ci`. Update README/docs when behavior changes.

## Security & Configuration Tips
- Put secrets in `.env` (do not commit). Build settings live in `eas.json` and `app.json`.
- Use EAS credentials for signing; do not attach keystores or private keys to PRs/issues.

