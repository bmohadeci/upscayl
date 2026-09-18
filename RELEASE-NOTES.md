Installable Windows and macOS builds of the internal Upscayl fork, preserving the
August changes: telemetry and cloud signup removed, automatic updater disabled,
renderer context isolation and web security enabled, and Node integration disabled.

- **Windows Intel/AMD 64-bit:** download the `win-x64.exe` installer.
- **Mac Apple Silicon:** download the `mac-arm64.dmg` disk image.
- **Mac Intel:** download the `mac-x64.dmg` disk image.

The new packaging includes the native engine, all bundled models, unpacked
ExifTool resources and license notices. The Windows engine uses an explicit
`.exe` path. Both Mac builds require macOS 12 or later.

All three packaged apps pass native-host startup, preload IPC, local image
preview, bundled engine, model and ExifTool checks. Windows additionally passes
silent installation and the same checks against the installed application.
Both Mac disk images pass verification. The Apple Silicon build has also
completed a real 128x128 to 512x512 upscale and metadata copy on an Apple M3 Pro.

**Windows GPU upscaling still needs a representative team PC test.** Hosted CI
tests the engine loader with the official Vulkan runtime installed; it has no
physical Vulkan GPU. A compatible GPU and current vendor graphics drivers are
required. Windows ARM is not a tested target. Batch and double-upscale workflows
have not been exercised in this release validation.

**Signing:** Windows is unsigned. Mac is ad-hoc signed, without Developer ID
signing or notarization. OS approval prompts may appear; see `INSTALLATION.md`.
This release retains the existing dependency versions and is not a full
dependency-security audit or update.

The exact source commit and build run are recorded in `BUILD-INFO.txt`. Matching
source and SHA-256 checksums are attached. The project license remains AGPL-3.0;
individual model restrictions remain visible in the application.
