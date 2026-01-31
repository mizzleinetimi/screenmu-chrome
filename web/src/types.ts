// Type definitions for ScreenMu Web App
// See steering.md: TypeScript Rules - No any, no type casting with as.

// ============================================================================
// Engine Types (mirror of Rust types)
// ============================================================================

/** Capture mode determines signal quality tier */
export type CaptureMode = 'Tab' | 'Screen' | 'Window';

/** Cursor visibility/inference state */
export type CursorState = 'Visible' | 'Hidden' | 'Inferred';

/** Easing function for camera transitions */
export type EasingType = 'Linear' | 'EaseOut' | 'EaseInOut' | 'Spring';

/** Normalized coordinate (0.0 to 1.0) */
export interface NormalizedCoord {
    x: number;
    y: number;
}

/** Normalized rectangle */
export interface NormalizedRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** Engine configuration */
export interface EngineConfig {
    capture_mode: CaptureMode;
    camera_settings?: CameraSettings;
    effect_settings?: EffectSettings;
}

/** Camera behavior settings */
export interface CameraSettings {
    min_hold_time_us?: number;
    max_pan_speed?: number;
    dead_zone?: number;
    zoom_strength?: number;
}

/** Effect generation settings */
export interface EffectSettings {
    click_rings?: boolean;
    cursor_highlight?: boolean;
}

/** Input event types */
export type EventType =
    | { type: 'MouseMove'; position: NormalizedCoord }
    | { type: 'MouseClick'; position: NormalizedCoord; button: number }
    | { type: 'FocusChange'; bounds: NormalizedRect }
    | { type: 'Scroll'; delta_y: number }
    | { type: 'FrameCaptured'; frame_index: number };

/** Single input event */
export interface InputEvent {
    timestamp: number; // microseconds
    event_type: EventType;
}

/** Batch of input signals */
export interface SignalBatch {
    events: InputEvent[];
}

/** Cursor track point */
export interface CursorTrackPoint {
    timestamp: number;
    position: NormalizedCoord;
    state: CursorState;
    confidence: number;
    reason: string;
}

/** Focus region */
export interface FocusRegion {
    timestamp: number;
    bounds: NormalizedRect;
    importance: number;
}

/** Viewport definition */
export interface Viewport {
    center: NormalizedCoord;
    zoom: number;
}

/** Camera keyframe */
export interface CameraKeyframe {
    timestamp: number;
    viewport: Viewport;
    easing: EasingType;
}

/** Effect instance */
export interface Effect {
    timestamp: number;
    duration_us: number;
    effect_type: 'ClickRing' | 'CursorHighlight';
    position: NormalizedCoord;
}

/** Effect track */
export interface EffectTrack {
    effects: Effect[];
}

/** Complete analysis result from engine */
export interface AnalysisResult {
    cursor_track: CursorTrackPoint[];
    focus_regions: FocusRegion[];
    camera_keyframes: CameraKeyframe[];
    effect_tracks: EffectTrack;
}

// ============================================================================
// App State Types
// ============================================================================

/** Recording state */
export type RecordingState = 'idle' | 'countdown' | 'recording' | 'paused' | 'stopped';

/** Project data */
export interface Project {
    id: string;
    name: string;
    createdAt: number;
    captureMode: CaptureMode;
    duration: number; // microseconds
    videoBlob?: Blob;
    audioBlob?: Blob;       // Microphone audio (optional)
    cameraBlob?: Blob;
    signals: SignalBatch;
    analysisResult?: AnalysisResult;
    editSettings: EditSettings;
}

/** Camera bubble shape options */
export type CameraBubbleShape = 'circle' | 'rounded-rect';

/** Edit settings */
export interface EditSettings {
    zoomStrength: number;
    padding: number;
    theme: 'light' | 'dark';
    clickRings: boolean;
    cursorHighlight: boolean;
    // Phase 2 additions
    backgroundGradient: string;  // Gradient preset ID
    screenCornerRadius: number;  // Default 12
    screenShadowEnabled: boolean;  // Default true
    screenShadowBlur: number;  // Default 32
    deviceFrame: 'none' | 'browser' | 'macbook';  // Default 'none' - Requirement 3.7
    // Camera bubble settings - Requirements 4.1, 4.3, 4.8
    cameraBubblePosition: NormalizedCoord;  // Center position (0-1)
    cameraBubbleSize: number;  // Diameter/width as fraction of canvas (0.1-0.4)
    cameraBubbleShape: CameraBubbleShape;  // Default 'circle'
    cameraBubbleBorderWidth: number;  // Default 3
    cameraBubbleBorderColor: string;  // Default '#ffffff'
    cameraBackgroundBlur: number;  // 0 = disabled, 1-20 = blur radius
    // Phase 3 additions - Trim functionality (Requirements 2.2, 2.3)
    inPoint: number;  // Start trim point in microseconds, default 0
    outPoint: number;  // End trim point in microseconds, default duration
    // Phase 3 additions - Cut segments (Requirement 3.1)
    cuts: TimeRange[];  // Array of cut segments (removed ranges)
    // Phase 3 additions - Speed ramps (Requirements 4.1, 4.2, 4.3)
    speedRamps: SpeedRamp[];  // Array of speed ramp segments
}

/** Time range for cut segments */
export interface TimeRange {
    /** Start time in microseconds */
    start: number;
    /** End time in microseconds */
    end: number;
}

/** Speed ramp segment for timeline speed changes */
export interface SpeedRamp {
    /** Time range for the speed ramp */
    range: TimeRange;
    /** Speed multiplier (0.25 to 4.0) */
    speed: number;
}

/** Zoom marker (manual marking) */
export interface ZoomMarker {
    id: string;
    timestamp: number; // microseconds
    position: NormalizedCoord;
    zoomLevel: number; // 1.0 = no zoom
}

/** Zoom segment - a time range where zoom is applied, then returns to normal */
export interface ZoomSegment {
    id: string;
    /** Start time of the zoom in microseconds */
    start: number;
    /** End time of the zoom in microseconds */
    end: number;
    /** Zoom level during this segment (1.0 = no zoom, 2.0 = 2x zoom) */
    zoomLevel: number;
    /** Center position for the zoom (normalized 0-1) */
    position: NormalizedCoord;
}

// ============================================================================
// Message Types (Extension ↔ Web App)
// ============================================================================

/** Messages from extension to web app */
export type ExtensionToWebMessage =
    | { type: 'RECORDING_STARTED'; captureMode: CaptureMode }
    | { type: 'RECORDING_STOPPED'; videoBlob: Blob; cameraBlob?: Blob }
    | { type: 'SIGNAL_BATCH'; signals: SignalBatch }
    | { type: 'ERROR'; message: string };

/** Messages from web app to extension */
export type WebToExtensionMessage =
    | { type: 'START_RECORDING'; captureMode: CaptureMode }
    | { type: 'STOP_RECORDING' }
    | { type: 'PAUSE_RECORDING' }
    | { type: 'RESUME_RECORDING' };
