// Strong typing over strings. Newtypes for timestamps, frame indices, and pixel units.
// See steering.md: Rust Rules (Engine)

use serde::{Deserialize, Serialize};

/// Timestamp in microseconds. Newtype for type safety.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, Default)]
pub struct Timestamp(u64);

impl Timestamp {
    pub fn from_micros(us: u64) -> Self {
        Timestamp(us)
    }

    pub fn as_micros(&self) -> u64 {
        self.0
    }

    pub fn as_millis(&self) -> f64 {
        self.0 as f64 / 1000.0
    }

    pub fn as_secs(&self) -> f64 {
        self.0 as f64 / 1_000_000.0
    }
}

/// Frame index. Newtype for type safety.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, Default)]
pub struct FrameIndex(u32);

impl FrameIndex {
    pub fn new(index: u32) -> Self {
        FrameIndex(index)
    }

    pub fn as_u32(&self) -> u32 {
        self.0
    }
}

/// Pixel coordinate (absolute, in source resolution).
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, Default)]
pub struct PixelCoord {
    pub x: u32,
    pub y: u32,
}

impl PixelCoord {
    pub fn new(x: u32, y: u32) -> Self {
        PixelCoord { x, y }
    }
}

/// Normalized coordinate (0.0 to 1.0, resolution-independent).
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, Default)]
pub struct NormalizedCoord {
    pub x: f32,
    pub y: f32,
}

impl NormalizedCoord {
    pub fn new(x: f32, y: f32) -> Self {
        NormalizedCoord {
            x: x.clamp(0.0, 1.0),
            y: y.clamp(0.0, 1.0),
        }
    }

    pub fn center() -> Self {
        NormalizedCoord { x: 0.5, y: 0.5 }
    }
}

/// Capture mode determines signal quality tier.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CaptureMode {
    /// Tier A: Browser tab with content script signals (best quality).
    Tab,
    /// Tier B: Screen/window capture without cursor telemetry.
    Screen,
    /// Tier B: Window capture without cursor telemetry.
    Window,
}

/// Cursor visibility/inference state.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CursorState {
    /// Cursor position is known from real input (Tab Mode).
    Visible,
    /// Cursor is not visible or outside capture area.
    Hidden,
    /// Cursor position was inferred from video analysis.
    Inferred,
}

/// Reason for an inference decision (for debugging, analysis).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum InferenceReason {
    /// Direct input from Tab Mode content script.
    DirectInput,
    /// Detected cursor shape in video frame.
    CursorDetection { confidence: u8 },
    /// Motion-based tracking from previous position.
    MotionTracking,
    /// UI element change detection (menu opened, modal appeared).
    UiChange,
    /// Fallback to saliency-based focus.
    SaliencyFallback,
}

/// Engine configuration passed from JS.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineConfig {
    pub capture_mode: CaptureMode,
    #[serde(default)]
    pub camera_settings: CameraSettings,
    #[serde(default)]
    pub effect_settings: EffectSettings,
}

/// Camera behavior settings.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CameraSettings {
    /// Minimum time to hold a zoom before moving (microseconds).
    #[serde(default = "default_min_hold_time")]
    pub min_hold_time_us: u64,
    /// Maximum pan speed (normalized units per second).
    #[serde(default = "default_max_pan_speed")]
    pub max_pan_speed: f32,
    /// Dead zone radius (normalized). No movement if target is within this radius.
    #[serde(default = "default_dead_zone")]
    pub dead_zone: f32,
    /// Zoom strength multiplier.
    #[serde(default = "default_zoom_strength")]
    pub zoom_strength: f32,
}

fn default_min_hold_time() -> u64 {
    500_000 // 500ms
}

fn default_max_pan_speed() -> f32 {
    0.5
}

fn default_dead_zone() -> f32 {
    0.05
}

fn default_zoom_strength() -> f32 {
    1.5
}

/// Effect generation settings.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct EffectSettings {
    /// Enable click ring effect.
    #[serde(default = "default_true")]
    pub click_rings: bool,
    /// Enable cursor highlight.
    #[serde(default = "default_true")]
    pub cursor_highlight: bool,
}

fn default_true() -> bool {
    true
}

/// Batch of input signals from JS (minimizes JS↔WASM crossings).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignalBatch {
    pub events: Vec<InputEvent>,
}

/// Single input event from capture.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InputEvent {
    pub timestamp: Timestamp,
    pub event_type: EventType,
}

/// Type of input event.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum EventType {
    /// Mouse move (Tab Mode).
    MouseMove { position: NormalizedCoord },
    /// Mouse click (Tab Mode).
    MouseClick {
        position: NormalizedCoord,
        button: u8,
    },
    /// Focused element changed (Tab Mode).
    FocusChange { bounds: NormalizedRect },
    /// Scroll event (Tab Mode).
    Scroll { delta_y: f32 },
    /// Frame captured (for Desktop Mode analysis).
    FrameCaptured { frame_index: FrameIndex },
}

/// Normalized rectangle (0-1 coordinates).
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, Default)]
pub struct NormalizedRect {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

impl NormalizedRect {
    pub fn new(x: f32, y: f32, width: f32, height: f32) -> Self {
        NormalizedRect {
            x,
            y,
            width,
            height,
        }
    }

    pub fn center(&self) -> NormalizedCoord {
        NormalizedCoord::new(self.x + self.width / 2.0, self.y + self.height / 2.0)
    }
}

/// A point on the cursor track with confidence.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CursorTrackPoint {
    pub timestamp: Timestamp,
    pub position: NormalizedCoord,
    pub state: CursorState,
    pub confidence: u8, // 0-100
    pub reason: InferenceReason,
}

/// A detected focus region.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FocusRegion {
    pub timestamp: Timestamp,
    pub bounds: NormalizedRect,
    pub importance: f32, // 0.0-1.0
}

/// Camera keyframe for zoom/pan.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CameraKeyframe {
    pub timestamp: Timestamp,
    pub viewport: Viewport,
    pub easing: EasingType,
}

/// Viewport definition (what the camera shows).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Viewport {
    pub center: NormalizedCoord,
    pub zoom: f32, // 1.0 = no zoom, 2.0 = 2x zoom
}

impl Default for Viewport {
    fn default() -> Self {
        Viewport {
            center: NormalizedCoord::center(),
            zoom: 1.0,
        }
    }
}

/// Easing function for camera transitions.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum EasingType {
    Linear,
    EaseOut,
    EaseInOut,
    Spring,
}

/// Effect track (click rings, highlights).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EffectTrack {
    pub effects: Vec<Effect>,
}

/// Single effect instance.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Effect {
    pub timestamp: Timestamp,
    pub duration_us: u64,
    pub effect_type: EffectType,
    pub position: NormalizedCoord,
}

/// Type of visual effect.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EffectType {
    ClickRing,
    CursorHighlight,
}

/// Complete analysis result returned to JS.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisResult {
    pub cursor_track: Vec<CursorTrackPoint>,
    pub focus_regions: Vec<FocusRegion>,
    pub camera_keyframes: Vec<CameraKeyframe>,
    pub effect_tracks: EffectTrack,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn timestamp_conversions() {
        let ts = Timestamp::from_micros(1_500_000);
        assert_eq!(ts.as_micros(), 1_500_000);
        assert!((ts.as_secs() - 1.5).abs() < 0.0001);
    }

    #[test]
    fn normalized_coord_clamps() {
        let coord = NormalizedCoord::new(1.5, -0.5);
        assert_eq!(coord.x, 1.0);
        assert_eq!(coord.y, 0.0);
    }
}
