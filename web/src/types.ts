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

/** Edit settings */
export interface EditSettings {
    zoomStrength: number;
    padding: number;
    theme: 'light' | 'dark';
    clickRings: boolean;
    cursorHighlight: boolean;
}

/** Zoom marker (manual marking) */
export interface ZoomMarker {
    id: string;
    timestamp: number; // microseconds
    position: NormalizedCoord;
    zoomLevel: number; // 1.0 = no zoom
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
