# electron-app-planner

Use this skill when planning or changing the Electron application architecture for Volcanic-musicplayer.

## Operating Rules

- Read `PROJECT_REQUIREMENTS.md` and `AGENTS.md` before proposing architecture changes.
- Keep Electron boundaries explicit:
  - Renderer is declarative React UI only.
  - Main owns filesystem, native dialogs, FFmpeg process control, private container parsing, and playlist persistence.
  - Preload exposes only minimal typed IPC methods through `contextBridge`.
- Add or change IPC channels as typed contracts before wiring UI behavior.
- Prefer small, independently typechecked milestones.

## Required Checks

- Confirm no Renderer import of `fs`, `child_process`, or `cluster`.
- Confirm private format handling stays in Main-owned modules.
- Run `npm.cmd run typecheck` after logic, IPC, or state-flow changes.
