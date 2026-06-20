# audio-converter-core

Use this skill for conversion queue work, FFmpeg orchestration, and local private media container unpacking.

## Scope

- Supported standard formats: `mp3`, `wav`, `flac`, `m4a`, `aac`, `ogg`.
- Private container formats: `.ncm`, `.kgm`, `.qmc`.
- Main-process modules live under `src/main/converters/`.

## Safety Rules

- Do not run conversion commands through shell string concatenation.
- Use `child_process.spawn` with a command plus an explicit argument array.
- Keep all `.ncm`, `.kgm`, and `.qmc` byte-stream calculations local and deterministic.
- Do not download untrusted parser binaries or move parsing work into Renderer.

## Required Outputs

- Typed task model with status: waiting, converting, success, failed, unsupported.
- Progress reporting as serializable IPC payloads.
- Failure reasons suitable for UI display without leaking stack traces by default.
- `npm.cmd run typecheck` after implementation.
