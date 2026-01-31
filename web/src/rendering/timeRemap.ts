// Time remapping utilities for cuts and speed ramps
// Wraps the WASM TimeRemapper for use in TypeScript
// LLM Disclosure: This file was generated with AI assistance.
// See steering.md: TypeScript Rules - No any, no type casting with as.

import type { TimeRange, SpeedRamp } from '../types';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for creating a TimeRemapper.
 * Matches the JSON structure expected by WasmTimeRemapper.
 */
export interface TimeRemapperConfig {
  /** Cut segments to remove from the export */
  cuts: TimeRangeConfig[];
  /** Speed ramp segments */
  speed_ramps: SpeedRampConfig[];
  /** In point (start of export) in microseconds */
  in_point_us: number;
  /** Out point (end of export) in microseconds */
  out_point_us: number;
}

/**
 * JSON-friendly time range configuration for WASM.
 */
export interface TimeRangeConfig {
  /** Start time in microseconds */
  start_us: number;
  /** End time in microseconds */
  end_us: number;
}

/**
 * JSON-friendly speed ramp configuration for WASM.
 */
export interface SpeedRampConfig {
  /** Start time in microseconds */
  start_us: number;
  /** End time in microseconds */
  end_us: number;
  /** Speed multiplier (0.25 to 4.0) */
  speed: number;
}

/**
 * Result of frame timestamp generation with time remapping.
 * Contains both source timestamps (for seeking video) and export timestamps (for output).
 */
export interface RemappedFrameTimestampResult {
  /** Array of source timestamps in microseconds (for seeking to source video) */
  sourceTimestamps: number[];
  /** Array of export timestamps in microseconds (starting from 0 for output) */
  exportTimestamps: number[];
  /** Total number of frames to render */
  frameCount: number;
  /** Interval between frames in microseconds */
  frameInterval: number;
  /** Total export duration in microseconds (after cuts and speed ramps) */
  exportDuration: number;
}

// ============================================================================
// Configuration Conversion
// ============================================================================

/**
 * Converts TypeScript TimeRange to WASM-compatible TimeRangeConfig.
 * 
 * @param range - TypeScript TimeRange
 * @returns WASM-compatible TimeRangeConfig
 */
export function toTimeRangeConfig(range: TimeRange): TimeRangeConfig {
  return {
    start_us: range.start,
    end_us: range.end,
  };
}

/**
 * Converts TypeScript SpeedRamp to WASM-compatible SpeedRampConfig.
 * 
 * @param ramp - TypeScript SpeedRamp
 * @returns WASM-compatible SpeedRampConfig
 */
export function toSpeedRampConfig(ramp: SpeedRamp): SpeedRampConfig {
  return {
    start_us: ramp.range.start,
    end_us: ramp.range.end,
    speed: ramp.speed,
  };
}

/**
 * Creates a TimeRemapperConfig from TypeScript types.
 * This config can be serialized to JSON and passed to WasmTimeRemapper.
 * 
 * @param inPoint - Start trim point in microseconds
 * @param outPoint - End trim point in microseconds
 * @param cuts - Array of cut segments
 * @param speedRamps - Array of speed ramp segments
 * @returns TimeRemapperConfig for WASM
 * 
 * Validates: Requirements 4.5, 4.8
 */
export function createTimeRemapperConfig(
  inPoint: number,
  outPoint: number,
  cuts: TimeRange[] = [],
  speedRamps: SpeedRamp[] = []
): TimeRemapperConfig {
  return {
    cuts: cuts.map(toTimeRangeConfig),
    speed_ramps: speedRamps.map(toSpeedRampConfig),
    in_point_us: inPoint,
    out_point_us: outPoint,
  };
}

/**
 * Serializes a TimeRemapperConfig to JSON string for WASM.
 * 
 * @param config - TimeRemapperConfig
 * @returns JSON string
 */
export function serializeTimeRemapperConfig(config: TimeRemapperConfig): string {
  return JSON.stringify(config);
}

// ============================================================================
// Pure TypeScript Time Remapping (for preview without WASM)
// ============================================================================

/**
 * Calculates the export duration accounting for cuts and speed ramps.
 * This is a pure TypeScript implementation for use in preview without WASM.
 * 
 * @param inPoint - Start trim point in microseconds
 * @param outPoint - End trim point in microseconds
 * @param cuts - Array of cut segments
 * @param speedRamps - Array of speed ramp segments
 * @returns Export duration in microseconds
 * 
 * Validates: Requirements 4.5, 4.8
 */
export function calculateExportDuration(
  inPoint: number,
  outPoint: number,
  cuts: TimeRange[] = [],
  speedRamps: SpeedRamp[] = []
): number {
  if (outPoint <= inPoint) {
    return 0;
  }

  // Sort cuts and speed ramps by start time
  const sortedCuts = [...cuts].sort((a, b) => a.start - b.start);
  const sortedRamps = [...speedRamps].sort((a, b) => a.range.start - b.range.start);

  let exportDuration = 0;
  let sourceTime = inPoint;

  while (sourceTime < outPoint) {
    // Check if we're in a cut region
    const cut = sortedCuts.find(c => sourceTime >= c.start && sourceTime < c.end);
    if (cut) {
      // Skip to end of cut
      sourceTime = Math.min(cut.end, outPoint);
      continue;
    }

    // Find the next boundary (cut start, speed ramp boundary, or out_point)
    let nextBoundary = outPoint;

    // Check cut starts
    for (const c of sortedCuts) {
      if (c.start > sourceTime && c.start < nextBoundary) {
        nextBoundary = c.start;
      }
    }

    // Check speed ramp boundaries
    for (const r of sortedRamps) {
      if (r.range.start > sourceTime && r.range.start < nextBoundary) {
        nextBoundary = r.range.start;
      }
      if (r.range.end > sourceTime && r.range.end < nextBoundary) {
        nextBoundary = r.range.end;
      }
    }

    const segmentSourceDuration = nextBoundary - sourceTime;

    // Get speed at this source time
    const ramp = sortedRamps.find(r => sourceTime >= r.range.start && sourceTime < r.range.end);
    const speed = ramp ? ramp.speed : 1.0;

    // Export duration for this segment = source duration / speed
    const segmentExportDuration = Math.round(segmentSourceDuration / speed);
    exportDuration += segmentExportDuration;

    sourceTime = nextBoundary;
  }

  return exportDuration;
}

/**
 * Maps an export timestamp to a source timestamp.
 * This is a pure TypeScript implementation for use in preview without WASM.
 * 
 * @param exportTime - Export timestamp in microseconds
 * @param inPoint - Start trim point in microseconds
 * @param outPoint - End trim point in microseconds
 * @param cuts - Array of cut segments
 * @param speedRamps - Array of speed ramp segments
 * @returns Source timestamp in microseconds
 * 
 * Validates: Requirements 4.5, 4.8
 */
export function toSourceTime(
  exportTime: number,
  inPoint: number,
  outPoint: number,
  cuts: TimeRange[] = [],
  speedRamps: SpeedRamp[] = []
): number {
  if (exportTime <= 0) {
    // Skip any cuts at the beginning
    return skipCutsForward(inPoint, cuts, outPoint);
  }

  // Sort cuts and speed ramps by start time
  const sortedCuts = [...cuts].sort((a, b) => a.start - b.start);
  const sortedRamps = [...speedRamps].sort((a, b) => a.range.start - b.range.start);

  let sourceTime = skipCutsForward(inPoint, sortedCuts, outPoint);
  let remainingExportTime = exportTime;

  while (remainingExportTime > 0 && sourceTime < outPoint) {
    // Find the next boundary (cut start, speed ramp boundary, or out_point)
    let nextBoundary = outPoint;

    // Check cut starts
    for (const c of sortedCuts) {
      if (c.start > sourceTime && c.start < nextBoundary) {
        nextBoundary = c.start;
      }
    }

    // Check speed ramp boundaries
    for (const r of sortedRamps) {
      if (r.range.start > sourceTime && r.range.start < nextBoundary) {
        nextBoundary = r.range.start;
      }
      if (r.range.end > sourceTime && r.range.end < nextBoundary) {
        nextBoundary = r.range.end;
      }
    }

    const segmentSourceDuration = nextBoundary - sourceTime;

    // Get speed at this source time
    const ramp = sortedRamps.find(r => sourceTime >= r.range.start && sourceTime < r.range.end);
    const speed = ramp ? ramp.speed : 1.0;

    // Calculate export duration for this segment
    const segmentExportDuration = Math.round(segmentSourceDuration / speed);

    if (remainingExportTime < segmentExportDuration) {
      // The target is within this segment
      // source_offset = export_offset * speed
      const sourceOffset = Math.round(remainingExportTime * speed);
      sourceTime += sourceOffset;
      remainingExportTime = 0;
    } else {
      // Move past this segment
      remainingExportTime -= segmentExportDuration;
      sourceTime = nextBoundary;

      // Skip any cuts at the new position
      sourceTime = skipCutsForward(sourceTime, sortedCuts, outPoint);
    }
  }

  // Ensure we don't exceed out_point
  return Math.min(sourceTime, outPoint);
}

/**
 * Skips forward past any cut regions starting from the given timestamp.
 * 
 * @param timestamp - Starting timestamp in microseconds
 * @param cuts - Array of cut segments (should be sorted by start time)
 * @param outPoint - Maximum timestamp to return
 * @returns Timestamp after skipping cuts
 */
function skipCutsForward(
  timestamp: number,
  cuts: TimeRange[],
  outPoint: number
): number {
  let current = timestamp;

  // Keep skipping while we're in a cut
  let foundCut = true;
  while (foundCut) {
    foundCut = false;
    for (const cut of cuts) {
      if (current >= cut.start && current < cut.end) {
        current = cut.end;
        foundCut = true;
        break;
      }
    }
  }

  return Math.min(current, outPoint);
}

/**
 * Gets the playback speed at a source timestamp.
 * 
 * @param sourceTime - Source timestamp in microseconds
 * @param speedRamps - Array of speed ramp segments
 * @returns Speed multiplier (1.0 if no speed ramp is active)
 * 
 * Validates: Requirements 4.5, 4.8
 */
export function getSpeedAt(
  sourceTime: number,
  speedRamps: SpeedRamp[] = []
): number {
  for (const ramp of speedRamps) {
    if (sourceTime >= ramp.range.start && sourceTime < ramp.range.end) {
      return ramp.speed;
    }
  }
  return 1.0;
}

/**
 * Checks if a source timestamp is within a cut region.
 * 
 * @param sourceTime - Source timestamp in microseconds
 * @param cuts - Array of cut segments
 * @returns true if the timestamp is within a cut region
 */
export function isCut(
  sourceTime: number,
  cuts: TimeRange[] = []
): boolean {
  for (const cut of cuts) {
    if (sourceTime >= cut.start && sourceTime < cut.end) {
      return true;
    }
  }
  return false;
}

// ============================================================================
// Audio Handling During Speed Ramps
// ============================================================================

/**
 * Maximum playback speed at which audio remains audible.
 * Audio is muted above this threshold to prevent distorted/chipmunk audio.
 * Validates: Requirement 4.6 - WHEN audio is sped up beyond 2x, THE system SHALL optionally mute the audio
 */
export const AUDIO_MUTE_SPEED_THRESHOLD = 2.0;

/**
 * Determines whether audio should be muted based on the current playback speed.
 * Audio is muted at speeds > 2x to prevent distorted audio.
 * 
 * @param speed - Current playback speed multiplier
 * @returns true if audio should be muted, false otherwise
 * 
 * Validates: Requirement 4.6 - WHEN audio is sped up beyond 2x, THE system SHALL optionally mute the audio
 */
export function shouldMuteAudioAtSpeed(speed: number): boolean {
  return speed > AUDIO_MUTE_SPEED_THRESHOLD;
}

/**
 * Gets the appropriate audio playback rate for a given speed.
 * Returns the speed if <= 2x (audio plays at adjusted rate), or 1.0 if > 2x (audio will be muted anyway).
 * 
 * @param speed - Current playback speed multiplier
 * @returns Audio playback rate to use
 * 
 * Validates: Requirement 4.6
 */
export function getAudioPlaybackRate(speed: number): number {
  // If audio will be muted (speed > 2x), return 1.0 as the rate doesn't matter
  if (shouldMuteAudioAtSpeed(speed)) {
    return 1.0;
  }
  // For speeds <= 2x, use the actual speed for pitch-shifted playback
  return speed;
}

/**
 * Determines the audio state for a given source timestamp based on speed ramps.
 * Returns an object with muted state and playback rate.
 * 
 * @param sourceTime - Source timestamp in microseconds
 * @param speedRamps - Array of speed ramp segments
 * @returns Object with muted boolean and playbackRate number
 * 
 * Validates: Requirement 4.6 - WHEN audio is sped up beyond 2x, THE system SHALL optionally mute the audio
 */
export function getAudioStateAtTime(
  sourceTime: number,
  speedRamps: SpeedRamp[] = []
): { muted: boolean; playbackRate: number } {
  const speed = getSpeedAt(sourceTime, speedRamps);
  const muted = shouldMuteAudioAtSpeed(speed);
  const playbackRate = getAudioPlaybackRate(speed);
  
  return { muted, playbackRate };
}

// ============================================================================
// Frame Timestamp Generation with Time Remapping
// ============================================================================

/** Microseconds per second constant */
const MICROSECONDS_PER_SECOND = 1_000_000;

/** Default export framerate in frames per second */
const DEFAULT_EXPORT_FPS = 30;

/**
 * Generates frame timestamps for export with full time remapping support.
 * Accounts for trim points, cuts, and speed ramps.
 * 
 * For each frame in the export:
 * - exportTimestamp: the timestamp in the output video (starting from 0)
 * - sourceTimestamp: the corresponding timestamp in the source video
 * 
 * @param inPoint - Start trim point in microseconds
 * @param outPoint - End trim point in microseconds
 * @param cuts - Array of cut segments
 * @param speedRamps - Array of speed ramp segments
 * @param fps - Target frames per second (default: 30)
 * @returns Object containing source timestamps, export timestamps, frame count, and export duration
 * 
 * Validates: Requirements 2.5, 3.5, 4.5, 4.8
 */
export function generateFrameTimestampsWithRemap(
  inPoint: number,
  outPoint: number,
  cuts: TimeRange[] = [],
  speedRamps: SpeedRamp[] = [],
  fps: number = DEFAULT_EXPORT_FPS
): RemappedFrameTimestampResult {
  // Validate inputs
  if (!Number.isFinite(inPoint) || !Number.isFinite(outPoint)) {
    return {
      sourceTimestamps: [],
      exportTimestamps: [],
      frameCount: 0,
      frameInterval: 0,
      exportDuration: 0,
    };
  }

  if (inPoint < 0 || outPoint <= inPoint) {
    return {
      sourceTimestamps: [],
      exportTimestamps: [],
      frameCount: 0,
      frameInterval: 0,
      exportDuration: 0,
    };
  }

  if (!Number.isFinite(fps) || fps <= 0) {
    return {
      sourceTimestamps: [],
      exportTimestamps: [],
      frameCount: 0,
      frameInterval: 0,
      exportDuration: 0,
    };
  }

  // Calculate export duration accounting for cuts and speed ramps
  const exportDuration = calculateExportDuration(inPoint, outPoint, cuts, speedRamps);

  if (exportDuration <= 0) {
    return {
      sourceTimestamps: [],
      exportTimestamps: [],
      frameCount: 0,
      frameInterval: 0,
      exportDuration: 0,
    };
  }

  // Calculate frame interval in microseconds
  const frameInterval = MICROSECONDS_PER_SECOND / fps;

  // Calculate total frame count for export duration
  const frameCount = Math.ceil((exportDuration * fps) / MICROSECONDS_PER_SECOND);

  // Generate timestamps
  const sourceTimestamps: number[] = [];
  const exportTimestamps: number[] = [];

  for (let i = 0; i < frameCount; i++) {
    // Export timestamp starts at 0
    const exportTimestamp = i * frameInterval;

    // Ensure export timestamp doesn't exceed export duration
    if (exportTimestamp > exportDuration) {
      break;
    }

    // Map export timestamp to source timestamp
    const sourceTimestamp = toSourceTime(exportTimestamp, inPoint, outPoint, cuts, speedRamps);

    sourceTimestamps.push(sourceTimestamp);
    exportTimestamps.push(exportTimestamp);
  }

  return {
    sourceTimestamps,
    exportTimestamps,
    frameCount: sourceTimestamps.length,
    frameInterval,
    exportDuration,
  };
}
