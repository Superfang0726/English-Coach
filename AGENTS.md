# AGENTS.md

Guidance for coding agents working in this repository.

## Project Overview

This is a TOEIC vocabulary training coach built as a small React + Vite frontend with an Express server. The app reads and writes vocabulary data from `vocab.xlsx`, stores chat/session settings in browser `localStorage`, and calls Google Gemini through `@google/genai` to generate TOEIC-style questions and evaluate answers.

## Tech Stack

- Runtime: Node.js 18+
- Frontend: React 19, Vite 6, Tailwind CSS 4, lucide-react, react-markdown
- Backend: Express 4, Vite middleware in development
- AI: Google Gemini via `@google/genai`
- Data: `xlsx` package reading/writing root-level `vocab.xlsx`
- Language: TypeScript with `noEmit`

## Repository Map

- `server.ts`: Express server, `/api/vocab` read/write endpoints, Excel download endpoint, and Vite middleware setup.
- `src/App.tsx`: Main application state, vocabulary lifecycle, chat round management, API key/model settings, Gemini orchestration.
- `src/components/Chat.tsx`: Chat transcript, answer input, next-round control, markdown rendering.
- `src/components/VocabTable.tsx`: Vocabulary add/delete UI, duplicate check, sorting, cooldown display.
- `src/lib/gemini.ts`: Gemini prompt construction, question generation, answer evaluation, timeout/error handling.
- `src/main.tsx`: React root bootstrap.
- `src/index.css`: Tailwind import, typography plugin, font/theme setup.
- `vite.config.ts`: Vite React/Tailwind config and `GEMINI_API_KEY` env injection.
- `test-gemini.ts`: Manual Gemini evaluation script.
- `metadata.json`: App metadata.

## Commands

- Install dependencies: `npm install`
- Run dev server: `npm run dev`
- Build production bundle: `npm run build`
- Type-check/lint: `npm run lint`
- Preview production build: `npm run preview`

Notes:

- `npm run dev` runs `tsx server.ts`, not plain `vite`.
- The app is served on `http://localhost:3000` by `server.ts`.
- `npm start` currently runs `node server.ts`; because `server.ts` is TypeScript, prefer `npm run dev` unless the production start path is changed or compiled output exists.
- `npm run clean` uses `rm -rf dist`, which may not work in a default Windows shell.

## Environment And Data

- Required env var: `GEMINI_API_KEY`.
- `.env*` files are ignored except `.env.example`.
- The frontend can also store the Gemini API key and model name in `localStorage`.
- `vocab.xlsx` is ignored by git and is treated as local mutable data.
- Be careful with changes to Excel column names in `server.ts`; the read/write mapping must stay compatible with existing workbook headers.

## Development Conventions

- Preserve existing React functional component style and hooks-based state management.
- Keep Gemini-related prompt/schema changes in `src/lib/gemini.ts`.
- Keep API route changes in `server.ts` and frontend fetch behavior in `src/App.tsx`.
- Use Tailwind utility classes for UI changes; avoid introducing another styling system.
- Use lucide-react icons for controls when an icon is needed.
- Keep user-facing TOEIC/training behavior aligned with the three vocabulary levels: `O`, `^`, and `X`.
- Avoid broad refactors unless they directly support the requested change.

## Known Pitfalls

- Several Traditional Chinese strings and Excel header labels currently appear mojibaked/corrupted in source files. Do not "fix" them opportunistically unless the task is specifically about encoding, copy, or Excel compatibility.
- Some current source strings may make TypeScript parsing fragile. Run `npm run lint` before claiming a code change is complete, and report pre-existing failures separately.
- The Gemini model list in settings is hardcoded in `src/App.tsx`; changing model availability may require a UI update.
- `process.env.GEMINI_API_KEY` is injected through Vite `define`; this is exposed to client code. Treat it as a local-development convenience, not a secure production secret pattern.
- `generationIdRef` in `src/App.tsx` guards against stale async Gemini responses. Preserve this behavior when changing generation/evaluation flows.
- Chat history, current round, API key, and selected model persist in browser `localStorage`; reset behavior intentionally keeps vocabulary progress.

## Verification Expectations

For code changes, run the narrowest useful checks:

- Type-check: `npm run lint`
- Build check for frontend/server integration: `npm run build`
- Manual dev smoke test when UI or API behavior changes: `npm run dev`, then open `http://localhost:3000`

If verification fails because of existing encoding or syntax issues, document the exact command and first relevant error instead of hiding the failure.

## Git Hygiene

- The worktree may contain user changes. Do not revert or overwrite unrelated modifications.
- Before editing a tracked file, check current diffs if the file already has changes.
- `vocab.xlsx`, `.env*`, `node_modules`, `dist`, logs, and coverage output should stay untracked unless the user explicitly asks otherwise.
