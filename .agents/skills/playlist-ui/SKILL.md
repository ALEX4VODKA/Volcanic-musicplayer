# playlist-ui

Use this skill for playlist state, playlist controls, and Renderer playlist presentation.

## Scope

- Renderer UI: ordering, current-track highlight, remove, clear, playback controls, progress, and volume.
- Main persistence: save and load `playlist.json`.
- IPC contract: Renderer requests, Main performs filesystem work.

## Rules

- Renderer must not import `fs`, `child_process`, or `cluster`.
- Renderer must not write `playlist.json` directly.
- Keep playlist item data serializable and stable across app restarts.
- Manual order is authoritative unless the user explicitly sorts or clears it.

## Required Checks

- Verify empty playlist state and missing playlist file behavior.
- Verify reorder boundaries for first and last items.
- Run `npm.cmd run typecheck`.
