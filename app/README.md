# AdvancedLearning app

This folder holds the React client and the Express API for the AdvancedLearning JEE preparation tutor. The project overview, the pain points, the architecture and the roadmap are in the [root README](../README.md).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite UI only. Uses the offline tutor and the original sample question bank. |
| `npm run dev:full` | API on `:8787` and Vite on `:5173`. Uses the LLM when the server has a key in `../.env` or `.env`. |
| `npm run server` | API only (`tsx server/index.ts`). |
| `npm test` | Vitest over `server/**/*.spec.ts` and `src/**/*.spec.ts`. |
| `npm run build` | Type-check (`tsc -b`) and production build. |
| `npm run sync:graph -- <snapshot>` | Writes the git-ignored `public/data/graph.json` from a local graph snapshot. |

## Environment

See `.env.example`. Provider keys (`OPENROUTER_API_KEY`, or `GROK_API_KEY` / `XAI_API_KEY`) are read only on the server. `VITE_TUTOR_PROVIDER=mock` forces the offline tutor. `VITE_GRAPH=sample` and `AL_GRAPH_PATH=sample` force the sample graph even when a local `graph.json` exists.

Runtime SQLite stores are written to `data/` (git-ignored). Override the locations with `TUTOR_SQLITE_PATH` and `PILOT_DATA_DIR`.

## Keyboard

- `Enter`: new typed step
- `Cmd/Ctrl + Enter`: diagnose the typed work
- Warm-up: `Space` flips a card; `1` / `2` / `3` grade it hard / good / easy
