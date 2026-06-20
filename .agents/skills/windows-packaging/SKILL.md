# windows-packaging

Use this skill for Windows runtime, Electron packaging, npm script, and release-build issues.

## Windows Rules

- Prefer `npm.cmd` and `npx.cmd` in PowerShell when script execution policy blocks `npm.ps1` or `npx.ps1`.
- Validate Electron availability with `npx.cmd electron --version`.
- Treat Electron cache, builder cache, and mirror configuration as environment-sensitive.
- Do not weaken security settings to make packaging easier.

## Required Checks

- Run `npm.cmd run typecheck` before packaging.
- Run `npm.cmd run build` before `npm.cmd run pack` or `npm.cmd run dist`.
- Document any packaging-time binary dependency and its source.
