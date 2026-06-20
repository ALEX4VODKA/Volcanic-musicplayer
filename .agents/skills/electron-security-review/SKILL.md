# electron-security-review

Use this skill before merging changes that touch Electron process boundaries, IPC, conversion, playlist persistence, or packaging.

## Review Checklist

- Renderer contains no direct `fs`, `child_process`, or `cluster` import.
- Renderer has no direct FFmpeg or private container parsing code.
- Preload uses `contextBridge` and exposes only a small whitelist of typed methods.
- Main owns filesystem access, FFmpeg control, native dialogs, and private parser execution.
- FFmpeg invocations use `spawn` argument arrays and never shell-concatenated commands.
- Private format parsing is offline and local.

## Evidence Required

- Include changed file paths.
- Include `npm.cmd run typecheck` or `npm.cmd run build` result.
- Report findings first, ordered by severity.
