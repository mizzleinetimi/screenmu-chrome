// engine_core: ScreenMu Rust/WASM Engine
// See steering.md for architecture rules. All "magic" lives here; JS is plumbing.
// LLM-assisted: initial scaffold generated with AI assistance per hackathon disclosure rules.

mod camera;
mod cursor;
mod effects;
mod error;
mod focus;
mod time_remap;
mod types;

use wasm_bindgen::prelude::*;

pub use camera::CameraEngine;
pub use cursor::CursorTracker;
pub use effects::EffectGenerator;
pub use error::EngineError;
pub use focus::FocusAnalyzer;
pub use time_remap::{SpeedRamp, TimeRange, TimeRemapper, WasmTimeRemapper};
pub use types::*;

/// Initialize panic hook for better error messages in browser console.
#[wasm_bindgen(start)]
pub fn init() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

/// Main engine interface exposed to JavaScript.
/// Batch interface to minimize JS↔WASM crossings.
#[wasm_bindgen]
pub struct Engine {
    cursor_tracker: CursorTracker,
    focus_analyzer: FocusAnalyzer,
    camera_engine: CameraEngine,
    effect_generator: EffectGenerator,
}

#[wasm_bindgen]
impl Engine {
    #[wasm_bindgen(constructor)]
    pub fn new(config_json: &str) -> Result<Engine, JsValue> {
        let config: EngineConfig = serde_json::from_str(config_json)
            .map_err(|e| JsValue::from_str(&format!("Invalid config: {}", e)))?;

        Ok(Engine {
            cursor_tracker: CursorTracker::new(config.capture_mode),
            focus_analyzer: FocusAnalyzer::new(),
            camera_engine: CameraEngine::new(config.camera_settings),
            effect_generator: EffectGenerator::new(config.effect_settings),
        })
    }

    /// Process a batch of input signals and return analysis results.
    /// This is the main entry point, designed as a batch call to reduce JS↔WASM overhead.
    pub fn process_signals(&mut self, signals_json: &str) -> Result<String, JsValue> {
        let signals: SignalBatch = serde_json::from_str(signals_json)
            .map_err(|e| JsValue::from_str(&format!("Invalid signals: {}", e)))?;

        let cursor_track = self.cursor_tracker.process(&signals);
        let focus_regions = self.focus_analyzer.analyze(&signals, &cursor_track);
        let keyframes = self
            .camera_engine
            .generate_keyframes(&cursor_track, &focus_regions);
        let effects = self.effect_generator.generate(&signals, &cursor_track);

        let result = AnalysisResult {
            cursor_track,
            focus_regions,
            camera_keyframes: keyframes,
            effect_tracks: effects,
        };

        serde_json::to_string(&result)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
    }

    /// Apply camera transform to get viewport for a given timestamp.
    /// Returns JSON with { x, y, width, height, zoom } normalized 0-1.
    pub fn get_viewport_at(&self, timestamp_us: u64) -> Result<String, JsValue> {
        let ts = Timestamp::from_micros(timestamp_us);
        let viewport = self.camera_engine.get_viewport_at(ts);

        serde_json::to_string(&viewport)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn engine_creation_works() {
        let config = r#"{"capture_mode":"Tab","camera_settings":{},"effect_settings":{}}"#;
        let engine = Engine::new(config);
        assert!(engine.is_ok());
    }
}
