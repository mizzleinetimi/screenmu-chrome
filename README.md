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
- 🎬 **Cinematic Effects** - Click rings, smooth transitions, and professional-looking zoom animations
- 🔊 **Audio Recording** - Capture microphone audio synced with your screen recording
- 📤 **Export** - Export polished videos with all effects applied at consistent framerates
- 🔄 **Tab Mode** - Chrome extension captures cursor, clicks, and focus for best auto-zoom experience

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

## 🚀 Running the App

### Prerequisites

- [Rust](https://rustup.rs/) (for building the WASM engine)
- [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/) (`cargo install wasm-pack`)
- [Node.js](https://nodejs.org/) (v18+ recommended)
- Chrome browser (for the extension)

### Step 1: Build the Rust/WASM Engine

```bash
cd engine_core
wasm-pack build --target web
```

This compiles the Rust code to WebAssembly and outputs to `engine_core/pkg/`.

### Step 2: Run the Web App

```bash
cd web
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

### Step 3: Install the Chrome Extension (Optional)

For the best experience with cursor tracking and auto-zoom:

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `extension/` folder from this project
5. Click the ScreenMu extension icon to start recording

### Usage

1. **Record**: Click "Start Recording" to capture your screen, camera, and microphone
2. **Edit**: After recording, use the timeline to trim, add zoom segments, and adjust effects
3. **Export**: Click "Export" to render your polished video

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
└── extension/            # Chrome extension (MV3)
    ├── manifest.json
    ├── src/
    │   ├── background.js # Service worker
    │   ├── content.js    # Tab Mode signals
    │   └── offscreen.js  # MediaRecorder
    └── popup.html
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
cargo fmt                              # Format code
cargo clippy --all --tests             # Lint
cargo test                             # Run tests
wasm-pack build --target web           # Build WASM
```

### Web App

```bash
cd web
npm run dev      # Development server
npm run build    # Production build
npm run test     # Run tests
```

## 🎯 Key Features

- **Two-phase export rendering** - Pre-renders frames then encodes at fixed framerate for smooth playback
- **Cinematic zoom transitions** - Quintic easing for professional-looking zoom in/out
- **Cursor smoothing** - Gaussian-weighted averaging with momentum tracking
- **Camera bubble** - Customizable PiP overlay with circle/rounded-rect shapes
- **Timeline editing** - Trim handles, cut segments, zoom segments
- **Undo/Redo** - Full undo manager for editing operations

## 📄 License

MIT

---

**#RustAfricaHackathon** | Built with 🦀 Rust + ⚛️ React
