# Volcanic Android APK

This folder is an isolated Android implementation for Volcanic. It does not change the Electron desktop app under the repository root.

## MVP scope

- Import local audio through Android document picker.
- Scan local media library when the user grants audio read permission.
- Persist the playlist to app-private storage.
- Play, pause, previous, next, remove, and clear tracks.
- Keep UI dark, compact, and readable.

## Build

Requirements:

- JDK 17
- Android SDK with platform 35 and build-tools installed
- Gradle 8.x available on PATH, or a Gradle wrapper added inside this folder

Commands:

```powershell
cd F:\Codex-projects\Volcanic-musicplayer\android-apk
.\scripts\build-apk.ps1
```

Output:

```text
android-apk\app\build\outputs\apk\debug\app-debug.apk
```

If Android SDK is not configured globally, copy `local.properties.example` to `local.properties` and set `sdk.dir`.
