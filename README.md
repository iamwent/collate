# Collate

English | [简体中文](README.zh-CN.md)

A local PDF page editor built with [MyGo](https://github.com/egoist/mygo), available as a desktop app or a browser app on [GitHub Pages](https://iamwent.github.io/collate/).

> **Collate does not collect any user data. All PDF processing happens locally on your device.**

No accounts, file uploads, analytics, or telemetry. Your PDF contents, filenames, and editing history are never sent to a server. The browser version downloads the application’s static resources to run locally; editing and exporting stay on your device.

## Features

- **Merge** multiple PDFs into one document.
- **Split** a PDF by page ranges or into individual pages.
- **Delete** selected pages.
- **Rotate** selected pages in 90° increments.
- **Reorder** pages by dragging, moving, or entering a page sequence.
- **Replace** selected pages with pages from another PDF.

Preview page thumbnails, select pages in batches, and undo or redo changes. PDF files are processed locally on your device.

## Screenshot

![Collate macOS app home screen](docs/images/screenshot.jpg)

## Permissions and first-launch limitations

- **Browser:** open the web app in a modern desktop browser and choose local PDFs. Editing stays in browser memory; exports are downloaded to your device. No files are uploaded, and the workspace is cleared when you close or reload the page.
- **Desktop requirements:** macOS 15+ or Windows x64. No Go, Bun, or Node.js installation is needed. The default Windows installer includes a small WebView2 bootstrapper and automatically downloads the runtime only if it is missing or too old; that step requires internet access.
- **Windows portable:** extract the ZIP into a writable folder and run `collate.exe`. Requires an existing WebView2 140+ runtime; when no runtime is detected, a dialog provides the official Microsoft download link. Application settings, WebView2 caches and temporary files use the adjacent `Data` folder; keep it when moving or updating. See [portable usage and limits](docs/windows-portable.md).
- **GitHub Actions:** builds require no additional signing secrets in the current configuration. Only the Release publishing job uses the built-in `GITHUB_TOKEN` with `contents: write`; the Pages deployment job uses `pages: write` and `id-token: write`; build jobs have read-only repository access. Your repository or organization must allow these Actions permissions.
- **macOS:** the app currently uses ad-hoc signing and is not notarized by Apple. Gatekeeper may block it when first opened after downloading.
- **Windows:** the app and installer currently have no publisher code signature. Windows may show an unknown-publisher or SmartScreen warning.

A warning-free first launch cannot be guaranteed until Developer ID signing and notarization for macOS, and publisher code signing for Windows, are configured and verified.

## License

Licensed under the [MIT License](LICENSE).
