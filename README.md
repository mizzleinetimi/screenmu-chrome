# ScreenMu

**#RustAfricaHackathon**

A Screen Studio-style screen recorder and editor for the web, built with a Rust/WASM core engine for auto-reframing, cursor inference, and cinematic polish.

> **Hackathon Disclosure**: This project was developed for the Rust Africa Hackathon. Initial scaffolding and boilerplate were generated with AI assistance. Core logic and architecture decisions were human-directed.

## ✨ Features

- 🎥 **Screen & Tab Capture** - Record your screen, window, or browser tab with high quality
- 📷 **Camera Overlay** - Picture-in-picture webcam recording with customizable bubble shape, size, and position
- 🎯 **Auto-Zoom & Cursor Following** - Intelligent zoom that follows your cursor with cinematic easing
- 🦀 **Rust/WASM Core** - High-performance video processing engine compiled to WebAssembly
- ⏱️ **Timeline Editor** - Trim, cut, and adjust zoom keyframes with smooth easing curves
- � **Cinematic Effects** - Click rings, smooth transitions, and professional-looking zoom animations
- 🔊 **Audio Recording** - Capture microphone audio synced with your screen recording
- 📤 **Export** - Export polished videos with all effects applied at consistent framerates
- � **Tab Mode** - Chrome extension captures cursor, clicks, and focus for best auto-zoom experience

## 🏗️ Architecture

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

## 🚀 Quick Start

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

## 📁 Project Structure

```
screenmu-web/
├── engine_core/          # 🦀 Rust/WASM engine
│   ├── src/
│   │   ├── lib.rs        # WASM exports
│   │   ├── types.rs      # Newtypes & enums
│   │   ├── cursor.rs     # Cursor tracking
│   │   ├── focus.rs      # Focus region detection
│   │   ├── camera.rs     # Keyframe generation
│   │   ├── effects.rs    # Click rings, highlights
│   │   └── time_remap.rs # Speed ramps & cuts
│   └── pkg/              # Built WASM output
│
├── web/                  # React web app
│   └── src/
│       ├── views/        # RecordView, EditView
│       ├── components/   # Timeline, TrimHandles, ZoomSegments
│       ├── rendering/    # Compositor, viewport, effects
│       ├── editing/      # UndoManager
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

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| Core Engine | Rust → WebAssembly |
| Web App | React + TypeScript + Vite |
| Extension | Chrome Extension Manifest V3 |
| Video | MediaRecorder, Canvas API |
| Testing | Vitest, Property-based testing |
| Styling | CSS (custom design system) |

## 💻 Development

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
npm run dev      # Development server
npm run build    # Production build
npm run test     # Run tests
```

## 📋 Guidelines

See [steering.md](steering.md) for project conventions:
- Zero `unwrap()`/`expect()` in Rust - use proper error handling
- Newtypes for Timestamp, FrameIndex, PixelCoord
- No `any` or `as` casting in TypeScript
- Typed message passing between components
- Heavy work in workers/WASM for performance

## 🎯 Key Features Implemented

- **Two-phase export rendering** - Pre-renders frames then encodes at fixed framerate for smooth playback
- **Cinematic zoom transitions** - Quintic easing for professional-looking zoom in/out
- **Cursor smoothing** - Gaussian-weighted averaging with momentum tracking
- **Camera bubble** - Customizable PiP overlay with circle/rounded-rect shapes
- **Timeline editing** - Trim handles, cut segments, zoom segments
- **Undo/Redo** - Full undo manager for editing operations

## � License

MIT

---

**#RustAfricaHackathon** | Built with 🦀 Rust + ⚛️ React
