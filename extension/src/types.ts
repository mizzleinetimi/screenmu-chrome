// Type definitions for Chrome Extension messaging
// See steering.md: TypeScript Rules - Typed message passing

// ============================================================================
// Content Script → Background messaging
// ============================================================================

/** Capture signal types from content script */
export type CaptureSignal =
    | { type: 'MOUSE_MOVE'; x: number; y: number; timestamp: number }
    | { type: 'MOUSE_CLICK'; x: number; y: number; button: number; timestamp: number }
    | { type: 'FOCUS_CHANGE'; bounds: DOMRect; timestamp: number }
    | { type: 'SCROLL'; deltaY: number; timestamp: number };

/** Messages from content script to background */
export type ContentToBackground =
    | { type: 'SIGNAL_BATCH'; signals: CaptureSignal[] }
    | { type: 'TAB_READY' };

// ============================================================================
// Background → Offscreen messaging
// ============================================================================

/** Messages from background to offscreen document */
export type BackgroundToOffscreen =
    | { type: 'START_RECORDING'; streamId: string }
    | { type: 'STOP_RECORDING' }
    | { type: 'PAUSE_RECORDING' }
    | { type: 'RESUME_RECORDING' };

/** Messages from offscreen to background */
export type OffscreenToBackground =
    | { type: 'RECORDING_STARTED' }
    | { type: 'RECORDING_STOPPED'; videoBlob: Blob }
    | { type: 'RECORDING_ERROR'; error: string };

// ============================================================================
// Popup → Background messaging
// ============================================================================

/** Messages from popup to background */
export type PopupToBackground =
    | { type: 'START_TAB_CAPTURE' }
    | { type: 'STOP_CAPTURE' }
    | { type: 'GET_STATUS' };

/** Messages from background to popup */
export type BackgroundToPopup =
    | { type: 'STATUS'; isRecording: boolean; duration: number }
    | { type: 'CAPTURE_STARTED' }
    | { type: 'CAPTURE_STOPPED' }
    | { type: 'ERROR'; message: string };

// ============================================================================
// Storage types
// ============================================================================

/** Stored recording data */
export interface StoredRecording {
    id: string;
    name: string;
    createdAt: number;
    duration: number;
    signals: CaptureSignal[];
    // Video data stored in IndexedDB separately
}
