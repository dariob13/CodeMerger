# macOS desktop app

The Tauri 2 app bundles the Next.js standalone server and the build machine's Node.js runtime. The server listens on a private loopback port selected at launch. Closing the app stops its server. A second launch focuses the existing window.

## Build a DMG

Install Xcode Command Line Tools and the stable Rust toolchain, then run:

```sh
npm install --include=dev
npm run desktop:build
```

The installer is copied to `dist/Code-Merger-0.1.0-arm64.dmg` on Apple Silicon, or the corresponding `x64.dmg` on Intel. The app bundle is also available in `src-tauri/target/release/bundle/macos/Code Merger.app`.

Builds target the current machine's architecture; the bundled Node runtime must match. This build requires macOS 13.5 or later, matching its bundled Node.js runtime. Node.js and npm are not needed on the user's machine. Supported agent CLIs still need to be installed and signed in.

The installer includes an Applications shortcut: open the DMG and drag Code Merger into Applications.

To check the packaged app's startup, bundled styles, API origin protection, agent discovery, single-instance behavior, saved data, relaunch, and server shutdown with temporary data:

```sh
node desktop/smoke-test.mjs
```

## Local data

Chats, uploads, notes, and settings are stored in `~/Library/Application Support/com.codemerger.desktop/data`. This is separate from the web app's repository-local `data/` folder. No existing chats, uploads, credentials, or project files are included in the installer. Set `CODE_MERGER_DATA` before launching the executable to use another directory.

Server logs are written to `~/Library/Logs/com.codemerger.desktop/next-server.log`. Projects remain in their original folders. Agent detection also searches common Homebrew and user-local CLI directories.

## Signing

The default configuration uses ad hoc signing for a local installer. It is not notarized by Apple. For public distribution, configure a Developer ID signing identity and notarization credentials using the [Tauri macOS signing guide](https://v2.tauri.app/distribute/sign/macos/), then rebuild.

The app exposes no Tauri commands to the web content. Navigation is restricted to its own local server, external web links open in the default browser, and the existing API origin checks remain enabled.
