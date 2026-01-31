// Frame timing utilities for export rendering
// LLM Disclosure: This file was generated with AI assistance.
// See steering.md: TypeScript Rules - No any, no type casting with as.

// ============================================================================
// Constants
// ============================================================================

/** Default export framerate in frames per second */
export const DEFAULT_EXPORT_FPS = 30;

/** Maximum number of retry attempts for video seek operations */
export const MAX_SEEK_RETRIES = 3;

/** Base delay for exponential backoff in milliseconds */
export const BASE_RETRY_DELAY_MS = 100;

/** Microseconds per second constant */
const MICROSECONDS_PER_SECOND = 1_000_000;

// ============================================================================
// Frame Timestamp Generation
// ============================================================================

/**
 * Result of frame timestamp generation.
 */
export interface FrameTimestampResult {
  /** Array of frame timestamps in microseconds */
  timestamps: number[];
  /** Total number of frames to render */
  frameCount: number;
  /** Interval between frames in microseconds */
  frameInterval: number;
}

/**
 * Generates frame timestamps for export at the specified framerate.
 *
 * Property 6 (Frame Timestamp Generation):
 * For any video duration D (microseconds) and target FPS F:
 * - Count = ceil(D * F / 1_000_000)
 * - For each frame i in [0, Count): timestamp_i = i * (1_000_000 / F)
 * - All timestamps shall be <= D
 *
 * @param durationUs - Video duration in microseconds
 * @param fps - Target frames per second (default: 30)
 * @returns Object containing timestamps array, frame count, and frame interval
 *
 * Validates: Requirements 1.1, 1.5
 */
export function generateFrameTimestamps(
  durationUs: number,
  fps: number = DEFAULT_EXPORT_FPS
): FrameTimestampResult {
  // Validate inputs
  if (!Number.isFinite(durationUs) || durationUs < 0) {
    return {
      timestamps: [],
      frameCount: 0,
      frameInterval: 0,
    };
  }

  if (!Number.isFinite(fps) || fps <= 0) {
    return {
      timestamps: [],
      frameCount: 0,
      frameInterval: 0,
    };
  }

  // Calculate frame interval in microseconds
  const frameInterval = MICROSECONDS_PER_SECOND / fps;

  // Calculate total frame count: ceil(D * F / 1_000_000)
  const frameCount = Math.ceil((durationUs * fps) / MICROSECONDS_PER_SECOND);

  // Generate timestamps: timestamp_i = i * (1_000_000 / F)
  const timestamps: number[] = [];
  for (let i = 0; i < frameCount; i++) {
    const timestamp = i * frameInterval;
    // Ensure all timestamps are <= duration
    if (timestamp <= durationUs) {
      timestamps.push(timestamp);
    }
  }

  return {
    timestamps,
    frameCount: timestamps.length,
    frameInterval,
  };
}

// ============================================================================
// Trim-Aware Frame Timestamp Generation
// ============================================================================

/**
 * Result of trim-aware frame timestamp generation.
 * Contains both source timestamps (for seeking video) and export timestamps (for output).
 */
export interface TrimmedFrameTimestampResult {
  /** Array of source timestamps in microseconds (for seeking to source video) */
  sourceTimestamps: number[];
  /** Array of export timestamps in microseconds (starting from 0 for output) */
  exportTimestamps: number[];
  /** Total number of frames to render */
  frameCount: number;
  /** Interval between frames in microseconds */
  frameInterval: number;
  /** Trimmed duration in microseconds (outPoint - inPoint) */
  trimmedDuration: number;
}

/**
 * Generates frame timestamps for export respecting trim points.
 * 
 * Only generates timestamps between inPoint and outPoint.
 * Source timestamps are used for seeking the video.
 * Export timestamps start at 0 for the output video.
 *
 * @param inPoint - Start trim point in microseconds
 * @param outPoint - End trim point in microseconds
 * @param fps - Target frames per second (default: 30)
 * @returns Object containing source timestamps, export timestamps, frame count, and frame interval
 *
 * Validates: Requirement 2.5 - Export SHALL only include content between In_Point and Out_Point
 */
export function generateFrameTimestampsWithTrim(
  inPoint: number,
  outPoint: number,
  fps: number = DEFAULT_EXPORT_FPS
): TrimmedFrameTimestampResult {
  // Validate inputs
  if (!Number.isFinite(inPoint) || !Number.isFinite(outPoint)) {
    return {
      sourceTimestamps: [],
      exportTimestamps: [],
      frameCount: 0,
      frameInterval: 0,
      trimmedDuration: 0,
    };
  }

  if (inPoint < 0 || outPoint <= inPoint) {
    return {
      sourceTimestamps: [],
      exportTimestamps: [],
      frameCount: 0,
      frameInterval: 0,
      trimmedDuration: 0,
    };
  }

  if (!Number.isFinite(fps) || fps <= 0) {
    return {
      sourceTimestamps: [],
      exportTimestamps: [],
      frameCount: 0,
      frameInterval: 0,
      trimmedDuration: 0,
    };
  }

  // Calculate trimmed duration
  const trimmedDuration = outPoint - inPoint;

  // Calculate frame interval in microseconds
  const frameInterval = MICROSECONDS_PER_SECOND / fps;

  // Calculate total frame count for trimmed duration: ceil(trimmedDuration * F / 1_000_000)
  const frameCount = Math.ceil((trimmedDuration * fps) / MICROSECONDS_PER_SECOND);

  // Generate timestamps
  const sourceTimestamps: number[] = [];
  const exportTimestamps: number[] = [];

  for (let i = 0; i < frameCount; i++) {
    // Export timestamp starts at 0
    const exportTimestamp = i * frameInterval;
    
    // Source timestamp is offset by inPoint
    const sourceTimestamp = inPoint + exportTimestamp;
    
    // Ensure source timestamp doesn't exceed outPoint
    if (sourceTimestamp <= outPoint) {
      sourceTimestamps.push(sourceTimestamp);
      exportTimestamps.push(exportTimestamp);
    }
  }

  return {
    sourceTimestamps,
    exportTimestamps,
    frameCount: sourceTimestamps.length,
    frameInterval,
    trimmedDuration,
  };
}

/**
 * Calculates the expected frame count for a trimmed duration and FPS.
 * This is a convenience function for progress reporting with trim points.
 *
 * @param inPoint - Start trim point in microseconds
 * @param outPoint - End trim point in microseconds
 * @param fps - Target frames per second
 * @returns Expected number of frames
 *
 * Validates: Requirement 2.5
 */
export function calculateTrimmedFrameCount(
  inPoint: number,
  outPoint: number,
  fps: number = DEFAULT_EXPORT_FPS
): number {
  if (!Number.isFinite(inPoint) || !Number.isFinite(outPoint)) {
    return 0;
  }
  if (inPoint < 0 || outPoint <= inPoint) {
    return 0;
  }
  if (!Number.isFinite(fps) || fps <= 0) {
    return 0;
  }
  const trimmedDuration = outPoint - inPoint;
  return Math.ceil((trimmedDuration * fps) / MICROSECONDS_PER_SECOND);
}

/**
 * Calculates the expected frame count for a given duration and FPS.
 * This is a convenience function for progress reporting.
 *
 * @param durationUs - Video duration in microseconds
 * @param fps - Target frames per second
 * @returns Expected number of frames
 */
export function calculateFrameCount(
  durationUs: number,
  fps: number = DEFAULT_EXPORT_FPS
): number {
  if (!Number.isFinite(durationUs) || durationUs < 0) {
    return 0;
  }
  if (!Number.isFinite(fps) || fps <= 0) {
    return 0;
  }
  return Math.ceil((durationUs * fps) / MICROSECONDS_PER_SECOND);
}

/**
 * Converts a frame index to its timestamp in microseconds.
 *
 * @param frameIndex - Zero-based frame index
 * @param fps - Target frames per second
 * @returns Timestamp in microseconds
 */
export function frameIndexToTimestamp(
  frameIndex: number,
  fps: number = DEFAULT_EXPORT_FPS
): number {
  if (!Number.isFinite(frameIndex) || frameIndex < 0) {
    return 0;
  }
  if (!Number.isFinite(fps) || fps <= 0) {
    return 0;
  }
  return frameIndex * (MICROSECONDS_PER_SECOND / fps);
}

// ============================================================================
// Video Seek Utilities
// ============================================================================

/**
 * Result of a video seek operation.
 */
export interface VideoSeekResult {
  /** Whether the seek was successful */
  success: boolean;
  /** The actual timestamp the video seeked to (in seconds) */
  actualTime: number;
  /** Number of retry attempts made */
  attempts: number;
  /** Error message if seek failed */
  error?: string;
}

/**
 * Waits for a video element to seek to the specified timestamp with retry logic.
 *
 * Error handling for video seek:
 * - Retry up to 3 times with exponential backoff
 * - If still failing, returns failure result (caller should use last successfully rendered frame)
 * - Logs warning with timestamp on failure
 *
 * @param video - HTMLVideoElement to seek
 * @param timestampUs - Target timestamp in microseconds
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns Promise resolving to seek result
 *
 * Validates: Requirements 1.1, 1.5, 5.5
 */
export async function waitForVideoSeek(
  video: HTMLVideoElement,
  timestampUs: number,
  maxRetries: number = MAX_SEEK_RETRIES
): Promise<VideoSeekResult> {
  const targetTimeSeconds = timestampUs / MICROSECONDS_PER_SECOND;
  let attempts = 0;

  while (attempts < maxRetries) {
    attempts++;

    try {
      const seekResult = await attemptSeek(video, targetTimeSeconds);
      if (seekResult.success) {
        return {
          success: true,
          actualTime: video.currentTime,
          attempts,
        };
      }
    } catch (error) {
      // Continue to retry on error
    }

    // Exponential backoff before retry
    if (attempts < maxRetries) {
      const delayMs = BASE_RETRY_DELAY_MS * Math.pow(2, attempts - 1);
      await delay(delayMs);
    }
  }

  // All retries exhausted
  const errorMessage = `Video seek failed after ${maxRetries} attempts for timestamp ${timestampUs}us (${targetTimeSeconds.toFixed(3)}s)`;
  console.warn(errorMessage);

  return {
    success: false,
    actualTime: video.currentTime,
    attempts,
    error: errorMessage,
  };
}

/**
 * Attempts a single video seek operation.
 *
 * @param video - HTMLVideoElement to seek
 * @param targetTimeSeconds - Target time in seconds
 * @returns Promise resolving to success/failure
 */
function attemptSeek(
  video: HTMLVideoElement,
  targetTimeSeconds: number
): Promise<{ success: boolean }> {
  return new Promise((resolve) => {
    // Set up event listeners before seeking
    const onSeeked = (): void => {
      cleanup();
      resolve({ success: true });
    };

    const onError = (): void => {
      cleanup();
      resolve({ success: false });
    };

    const onTimeout = (): void => {
      cleanup();
      resolve({ success: false });
    };

    const cleanup = (): void => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      clearTimeout(timeoutId);
    };

    video.addEventListener('seeked', onSeeked, { once: true });
    video.addEventListener('error', onError, { once: true });

    // Timeout after 5 seconds
    const timeoutId = setTimeout(onTimeout, 5000);

    // Initiate seek
    video.currentTime = targetTimeSeconds;
  });
}

/**
 * Creates a promise that resolves after the specified delay.
 *
 * @param ms - Delay in milliseconds
 * @returns Promise that resolves after delay
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Export Progress Utilities
// ============================================================================

/**
 * Export progress information.
 */
export interface ExportProgress {
  /** Current frame being processed (0-indexed) */
  currentFrame: number;
  /** Total number of frames to process */
  totalFrames: number;
  /** Progress percentage (0-100) */
  percentage: number;
  /** Estimated time remaining in milliseconds (null if unknown) */
  estimatedRemainingMs: number | null;
}

/**
 * Calculates export progress information.
 *
 * @param currentFrame - Current frame index (0-indexed)
 * @param totalFrames - Total number of frames
 * @param elapsedMs - Elapsed time in milliseconds since export started
 * @returns Export progress information
 *
 * Validates: Requirement 5.4
 */
export function calculateExportProgress(
  currentFrame: number,
  totalFrames: number,
  elapsedMs: number
): ExportProgress {
  if (totalFrames <= 0) {
    return {
      currentFrame: 0,
      totalFrames: 0,
      percentage: 0,
      estimatedRemainingMs: null,
    };
  }

  const percentage = Math.min(100, (currentFrame / totalFrames) * 100);

  // Estimate remaining time based on current progress
  let estimatedRemainingMs: number | null = null;
  if (currentFrame > 0 && elapsedMs > 0) {
    const msPerFrame = elapsedMs / currentFrame;
    const remainingFrames = totalFrames - currentFrame;
    estimatedRemainingMs = Math.round(msPerFrame * remainingFrames);
  }

  return {
    currentFrame,
    totalFrames,
    percentage,
    estimatedRemainingMs,
  };
}
