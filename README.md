# ScreenMu

A Screen Studio-style screen recorder and editor for the web, built with a Rust/WASM core engine for auto-reframing, cursor inference, and kinetic polish.

> **Hackathon Disclosure**: This project was developed for a Rust hackathon. Initial scaffolding and boilerplate were generated with AI assistance. Core logic and architecture decisions were human-directed.

## Features

- 🎥 **Screen & Tab Capture** - Record your screen, window, or browser tab
- 📷 **Camera Overlay** - Picture-in-picture webcam recording
- 🎯 **Manual Zoom Markers** - Click or press 'Z' to mark zoom points during recording
- 🦀 **Rust/WASM Core** - High-performance video processing engine
- ⏱️ **Timeline Editor** - Adjust zoom keyframes with easing curves
- 🔄 **Tab Mode** - Chrome extension captures cursor, clicks, focus for best auto-zoom

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                   Rust/WASM Engine (engine_core)                    │
│  Cursor tracking, focus regions, camera keyframes, effect tracks   │
└─────────────────────────────────────────────────────────────────────┘
          ↑                                           ↑
┌─────────────────────────────┐       ┌──────────────────────────────┐
│   Chrome Extension (MV3)    │       │      Web App (React)         │
│  Tab capture + signals      │       │  Editor + Timeline           │
└─────────────────────────────┘       └──────────────────────────────┘
```

## Quick Start

### Web App

```bash
# Build the Rust engine
cd engine_core
wasm-pack build --target web

# Run the web app
cd ../web
npm install
npm run dev
```

Open http://localhost:5173

### Chrome Extension

1. Open Chrome → `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" → select the `extension/` folder
4. Click the ScreenMu icon to start recording

## Project Structure

```
screenmu-web/
├── engine_core/          # 🦀 Rust/WASM engine
│   ├── src/
│   │   ├── lib.rs        # WASM exports
│   │   ├── types.rs      # Newtypes & enums
│   │   ├── cursor.rs     # Cursor tracking
│   │   ├── focus.rs      # Focus region detection
│   │   ├── camera.rs     # Keyframe generation
│   │   └── effects.rs    # Click rings, highlights
│   └── pkg/              # Built WASM output
│
├── web/                  # React web app
│   └── src/
│       ├── views/        # RecordView, EditView
│       ├── components/   # Timeline
│       └── hooks/        # useWasmEngine, useCapture
│
├── extension/            # Chrome extension (MV3)
│   ├── manifest.json
│   ├── src/
│   │   ├── background.js # Service worker
│   │   ├── content.js    # Tab Mode signals
│   │   └── offscreen.js  # MediaRecorder
│   └── popup.html
│
└── steering.md           # Project guidelines
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Core Engine | Rust → WebAssembly |
| Web App | React + TypeScript + Vite |
| Extension | Chrome Extension Manifest V3 |
| Video | MediaRecorder, WebCodecs |
| Styling | CSS (custom design system) |

## Development

### Rust Engine

```bash
cd engine_core
cargo fmt
cargo clippy --all --tests --all-features
cargo test
wasm-pack build --target web
```

### Web App

```bash
cd web
npm run dev      # Development
npm run build    # Production build
```

## Guidelines

See [steering.md](steering.md) for project conventions:
- Zero `unwrap()`/`expect()` in Rust
- Newtypes for Timestamp, FrameIndex, PixelCoord
- No `any` or `as` casting in TypeScript
- Typed message passing between components
- Heavy work in workers/WASM

## License

MIT
