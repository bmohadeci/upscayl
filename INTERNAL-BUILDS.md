# Upscayl internal installers

Version `2.15.0-internal.2` preserves the August internal changes: no PostHog or
Firebase, no cloud signup or log upload, no automatic updater, and renderer
context isolation and web security enabled with Node integration disabled.

## Choose an installer

- Windows 64-bit Intel/AMD: `upscayl-internal-2.15.0-internal.2-win-x64.exe`.
  Run the installer and follow the wizard. The default is a per-user installation.
- Apple Silicon Mac: `upscayl-internal-2.15.0-internal.2-mac-arm64.dmg`.
- Intel Mac: `upscayl-internal-2.15.0-internal.2-mac-x64.dmg`.
  Open the disk image and drag Upscayl to Applications. Mac builds require macOS
  12 or later. Quit an existing Upscayl instance before replacing it.

Windows builds are unsigned. Mac builds have ad-hoc signatures, without Apple
Developer ID signing or notarization. An OS approval prompt may appear. On Mac,
after attempting to open the app, use System Settings > Privacy & Security >
Open Anyway if offered. On managed computers, ask IT if installation is blocked.
Do not disable system-wide security settings.

Upscaling requires a compatible Vulkan GPU and drivers; macOS uses Metal through
the bundled MoltenVK engine. Windows ARM is not a tested target. Automatic
updates remain disabled; distribute a new installer for subsequent updates.

## Build and verify

The `Internal Windows and Mac installers` workflow builds all three targets from
the same commit using `npm ci` and the committed lockfile. It uploads installers,
SHA-256 checksums and startup screenshots as Actions artifacts for 30 days. It
does not publish a GitHub Release or overwrite the August release.

Use Node 22 with npm. On the relevant operating system:

```sh
npm ci
npm run dist:internal:mac
# or, on Windows:
npm run dist:internal:win
```

The separate `electron-builder.internal.json` configuration bundles the engine,
models, license notices and unpacked ExifTool resources, includes architecture
in each filename, and does not require upstream signing credentials. Windows
uses an explicit `.exe` engine path.

`scripts/smoke-packaged.cjs` launches the packaged executable with a disposable
profile, then verifies version, renderer isolation, preload IPC, image preview
with spaces and special characters in the filename, native engine loading,
ExifTool execution, model presence and the inherited telemetry/updater changes.
Windows CI also installs the EXE into a temporary directory and repeats these
checks against the installed app. Mac CI verifies the DMG checksum structure.

These automated checks do not prove GPU upscaling on every colleague's machine.
Before broad rollout, use a representative Windows PC to upscale a small image,
check the output dimensions and preview, and test the batch and double-upscale
features if those are used by your team. The local Apple Silicon engine has
successfully completed a 128x128 to 512x512 upscale during this build preparation.

Keep the corresponding source and license notices with the installer handoff.
The project remains AGPL-3.0; the source repository is
https://github.com/bmohadeci/upscayl. The shared source archive should identify
the exact build commit. Individual model restrictions remain as shown in the app.
