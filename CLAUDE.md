# The Membrane Operator Console

A statically hosted demo dashboard for our AES Energy Innovation Challenge final round. Stack: Vite + React + TypeScript.

## Design

- Before any UI work, read `.claude/skills/frontend-design/SKILL.md`.
- When choosing palette and type, also read `.claude/skills/theme-factory/SKILL.md`.

## Visual check loop

After every meaningful UI change:

1. Run the dev server.
2. Use Playwright (the `playwright` MCP server, or the `webapp-testing` skill with `.venv/`) to screenshot the app at **1920×1080** and **1280×720**.
3. Look at the screenshots and fix what looks off before moving on.

## Data

All non-public data in the app is simulated and must be labeled that way in the UI.
